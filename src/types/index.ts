export type WorkType = 
  | 'workshop_welding' 
  | 'site_assembly' 
  | 'service_emergency' 
  | 'travel_only';

export type ShiftSurchargeType = 'weekend' | 'night' | 'holiday';

export type WorkEntryStatus = 'draft' | 'submitted' | 'invoiced' | 'paid';

export type WeldingMethod = 'TIG' | 'MIG_MAG' | 'MMA' | 'AUTOGEN' | 'COMBINED' | 'NONE' | 'OTHER';

// ==========================================
// Milestone M2: Welding & Technical Passport (ČSN EN 1090-2 / ISO 9606-1)
// ==========================================

export type WeldingMethodCode = 
  | '141' 
  | '135' 
  | '136' 
  | '131' 
  | '111' 
  | '311' 
  | '141_135' 
  | '141_111' 
  | 'NONE';

export interface WeldingPassport {
  methodCode: WeldingMethodCode;
  methodName?: string;
  baseMaterialGrade: string; // e.g. "1.4404 (AISI 316L)", "S355J2"
  materialThickness: string; // e.g. "3.0 mm", "4-10 mm"
  shieldingGas: string;      // e.g. "Argon 100% (ISO 14175 I1)"
  fillerBatch: string;       // e.g. "Böhler ER316L, šarže #742198"
  rootBackingGas?: boolean;
  welderCertNumber?: string;
  weldInspectionVT?: 'passed_B' | 'passed_C' | 'failed' | 'not_required';
}

// ==========================================
// Milestone M3: Consumable Materials & Tags
// ==========================================

export type ConsumableCategory =
  | 'cutting_grinding'     // Řezné a brusné kotouče
  | 'technical_gases'      // Technické plyny
  | 'anchors'              // Kotevní technika
  | 'fasteners'            // Spojovací materiál DIN 933/934
  | 'welding_consumables'  // Přídavný svářecí drát, elektrody
  | 'custom';

export interface ConsumableItem {
  id: string;
  category: ConsumableCategory;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  markupPercent?: number;
  billedPrice: number;
}

export interface ConsumableSlip {
  items: ConsumableItem[];
  overheadMarkupPercent: number;
  fixedOverheadFee: number;
  totalMaterialCost: number;
  totalBilledAmount: number;
}

export type QuickActionTag = 
  | 'Příprava' 
  | 'Svařování' 
  | 'Montáž ve výškách' 
  | 'Broušení/začištění' 
  | 'Kotvení';

// ==========================================
// Milestone M4: Field Photo Documentation & Compression
// ==========================================

export interface EntryPhoto {
  id: string;
  entryId: string;
  createdAt: string;
  caption?: string;
  dataUrl: string;       // Compressed image with watermark (< 500 KB)
  thumbnailUrl: string;  // Fast thumbnail (320x240)
  sizeBytes: number;
  width: number;
  height: number;
}

export interface CompressPhotoOptions {
  file: File | Blob;
  projectCode: string;
  projectName: string;
  welderName?: string;
  caption?: string;
  maxDimension?: number;   // default 1920
  targetMaxBytes?: number; // default 500 * 1024 (512,000 bytes)
  timestamp?: string;
}

export interface CompressedPhotoResult {
  fullDataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface WatermarkOptions {
  projectCode: string;
  projectName: string;
  welderName?: string;
  activityCaption?: string;
  timestamp?: string;
}

export interface ProtocolPhotoItem {
  id: string;
  thumbnailUrl: string;
  caption: string;
  dateStr: string;
  timeStr: string;
}

export interface ExtraCostItem {
  id: string;
  description: string;
  amount: number;
}

/** Reusable catalog entry for materials, gases & consumables (Nastavení / Sazebník) */
export interface MaterialCatalogItem {
  id: string;
  name: string;
  unitPrice: number;
  unit: string; // e.g. 'ks', 'bal', 'm', 'hod'
}

export interface EntryPricing {
  baseHourlyRate: number;
  complexityMultiplier: number;
  shiftSurcharges: ShiftSurchargeType[];
  calculatedHourlyRate: number;
  manualTotalOverride?: number;
  isManualOverride?: boolean;
}

export type DietBandType = 'none' | 'band_1' | 'band_2' | 'band_3' | 'custom';
export type LegacyDietType = 'half_day' | 'full_day';
export type DietType = DietBandType | LegacyDietType;

export interface DietEstimateResult {
  allowance: number;
  type: DietBandType;
  description: string;
}

export interface EntryTravel {
  distanceKm: number;
  ratePerKm: number;
  travelTimeHours: number;
  travelHourlyRate: number;
  dietAllowance: number;
  dietType?: DietType;
  isManualDiet?: boolean;
  dietBandApplied?: DietBandType;
  customDietRate?: number;
}

export type ShiftEventType = 
  | 'shift_start' 
  | 'pause_start' 
  | 'pause_end' 
  | 'shift_end' 
  | 'note';

export interface ShiftTimelineEvent {
  id: string;
  timestamp: number; // Date.now()
  timeStr: string; // "07:00"
  type: ShiftEventType;
  title: string;
  description?: string;
}

export type LiveShiftStatus = 'idle' | 'running' | 'paused';

/** Typed checkout data produced by getShiftCheckoutData() */
export interface ShiftCheckoutData {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  startTimestamp: number;
  isAnomaly: boolean;
  anomalyReason: string;
  elapsedHours: number;
  isWarningLongShift: boolean;
  isSmartCheckoutRequired: boolean;
  clientName: string;
  projectName: string;
  workType: WorkType;
  weldingMethod: WeldingMethod;
  events: ShiftTimelineEvent[];
  notes: string;
}

/** Input validation limits */
export const INPUT_LIMITS = {
  MAX_DISTANCE_KM: 1500,      // realistický max za den (Praha–Berlín)
  MAX_HOURLY_RATE: 50_000,    // absolutní strop Kč/h
  MAX_BREAK_MINUTES: 480,     // max 8h pauza
  MAX_MANUAL_TOTAL: 500_000,  // max celková částka za jednu směnu
  MAX_EXTRA_COST: 200_000,    // max jedna extra položka
  MAX_TRAVEL_HOURS: 24,       // max 24h cestování
} as const;

export interface ActiveShiftState {
  status: LiveShiftStatus;
  startTimestamp: number | null; // Date.now() timestamp when shift started
  currentPauseStart: number | null; // Date.now() when current pause started
  totalPausedMs: number; // accumulated completed pause duration in ms
  events: ShiftTimelineEvent[];
  clientName: string;
  projectName: string;
  workType: WorkType;
  weldingMethod: WeldingMethod;
  notes: string;
  notifiedTenHours?: boolean;
}

export interface WorkEntry {
  id: string;
  date: string; // YYYY-MM-DD
  projectCode?: string;
  projectName: string;
  clientName: string;
  workType: WorkType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  totalHours: number;
  pricing: EntryPricing;
  travel: EntryTravel;
  extraCosts: ExtraCostItem[];
  totalEarnings: number;
  status: WorkEntryStatus;
  notes: string;
  weldingMethod?: WeldingMethod;
  weldingPassport?: WeldingPassport;
  consumableSlip?: ConsumableSlip;
  activityTags?: QuickActionTag[];
  workActionTags?: QuickActionTag[];
  photos?: EntryPhoto[];
  signatures?: DualSignaturesRecord;
  contractorSignature?: ProtocolSignature;
  clientSignature?: ProtocolSignature;
  isPdp?: boolean;
  timeline?: ShiftTimelineEvent[];
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentDueDate?: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftPreset {
  id: string;
  name: string;
  workType: WorkType;
  baseHourlyRate: number;
  complexityMultiplier: number;
  defaultBreakMinutes: number;
  defaultRatePerKm: number;
  defaultTravelHourlyRate: number;
  weldingMethod?: WeldingMethod;
  weldingPassport?: WeldingPassport;
  consumableSlip?: ConsumableSlip;
  activityTags?: QuickActionTag[];
  workActionTags?: QuickActionTag[];
  photos?: EntryPhoto[];
  signatures?: DualSignaturesRecord;
  notesTemplate?: string;
  isDefault?: boolean;
}

export interface ContractorProfile {
  name: string;
  tradeTitle: string;
  ico: string;
  dic?: string;
  address: string;
  city: string;
  zip: string;
  bankAccount: string;
  bankCode?: string;
  iban?: string;
  swift?: string;
  phone: string;
  email: string;
  certifications?: string; // např. "ČSN EN ISO 9606-1 (141, 135)"
}

export interface ClientProfile {
  id: string;
  name: string;
  ico?: string;
  dic?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  defaultKm?: number;
  defaultRateOverride?: number;
  isPdpDefault?: boolean;
  isPdp?: boolean;
}

export interface SurchargeConfig {
  weekendPercent: number; // e.g. 25 (%)
  nightPercent: number;   // e.g. 20 (%)
  holidayPercent: number; // e.g. 50 (%)
  fixedWeekendBonus: number; // fixní Kč/h navíc, pokud preferováno
  fixedNightBonus: number;
  fixedHolidayBonus: number;
  useFixedBonus: boolean;
}

export interface RatesConfig {
  defaultWorkshopRate: number;
  defaultSiteAssemblyRate: number;
  defaultEmergencyRate: number;
  defaultTravelOnlyRate: number;
  defaultRatePerKm: number;
  defaultTravelHourlyRate: number;
  dietHalfDayRate: number; // 5-12h (Pásmo 1 MPSV, výchozí 166 Kč)
  dietFullDayRate: number; // 12-18h (Pásmo 2 MPSV, výchozí 256 Kč)
  dietOver18Rate: number;  // >18h (Pásmo 3 MPSV, výchozí 398 Kč)
  dietBand1Rate?: number;
  dietBand2Rate?: number;
  dietBand3Rate?: number;
  surcharges: SurchargeConfig;
}

export interface AppSettings {
  id: string;
  contractor: ContractorProfile;
  rates: RatesConfig;
  clients: ClientProfile[];
  materialCatalog: MaterialCatalogItem[];
  /** Last protocol number issued from the A4 handover report (PR-YYYY/XXX), used to suggest the next one. */
  lastProtocolNumber?: string;
  darkMode: boolean;
  currencySymbol: string;
  shiftAnomalyLimitHours: number;
}

// ==========================================
// Milestone M5: Digital Handover Protocol, Sign-on-Glass & SPAYD
// ==========================================

export type SignatureRole = 'contractor' | 'client';
export type ProtocolSigningStatus = 'unsigned' | 'partially_signed' | 'fully_signed';

export interface ProtocolSignature {
  dataUrl: string;       // Trimmed transparent PNG data URL
  signerName: string;
  signedAt: string;      // ISO 8601 string
  role: SignatureRole;
}

export interface DualSignaturesRecord {
  contractor?: ProtocolSignature;
  client?: ProtocolSignature;
}

export interface SpaydParams {
  accountOrIban: string;
  iban?: string;
  amount: number;
  currency?: 'CZK' | 'EUR';
  variableSymbol?: string;
  vs?: string;
  message?: string;
  dueDate?: string; // YYYY-MM-DD or YYYYMMDD
  constantSymbol?: string;
  specificSymbol?: string;
}

export interface SignaturePoint {
  x: number;
  y: number;
  time?: number;
  pressure?: number;
}

export interface SignatureStroke {
  points: SignaturePoint[];
  color?: string;
  lineWidth?: number;
}

