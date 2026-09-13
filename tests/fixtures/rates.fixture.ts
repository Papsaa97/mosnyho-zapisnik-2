import { RatesConfig, SurchargeConfig } from '../../src/types';

export const MPSV_LEGAL_RATES_2026 = {
  tier1_5_to_12h: 166,  // Pásmo 1: 5–12 hod
  tier2_12_to_18h: 256, // Pásmo 2: 12–18 hod
  tier3_over_18h: 398,  // Pásmo 3: nad 18 hod
  tier0_under_5h: 0,    // Méně než 5 hod: 0 Kč
} as const;

export const DEFAULT_SURCHARGE_CONFIG: SurchargeConfig = {
  weekendPercent: 25,
  nightPercent: 20,
  holidayPercent: 50,
  fixedWeekendBonus: 120,
  fixedNightBonus: 100,
  fixedHolidayBonus: 250,
  useFixedBonus: false,
};

export const FIXED_SURCHARGE_CONFIG: SurchargeConfig = {
  weekendPercent: 0,
  nightPercent: 0,
  holidayPercent: 0,
  fixedWeekendBonus: 150,
  fixedNightBonus: 120,
  fixedHolidayBonus: 300,
  useFixedBonus: true,
};

export const STANDARD_RATES_FIXTURE: RatesConfig = {
  defaultWorkshopRate: 480,
  defaultSiteAssemblyRate: 620,
  defaultEmergencyRate: 850,
  defaultTravelOnlyRate: 350,
  defaultRatePerKm: 11,
  defaultTravelHourlyRate: 350,
  dietHalfDayRate: 166, // Pásmo 1 fallback
  dietFullDayRate: 256, // Pásmo 2 fallback
  dietOver18Rate: 398,  // Pásmo 3 fallback
  dietBand1Rate: 166,
  dietBand2Rate: 256,
  dietBand3Rate: 398,
  surcharges: DEFAULT_SURCHARGE_CONFIG,
};

export const CUSTOM_PREMIUM_RATES_FIXTURE: RatesConfig = {
  defaultWorkshopRate: 650,
  defaultSiteAssemblyRate: 850,
  defaultEmergencyRate: 1200,
  defaultTravelOnlyRate: 450,
  defaultRatePerKm: 14,
  defaultTravelHourlyRate: 450,
  dietHalfDayRate: 200,
  dietFullDayRate: 320,
  dietOver18Rate: 480,
  dietBand1Rate: 200,
  dietBand2Rate: 320,
  dietBand3Rate: 480,
  surcharges: {
    ...DEFAULT_SURCHARGE_CONFIG,
    weekendPercent: 35,
    nightPercent: 30,
    holidayPercent: 75,
  },
};
