export type WorkType = 
  | 'workshop_welding' 
  | 'site_assembly' 
  | 'service_emergency' 
  | 'travel_only';

export type ShiftSurchargeType = 'weekend' | 'night' | 'holiday';

export type WorkEntryStatus = 'draft' | 'submitted' | 'invoiced' | 'paid';

export type WeldingMethod = 'TIG' | 'MIG_MAG' | 'MMA' | 'AUTOGEN' | 'COMBINED' | 'NONE' | 'OTHER';

export interface ExtraCostItem {
  id: string;
  description: string;
  amount: number;
}

export interface EntryPricing {
  baseHourlyRate: number;
  complexityMultiplier: number;
  shiftSurcharges: ShiftSurchargeType[];
  calculatedHourlyRate: number;
  manualHourlyRateOverride?: number;
  manualTotalOverride?: number;
  isManualOverride?: boolean;
}

export interface EntryTravel {
  distanceKm: number;
  ratePerKm: number;
  travelTimeHours: number;
  travelHourlyRate: number;
  dietAllowance: number;
  dietType?: 'none' | 'half_day' | 'full_day' | 'custom';
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

export interface ActiveShiftState {
  status: LiveShiftStatus;
  startTimestamp: number | null; // Date.now() timestamp when shift started
  currentPauseStart: number | null; // Date.now() when current pause started
  totalPausedMs: number; // accumulated completed pause duration in ms
  events: ShiftTimelineEvent[];
  clientName: string;
  projectName: string;
  projectCode: string;
  workType: WorkType;
  weldingMethod: WeldingMethod;
  notes: string;
  notifiedTenHours?: boolean;
}

export interface WorkEntry {
  id: string;
  date: string; // YYYY-MM-DD
  projectCode: string;
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
  description: string;
  workType: WorkType;
  baseHourlyRate: number;
  complexityMultiplier: number;
  defaultBreakMinutes: number;
  defaultRatePerKm: number;
  defaultTravelHourlyRate: number;
  weldingMethod?: WeldingMethod;
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
  dietHalfDayRate: number; // 5-12h
  dietFullDayRate: number; // >12h
  surcharges: SurchargeConfig;
}

export interface AppSettings {
  id: string;
  contractor: ContractorProfile;
  rates: RatesConfig;
  clients: ClientProfile[];
  darkMode: boolean;
  currencySymbol: string;
}
