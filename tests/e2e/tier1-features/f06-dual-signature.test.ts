import { describe, it, expect } from 'vitest';
import {
  CONTRACTOR_SIGNATURE_FIXTURE,
  CLIENT_SIGNATURE_FIXTURE,
  CONTRACTOR_PNG_DATA_URL,
  CLIENT_PNG_DATA_URL,
} from '../../fixtures/signatures.fixture';
import { DualSignatureProtocol } from '../../../src/components/signature/SignaturePadModal';
import type {
  SignatureRole,
  ProtocolSigningStatus,
  DualSignaturesRecord,
  ProtocolSignature,
} from '../../../src/types';

export { DualSignatureProtocol };
export type { SignatureRole, ProtocolSigningStatus, DualSignaturesRecord, ProtocolSignature };

describe('Feature 6: Dual Signature Protocol (f06-dual-signature)', () => {
  it('creates valid ProtocolSignature structure for contractor with role, name, and ISO timestamp', () => {
    const sig = DualSignatureProtocol.createSignature(
      'contractor',
      'Jan Novák (Zhotovitel)',
      CONTRACTOR_PNG_DATA_URL,
      '2026-03-02T16:45:00.000Z'
    );

    expect(sig.role).toBe('contractor');
    expect(sig.signerName).toBe('Jan Novák (Zhotovitel)');
    expect(sig.dataUrl).toBe(CONTRACTOR_PNG_DATA_URL);
    expect(sig.signedAt).toBe('2026-03-02T16:45:00.000Z');
  });

  it('creates valid ProtocolSignature structure for client/supervisor with role, name, and ISO timestamp', () => {
    const sig = DualSignatureProtocol.createSignature(
      'client',
      'Ing. Karel Dvořák (Objednatel / TDI)',
      CLIENT_PNG_DATA_URL,
      '2026-03-02T17:00:00.000Z'
    );

    expect(sig.role).toBe('client');
    expect(sig.signerName).toBe('Ing. Karel Dvořák (Objednatel / TDI)');
    expect(sig.dataUrl).toBe(CLIENT_PNG_DATA_URL);
    expect(sig.signedAt).toBe('2026-03-02T17:00:00.000Z');
  });

  it('validates protocol completion: recognizes unsigned, partially signed, and fully signed states', () => {
    // Unsigned
    expect(DualSignatureProtocol.getStatus(null)).toBe('unsigned');
    expect(DualSignatureProtocol.getStatus({})).toBe('unsigned');
    expect(DualSignatureProtocol.isFullySigned({})).toBe(false);
    expect(DualSignatureProtocol.getMissingRoles({})).toEqual(['contractor', 'client']);

    // Partially signed: contractor only
    const contractorOnly: DualSignaturesRecord = {
      contractor: CONTRACTOR_SIGNATURE_FIXTURE,
    };
    expect(DualSignatureProtocol.getStatus(contractorOnly)).toBe('partially_signed');
    expect(DualSignatureProtocol.isFullySigned(contractorOnly)).toBe(false);
    expect(DualSignatureProtocol.getMissingRoles(contractorOnly)).toEqual(['client']);

    // Partially signed: client only
    const clientOnly: DualSignaturesRecord = {
      client: CLIENT_SIGNATURE_FIXTURE,
    };
    expect(DualSignatureProtocol.getStatus(clientOnly)).toBe('partially_signed');
    expect(DualSignatureProtocol.isFullySigned(clientOnly)).toBe(false);
    expect(DualSignatureProtocol.getMissingRoles(clientOnly)).toEqual(['contractor']);

    // Fully signed: both parties
    const dualSigned: DualSignaturesRecord = {
      contractor: CONTRACTOR_SIGNATURE_FIXTURE,
      client: CLIENT_SIGNATURE_FIXTURE,
    };
    expect(DualSignatureProtocol.getStatus(dualSigned)).toBe('fully_signed');
    expect(DualSignatureProtocol.isFullySigned(dualSigned)).toBe(true);
    expect(DualSignatureProtocol.getMissingRoles(dualSigned)).toHaveLength(0);
  });

  it('verifies ISO 8601 timestamp format and disallows future timestamp anomalies', () => {
    // Malformed timestamp string
    expect(() => {
      DualSignatureProtocol.createSignature(
        'contractor',
        'Test Welder',
        CONTRACTOR_PNG_DATA_URL,
        'invalid-date'
      );
    }).toThrow(/Invalid signedAt timestamp/);

    // Far-future timestamp (e.g. 2099)
    expect(() => {
      DualSignatureProtocol.createSignature(
        'client',
        'Future Inspector',
        CLIENT_PNG_DATA_URL,
        '2099-01-01T00:00:00.000Z'
      );
    }).toThrow(/Future signature timestamp rejected/);
  });

  it('allows independent signing: signing as client preserves existing contractor signature', () => {
    let signatures: DualSignaturesRecord = {};

    // 1. Contractor signs first
    signatures = DualSignatureProtocol.applySignature(signatures, CONTRACTOR_SIGNATURE_FIXTURE);
    expect(signatures.contractor).toBeDefined();
    expect(signatures.client).toBeUndefined();

    // 2. Client signs later
    signatures = DualSignatureProtocol.applySignature(signatures, CLIENT_SIGNATURE_FIXTURE);
    expect(signatures.contractor?.signerName).toBe(CONTRACTOR_SIGNATURE_FIXTURE.signerName);
    expect(signatures.client?.signerName).toBe(CLIENT_SIGNATURE_FIXTURE.signerName);
    expect(DualSignatureProtocol.isFullySigned(signatures)).toBe(true);

    // 3. Clear client signature does not wipe contractor
    signatures = DualSignatureProtocol.clearSignature(signatures, 'client');
    expect(signatures.contractor).toBeDefined();
    expect(signatures.client).toBeUndefined();
    expect(DualSignatureProtocol.getStatus(signatures)).toBe('partially_signed');
  });

  it('rejects invalid signatures missing signerName or with empty dataUrl', () => {
    expect(() => {
      DualSignatureProtocol.createSignature('contractor', '', CONTRACTOR_PNG_DATA_URL);
    }).toThrow(/Signer name cannot be empty/);

    expect(() => {
      DualSignatureProtocol.createSignature('contractor', '   ', CONTRACTOR_PNG_DATA_URL);
    }).toThrow(/Signer name cannot be empty/);

    expect(() => {
      DualSignatureProtocol.createSignature('contractor', 'Jan Novák', '');
    }).toThrow(/Invalid signature image/);

    expect(() => {
      DualSignatureProtocol.createSignature('contractor', 'Jan Novák', 'http://example.com/sig.png');
    }).toThrow(/Invalid signature image/);
  });

  it('enforces strict role discrimination between contractor and client', () => {
    expect(() => {
      DualSignatureProtocol.createSignature(
        'invalid_role' as any,
        'Test Person',
        CONTRACTOR_PNG_DATA_URL
      );
    }).toThrow(/Invalid signature role/);
  });
});
