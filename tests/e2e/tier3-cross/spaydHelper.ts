/**
 * Proxy helper re-exporting genuine production SPAYD service symbols
 * for backwards compatibility with cross-tier test suites.
 */
export {
  czechAccountToIban,
  generateSpaydString,
  SpaydService,
} from '../../../src/services/spaydService';

export type { SpaydParams } from '../../../src/types';
