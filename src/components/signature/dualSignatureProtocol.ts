import {
  ProtocolSignature,
  SignatureRole,
  ProtocolSigningStatus,
  DualSignaturesRecord,
} from '../../types';

/**
 * Dual Signature Protocol Manager
 * Enforces dual Sign-on-Glass protocol between contractor and client/TDI
 * per ORIGINAL_REQUEST §R1 & PROJECT.md #6 & Interface Contracts §5.
 */
export class DualSignatureProtocol {
  public static createSignature(
    role: SignatureRole,
    signerName: string,
    dataUrl: string,
    signedAt: string = new Date().toISOString()
  ): ProtocolSignature {
    if (!role || (role !== 'contractor' && role !== 'client')) {
      throw new Error(`Invalid signature role: '${role}'. Expected 'contractor' or 'client'.`);
    }

    if (!signerName || signerName.trim().length === 0) {
      throw new Error('Signer name cannot be empty.');
    }

    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Invalid signature image: must be a valid PNG Base64 data URL.');
    }

    const parsedTime = Date.parse(signedAt);
    if (isNaN(parsedTime)) {
      throw new Error(`Invalid signedAt timestamp: '${signedAt}' is not ISO 8601.`);
    }

    // Guard against far-future timestamps (allow 5 minute clock skew)
    if (parsedTime > Date.now() + 5 * 60 * 1000) {
      throw new Error(`Future signature timestamp rejected: ${signedAt}`);
    }

    return {
      role,
      signerName: signerName.trim(),
      dataUrl,
      signedAt: new Date(parsedTime).toISOString(),
    };
  }

  public static getStatus(signatures?: DualSignaturesRecord | null): ProtocolSigningStatus {
    if (!signatures) return 'unsigned';
    const hasContractor = !!signatures.contractor?.dataUrl && !!signatures.contractor?.signerName;
    const hasClient = !!signatures.client?.dataUrl && !!signatures.client?.signerName;

    if (hasContractor && hasClient) return 'fully_signed';
    if (hasContractor || hasClient) return 'partially_signed';
    return 'unsigned';
  }

  public static isFullySigned(signatures?: DualSignaturesRecord | null): boolean {
    return this.getStatus(signatures) === 'fully_signed';
  }

  public static getMissingRoles(signatures?: DualSignaturesRecord | null): SignatureRole[] {
    const missing: SignatureRole[] = [];
    if (!signatures?.contractor?.dataUrl) missing.push('contractor');
    if (!signatures?.client?.dataUrl) missing.push('client');
    return missing;
  }

  public static applySignature(
    current: DualSignaturesRecord | undefined,
    signature: ProtocolSignature
  ): DualSignaturesRecord {
    const next: DualSignaturesRecord = { ...(current || {}) };
    if (signature.role === 'contractor') {
      next.contractor = signature;
    } else if (signature.role === 'client') {
      next.client = signature;
    }
    return next;
  }

  public static clearSignature(
    current: DualSignaturesRecord | undefined,
    role: SignatureRole
  ): DualSignaturesRecord {
    const next: DualSignaturesRecord = { ...(current || {}) };
    delete next[role];
    return next;
  }
}
