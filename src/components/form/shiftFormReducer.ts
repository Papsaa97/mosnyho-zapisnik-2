import { 
  WorkType, 
  WeldingMethod, 
  WeldingPassport, 
  ShiftSurchargeType, 
  ExtraCostItem, 
  WorkEntryStatus, 
  WorkEntry, 
  DietType, 
  DietBandType, 
  ClientProfile, 
  RatesConfig,
  ConsumableItem,
  ConsumableSlip,
  QuickActionTag,
  EntryPhoto
} from '../../types';
import { 
  normalizeDietType, 
  calculateNetHours, 
  estimateDiet,
  calculateConsumableItemBilledPrice,
  calculateConsumableSlipTotals
} from '../../services/pricingEngine';
import { toggleActivityChip } from '../../services/consumablesCatalog';

export interface ShiftFormState {
  // Identification
  date: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  workType: WorkType;
  weldingMethod: WeldingMethod;
  weldingPassport?: WeldingPassport;
  isPdp: boolean;
  // Time
  startTime: string;
  endTime: string;
  breakMinutes: number;
  // Pricing
  baseHourlyRate: number;
  complexityMultiplier: number;
  shiftSurcharges: ShiftSurchargeType[];
  isManualOverride: boolean;
  manualTotalOverride: number;
  // Travel
  distanceKm: number;
  ratePerKm: number;
  travelTimeHours: number;
  travelHourlyRate: number;
  dietAllowance: number;
  dietType: DietType;
  isManualDiet: boolean;
  customDietRate: number;
  dietBandApplied: DietBandType;
  // Extras & Notes
  extraCosts: ExtraCostItem[];
  consumableSlip?: ConsumableSlip;
  activityTags: QuickActionTag[];
  photos: EntryPhoto[];
  notes: string;
  status: WorkEntryStatus;
  invoiceNumber: string;
}

export type ShiftFormAction =
  | { type: 'SET_FIELD'; field: keyof ShiftFormState; value: ShiftFormState[keyof ShiftFormState] }
  | { type: 'TOGGLE_SURCHARGE'; surcharge: ShiftSurchargeType }
  | { type: 'ADD_EXTRA'; item: ExtraCostItem }
  | { type: 'REMOVE_EXTRA'; id: string }
  | { type: 'APPEND_NOTE_TAG'; tag: string }
  | { type: 'APPLY_PRESET'; preset: Partial<ShiftFormState> }
  | { type: 'SET_DIET'; dietType: DietType; allowance: number; isManual?: boolean }
  | { type: 'SET_CONSUMABLE_SLIP'; slip?: ConsumableSlip }
  | { type: 'ADD_CONSUMABLE_ITEM'; item: ConsumableItem }
  | { type: 'REMOVE_CONSUMABLE_ITEM'; id: string }
  | { type: 'UPDATE_CONSUMABLE_ITEM_QTY'; id: string; quantity: number }
  | { type: 'SET_CONSUMABLE_MARKUP'; markupPercent: number }
  | { type: 'SET_CONSUMABLE_FIXED_FEE'; fee: number }
  | { type: 'TOGGLE_ACTIVITY_TAG'; tag: QuickActionTag }
  | { type: 'ADD_PHOTO'; photo: EntryPhoto }
  | { type: 'REMOVE_PHOTO'; id: string }
  | { type: 'UPDATE_PHOTO_CAPTION'; id: string; caption: string }
  | { type: 'SET_PHOTOS'; photos: EntryPhoto[] }
  | { type: 'RESET'; state: ShiftFormState };

export function shiftFormReducer(state: ShiftFormState, action: ShiftFormAction): ShiftFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'TOGGLE_SURCHARGE': {
      const surcharges = state.shiftSurcharges.includes(action.surcharge)
        ? state.shiftSurcharges.filter(s => s !== action.surcharge)
        : [...state.shiftSurcharges, action.surcharge];
      return { ...state, shiftSurcharges: surcharges };
    }
    case 'ADD_EXTRA':
      return { ...state, extraCosts: [...state.extraCosts, action.item] };
    case 'REMOVE_EXTRA':
      return { ...state, extraCosts: state.extraCosts.filter(i => i.id !== action.id) };
    case 'APPEND_NOTE_TAG': {
      const notes = state.notes ? `${state.notes} | ${action.tag}` : action.tag;
      return { ...state, notes };
    }
    case 'APPLY_PRESET':
      return { ...state, ...action.preset };
    case 'SET_DIET':
      return { 
        ...state, 
        dietType: action.dietType, 
        dietAllowance: action.allowance,
        dietBandApplied: normalizeDietType(action.dietType),
        isManualDiet: action.isManual !== undefined ? action.isManual : state.isManualDiet,
        customDietRate: action.dietType === 'custom' ? action.allowance : state.customDietRate
      };
    case 'TOGGLE_ACTIVITY_TAG': {
      const activityTags = toggleActivityChip(state.activityTags || [], action.tag);
      return { ...state, activityTags };
    }
    case 'SET_CONSUMABLE_SLIP': {
      return { ...state, consumableSlip: action.slip };
    }
    case 'ADD_CONSUMABLE_ITEM': {
      const currentSlip = state.consumableSlip || {
        items: [],
        overheadMarkupPercent: 0,
        fixedOverheadFee: 0,
        totalMaterialCost: 0,
        totalBilledAmount: 0,
      };
      const existingIndex = currentSlip.items.findIndex(
        i => i.id === action.item.id || (i.name === action.item.name && i.unitPrice === action.item.unitPrice)
      );
      let updatedItems: ConsumableItem[];
      if (existingIndex >= 0) {
        updatedItems = currentSlip.items.map((it, idx) => {
          if (idx === existingIndex) {
            const newQty = it.quantity + action.item.quantity;
            const effectiveMarkup = it.markupPercent !== undefined ? it.markupPercent : currentSlip.overheadMarkupPercent;
            const billedPrice = calculateConsumableItemBilledPrice(newQty, it.unitPrice, effectiveMarkup);
            return { ...it, quantity: newQty, billedPrice };
          }
          return it;
        });
      } else {
        const itemWithBilled = {
          ...action.item,
          billedPrice: action.item.billedPrice || calculateConsumableItemBilledPrice(
            action.item.quantity,
            action.item.unitPrice,
            action.item.markupPercent ?? currentSlip.overheadMarkupPercent
          ),
        };
        updatedItems = [...currentSlip.items, itemWithBilled];
      }
      const totals = calculateConsumableSlipTotals(updatedItems, currentSlip.overheadMarkupPercent, currentSlip.fixedOverheadFee);
      return {
        ...state,
        consumableSlip: {
          items: updatedItems,
          overheadMarkupPercent: currentSlip.overheadMarkupPercent,
          fixedOverheadFee: currentSlip.fixedOverheadFee,
          totalMaterialCost: totals.totalMaterialCost,
          totalBilledAmount: totals.totalBilledAmount,
        },
      };
    }
    case 'REMOVE_CONSUMABLE_ITEM': {
      if (!state.consumableSlip) return state;
      const updatedItems = state.consumableSlip.items.filter(i => i.id !== action.id);
      const totals = calculateConsumableSlipTotals(
        updatedItems,
        state.consumableSlip.overheadMarkupPercent,
        state.consumableSlip.fixedOverheadFee
      );
      return {
        ...state,
        consumableSlip: {
          ...state.consumableSlip,
          items: updatedItems,
          totalMaterialCost: totals.totalMaterialCost,
          totalBilledAmount: totals.totalBilledAmount,
        },
      };
    }
    case 'UPDATE_CONSUMABLE_ITEM_QTY': {
      if (!state.consumableSlip) return state;
      let updatedItems: ConsumableItem[];
      if (action.quantity <= 0) {
        updatedItems = state.consumableSlip.items.filter(i => i.id !== action.id);
      } else {
        updatedItems = state.consumableSlip.items.map(it => {
          if (it.id === action.id) {
            const effectiveMarkup = it.markupPercent !== undefined ? it.markupPercent : state.consumableSlip!.overheadMarkupPercent;
            const billedPrice = calculateConsumableItemBilledPrice(action.quantity, it.unitPrice, effectiveMarkup);
            return { ...it, quantity: action.quantity, billedPrice };
          }
          return it;
        });
      }
      const totals = calculateConsumableSlipTotals(
        updatedItems,
        state.consumableSlip.overheadMarkupPercent,
        state.consumableSlip.fixedOverheadFee
      );
      return {
        ...state,
        consumableSlip: {
          ...state.consumableSlip,
          items: updatedItems,
          totalMaterialCost: totals.totalMaterialCost,
          totalBilledAmount: totals.totalBilledAmount,
        },
      };
    }
    case 'SET_CONSUMABLE_MARKUP': {
      const currentSlip = state.consumableSlip || {
        items: [],
        overheadMarkupPercent: 0,
        fixedOverheadFee: 0,
        totalMaterialCost: 0,
        totalBilledAmount: 0,
      };
      const updatedItems = currentSlip.items.map(it => {
        const markup = it.markupPercent !== undefined ? it.markupPercent : action.markupPercent;
        return {
          ...it,
          billedPrice: calculateConsumableItemBilledPrice(it.quantity, it.unitPrice, markup),
        };
      });
      const totals = calculateConsumableSlipTotals(updatedItems, action.markupPercent, currentSlip.fixedOverheadFee);
      return {
        ...state,
        consumableSlip: {
          ...currentSlip,
          items: updatedItems,
          overheadMarkupPercent: action.markupPercent,
          totalMaterialCost: totals.totalMaterialCost,
          totalBilledAmount: totals.totalBilledAmount,
        },
      };
    }
    case 'SET_CONSUMABLE_FIXED_FEE': {
      const currentSlip = state.consumableSlip || {
        items: [],
        overheadMarkupPercent: 0,
        fixedOverheadFee: 0,
        totalMaterialCost: 0,
        totalBilledAmount: 0,
      };
      const totals = calculateConsumableSlipTotals(
        currentSlip.items,
        currentSlip.overheadMarkupPercent,
        action.fee
      );
      return {
        ...state,
        consumableSlip: {
          ...currentSlip,
          fixedOverheadFee: Math.max(0, Number(action.fee) || 0),
          totalMaterialCost: totals.totalMaterialCost,
          totalBilledAmount: totals.totalBilledAmount,
        },
      };
    }
    case 'ADD_PHOTO':
      return { ...state, photos: [...(state.photos || []), action.photo] };
    case 'REMOVE_PHOTO':
      return { ...state, photos: (state.photos || []).filter(p => p.id !== action.id) };
    case 'UPDATE_PHOTO_CAPTION':
      return {
        ...state,
        photos: (state.photos || []).map(p => p.id === action.id ? { ...p, caption: action.caption } : p)
      };
    case 'SET_PHOTOS':
      return { ...state, photos: action.photos };
    case 'RESET':
      return action.state;
    default:
      return state;
  }
}

export function createInitialState(
  editingEntry: WorkEntry | null | undefined,
  initialValues: Partial<WorkEntry> | null | undefined,
  settings: { clients: ClientProfile[]; rates: RatesConfig }
): ShiftFormState {
  const source = editingEntry || initialValues;
  const initialClientName = source?.clientName || (settings.clients[0]?.name || 'Metrostav DIZ s.r.o.');
  const matchedClient = settings.clients.find(c => c.name === initialClientName);
  const initialIsPdp = editingEntry?.isPdp ?? (matchedClient?.isPdpDefault ?? false);

  const isEditing = !!editingEntry;
  const hasExplicitTravel = !!initialValues?.travel;
  const defaultDuration = (!isEditing && !hasExplicitTravel)
    ? calculateNetHours(source?.startTime || '07:00', source?.endTime || '16:00', source?.breakMinutes ?? 30)
    : 0;
  const defaultEst = (!isEditing && !hasExplicitTravel)
    ? estimateDiet(defaultDuration, settings.rates)
    : null;

  const initialDietType: DietType = editingEntry?.travel?.dietType 
    ?? initialValues?.travel?.dietType 
    ?? (defaultEst ? defaultEst.type : 'none');
  const initialDietAllowance = editingEntry?.travel?.dietAllowance 
    ?? initialValues?.travel?.dietAllowance 
    ?? (defaultEst ? defaultEst.allowance : 0);
  const initialIsManualDiet = editingEntry?.travel?.isManualDiet 
    ?? initialValues?.travel?.isManualDiet 
    ?? (initialDietType === 'custom');
  const initialCustomDietRate = editingEntry?.travel?.customDietRate 
    ?? initialValues?.travel?.customDietRate 
    ?? (initialDietType === 'custom' ? initialDietAllowance : 0);
  const initialDietBandApplied = editingEntry?.travel?.dietBandApplied 
    ?? initialValues?.travel?.dietBandApplied 
    ?? normalizeDietType(initialDietType);

  const initialWeldingMethod: WeldingMethod = source?.weldingMethod || 'TIG';
  const initialWeldingPassport: WeldingPassport | undefined = 
    editingEntry?.weldingPassport ?? 
    initialValues?.weldingPassport ?? 
    (initialWeldingMethod !== 'NONE' ? {
      methodCode: initialWeldingMethod === 'TIG' ? '141' :
                  initialWeldingMethod === 'MIG_MAG' ? '135' :
                  initialWeldingMethod === 'MMA' ? '111' :
                  initialWeldingMethod === 'AUTOGEN' ? '311' :
                  initialWeldingMethod === 'COMBINED' ? '141_135' : 'NONE',
      methodName: initialWeldingMethod,
      baseMaterialGrade: '1.4301',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: '',
      rootBackingGas: false,
      weldInspectionVT: 'not_required',
    } : undefined);

  return {
    date: source?.date || new Date().toISOString().slice(0, 10),
    projectCode: source?.projectCode || 'Hala-C',
    projectName: source?.projectName || '',
    clientName: initialClientName,
    workType: source?.workType || 'site_assembly',
    weldingMethod: initialWeldingMethod,
    weldingPassport: initialWeldingPassport,
    isPdp: initialIsPdp,
    startTime: source?.startTime || '07:00',
    endTime: source?.endTime || '16:00',
    breakMinutes: source?.breakMinutes ?? 30,
    baseHourlyRate: editingEntry?.pricing?.baseHourlyRate ?? settings.rates.defaultSiteAssemblyRate,
    complexityMultiplier: editingEntry?.pricing?.complexityMultiplier ?? 1.0,
    shiftSurcharges: editingEntry?.pricing?.shiftSurcharges ?? [],
    isManualOverride: editingEntry?.pricing?.isManualOverride ?? false,
    manualTotalOverride: editingEntry?.pricing?.manualTotalOverride ?? 0,
    distanceKm: editingEntry?.travel?.distanceKm ?? 0,
    ratePerKm: editingEntry?.travel?.ratePerKm ?? settings.rates.defaultRatePerKm,
    travelTimeHours: editingEntry?.travel?.travelTimeHours ?? 0,
    travelHourlyRate: editingEntry?.travel?.travelHourlyRate ?? settings.rates.defaultTravelHourlyRate,
    dietAllowance: initialDietAllowance,
    dietType: initialDietType,
    isManualDiet: initialIsManualDiet,
    customDietRate: initialCustomDietRate,
    dietBandApplied: initialDietBandApplied,
    extraCosts: editingEntry?.extraCosts ?? [],
    consumableSlip: editingEntry?.consumableSlip ?? initialValues?.consumableSlip,
    activityTags: editingEntry?.activityTags ?? editingEntry?.workActionTags ?? initialValues?.activityTags ?? initialValues?.workActionTags ?? [],
    photos: editingEntry?.photos ? [...editingEntry.photos] : (initialValues?.photos ? [...initialValues.photos] : []),
    notes: source?.notes || '',
    status: editingEntry?.status ?? 'draft',
    invoiceNumber: editingEntry?.invoiceNumber ?? ''
  };
}
