import { describe, it, expect } from 'vitest';
import {
  calculateNetHours,
  calculateEffectiveHourlyRate,
  calculateExtraCostsTotal,
  calculateTravelTotal,
  calculateGrandTotal,
  isDateWeekend,
  normalizeDietType,
  estimateDiet,
  calculateVatAndTotal,
  PDP_STATUTORY_CLAUSE,
  formatCurrency,
  formatHours,
  calculateConsumableItemBilledPrice,
  calculateItemBilledPrice,
  calculateConsumableSlipTotals,
  calculateGrandTotalWithMaterials,
  formatActivityTagsForProtocol,
} from '../../src/services/pricingEngine';
import {
  czechAccountToIban,
  generateSpaydString,
  SpaydService,
} from '../../src/services/spaydService';
import {
  WeldingMethodService,
  BaseMaterialService,
  ShieldingGasService,
  FillerBatchService,
  TechnicalPassportService,
} from '../../src/services/weldingPassportService';
import {
  STANDARD_CONSUMABLES_CATALOG,
  CONSUMABLE_CATEGORIES,
  MANDATORY_ACTIVITY_CHIPS,
  toggleActivityChip,
} from '../../src/services/consumablesCatalog';
import { RatesConfig, WeldingPassport, ConsumableItem, ConsumableSlip, SpaydParams } from '../../src/types';

describe('Phase 2 Tier 5: Domain Compliance Adversarial Stress Test Suite', () => {

  const testRates: RatesConfig = {
    defaultWorkshopRate: 480,
    defaultSiteAssemblyRate: 620,
    defaultEmergencyRate: 850,
    defaultTravelOnlyRate: 350,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    dietHalfDayRate: 166,
    dietFullDayRate: 256,
    dietOver18Rate: 398,
    dietBand1Rate: 166,
    dietBand2Rate: 256,
    dietBand3Rate: 398,
    surcharges: {
      weekendPercent: 25,
      nightPercent: 20,
      holidayPercent: 50,
      fixedWeekendBonus: 120,
      fixedNightBonus: 100,
      fixedHolidayBonus: 250,
      useFixedBonus: false,
    },
  };

  // =========================================================================
  // SECTION 1: Czech Legislation & Pricing Engine Adversarial Tests
  // =========================================================================
  describe('1. Czech Legislation & Pricing Engine (§ 163/176 MPSV, § 92e PDP, Duration & Rounding)', () => {

    describe('1.1 Extreme Duration Boundaries around statutory MPSV thresholds (5.0h, 12.0h, 18.0h)', () => {
      it('verifies sub-second and epsilon transitions around 5.0h boundary', () => {
        // 5 hours minus 1 second (4.999722h)
        const fiveHoursMinusOneSec = 5 - (1 / 3600);
        const resBelow = estimateDiet(fiveHoursMinusOneSec, testRates);
        expect(resBelow.allowance).toBe(0);
        expect(resBelow.type).toBe('none');

        // Micro-epsilon below 5.0h
        expect(estimateDiet(4.9999999999, testRates).allowance).toBe(0);
        expect(estimateDiet(4.9999999999, testRates).type).toBe('none');

        // Exactly 5.0h (inclusive lower boundary of Band 1)
        const resExact = estimateDiet(5.0, testRates);
        expect(resExact.allowance).toBe(166);
        expect(resExact.type).toBe('band_1');

        // Micro-epsilon above 5.0h
        expect(estimateDiet(5.0000000001, testRates).allowance).toBe(166);
        expect(estimateDiet(5.0000000001, testRates).type).toBe('band_1');

        // 5 hours plus 1 second
        const fiveHoursPlusOneSec = 5 + (1 / 3600);
        expect(estimateDiet(fiveHoursPlusOneSec, testRates).allowance).toBe(166);
        expect(estimateDiet(fiveHoursPlusOneSec, testRates).type).toBe('band_1');
      });

      it('verifies sub-second and epsilon transitions around 12.0h boundary', () => {
        // 12 hours minus 1 second
        const twelveMinusOneSec = 12 - (1 / 3600);
        expect(estimateDiet(twelveMinusOneSec, testRates).allowance).toBe(166);
        expect(estimateDiet(twelveMinusOneSec, testRates).type).toBe('band_1');

        // Exactly 12.0h (statutory upper boundary of Band 1 inclusive)
        const resExact = estimateDiet(12.0, testRates);
        expect(resExact.allowance).toBe(166);
        expect(resExact.type).toBe('band_1');

        // Micro-epsilon above 12.0h (enters Band 2)
        const resAbove = estimateDiet(12.0000000001, testRates);
        expect(resAbove.allowance).toBe(256);
        expect(resAbove.type).toBe('band_2');

        // 12 hours plus 1 second
        const twelvePlusOneSec = 12 + (1 / 3600);
        expect(estimateDiet(twelvePlusOneSec, testRates).allowance).toBe(256);
        expect(estimateDiet(twelvePlusOneSec, testRates).type).toBe('band_2');
      });

      it('verifies sub-second and epsilon transitions around 18.0h boundary', () => {
        // 18 hours minus 1 second
        const eighteenMinusOneSec = 18 - (1 / 3600);
        expect(estimateDiet(eighteenMinusOneSec, testRates).allowance).toBe(256);
        expect(estimateDiet(eighteenMinusOneSec, testRates).type).toBe('band_2');

        // Exactly 18.0h (statutory upper boundary of Band 2 inclusive)
        const resExact = estimateDiet(18.0, testRates);
        expect(resExact.allowance).toBe(256);
        expect(resExact.type).toBe('band_2');

        // Micro-epsilon above 18.0h (enters Band 3)
        const resAbove = estimateDiet(18.0000000001, testRates);
        expect(resAbove.allowance).toBe(398);
        expect(resAbove.type).toBe('band_3');

        // 18 hours plus 1 second
        const eighteenPlusOneSec = 18 + (1 / 3600);
        expect(estimateDiet(eighteenPlusOneSec, testRates).allowance).toBe(398);
        expect(estimateDiet(eighteenPlusOneSec, testRates).type).toBe('band_3');
      });

      it('handles zero, negative, NaN, and 100+ hour shift durations safely', () => {
        // Zero duration
        expect(estimateDiet(0, testRates)).toEqual({
          allowance: 0,
          type: 'none',
          description: 'Bez nároku (< 5 h)',
        });

        // Negative duration (e.g. invalid arithmetic)
        expect(estimateDiet(-5, testRates)).toEqual({
          allowance: 0,
          type: 'none',
          description: 'Bez nároku (< 5 h)',
        });

        // NaN duration
        expect(estimateDiet(NaN, testRates)).toEqual({
          allowance: 0,
          type: 'none',
          description: 'Bez nároku (< 5 h)',
        });

        // Extreme 120-hour continuous offshore/assembly shift
        const resMarathon = estimateDiet(120, testRates);
        expect(resMarathon.allowance).toBe(398);
        expect(resMarathon.type).toBe('band_3');
      });

      it('correctly uses custom rates including explicit zero-allowance tiers', () => {
        const customRates: RatesConfig = {
          ...testRates,
          dietBand1Rate: 0, // client agreement: zero allowance for band 1
          dietBand2Rate: 300,
          dietBand3Rate: 500,
        };

        expect(estimateDiet(6.0, customRates).allowance).toBe(0);
        expect(estimateDiet(6.0, customRates).type).toBe('band_1');
        expect(estimateDiet(14.0, customRates).allowance).toBe(300);
        expect(estimateDiet(20.0, customRates).allowance).toBe(500);
      });
    });

    describe('1.2 Midnight Crossovers & Shift Net Hours Calculations', () => {
      it('calculates standard overnight shift across midnight (22:00 to 06:00)', () => {
        expect(calculateNetHours('22:00', '06:00', 30)).toBe(7.5);
        expect(calculateNetHours('22:00', '06:00', 0)).toBe(8.0);
      });

      it('calculates micro midnight transitions (23:59 to 00:01)', () => {
        // 2 minutes duration = 2/60 = 0.0333... rounded to 2 decimals -> 0.03 h
        expect(calculateNetHours('23:59', '00:01', 0)).toBe(0.03);
      });

      it('calculates near-full day span (00:00 to 23:59)', () => {
        // 1439 minutes = 23.9833... rounded -> 23.98 h
        expect(calculateNetHours('00:00', '23:59', 0)).toBe(23.98);
      });

      it('handles identical start and end time (08:00 to 08:00) safely as 0h', () => {
        expect(calculateNetHours('08:00', '08:00', 0)).toBe(0);
        expect(calculateNetHours('00:00', '00:00', 0)).toBe(0);
      });

      it('guards against excessive break minutes exceeding shift duration', () => {
        // Shift 08:00 to 12:00 = 240 minutes. Break = 300 minutes.
        expect(calculateNetHours('08:00', '12:00', 300)).toBe(0);
      });

      it('guards against negative break minutes', () => {
        // Negative break is clamped to 0
        expect(calculateNetHours('08:00', '12:00', -60)).toBe(4.0);
      });

      it('handles invalid time strings and malformed formatting safely', () => {
        expect(calculateNetHours('', '12:00', 0)).toBe(0);
        expect(calculateNetHours('08:00', '', 0)).toBe(0);
        expect(calculateNetHours('invalid', '12:00', 0)).toBe(0);
        expect(calculateNetHours('08:00', 'invalid', 0)).toBe(0);
        expect(calculateNetHours('null', 'undefined', 0)).toBe(0);
      });
    });

    describe('1.3 Manual Diet Override Interactions and Precedence', () => {
      it('preserves manual diet override in travel calculations regardless of shift duration', () => {
        // Under 5h shift (0h travel, 3h shift), automatic would be 0 Kč.
        // User sets manual override dietAllowance = 250 Kč.
        const travelCalc = calculateTravelTotal(100, 10, 0, 350, 250);
        // 100 km * 10 Kč = 1000 Kč + 250 Kč diet = 1250 Kč
        expect(travelCalc).toBe(1250);
      });

      it('allows manual diet override of exactly 0 Kč on high-duration shifts', () => {
        // 20h shift where company provided free full-board meals -> 0 Kč diet
        const travelCalc = calculateTravelTotal(50, 10, 2, 300, 0);
        // 500 + 600 + 0 = 1100 Kč
        expect(travelCalc).toBe(1100);
      });

      it('honors entry-level manualTotalOverride over all calculated labor, travel, and diets', () => {
        const entry = {
          totalHours: 10,
          pricing: {
            calculatedHourlyRate: 500,
            manualTotalOverride: 4500,
            isManualOverride: true,
          },
          travel: {
            distanceKm: 200,
            ratePerKm: 10,
            travelTimeHours: 3,
            travelHourlyRate: 350,
            dietAllowance: 256,
          },
          extraCosts: [{ id: '1', description: 'Parking', amount: 300 }],
        };

        expect(calculateGrandTotal(entry)).toBe(4500);
        expect(calculateGrandTotalWithMaterials(entry)).toBe(4500);
      });

      it('correctly falls back to full component sum when manual override is deactivated', () => {
        const entry = {
          totalHours: 10,
          pricing: {
            calculatedHourlyRate: 500,
            manualTotalOverride: 4500,
            isManualOverride: false, // inactive
          },
          travel: {
            distanceKm: 200, // 2000 Kč
            ratePerKm: 10,
            travelTimeHours: 2, // 700 Kč
            travelHourlyRate: 350,
            dietAllowance: 256, // 256 Kč
          },
          extraCosts: [{ id: '1', description: 'Parking', amount: 300 }],
        };

        // Labor: 10 * 500 = 5000 Kč
        // Travel: 2000 + 700 + 256 = 2956 Kč
        // Extra: 300 Kč
        // Total = 5000 + 2956 + 300 = 8256 Kč
        expect(calculateGrandTotal(entry)).toBe(8256);
      });
    });

    describe('1.4 § 92e PDP Mixed-Shift Documents & VAT Recalculation', () => {
      it('computes 0% VAT and generates exact statutory clause when isPdp is true', () => {
        const amount = 34567.89;
        const result = calculateVatAndTotal(amount, true, 21);

        expect(result.isPdp).toBe(true);
        expect(result.taxBase).toBe(34568);
        expect(result.vatRatePercent).toBe(0);
        expect(result.vatAmount).toBe(0);
        expect(result.totalWithVat).toBe(34568);
        expect(result.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
        expect(result.statutoryClause).toBe(
          'Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH'
        );
      });

      it('computes standard 21% VAT and leaves statutory clause undefined when isPdp is false', () => {
        const amount = 10000;
        const result = calculateVatAndTotal(amount, false, 21);

        expect(result.isPdp).toBe(false);
        expect(result.taxBase).toBe(10000);
        expect(result.vatRatePercent).toBe(21);
        expect(result.vatAmount).toBe(2100);
        expect(result.totalWithVat).toBe(12100);
        expect(result.statutoryClause).toBeUndefined();
      });

      it('correctly rounds VAT on fractional tax bases (Czech tax rounding)', () => {
        // Base 1234.50 -> rounds base to 1235 Kč
        // 1235 * 0.21 = 259.35 -> rounds VAT to 259 Kč
        // Total = 1235 + 259 = 1494 Kč
        const result = calculateVatAndTotal(1234.50, false, 21);
        expect(result.taxBase).toBe(1235);
        expect(result.vatAmount).toBe(259);
        expect(result.totalWithVat).toBe(1494);
      });
    });

    describe('1.5 Currency & Hours Formatting Helpers', () => {
      it('formats currency cleanly in Czech locale with no fractions', () => {
        const formatted = formatCurrency(12450);
        expect(formatted).toMatch(/12\s*450/);
        expect(formatted).toMatch(/Kč/);
      });

      it('formats hours with decimal Czech comma', () => {
        expect(formatHours(8.5)).toBe('8,5 h');
        expect(formatHours(0)).toBe('0,0 h');
        expect(formatHours(12.75)).toBe('12,8 h');
      });

      it('normalizes legacy and modern diet type strings', () => {
        expect(normalizeDietType('half_day')).toBe('band_1');
        expect(normalizeDietType('band_1')).toBe('band_1');
        expect(normalizeDietType('full_day')).toBe('band_2');
        expect(normalizeDietType('band_2')).toBe('band_2');
        expect(normalizeDietType('band_3')).toBe('band_3');
        expect(normalizeDietType('custom')).toBe('custom');
        expect(normalizeDietType('none')).toBe('none');
        expect(normalizeDietType('')).toBe('none');
        expect(normalizeDietType(undefined)).toBe('none');
      });
    });
  });

  // =========================================================================
  // SECTION 2: SPAYD 1.0 & ISO 7064 MOD-97 Czech Account Synthesizer
  // =========================================================================
  describe('2. SPAYD 1.0 & ISO 7064 MOD-97 Czech Account Synthesizer', () => {

    describe('2.1 Boundary Bank Account Permutations', () => {
      it('synthesizes boundary 2-digit account (minimum legal domestic account)', () => {
        // ČNB Decree: account minimum is 2 digits
        const iban = czechAccountToIban('01/0100');
        expect(iban).not.toBeNull();
        expect(iban).toHaveLength(24);
        expect(iban?.slice(0, 2)).toBe('CZ');
        expect(iban?.slice(4, 8)).toBe('0100');
        expect(iban?.slice(8, 14)).toBe('000000'); // prefix padded
        expect(iban?.slice(14)).toBe('0000000001'); // account padded to 10

        // Verify MOD-97 check
        const numeric = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
        expect(BigInt(numeric) % 97n).toBe(1n);
      });

      it('synthesizes boundary 10-digit account (maximum legal domestic account)', () => {
        const iban = czechAccountToIban('9999999999/2010');
        expect(iban).not.toBeNull();
        expect(iban).toHaveLength(24);
        expect(iban?.slice(14)).toBe('9999999999');

        const numeric = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
        expect(BigInt(numeric) % 97n).toBe(1n);
      });

      it('synthesizes boundary 1-digit prefix and 6-digit prefix', () => {
        // 1-digit prefix
        const iban1 = czechAccountToIban('1-1234567890/0800');
        expect(iban1).not.toBeNull();
        expect(iban1?.slice(8, 14)).toBe('000001');

        // 6-digit prefix
        const iban6 = czechAccountToIban('123456-1234567890/0800');
        expect(iban6).not.toBeNull();
        expect(iban6?.slice(8, 14)).toBe('123456');

        // Verify MOD-97 invariant for both
        expect(BigInt(`${iban1!.slice(4)}1235${iban1!.slice(2, 4)}`) % 97n).toBe(1n);
        expect(BigInt(`${iban6!.slice(4)}1235${iban6!.slice(2, 4)}`) % 97n).toBe(1n);
      });

      it('synthesizes prefix with leading zeros identical to short prefix', () => {
        const ibanShort = czechAccountToIban('19-2000145399/0800');
        const ibanPadded = czechAccountToIban('000019-2000145399/0800');
        expect(ibanShort).toBe(ibanPadded);
      });

      it('rejects illegal account formats (< 2 digits, > 10 digits, > 6 prefix digits, bad bank code)', () => {
        // 1 digit base account -> null
        expect(czechAccountToIban('1/0800')).toBeNull();

        // 11 digits base account -> null
        expect(czechAccountToIban('12345678901/0100')).toBeNull();

        // 7 digits prefix -> null
        expect(czechAccountToIban('1234567-1234567890/0800')).toBeNull();

        // 3 digits bank code -> null
        expect(czechAccountToIban('1234567890/100')).toBeNull();

        // 5 digits bank code -> null
        expect(czechAccountToIban('1234567890/01000')).toBeNull();

        // Missing bank code -> null
        expect(czechAccountToIban('1234567890')).toBeNull();
      });

      it('validates pre-existing valid Czech IBAN and rejects corrupt IBAN checksums', () => {
        const validIban = 'CZ6508000000192000145399';
        expect(czechAccountToIban(validIban)).toBe(validIban);
        expect(czechAccountToIban(validIban.toLowerCase())).toBe(validIban);

        // Corrupted checksum
        const corruptCheck = 'CZ9908000000192000145399';
        expect(czechAccountToIban(corruptCheck)).toBeNull();

        // Non-Czech IBAN
        expect(czechAccountToIban('SK3112000000001987426375')).toBeNull();
      });
    });

    describe('2.2 Boundary Amounts & Number Formats', () => {
      const defaultAcc = '19-2000145399/0800';

      it('formats large CZK amounts up to 999,999,999.99 CZK', () => {
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 999999999.99,
        });
        expect(spayd).not.toBeNull();
        expect(spayd).toContain('AM:999999999.99');
        expect(spayd).toContain('CC:CZK');
      });

      it('omits AM and CC parameters when amount is exactly zero (open-amount payment per ČBA SPAYD)', () => {
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 0,
        });
        expect(spayd).not.toBeNull();
        // Notice: check *AM: and *CC: specifically to avoid false-positive match against ACC:
        expect(spayd).not.toMatch(/\*AM:/);
        expect(spayd).not.toMatch(/\*CC:/);
        expect(spayd?.startsWith('SPD*1.0*ACC:')).toBe(true);
      });

      it('rejects negative amounts, NaN, and non-number types with null', () => {
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: -0.01 })).toBeNull();
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: -1000 })).toBeNull();
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: NaN })).toBeNull();
        // @ts-expect-error test runtime JS types
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: '100' })).toBeNull();
      });

      it('formats sub-cent and fractional amounts with exactly 2 decimal places using standard rounding', () => {
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: 1500.5 })).toContain('AM:1500.50');
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: 1500.554 })).toContain('AM:1500.55');
        expect(generateSpaydString({ accountOrIban: defaultAcc, amount: 1500.556 })).toContain('AM:1500.56');
      });
    });

    describe('2.3 Exotic Czech Diacritics Pangrams & Unicode Normalization', () => {
      const defaultAcc = '19-2000145399/0800';

      it('sanitizes full Czech pangram 1: "Příliš žluťoučký kůň úpěl ďábelské ódy na montáži"', () => {
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 500,
          message: 'Příliš žluťoučký kůň úpěl ďábelské ódy na montáži',
        });
        expect(spayd).not.toBeNull();
        expect(spayd).not.toMatch(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/);
        expect(spayd).toContain('MSG:Prilis zlutoucky kun upel dabelske ody na montazi');
      });

      it('sanitizes full Czech pangram 2 with exotic letters: "Nechť již hříšné saxofony ďáblů rozezvučí síň..."', () => {
        const pangram2 = 'Nechť již hříšné saxofony ďáblů rozezvučí síň';
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 500,
          message: pangram2,
        });
        expect(spayd).not.toBeNull();
        expect(spayd).toContain('MSG:Necht jiz hrisne saxofony dablu rozezvuci sin');
      });

      it('strips all Czech uppercase accented letters cleanly', () => {
        const uppercaseCzech = 'Č, Ř, Š, Ž, Ť, Ď, Ň, Á, É, Í, Ó, Ú, Ů, Ý';
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 100,
          message: uppercaseCzech,
        });
        expect(spayd).not.toBeNull();
        expect(spayd).toContain('MSG:C R S Z T D N A E I O U U Y');
      });
    });

    describe('2.4 Delimiter Injection & Parameter Hardening', () => {
      const defaultAcc = '19-2000145399/0800';

      it('neutralizes asterisk (*) delimiter injection in payment message', () => {
        const malicious = 'Platba*AM:1.00*ACC:CZ9999999999999999999999*';
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 2500,
          message: malicious,
        });
        expect(spayd).not.toBeNull();
        // The * characters in MSG are stripped to space
        expect(spayd).toContain('ACC:CZ6508000000192000145399');
        expect(spayd).toContain('AM:2500.00');
        expect(spayd).toContain('MSG:Platba AM 1.00 ACC CZ9999999999999999999999');
        // Count of ACC and AM parameters in the entire SPAYD string must be exactly 1
        expect((spayd?.match(/ACC:/g) || []).length).toBe(1);
        expect((spayd?.match(/AM:/g) || []).length).toBe(1);
      });

      it('sanitizes currency parameter and prevents delimiter injection vulnerability', () => {
        // When an adversarial caller attempts to inject delimiters through currency:
        const maliciousCurrency = 'CZK*AM:0.01' as any;
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 100,
          currency: maliciousCurrency,
        });
        // Hardened: currency is sanitized to strictly 3 alpha chars, delimiters stripped
        expect(spayd).toContain('*CC:CZK*');
        expect(spayd).not.toContain('*AM:0.01*');
        expect((spayd?.match(/AM:/g) || []).length).toBe(1);
      });

      it('neutralizes newlines, carriage returns, and HTML/script injection', () => {
        const attack = 'Invoice\n\r<script>alert("XSS")</script>; DROP TABLE';
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 100,
          message: attack,
        });
        expect(spayd).not.toBeNull();
        expect(spayd).not.toContain('\n');
        expect(spayd).not.toContain('\r');
        expect(spayd).not.toContain('<');
        expect(spayd).not.toContain('>');
        expect(spayd).not.toContain(';');
      });

      it('enforces boundaries on symbols and dates', () => {
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 100,
          variableSymbol: 'VS-2026/001-9999999999', // extra chars and excess length
          constantSymbol: 'KS030899', // extra chars and excess length
          specificSymbol: 'SS1234567890123',
          dueDate: '2026-12-31',
        });

        expect(spayd).toContain('X-VS:2026001999'); // max 10 digits
        expect(spayd).toContain('X-KS:0308'); // max 4 digits
        expect(spayd).toContain('X-SS:1234567890'); // max 10 digits
        expect(spayd).toContain('DT:20261231'); // 8 digits
      });

      it('validates strict ČBA SPAYD 1.0 format structure', () => {
        const spayd = generateSpaydString({
          accountOrIban: defaultAcc,
          amount: 1200,
          variableSymbol: '123456',
        });
        expect(spayd?.startsWith('SPD*1.0*')).toBe(true);
        expect(spayd?.endsWith('*')).toBe(true);

        const segments = spayd?.split('*');
        expect(segments?.[0]).toBe('SPD');
        expect(segments?.[1]).toBe('1.0');
        expect(segments?.[segments.length - 1]).toBe(''); // trailing delimiter creates empty end
      });
    });
  });

  // =========================================================================
  // SECTION 3: Welding Technical Passport & Normative Compliance
  // =========================================================================
  describe('3. Welding Technical Passport & Normative Compliance (ČSN EN 1090-2, ISO 4063, ISO 14175, EN 10204 3.1)', () => {

    describe('3.1 Exotic and Combined Welding Methods', () => {
      it('resolves combined TIG + MAG (141_135) across diverse notation permutations', () => {
        const permutations = [
          '141_135',
          '141/135',
          '141 / 135',
          '141-135',
          '141 - 135',
          '141+135',
          '141 + 135',
          'TIG/MAG',
          'tig/mag',
          '141/135 TIG+MAG',
          'COMBINED',
          'kombinace',
        ];

        for (const input of permutations) {
          const code = WeldingMethodService.normalizeMethodCode(input);
          expect(code).toBe('141_135');
          const method = WeldingMethodService.getMethod(input);
          expect(method).not.toBeNull();
          expect(method?.isMultiProcess).toBe(true);
          expect(method?.requiresWeldingPassport).toBe(true);
        }
      });

      it('resolves combined TIG + MMA (141_111) across diverse notation permutations', () => {
        const permutations = [
          '141_111',
          '141/111',
          '141 / 111',
          '141-111',
          '141 - 111',
          '141+111',
          '141 + 111',
          'TIG/MMA',
          'tig/mma',
          '141/111 TIG+MMA',
        ];

        for (const input of permutations) {
          const code = WeldingMethodService.normalizeMethodCode(input);
          expect(code).toBe('141_111');
          const method = WeldingMethodService.getMethod(input);
          expect(method).not.toBeNull();
          expect(method?.isMultiProcess).toBe(true);
          expect(method?.requiresWeldingPassport).toBe(true);
        }
      });

      it('documents empirical behavior for unmapped combined processes like 141/136 (TIG+FCAW)', () => {
        // Industry practice often pairs TIG root with FCAW (136) flux-cored fill.
        // Currently, WeldingMethodService only recognizes 141_135 and 141_111, returning NONE for 141/136.
        expect(WeldingMethodService.normalizeMethodCode('141/136')).toBe('NONE');
      });

      it('handles NONE / non-welding locksmith assembly', () => {
        const nonePermutations = ['NONE', 'none', 'BEZ SVÁRU', 'bez svaru', ''];
        for (const input of nonePermutations) {
          const code = WeldingMethodService.normalizeMethodCode(input);
          expect(code).toBe('NONE');
          const method = WeldingMethodService.getMethod(code);
          expect(method?.requiresWeldingPassport).toBe(false);
          expect(method?.isMultiProcess).toBe(false);
        }
      });

      it('correctly reports isValidCode for standard and combined methods', () => {
        expect(WeldingMethodService.isValidCode('141')).toBe(true);
        expect(WeldingMethodService.isValidCode('135')).toBe(true);
        expect(WeldingMethodService.isValidCode('141_135')).toBe(true);
        expect(WeldingMethodService.isValidCode('141_111')).toBe(true);
        expect(WeldingMethodService.isValidCode('NONE')).toBe(true);
        expect(WeldingMethodService.isValidCode('999')).toBe(false);
        expect(WeldingMethodService.isValidCode('LASER')).toBe(false);
      });
    });

    describe('3.2 Base Material Delivery Condition Variants & ISO/TR 15608 Groups', () => {
      it('recognizes delivery condition suffixes (+N, +M, +AR, +QT) and maps to base standard', () => {
        const variants = [
          { input: 'S355J2+N', expectedGrade: 'S355J2', expectedGroup: 'Skupina 1.2' },
          { input: 'S355J2 + N', expectedGrade: 'S355J2', expectedGroup: 'Skupina 1.2' },
          { input: 'S355J2+AR', expectedGrade: 'S355J2', expectedGroup: 'Skupina 1.2' },
          { input: 'S355J2+M', expectedGrade: 'S355J2', expectedGroup: 'Skupina 1.2' },
          { input: 'S235JR+AR', expectedGrade: 'S235JR', expectedGroup: 'Skupina 1.1' },
          { input: '16Mo3+QT', expectedGrade: '16Mo3', expectedGroup: 'Skupina 1.2' },
        ];

        for (const { input, expectedGrade, expectedGroup } of variants) {
          const spec = BaseMaterialService.resolveMaterial(input);
          expect(spec.gradeCode).toBe(expectedGrade);
          expect(spec.materialGroup).toBe(expectedGroup);
          expect(spec.isCustom).toBeFalsy();
        }
      });

      it('resolves stainless steel grades and delivery finishes (e.g. 1.4404-2B, AISI 316L)', () => {
        const stainless316 = BaseMaterialService.resolveMaterial('1.4404-2B');
        expect(stainless316.category).toBe('stainless_steel');
        expect(stainless316.materialGroup).toBe('Skupina 8.1');

        const aisi304 = BaseMaterialService.resolveMaterial('AISI 304');
        expect(aisi304.category).toBe('stainless_steel');
        expect(aisi304.materialGroup).toBe('Skupina 8.1');
      });

      it('resolves aluminum including European EN AW designations to Skupina 22', () => {
        // When aluminum starts with 'Al' or contains 'hliník':
        const alu1 = BaseMaterialService.resolveMaterial('AlSi10Mg');
        expect(alu1.category).toBe('aluminum');
        expect(alu1.materialGroup).toBe('Skupina 22');

        const alu2 = BaseMaterialService.resolveMaterial('Hliník 6060');
        expect(alu2.category).toBe('aluminum');
        expect(alu2.materialGroup).toBe('Skupina 22');

        // Hardened: 'EN AW-6060' is correctly recognized as aluminum and classified in Skupina 22
        const enAw = BaseMaterialService.resolveMaterial('EN AW-6060');
        expect(enAw.category).toBe('aluminum');
        expect(enAw.materialGroup).toBe('Skupina 22');
      });

      it('throws descriptive error on empty or whitespace-only material grade', () => {
        expect(() => BaseMaterialService.resolveMaterial('')).toThrow('Base material grade cannot be empty');
        expect(() => BaseMaterialService.resolveMaterial('   ')).toThrow('Base material grade cannot be empty');
      });
    });

    describe('3.3 Thickness Dimension Formatting & Validation', () => {
      it('formats valid boundary thicknesses (0.1 mm to 500 mm)', () => {
        expect(BaseMaterialService.formatThickness(0.1)).toBe('0.1 mm');
        expect(BaseMaterialService.formatThickness(500)).toBe('500.0 mm');
        expect(BaseMaterialService.formatThickness('0.8 mm')).toBe('0.8 mm');
        expect(BaseMaterialService.formatThickness('12')).toBe('12.0 mm');
        expect(BaseMaterialService.formatThickness('+4.5')).toBe('4.5 mm');
      });

      it('formats ranges and pipe composite notations', () => {
        expect(BaseMaterialService.formatThickness('3-6')).toBe('3–6 mm');
        expect(BaseMaterialService.formatThickness('4–10 mm')).toBe('4–10 mm');
        expect(BaseMaterialService.formatThickness('Ø 60.3 x 3.2 mm')).toBe('Ø 60.3 x 3.2 mm');
        expect(BaseMaterialService.formatThickness('DN 50 x 2.9')).toBe('DN 50 x 2.9 mm');
      });

      it('strictly rejects zero, negative, inverted ranges, and corrupt values', () => {
        expect(() => BaseMaterialService.formatThickness(0)).toThrow();
        expect(() => BaseMaterialService.formatThickness(-2)).toThrow();
        expect(() => BaseMaterialService.formatThickness('-3.5 mm')).toThrow();
        expect(() => BaseMaterialService.formatThickness('6-3 mm')).toThrow(); // inverted range
        expect(() => BaseMaterialService.formatThickness('Ø 60.3 x -3.2 mm')).toThrow(); // negative pipe wall
        expect(() => BaseMaterialService.formatThickness('bez tloušťky')).toThrow(); // no digits
        expect(() => BaseMaterialService.formatThickness('')).toThrow();
      });

      it('normalizes Czech decimal comma and strictly rejects zero thickness in formatThickness', () => {
        // '0 mm' and '0.0 mm' throw an error:
        expect(() => BaseMaterialService.formatThickness('0 mm')).toThrow();
        expect(() => BaseMaterialService.formatThickness('0.0 mm')).toThrow();

        // Hardened: '0,0 mm' normalizes comma to dot and is strictly rejected as non-positive
        expect(() => BaseMaterialService.formatThickness('0,0 mm')).toThrow();
        expect(() => BaseMaterialService.formatThickness('0,00 mm')).toThrow();
      });

      it('returns boolean safely from validateThickness without throwing exceptions', () => {
        expect(BaseMaterialService.validateThickness('4.0 mm')).toBe(true);
        expect(BaseMaterialService.validateThickness('3-6')).toBe(true);
        expect(BaseMaterialService.validateThickness('Ø 88.9 x 3.6 mm')).toBe(true);
        expect(BaseMaterialService.validateThickness('-5')).toBe(false);
        expect(BaseMaterialService.validateThickness('corrupted')).toBe(false);
        expect(BaseMaterialService.validateThickness('')).toBe(false);
      });
    });

    describe('3.4 Shielding Gas Auto-Recommendation Edge Cases', () => {
      it('recommends Argon 4.6 + root backing gas for TIG on stainless steels', () => {
        const rec = ShieldingGasService.recommendGas('141', '1.4404 / AISI 316L');
        expect(rec.gas).toContain('Argon 4.6');
        expect(rec.isoGroup).toBe('ISO 14175-I1');
        expect(rec.rootBackingGasRecommended).toBe(true);
        expect(rec.notes).toContain('formování kořene');
      });

      it('recommends Argon 4.6 WITHOUT root backing gas for TIG on carbon steel (S355)', () => {
        const rec = ShieldingGasService.recommendGas('141', 'S355J2+N');
        expect(rec.gas).toContain('Argon 4.6');
        expect(rec.rootBackingGasRecommended).toBe(false);
      });

      it('recommends CORGON 18 (M21) for MAG (135/136)', () => {
        const rec135 = ShieldingGasService.recommendGas('135', 'S235JR');
        expect(rec135.gas).toContain('CORGON 18');
        expect(rec135.isoGroup).toBe('ISO 14175-M21');
        expect(rec135.rootBackingGasRecommended).toBe(false);

        const rec136 = ShieldingGasService.recommendGas('136', 'S355');
        expect(rec136.gas).toContain('CORGON 18');
      });

      it('recommends no shielding gas for MMA 111 (flux covered electrode)', () => {
        const rec = ShieldingGasService.recommendGas('111', 'S355');
        expect(rec.gas).toContain('Bez ochranného plynu');
        expect(rec.isoGroup).toBe('N/A');
        expect(rec.rootBackingGasRecommended).toBe(false);
      });

      it('recommends Oxygen + Acetylene for Autogen 311', () => {
        const rec = ShieldingGasService.recommendGas('311', 'Ocelové trubky');
        expect(rec.gas).toBe('Kyslík + Acetylén');
        expect(rec.isoGroup).toBe('Plamen');
      });

      it('formats passport gas string cleanly with root backing note', () => {
        expect(ShieldingGasService.formatPassportGasString('Argon 4.6', true)).toBe('Argon 4.6 [vč. formování kořene]');
        expect(ShieldingGasService.formatPassportGasString('CORGON 18', false)).toBe('CORGON 18');
      });
    });

    describe('3.5 EN 10204 3.1 Filler Batch Tracking and Parsing', () => {
      it('formats batch strings cleanly for passport summary', () => {
        const batch = {
          manufacturer: 'Böhler',
          tradeName: 'Fox EV 50',
          diameterMm: 2.5,
          batchNumber: '742198',
        };
        const str = FillerBatchService.formatBatchString(batch);
        expect(str).toBe('Böhler Fox EV 50, Ø 2.5 mm, šarže 742198');
      });

      it('parses diverse real-world batch notations with diameter, heat number, and manufacturer', () => {
        const parsed = FillerBatchService.parseBatchString('ESAB OK Autrod 12.50 Ø 1.2 mm šarže #849102');
        expect(parsed.manufacturer).toBe('ESAB');
        expect(parsed.diameterMm).toBe(1.2);
        expect(parsed.batchNumber).toBe('#849102');

        const parsed2 = FillerBatchService.parseBatchString('Kowax Speedweld průměr 0.8 mm tavba E-99124');
        expect(parsed2.manufacturer).toBe('Kowax');
        expect(parsed2.diameterMm).toBe(0.8);
        expect(parsed2.batchNumber).toBe('#E-99124');
      });

      it('validates EN 1090 compliance requirements for filler material', () => {
        // Valid batch
        const validBatch = {
          manufacturer: 'Lincoln Electric',
          tradeName: 'Supranox 316L',
          diameterMm: 2.0,
          batchNumber: '#LE-998822',
        };
        expect(FillerBatchService.validateForEn1090(validBatch).valid).toBe(true);

        // Invalid batch (missing manufacturer, out-of-range diameter, missing batch number)
        const invalidBatch = {
          manufacturer: '',
          tradeName: 'Drát',
          diameterMm: 12.0, // out of range (0.6 - 6.0 mm)
          batchNumber: '',
        };
        const validation = FillerBatchService.validateForEn1090(invalidBatch);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('3.6 Technical Passport Protocol Block & VT Inspection Quality Levels', () => {
      it('formats visual inspection VT2 quality levels according to ISO 5817', () => {
        expect(TechnicalPassportService.formatVtInspection('passed_B').qualityLevel).toBe('B');
        expect(TechnicalPassportService.formatVtInspection('passed_B').isCompliant).toBe(true);

        expect(TechnicalPassportService.formatVtInspection('passed_C').qualityLevel).toBe('C');
        expect(TechnicalPassportService.formatVtInspection('passed_C').isCompliant).toBe(true);

        expect(TechnicalPassportService.formatVtInspection('failed').isCompliant).toBe(false);
        expect(TechnicalPassportService.formatVtInspection('not_required').isCompliant).toBe(true);
      });

      it('determines whether passport block should render in protocol', () => {
        expect(TechnicalPassportService.shouldRenderPassport(null)).toBe(false);
        expect(TechnicalPassportService.shouldRenderPassport({ methodCode: 'NONE' } as any)).toBe(false);
        expect(TechnicalPassportService.shouldRenderPassport({ methodCode: '141' } as any)).toBe(true);
        expect(TechnicalPassportService.shouldRenderPassport({ methodCode: '141_135' } as any)).toBe(true);
      });

      it('evaluates TDI compliance in passport block', () => {
        const fullPassport: WeldingPassport = {
          methodCode: '141_135',
          methodName: 'Kombinace TIG+MAG',
          baseMaterialGrade: '1.4404',
          materialThickness: '4.0 mm',
          shieldingGas: 'Argon 4.6',
          fillerBatch: 'Böhler ER316L, Ø 2.4 mm, šarže #742198',
          rootBackingGas: true,
          weldInspectionVT: 'passed_B',
        };

        const block = TechnicalPassportService.formatPassportBlock(fullPassport);
        expect(block.isCompliantForTdi).toBe(true);
        expect(block.gasDisplay).toContain('(vč. formování kořene)');
        expect(block.materialDisplay).toBe('1.4404, tl. 4.0 mm');
      });
    });
  });

  // =========================================================================
  // SECTION 4: Consumables Catalog & Slip Calculations Under Extreme Conditions
  // =========================================================================
  describe('4. Consumables Catalog & Slip Calculations Under Extreme Conditions', () => {

    describe('4.1 Extreme Markups (0%, 500%, Negative Clamping)', () => {
      it('calculates 0% markup without any markup addition', () => {
        expect(calculateConsumableItemBilledPrice(1, 100, 0)).toBe(100);
        expect(calculateConsumableItemBilledPrice(10, 55, 0)).toBe(550);
        expect(calculateItemBilledPrice(55, 10, 0)).toBe(550);
      });

      it('calculates extreme 500% markup correctly (base * 6)', () => {
        // Base: 10 * 100 = 1000. Markup 500% -> 1000 * (1 + 5.0) = 6000
        expect(calculateConsumableItemBilledPrice(10, 100, 500)).toBe(6000);
      });

      it('clamps negative markups safely to 0% markup in item calculation', () => {
        expect(calculateConsumableItemBilledPrice(10, 100, -25)).toBe(1000);
      });

      it('clamps negative quantities and negative prices to 0 in item calculation', () => {
        expect(calculateConsumableItemBilledPrice(-5, 100, 15)).toBe(0);
        expect(calculateConsumableItemBilledPrice(5, -100, 15)).toBe(0);
      });
    });

    describe('4.2 Multi-Item Consumables Slip Totals with Mixed Markups & Overhead Fee', () => {
      it('calculates slip with individual item markups and fixed overhead fee', () => {
        const items: ConsumableItem[] = [
          {
            id: '1',
            category: 'cutting_grinding',
            name: 'Kotouč 125mm',
            quantity: 10,
            unit: 'ks',
            unitPrice: 35,
            markupPercent: 20, // 350 * 1.2 = 420
            billedPrice: 420,
          },
          {
            id: '2',
            category: 'technical_gases',
            name: 'Argon náplň',
            quantity: 1,
            unit: 'lahev',
            unitPrice: 650,
            markupPercent: 10, // 650 * 1.1 = 715
            billedPrice: 715,
          },
        ];

        // Overhead markup 0, fixed overhead fee 250 Kč
        const totals = calculateConsumableSlipTotals(items, 0, 250);
        expect(totals.totalMaterialCost).toBe(1000); // 350 + 650 = 1000
        expect(totals.totalBilledAmount).toBe(420 + 715 + 250); // 1385 Kč
      });

      it('calculates slip when items do not have individual markups (applies slip-wide overheadMarkupPercent)', () => {
        const items: ConsumableItem[] = [
          {
            id: '1',
            category: 'fasteners',
            name: 'Šroub M12',
            quantity: 100,
            unit: 'ks',
            unitPrice: 14,
            billedPrice: 1400,
          },
          {
            id: '2',
            category: 'fasteners',
            name: 'Matice M12',
            quantity: 100,
            unit: 'ks',
            unitPrice: 6,
            billedPrice: 600,
          },
        ];

        // Slip has overheadMarkupPercent = 15%, fixedOverheadFee = 150
        // Total material cost = 1400 + 600 = 2000 Kč
        // Billed items = 2000 * 1.15 = 2300 Kč
        // Total billed = 2300 + 150 = 2450 Kč
        const totals = calculateConsumableSlipTotals(items, 15, 150);
        expect(totals.totalMaterialCost).toBe(2000);
        expect(totals.totalBilledAmount).toBe(2450);
      });

      it('enforces non-negative clamping on raw negative items in calculateConsumableSlipTotals', () => {
        // If a raw item with negative quantity or negative billedPrice bypasses the form helper:
        const totals = calculateConsumableSlipTotals([
          { id: '1', category: 'fasteners', name: 'Item', quantity: -10, unit: 'ks', unitPrice: 50, billedPrice: -500 }
        ]);
        // Hardened: calculateConsumableSlipTotals clamps negative inputs and totals to 0
        expect(totals.totalMaterialCost).toBe(0);
        expect(totals.totalBilledAmount).toBe(0);
      });

      it('handles empty slip safely', () => {
        const totals = calculateConsumableSlipTotals([], 15, 200);
        expect(totals.totalMaterialCost).toBe(0);
        expect(totals.totalBilledAmount).toBe(200); // fixed fee remains
      });

      it('integrates materials slip into grand total calculation with VAT / PDP', () => {
        const entry = {
          totalHours: 8,
          pricing: {
            calculatedHourlyRate: 600, // 4800 Kč
          },
          travel: {
            distanceKm: 100,
            ratePerKm: 10, // 1000 Kč
            travelTimeHours: 1,
            travelHourlyRate: 300, // 300 Kč
            dietAllowance: 166, // 166 Kč
          },
          extraCosts: [],
          consumableSlip: {
            items: [],
            overheadMarkupPercent: 0,
            fixedOverheadFee: 0,
            totalMaterialCost: 1500,
            totalBilledAmount: 1800,
          },
        };

        // Grand total without materials = 4800 + 1466 = 6266 Kč
        // Grand total with materials = 6266 + 1800 = 8066 Kč
        const total = calculateGrandTotalWithMaterials(entry);
        expect(total).toBe(8066);

        // Under § 92e PDP:
        const pdpVat = calculateVatAndTotal(total, true);
        expect(pdpVat.totalWithVat).toBe(8066);
        expect(pdpVat.vatAmount).toBe(0);
        expect(pdpVat.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

        // Under standard 21% VAT:
        const stdVat = calculateVatAndTotal(total, false);
        expect(stdVat.vatAmount).toBe(Math.round(8066 * 0.21)); // 1694 Kč
        expect(stdVat.totalWithVat).toBe(8066 + 1694); // 9760 Kč
      });
    });

    describe('4.3 Large-Scale Slip Performance & Cumulative Rounding (1,000 Items Stress)', () => {
      it('calculates 1,000 items in consumables slip without precision drift or NaN', () => {
        const largeItems: ConsumableItem[] = [];
        for (let i = 0; i < 1000; i++) {
          largeItems.push({
            id: `item_${i}`,
            category: 'fasteners',
            name: `Item ${i}`,
            quantity: 3,
            unit: 'ks',
            unitPrice: 12.50,
            markupPercent: 10,
            billedPrice: calculateConsumableItemBilledPrice(3, 12.50, 10), // 37.5 * 1.1 = 41.25 -> 41
          });
        }

        const totals = calculateConsumableSlipTotals(largeItems, 10, 500);
        expect(totals.totalMaterialCost).toBe(1000 * Math.round(3 * 12.50)); // 38 * 1000 = 38000
        expect(totals.totalBilledAmount).toBe(1000 * 41 + 500); // 41500
        expect(Number.isFinite(totals.totalBilledAmount)).toBe(true);
      });
    });

    describe('4.4 Standard Catalog & 1-Touch Activity Chips Compliance', () => {
      it('verifies standard catalog contains essential industrial items across all categories', () => {
        expect(STANDARD_CONSUMABLES_CATALOG.length).toBeGreaterThanOrEqual(20);

        const categories = new Set(STANDARD_CONSUMABLES_CATALOG.map(i => i.category));
        expect(categories.has('cutting_grinding')).toBe(true);
        expect(categories.has('technical_gases')).toBe(true);
        expect(categories.has('anchors')).toBe(true);
        expect(categories.has('fasteners')).toBe(true);
        expect(categories.has('welding_consumables')).toBe(true);

        for (const item of STANDARD_CONSUMABLES_CATALOG) {
          expect(item.unitPrice).toBeGreaterThan(0);
          expect(item.name.length).toBeGreaterThan(0);
          expect(item.unit.length).toBeGreaterThan(0);
        }
      });

      it('verifies all 5 mandatory glove-friendly quick action tags exist per §R4', () => {
        expect(MANDATORY_ACTIVITY_CHIPS).toEqual([
          'Příprava',
          'Svařování',
          'Montáž ve výškách',
          'Broušení/začištění',
          'Kotvení',
        ]);
      });

      it('toggles activity chips cleanly', () => {
        let chips = toggleActivityChip([], 'Svařování');
        expect(chips).toEqual(['Svařování']);

        chips = toggleActivityChip(chips, 'Kotvení');
        expect(chips).toEqual(['Svařování', 'Kotvení']);

        chips = toggleActivityChip(chips, 'Svařování');
        expect(chips).toEqual(['Kotvení']);
      });

      it('formats activity tags as comma-separated protocol string', () => {
        expect(formatActivityTagsForProtocol(['Příprava', 'Svařování', 'Kotvení'])).toBe(
          'Příprava, Svařování, Kotvení'
        );
        expect(formatActivityTagsForProtocol([])).toBe('');
        expect(formatActivityTagsForProtocol(undefined)).toBe('');
      });
    });
  });
});
