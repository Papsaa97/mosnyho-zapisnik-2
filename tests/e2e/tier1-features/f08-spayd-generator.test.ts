import { describe, it, expect } from 'vitest';
import { PRIMARY_CONTRACTOR_FIXTURE, SECONDARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';
import { SpaydService, czechAccountToIban, generateSpaydString } from '../../../src/services/spaydService';
import type { SpaydParams } from '../../../src/types';

export { SpaydService, czechAccountToIban, generateSpaydString };
export type { SpaydParams };

describe('Feature 8: Domestic SPAYD QR Generator (f08-spayd-generator)', () => {
  it('synthesizes valid Czech IBAN from standard account number without prefix using MOD-97', () => {
    // 123456789/0100 -> Bank 0100 (Komerční banka), Account 0123456789
    // Authoritative ISO 7064 MOD-97 check digits = 18
    const iban = SpaydService.czechAccountToIban(PRIMARY_CONTRACTOR_FIXTURE.bankAccount);
    expect(iban).toBe('CZ1801000000000123456789');

    // Verify MOD-97 ISO 7064 check: IBAN numeric remainder modulo 97 must be 1
    const checkNumeric = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
    expect(Number(BigInt(checkNumeric) % 97n)).toBe(1);
  });

  it('synthesizes valid Czech IBAN from account number with prefix (e.g. 19-9876543210/0800)', () => {
    // 19-9876543210/0800 -> Bank 0800 (Česká spořitelna), Prefix 000019, Account 9876543210
    // Authoritative ISO 7064 MOD-97 check digits = 95
    const iban = SpaydService.czechAccountToIban(SECONDARY_CONTRACTOR_FIXTURE.bankAccount);
    expect(iban).toBe('CZ9508000000199876543210');

    const checkNumeric = `${iban!.slice(4)}1235${iban!.slice(2, 4)}`;
    expect(Number(BigInt(checkNumeric) % 97n)).toBe(1);
  });

  it('rejects invalid account strings (missing bank code, non-numeric, malformed length) returning null', () => {
    expect(SpaydService.czechAccountToIban('')).toBeNull();
    expect(SpaydService.czechAccountToIban('123456789')).toBeNull(); // missing /bankCode
    expect(SpaydService.czechAccountToIban('123456789/01')).toBeNull(); // bank code < 4 digits
    expect(SpaydService.czechAccountToIban('123456789/01000')).toBeNull(); // bank code > 4 digits
    expect(SpaydService.czechAccountToIban('123456789012/0100')).toBeNull(); // account > 10 digits
    expect(SpaydService.czechAccountToIban('1234567-89/0100')).toBeNull(); // prefix > 6 digits
    expect(SpaydService.czechAccountToIban('abc/0100')).toBeNull(); // non-numeric
  });

  it('generates compliant SPAYD 1.0 string with mandatory ACC, AM, and CC keys', () => {
    const spayd = SpaydService.generateSpaydString({
      accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.iban,
      amount: 15420.5,
      variableSymbol: '20260301',
      message: 'Faktura za montaz',
    });

    expect(spayd).not.toBeNull();
    expect(spayd).toMatch(/^SPD\*1\.0\*/);
    expect(spayd).toContain(`*ACC:${PRIMARY_CONTRACTOR_FIXTURE.iban}`);
    expect(spayd).toContain('*AM:15420.50');
    expect(spayd).toContain('*CC:CZK');
    expect(spayd).toContain('*X-VS:20260301');
    expect(spayd).toContain('*MSG:Faktura za montaz');
  });

  it('strips Czech diacritics and special characters from SPAYD MSG parameter with 60-char truncation', () => {
    const spayd = SpaydService.generateSpaydString({
      accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.iban,
      amount: 2500,
      message: 'Předávací protokol – Montáž & Sváření mostního zábradlí S355 v terénu!',
    });

    expect(spayd).not.toBeNull();
    // Diacritics removed: 'Předávací' -> 'Predavaci', '&' removed, '!' removed, multiple spaces collapsed
    expect(spayd).toContain('MSG:Predavaci protokol Montaz Svareni mostniho zabradli S355 v');
    // Ensure total length of MSG does not exceed 60 characters
    const msgMatch = spayd!.match(/\*MSG:([^*]+)/);
    expect(msgMatch).not.toBeNull();
    expect(msgMatch![1].length).toBeLessThanOrEqual(60);
  });

  it('formats variable symbol X-VS and amounts with exactly 2 decimal places', () => {
    const spayd = SpaydService.generateSpaydString({
      accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.iban,
      amount: 100, // integer
      variableSymbol: '00123456',
    });

    expect(spayd).toContain('*AM:100.00');
    expect(spayd).toContain('*X-VS:00123456');
  });

  it('guards against negative or NaN payment amounts', () => {
    expect(
      SpaydService.generateSpaydString({
        accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.iban,
        amount: -500,
      })
    ).toBeNull();

    expect(
      SpaydService.generateSpaydString({
        accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.iban,
        amount: NaN,
      })
    ).toBeNull();
  });
});
