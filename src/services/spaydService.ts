import { SpaydParams } from '../types';

/**
 * Domestic SPAYD Generator & MOD-97 Czech Account to IBAN Synthesizer
 * Formats payments according to Czech Banking Association (ČBA) SPAYD 1.0
 * and ISO 7064 / ISO 13616 standards per ORIGINAL_REQUEST §R1 & PROJECT.md §5.
 */

/**
 * Synthesizes a valid ISO 13616 Czech IBAN from domestic account format:
 * [prefix-]accountNumber/bankCode
 * Also validates existing valid Czech IBANs.
 */
export function czechAccountToIban(accountStr: string | null | undefined): string | null {
  if (!accountStr || typeof accountStr !== 'string') return null;
  const cleaned = accountStr.trim().replace(/\s+/g, '');
  if (!cleaned) return null;

  // Already a valid 24-character Czech IBAN
  if (/^CZ\d{22}$/i.test(cleaned)) {
    const uppercase = cleaned.toUpperCase();
    // Validate MOD-97 on existing IBAN: move CZ (1235) to end
    const bban = uppercase.slice(4);
    const check = uppercase.slice(2, 4);
    const numStr = `${bban}1235${check}`;
    try {
      if (BigInt(numStr) % 97n === 1n) {
        return uppercase;
      }
    } catch {
      return null;
    }
    return null;
  }

  // Format: [prefix (1-6 digits)-]account (2-10 digits)/bankCode (4 digits)
  const match = cleaned.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const prefix = (match[1] || '').padStart(6, '0');
  const account = match[2].padStart(10, '0');
  const bankCode = match[3];

  // BBAN for Czech Republic is exactly 20 digits: bankCode (4) + prefix (6) + account (10)
  const bban = `${bankCode}${prefix}${account}`;

  // ISO 7064 MOD-97-10 calculation:
  // Move 'CZ00' to end -> 'C' = 12, 'Z' = 35, '00' = 00 -> 123500
  const numericString = `${bban}123500`;
  try {
    const remainder = Number(BigInt(numericString) % 97n);
    const checkDigits = String(98 - remainder).padStart(2, '0');
    return `CZ${checkDigits}${bban}`;
  } catch {
    return null;
  }
}

/**
 * Standard SPAYD 1.0 generator adhering to ČBA and PROJECT.md §5 specifications.
 * Format: SPD*1.0*ACC:...*AM:...*CC:CZK*MSG:...*X-VS:...*
 */
export function generateSpaydString(params: SpaydParams): string | null {
  if (!params) return null;
  const rawAccount = params.accountOrIban || params.iban;
  const iban = czechAccountToIban(typeof rawAccount === 'string' ? rawAccount : null);
  if (!iban) return null;

  if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount < 0) {
    return null;
  }

  const parts: string[] = ['SPD', '1.0', `ACC:${iban}`];

  if (params.amount > 0) {
    parts.push(`AM:${params.amount.toFixed(2)}`);
    let cleanCurrency = 'CZK';
    if (params.currency && typeof params.currency === 'string') {
      const firstToken = params.currency.split(/[*:\s]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
      if (firstToken.length === 3) {
        cleanCurrency = firstToken;
      }
    }
    parts.push(`CC:${cleanCurrency}`);
  }

  const rawVs = params.variableSymbol ?? params.vs;
  if (rawVs && typeof rawVs === 'string') {
    const cleanVs = rawVs.replace(/[^0-9]/g, '').substring(0, 10);
    if (cleanVs) parts.push(`X-VS:${cleanVs}`);
  }

  if (params.constantSymbol) {
    const cleanKs = params.constantSymbol.replace(/[^0-9]/g, '').substring(0, 4);
    if (cleanKs) parts.push(`X-KS:${cleanKs}`);
  }

  if (params.specificSymbol) {
    const cleanSs = params.specificSymbol.replace(/[^0-9]/g, '').substring(0, 10);
    if (cleanSs) parts.push(`X-SS:${cleanSs}`);
  }

  if (params.dueDate) {
    const cleanDate = params.dueDate.replace(/[^0-9]/g, '').substring(0, 8);
    if (cleanDate.length === 8) parts.push(`DT:${cleanDate}`);
  }

  if (params.message) {
    // Strip diacritics and non-ASCII chars, forbidden delimiter '*'
    const cleanMsg = params.message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ._\-+/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 60);
    if (cleanMsg) parts.push(`MSG:${cleanMsg}`);
  }

  return parts.join('*') + '*';
}

/**
 * Service class wrapper for object-oriented or static usage
 */
export class SpaydService {
  public static czechAccountToIban = czechAccountToIban;
  public static generateSpaydString = generateSpaydString;
}
