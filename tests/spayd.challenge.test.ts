import { describe, it, expect } from 'vitest';
import { czechAccountToIban, generateSpaydString, SpaydService } from '../src/services/spaydService';

describe('Adversarial Stress Test: Feature 8 — SPAYD & IBAN Synthesizer', () => {

  // =========================================================================
  // 1. Extreme Permutations of Domestic Czech Accounts
  // =========================================================================
  describe('1. Domestic account synthesis across extreme permutations', () => {
    
    it('synthesizes standard account without prefix: 123456789/0100 (KB)', () => {
      const iban = czechAccountToIban('123456789/0100');
      expect(iban).toBe('CZ1801000000000123456789');
      expect(iban).toHaveLength(24);

      // Verify ISO 7064 MOD-97 mathematical invariant
      const numericStr = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('synthesizes maximum 10-digit account without prefix: 9999999999/2010 (Fio)', () => {
      const iban = czechAccountToIban('9999999999/2010');
      expect(iban).not.toBeNull();
      expect(iban).toHaveLength(24);
      expect(iban?.slice(4, 8)).toBe('2010');
      expect(iban?.slice(8, 14)).toBe('000000'); // prefix
      expect(iban?.slice(14)).toBe('9999999999'); // account
      
      const numericStr = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('documents empirical behavior on 1-digit account without prefix: 1/0800', () => {
      // Under ČNB decree 62/2004 § 2 (1) b, base account numbers must have between 2 and 10 digits.
      // Current implementation in spaydService.ts uses \d{2,10}, rejecting '1/0800' with null.
      const iban = czechAccountToIban('1/0800');
      expect(iban).toBeNull();

      // Note: If 2 digits are provided with leading zero ('01/0800'), it synthesizes successfully:
      const ibanPadded = czechAccountToIban('01/0800');
      expect(ibanPadded).toBe('CZ3408000000000000000001');
      expect(ibanPadded).not.toBeNull();
      const numericStr = `${ibanPadded!.slice(4)}1235${ibanPadded!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('synthesizes 2-digit prefix account: 19-2000145399/0800 (Česká spořitelna)', () => {
      const iban = czechAccountToIban('19-2000145399/0800');
      expect(iban).toBe('CZ6508000000192000145399');
      const numericStr = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('synthesizes prefix with leading zeros matching 6 digits: 000019-2000145399/0800', () => {
      const iban = czechAccountToIban('000019-2000145399/0800');
      // Must match the identical IBAN as 19-2000145399/0800
      expect(iban).toBe('CZ6508000000192000145399');
    });

    it('documents empirical behavior on 1-digit prefix and 1-digit account: 1-1/0100', () => {
      // 1-1/0100: Prefix '1' is 1 digit, account '1' is 1 digit.
      // Account '1' fails \d{2,10} and returns null.
      const iban = czechAccountToIban('1-1/0100');
      expect(iban).toBeNull();

      // With 2-digit account '1-01/0100', it succeeds:
      const ibanPadded = czechAccountToIban('1-01/0100');
      expect(ibanPadded).not.toBeNull();
      expect(ibanPadded?.slice(8, 14)).toBe('000001');
      expect(ibanPadded?.slice(14)).toBe('0000000001');
      const numericStr = `${ibanPadded!.slice(4)}1235${ibanPadded!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('synthesizes maximum 6-digit prefix and 10-digit account: 999999-9999999999/0300 (ČSOB)', () => {
      const iban = czechAccountToIban('999999-9999999999/0300');
      expect(iban).not.toBeNull();
      expect(iban).toHaveLength(24);
      expect(iban?.slice(4, 8)).toBe('0300');
      expect(iban?.slice(8, 14)).toBe('999999');
      expect(iban?.slice(14)).toBe('9999999999');

      const numericStr = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
      expect(BigInt(numericStr) % 97n).toBe(1n);
    });

    it('handles explicit zero prefix: 0-2000145399/0800 and 000000-2000145399/0800', () => {
      const iban1 = czechAccountToIban('0-2000145399/0800');
      const iban2 = czechAccountToIban('000000-2000145399/0800');
      const ibanNoPrefix = czechAccountToIban('2000145399/0800');
      expect(iban1).toBe(ibanNoPrefix);
      expect(iban2).toBe(ibanNoPrefix);
    });

    it('rejects prefix exceeding 6 digits: 0000019-2000145399/0800', () => {
      // 7 digits prefix exceeds ČNB maximum of 6 digits
      expect(czechAccountToIban('0000019-2000145399/0800')).toBeNull();
    });

    it('rejects account exceeding 10 digits: 12345678901/0100', () => {
      expect(czechAccountToIban('12345678901/0100')).toBeNull();
    });

    it('handles whitespace variations (tabs, newlines, inner spaces, non-breaking spaces)', () => {
      expect(czechAccountToIban('  19 - 2000145399 / 0800  ')).toBe('CZ6508000000192000145399');
      expect(czechAccountToIban('\t19-2000145399/0800\n')).toBe('CZ6508000000192000145399');
      expect(czechAccountToIban('1 9 - 2 0 0 0 1 4 5 3 9 9 / 0 8 0 0')).toBe('CZ6508000000192000145399');
      expect(czechAccountToIban('19\u00A0-\u00A02000145399/0800')).toBe('CZ6508000000192000145399');
    });

    it('rejects invalid characters, injection attempts, and malformed structures', () => {
      expect(czechAccountToIban('19-2000145399/0800; DROP TABLE')).toBeNull();
      expect(czechAccountToIban('19-2000145399/0800<script>')).toBeNull();
      expect(czechAccountToIban('-19-2000145399/0800')).toBeNull();
      expect(czechAccountToIban('19-2000145399/0800/0100')).toBeNull();
      expect(czechAccountToIban('19/2000145399/0800')).toBeNull();
      expect(czechAccountToIban('19-2000145399')).toBeNull();
      expect(czechAccountToIban('/0800')).toBeNull();
      expect(czechAccountToIban('0800')).toBeNull();
    });
  });

  // =========================================================================
  // 2. Pre-existing Czech IBAN Validation vs Corrupt Checksums
  // =========================================================================
  describe('2. Already valid Czech IBANs vs invalid IBAN checksums', () => {
    const validIban = 'CZ6508000000192000145399';

    it('accepts exact 24-character Czech IBAN', () => {
      expect(czechAccountToIban(validIban)).toBe(validIban);
    });

    it('accepts lowercase Czech IBAN and normalizes to uppercase', () => {
      expect(czechAccountToIban('cz6508000000192000145399')).toBe(validIban);
    });

    it('accepts Czech IBAN with electronic banking 4-char space blocks', () => {
      expect(czechAccountToIban('CZ65 0800 0000 1920 0014 5399')).toBe(validIban);
    });

    it('rejects Czech IBAN with off-by-one check digits', () => {
      expect(czechAccountToIban('CZ6408000000192000145399')).toBeNull();
      expect(czechAccountToIban('CZ6608000000192000145399')).toBeNull();
    });

    it('rejects Czech IBAN with swapped digits in BBAN', () => {
      // Swapping two digits: 2000145399 -> 2000145398
      expect(czechAccountToIban('CZ6508000000192000145398')).toBeNull();
    });

    it('rejects foreign IBANs (Slovak, German) in domestic Czech synthesizer', () => {
      expect(czechAccountToIban('SK3112000000001987426375')).toBeNull();
      expect(czechAccountToIban('DE89370400440532013000')).toBeNull();
    });

    it('rejects Czech IBAN with invalid length (< 24 or > 24)', () => {
      expect(czechAccountToIban('CZ650800000019200014539')).toBeNull(); // 23 chars
      expect(czechAccountToIban('CZ65080000001920001453990')).toBeNull(); // 25 chars
    });
  });

  // =========================================================================
  // 3. ISO 7064 MOD-97 Mathematical Validation Suite
  // =========================================================================
  describe('3. ISO 7064 MOD-97 mathematical validation', () => {
    it('satisfies total numeric modulo 97 equals 1 for a wide battery of bank accounts', () => {
      const accounts = [
        '123456789/0100', // KB
        '9876543210/0800', // CSAS
        '1000000001/0300', // CSOB
        '2100000001/2010', // Fio
        '670100-2200000000/6210', // mBank
        '100-1234567890/5500', // Raiffeisen
        '555555-5555555555/0600', // Moneta
        '999999-9999999999/0800', // Extremes
      ];

      for (const acc of accounts) {
        const iban = czechAccountToIban(acc);
        expect(iban).not.toBeNull();
        if (!iban) continue;

        expect(iban).toHaveLength(24);
        expect(iban.startsWith('CZ')).toBe(true);

        const checkDigits = parseInt(iban.slice(2, 4), 10);
        expect(checkDigits).toBeGreaterThanOrEqual(2);
        expect(checkDigits).toBeLessThanOrEqual(98);

        // Verification formula: (BBAN + '1235' + checkDigits) % 97n === 1n
        const bban = iban.slice(4);
        const check = iban.slice(2, 4);
        const fullNumeric = `${bban}1235${check}`;
        expect(BigInt(fullNumeric) % 97n).toBe(1n);
      }
    });
  });

  // =========================================================================
  // 4. ČBA SPAYD 1.0 Formatting & Sanitization
  // =========================================================================
  describe('4. ČBA SPAYD 1.0 formatting & sanitization', () => {
    const defaultAccount = '19-2000145399/0800';

    it('sanitizes pangram with full Czech diacritics: "Příliš žluťoučký kůň úpěl ďábelské ódy na montáži"', () => {
      const pangram = 'Příliš žluťoučký kůň úpěl ďábelské ódy na montáži';
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 2500,
        message: pangram,
      });

      expect(spayd).not.toBeNull();
      // Verify no accented characters survive
      expect(spayd).not.toMatch(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/);
      expect(spayd).toContain('MSG:Prilis zlutoucky kun upel dabelske ody na montazi');
    });

    it('prevents asterisk (*) delimiter injection in message and symbols', () => {
      const attackPayload = 'Faktura*AM:0.01*ACC:CZ9999999999999999999999*MSG:Hacked*';
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 1000,
        message: attackPayload,
      });

      expect(spayd).not.toBeNull();
      // The attack asterisks must be converted to spaces or removed, so ACC and AM are not hijacked
      expect(spayd).toContain('ACC:CZ6508000000192000145399');
      expect(spayd).toContain('AM:1000.00');
      // Only one ACC and AM parameter must be present
      const accCount = (spayd?.match(/ACC:/g) || []).length;
      const amCount = (spayd?.match(/AM:/g) || []).length;
      expect(accCount).toBe(1);
      expect(amCount).toBe(1);
      // MSG contains sanitized text: colons and asterisks are stripped
      expect(spayd).toContain('MSG:Faktura AM 0.01 ACC CZ9999999999999999999999 MSG Hacked');
    });

    it('prevents delimiter injection vulnerability in currency parameter', () => {
      // If an adversarial caller passes a currency string containing delimiters:
      const maliciousCurrency = 'CZK*X-PWNED:1' as any;
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
        currency: maliciousCurrency,
      });

      // Hardened: delimiters stripped and currency code sanitized
      expect(spayd).toContain('*CC:CZK*');
      expect(spayd).not.toContain('X-PWNED');
    });

    it('enforces variable symbol (X-VS) boundaries: max 10 numeric digits, strips non-digits', () => {
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 500,
        variableSymbol: '2026/03-123456789', // 15 numeric digits mixed with separators
      });

      expect(spayd).not.toBeNull();
      // '2026031234' (10 digits max)
      expect(spayd).toContain('X-VS:2026031234');
    });

    it('enforces constant symbol (X-KS) boundaries: max 4 numeric digits', () => {
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 500,
        constantSymbol: '0308999', // 7 digits
      });

      expect(spayd).toContain('X-KS:0308');
    });

    it('enforces specific symbol (X-SS) boundaries: max 10 numeric digits', () => {
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 500,
        specificSymbol: '9876543210999', // 13 digits
      });

      expect(spayd).toContain('X-SS:9876543210');
    });

    it('handles due date formatting (YYYYMMDD and YYYY-MM-DD)', () => {
      const spaydIso = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
        dueDate: '2026-03-31',
      });
      expect(spaydIso).toContain('DT:20260331');

      const spaydRaw = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
        dueDate: '20260331',
      });
      expect(spaydRaw).toContain('DT:20260331');
    });

    it('handles currency codes: CZK default, EUR explicit', () => {
      const spaydCzk = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
      });
      expect(spaydCzk).toContain('*CC:CZK*');

      const spaydEur = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 50,
        currency: 'EUR',
      });
      expect(spaydEur).toContain('*CC:EUR*');
    });

    it('handles zero amount (omits AM and CC per ČBA SPAYD 1.0 open-amount payment)', () => {
      const spaydZero = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 0,
      });

      expect(spaydZero).not.toBeNull();
      expect(spaydZero?.startsWith('SPD*1.0*ACC:')).toBe(true);
      // AM and CC parameters must NOT appear as separate fields
      expect(spaydZero).not.toMatch(/\*AM:/);
      expect(spaydZero).not.toMatch(/\*CC:/);
      expect(spaydZero?.endsWith('*')).toBe(true);
    });

    it('rejects negative amounts and NaN amounts with null', () => {
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: -100 })).toBeNull();
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: -0.01 })).toBeNull();
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: NaN })).toBeNull();
    });

    it('formats floating point amounts with exactly two decimal places', () => {
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: 1500.5 })).toContain('AM:1500.50');
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: 1500.555 })).toContain('AM:1500.56'); // rounding
      expect(generateSpaydString({ accountOrIban: defaultAccount, amount: 100 })).toContain('AM:100.00');
    });

    it('truncates message (MSG) at exactly 60 characters and discards empty messages', () => {
      const longMessage = 'A'.repeat(80);
      const spayd = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
        message: longMessage,
      });

      expect(spayd).toContain(`MSG:${'A'.repeat(60)}`);
      expect(spayd).not.toContain(`MSG:${'A'.repeat(61)}`);

      // Message with only spaces or stripped characters should not add MSG:
      const spaydEmpty = generateSpaydString({
        accountOrIban: defaultAccount,
        amount: 100,
        message: '   *** &&&   ',
      });
      expect(spaydEmpty).not.toContain('MSG:');
    });
  });

  // =========================================================================
  // 5. SpaydService Static Facade
  // =========================================================================
  describe('5. SpaydService static facade parity', () => {
    it('mirrors czechAccountToIban and generateSpaydString behavior', () => {
      expect(SpaydService.czechAccountToIban('19-2000145399/0800')).toBe(
        czechAccountToIban('19-2000145399/0800')
      );
      expect(SpaydService.generateSpaydString({ accountOrIban: '19-2000145399/0800', amount: 100 })).toBe(
        generateSpaydString({ accountOrIban: '19-2000145399/0800', amount: 100 })
      );
    });
  });
});
