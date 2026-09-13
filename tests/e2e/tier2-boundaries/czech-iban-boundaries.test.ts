import { describe, it, expect } from 'vitest';
import { czechAccountToIban } from '../../../src/services/spaydService';

export { czechAccountToIban };

describe('Tier 2 Boundary: Czech Bank Account to IBAN Boundaries (czech-iban-boundaries.test.ts)', () => {
  // 1. Prefix Handling (0 to 6 digits)
  describe('Account prefix boundary handling (0 to 6 digits)', () => {
    it('handles 0-digit prefix (no prefix, standard account/bankCode)', () => {
      const iban = czechAccountToIban('123456789/0100');
      // BBAN = 0100 + 000000 + 0123456789 = 01000000000123456789
      // MOD-97 remainder is 80 -> check digits = 98 - 80 = 18 -> CZ18...
      expect(iban).toBe('CZ1801000000000123456789');
      expect(iban).toHaveLength(24);
      expect(iban?.slice(4, 14)).toBe('0100000000'); // bank 0100 + prefix 000000
    });

    it('handles 1-digit prefix correctly', () => {
      const iban = czechAccountToIban('9-123456789/0100');
      expect(iban).not.toBeNull();
      expect(iban?.slice(8, 14)).toBe('000009'); // prefix padded to 6 digits
    });

    it('handles 2-digit prefix (e.g. Česká spořitelna 19-)', () => {
      const iban = czechAccountToIban('19-2000145399/0800');
      expect(iban).toBe('CZ6508000000192000145399');
    });

    it('handles 6-digit prefix (maximum allowed by ČNB)', () => {
      const iban = czechAccountToIban('123456-2000145399/0800');
      expect(iban).not.toBeNull();
      expect(iban?.slice(8, 14)).toBe('123456');
    });

    it('rejects invalid prefixes exceeding 6 digits', () => {
      expect(czechAccountToIban('1234567-2000145399/0800')).toBeNull();
    });
  });

  // 2. Main Account Number Handling (2 to 10 digits)
  describe('Main account number boundary handling (2 to 10 digits)', () => {
    it('handles minimum 2-digit account number', () => {
      const iban = czechAccountToIban('12/0100');
      expect(iban).not.toBeNull();
      expect(iban?.slice(14)).toBe('0000000012'); // padded to 10 digits
    });

    it('handles maximum 10-digit account number', () => {
      const iban = czechAccountToIban('1234567890/0800');
      expect(iban).not.toBeNull();
      expect(iban?.slice(14)).toBe('1234567890');
    });

    it('rejects 1-digit account number (< 2 digits)', () => {
      expect(czechAccountToIban('5/0100')).toBeNull();
    });

    it('rejects 11-digit account number (> 10 digits)', () => {
      expect(czechAccountToIban('12345678901/0100')).toBeNull();
    });
  });

  // 3. Bank Codes (Valid and Invalid)
  describe('Bank code boundaries (4 digits strictly)', () => {
    it('accepts various 4-digit bank codes', () => {
      expect(czechAccountToIban('2000145399/2010')).toBe('CZ9320100000002000145399');
      expect(czechAccountToIban('123456789/0300')).not.toBeNull(); // ČSOB
      expect(czechAccountToIban('123456789/5500')).not.toBeNull(); // Raiffeisenbank
      expect(czechAccountToIban('123456789/6210')).not.toBeNull(); // mBank
    });

    it('rejects bank codes with fewer or more than 4 digits', () => {
      expect(czechAccountToIban('123456789/010')).toBeNull(); // 3 digits
      expect(czechAccountToIban('123456789/01001')).toBeNull(); // 5 digits
      expect(czechAccountToIban('123456789/ABCD')).toBeNull(); // non-numeric
    });
  });

  // 4. ISO 7064 MOD-97 Mathematical Boundary & Checksum Verification
  describe('ISO 7064 MOD-97 mathematical checksum verification', () => {
    it('computes correct MOD-97 check digits such that total IBAN mod 97 === 1', () => {
      const testAccounts = [
        '19-2000145399/0800',
        '2000145399/2010',
        '123456789/0100',
        '9876543210/0800',
      ];

      for (const acc of testAccounts) {
        const iban = czechAccountToIban(acc);
        expect(iban).not.toBeNull();
        if (!iban) continue;

        // Verify MOD 97: move 'CZ' (1235) and 2 check digits to the end
        const bban = iban.slice(4);
        const check = iban.slice(2, 4);
        const numericStr = `${bban}1235${check}`;
        const mod = BigInt(numericStr) % 97n;
        expect(mod).toBe(1n);
      }
    });

    it('verifies check digit range boundaries (02 to 98)', () => {
      // Generated check digits are strictly between 02 and 98
      const iban = czechAccountToIban('19-2000145399/0800');
      const checkDigits = Number(iban?.slice(2, 4));
      expect(checkDigits).toBeGreaterThanOrEqual(2);
      expect(checkDigits).toBeLessThanOrEqual(98);
    });
  });

  // 5. Pre-formatted IBAN and Whitespace Formatting
  describe('Pre-formatted IBAN detection and whitespace tolerance', () => {
    it('accepts existing valid Czech IBAN unchanged', () => {
      const existing = 'CZ6508000000192000145399';
      expect(czechAccountToIban(existing)).toBe(existing);
    });

    it('normalizes lowercase existing IBAN to uppercase', () => {
      const lower = 'cz6508000000192000145399';
      expect(czechAccountToIban(lower)).toBe('CZ6508000000192000145399');
    });

    it('handles formatted input with internal and trailing whitespace', () => {
      const formatted = '  19 - 2000145399 / 0800  ';
      expect(czechAccountToIban(formatted)).toBe('CZ6508000000192000145399');
    });

    it('rejects an invalid existing IBAN with wrong MOD-97 check digits', () => {
      const corrupted = 'CZ0008000000192000145399'; // Check digits '00' are invalid
      expect(czechAccountToIban(corrupted)).toBeNull();
    });
  });

  // 6. Malformed and Empty Input Guards
  describe('Malformed and empty input guards', () => {
    it('returns null for empty string, null, undefined, or purely whitespace input', () => {
      expect(czechAccountToIban('')).toBeNull();
      expect(czechAccountToIban('   ')).toBeNull();
      expect(czechAccountToIban(null)).toBeNull();
      expect(czechAccountToIban(undefined)).toBeNull();
    });

    it('returns null for strings without bank code slash or with alphabetic account', () => {
      expect(czechAccountToIban('1234567890')).toBeNull();
      expect(czechAccountToIban('ABC-123456/0100')).toBeNull();
      expect(czechAccountToIban('12-34-56/0100')).toBeNull();
    });
  });
});
