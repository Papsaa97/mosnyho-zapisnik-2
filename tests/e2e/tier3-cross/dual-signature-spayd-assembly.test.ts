import { describe, it, expect } from 'vitest';
import {
  ProtocolSignature,
  CONTRACTOR_SIGNATURE_FIXTURE,
  CLIENT_SIGNATURE_FIXTURE,
} from '../../fixtures/signatures.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';

import { generateSpaydString, czechAccountToIban } from '../../../src/services/spaydService';
import type { SpaydParams } from '../../../src/types';

export { generateSpaydString, czechAccountToIban };
export type { SpaydParams };

describe('Tier 3 Cross-Feature: Dual Signature & SPAYD Handover Assembly (dual-signature-spayd-assembly.test.ts)', () => {
  // 1. Dual Signatures Capture & Differentiation
  it('verifies independent dual signature capture with contractor and client roles', () => {
    const contractorSig: ProtocolSignature = CONTRACTOR_SIGNATURE_FIXTURE;
    const clientSig: ProtocolSignature = CLIENT_SIGNATURE_FIXTURE;

    expect(contractorSig.role).toBe('contractor');
    expect(contractorSig.signerName).toContain('Zhotovitel');
    expect(contractorSig.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Date.parse(contractorSig.signedAt)).not.toBeNaN();

    expect(clientSig.role).toBe('client');
    expect(clientSig.signerName).toContain('Objednatel');
    expect(clientSig.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Date.parse(clientSig.signedAt)).not.toBeNaN();

    // Verify signatures are distinct entities
    expect(contractorSig.role).not.toBe(clientSig.role);
    expect(contractorSig.signerName).not.toBe(clientSig.signerName);
  });

  // 2. Domestic SPAYD QR String Generation with Synthesized IBAN
  it('generates compliant SPAYD 1.0 payment string from domestic bank account', () => {
    const contractor = PRIMARY_CONTRACTOR_FIXTURE;
    const invoiceAmount = 14500.5;
    const rawVs = 'PR-2026/03-01'; // contains symbols to clean

    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount, // '123456789/0100'
      amount: invoiceAmount,
      variableSymbol: rawVs,
      message: 'Faktura za montáž a svářečské práce Most SO201',
    });

    expect(spayd).not.toBeNull();
    // Valid prefix
    expect(spayd).toMatch(/^SPD\*1\.0\*/);
    // IBAN synthesised via MOD-97
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    // Amount with 2 decimal places
    expect(spayd).toContain('AM:14500.50*CC:CZK');
    // Cleaned variable symbol (digits only: '20260301')
    expect(spayd).toContain('X-VS:20260301');
    // Diacritics stripped from message
    expect(spayd).toContain('MSG:Faktura za montaz a svarecske prace Most SO201');
    // Must end with asterisk delimiter
    expect(spayd?.endsWith('*')).toBe(true);
  });

  // 3. A4 Handover Protocol Document Assembly Integration
  it('assembles full protocol document with dual signatures, SPAYD QR, and print-ready metadata', () => {
    const protocolDocument = {
      protocolId: 'PR-2026/03-01',
      dateIssued: '2026-03-02',
      contractor: PRIMARY_CONTRACTOR_FIXTURE,
      clientName: 'Metrostav DIZ s.r.o.',
      totalHours: 10.0,
      totalAmount: 12008,
      isPdp: true,
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
        client: CLIENT_SIGNATURE_FIXTURE,
      },
      spaydQrPayload: generateSpaydString({
        accountOrIban: PRIMARY_CONTRACTOR_FIXTURE.bankAccount,
        amount: 12008,
        variableSymbol: '20260301',
        message: 'Prevadaci protokol PR-2026/03-01',
      }),
      printLayoutClasses: {
        container: 'print-container',
        nonPrintableControls: 'no-print',
        signatureBox: 'page-break-inside-avoid',
        pdpStatutoryBlock: 'page-break-inside-avoid',
      },
    };

    expect(protocolDocument.signatures.contractor).toBeDefined();
    expect(protocolDocument.signatures.client).toBeDefined();
    expect(protocolDocument.spaydQrPayload).not.toBeNull();
    expect(protocolDocument.spaydQrPayload).toContain('ACC:CZ1801000000000123456789');
    expect(protocolDocument.printLayoutClasses.signatureBox).toBe('page-break-inside-avoid');
    expect(protocolDocument.isPdp).toBe(true);
  });
});
