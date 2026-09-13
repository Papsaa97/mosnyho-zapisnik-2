import React, { useEffect, useMemo, useCallback, useReducer } from 'react';
import FocusTrap from 'focus-trap-react';
import { 
  X, 
  Save, 
  Flame, 
  Sparkles
} from 'lucide-react';
import { 
  WorkEntry, 
  ShiftPreset, 
  AppSettings
} from '../../types';
import { 
  calculateNetHours, 
  calculateEffectiveHourlyRate, 
  calculateGrandTotalWithMaterials, 
  calculateTravelTotal,
  calculateExtraCostsTotal,
  formatCurrency, 
  isDateWeekend
} from '../../services/pricingEngine';

import { shiftFormReducer, createInitialState } from './shiftFormReducer';
import { ProjectSection } from './sections/ProjectSection';
import { TimeSection } from './sections/TimeSection';
import { PricingSection } from './sections/PricingSection';
import { TravelSection } from './sections/TravelSection';
import { ExtrasSection } from './sections/ExtrasSection';
import { StatusNotesSection } from './sections/StatusNotesSection';
import { PhotoSection } from './sections/PhotoSection';
import { useToast } from '../../utils/toast';

interface ShiftModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: WorkEntry) => Promise<void>;
  editingEntry?: WorkEntry | null;
  initialValues?: Partial<WorkEntry> | null;
  presets: ShiftPreset[];
  settings: AppSettings;
  existingEntries: WorkEntry[];
}

export const ShiftModalForm: React.FC<ShiftModalFormProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEntry,
  initialValues,
  presets,
  settings,
  existingEntries
}) => {
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(
    shiftFormReducer, 
    null as any,
    () => createInitialState(editingEntry, initialValues, settings)
  );

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Reset form when editing entry or modal visibility changes
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET', state: createInitialState(editingEntry, initialValues, settings) });
    }
  }, [isOpen, editingEntry, initialValues, settings]);

  // Auto detect weekend when date changes
  useEffect(() => {
    if (!editingEntry && isDateWeekend(state.date)) {
      if (!state.shiftSurcharges.includes('weekend')) {
        dispatch({ type: 'TOGGLE_SURCHARGE', surcharge: 'weekend' });
      }
    }
  }, [state.date, editingEntry, state.shiftSurcharges]);

  // Client suggestions
  const clientSuggestions = useMemo(() => {
    const list = new Set<string>();
    settings.clients.forEach(c => list.add(c.name));
    existingEntries.forEach(e => { if (e.clientName) list.add(e.clientName); });
    return Array.from(list);
  }, [settings.clients, existingEntries]);

  // Project suggestions
  const projectSuggestions = useMemo(() => {
    const list = new Set<string>();
    existingEntries.forEach(e => { if (e.projectName) list.add(e.projectName); });
    return Array.from(list);
  }, [existingEntries]);

  // Calculations
  const totalHours = useMemo(() => {
    return calculateNetHours(state.startTime, state.endTime, state.breakMinutes);
  }, [state.startTime, state.endTime, state.breakMinutes]);

  const calculatedHourlyRate = useMemo(() => {
    return calculateEffectiveHourlyRate(
      state.baseHourlyRate,
      state.complexityMultiplier,
      state.shiftSurcharges,
      settings.rates.surcharges
    );
  }, [state.baseHourlyRate, state.complexityMultiplier, state.shiftSurcharges, settings.rates.surcharges]);

  const travelTotal = useMemo(() => {
    return calculateTravelTotal(state.distanceKm, state.ratePerKm, state.travelTimeHours, state.travelHourlyRate, state.dietAllowance);
  }, [state.distanceKm, state.ratePerKm, state.travelTimeHours, state.travelHourlyRate, state.dietAllowance]);

  const extrasTotal = useMemo(() => {
    return calculateExtraCostsTotal(state.extraCosts);
  }, [state.extraCosts]);

  const materialsTotal = useMemo(() => {
    return state.consumableSlip?.totalBilledAmount || 0;
  }, [state.consumableSlip]);

  const grandTotal = useMemo(() => {
    return calculateGrandTotalWithMaterials({
      totalHours,
      pricing: {
        calculatedHourlyRate,
        manualTotalOverride: state.manualTotalOverride,
        isManualOverride: state.isManualOverride
      },
      travel: {
        distanceKm: state.distanceKm,
        ratePerKm: state.ratePerKm,
        travelTimeHours: state.travelTimeHours,
        travelHourlyRate: state.travelHourlyRate,
        dietAllowance: state.dietAllowance
      },
      extraCosts: state.extraCosts,
      consumableSlip: state.consumableSlip
    });
  }, [totalHours, calculatedHourlyRate, state.manualTotalOverride, state.isManualOverride, state.distanceKm, state.ratePerKm, state.travelTimeHours, state.travelHourlyRate, state.dietAllowance, state.extraCosts, state.consumableSlip]);

  // Apply a preset
  const handleApplyPreset = (preset: ShiftPreset) => {
    dispatch({
      type: 'APPLY_PRESET',
      preset: {
        workType: preset.workType,
        baseHourlyRate: preset.baseHourlyRate,
        complexityMultiplier: preset.complexityMultiplier,
        breakMinutes: preset.defaultBreakMinutes,
        ratePerKm: preset.defaultRatePerKm,
        travelHourlyRate: preset.defaultTravelHourlyRate,
        weldingMethod: preset.weldingMethod || state.weldingMethod,
        weldingPassport: preset.weldingPassport || state.weldingPassport,
        consumableSlip: preset.consumableSlip || state.consumableSlip,
        activityTags: preset.activityTags || preset.workActionTags || state.activityTags,
        photos: preset.photos || state.photos,
        notes: (!state.notes && preset.notesTemplate) ? preset.notesTemplate : state.notes
      }
    });
  };

  // Validation: computed time error
  const timeValidationError = useMemo(() => {
    if (!state.startTime || !state.endTime) return null;
    const [sh, sm] = state.startTime.split(':').map(Number);
    const [eh, em] = state.endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;

    const startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin === startMin) return 'Konec směny musí být jiný čas než začátek.';

    const totalMin = endMin >= startMin ? endMin - startMin : (24 * 60 - startMin) + endMin;
    if (state.breakMinutes >= totalMin) {
      return `Pauza (${state.breakMinutes} min) nesmí přesáhnout celkovou délku směny (${totalMin} min).`;
    }
    return null;
  }, [state.startTime, state.endTime, state.breakMinutes]);

  // Save handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (timeValidationError) {
      showToast(`Chyba v časech: ${timeValidationError}`, 'error');
      return;
    }

    const entryToSave: WorkEntry = {
      id: editingEntry ? editingEntry.id : `entry-${Date.now()}`,
      date: state.date,
      projectCode: state.projectCode.trim() || 'Zakázka',
      projectName: state.projectName.trim() || (state.projectCode.trim() || 'Montážní práce'),
      clientName: state.clientName.trim() || 'Odběratel',
      workType: state.workType,
      startTime: state.startTime,
      endTime: state.endTime,
      breakMinutes: state.breakMinutes,
      totalHours,
      pricing: {
        baseHourlyRate: state.baseHourlyRate,
        complexityMultiplier: state.complexityMultiplier,
        shiftSurcharges: state.shiftSurcharges,
        calculatedHourlyRate,
        manualTotalOverride: state.isManualOverride ? state.manualTotalOverride : undefined,
        isManualOverride: state.isManualOverride
      },
      isPdp: state.isPdp,
      travel: {
        distanceKm: state.distanceKm,
        ratePerKm: state.ratePerKm,
        travelTimeHours: state.travelTimeHours,
        travelHourlyRate: state.travelHourlyRate,
        dietAllowance: state.dietAllowance,
        dietType: state.dietType,
        isManualDiet: state.isManualDiet,
        dietBandApplied: state.dietBandApplied,
        customDietRate: state.customDietRate
      },
      extraCosts: state.extraCosts,
      consumableSlip: state.consumableSlip,
      activityTags: state.activityTags,
      workActionTags: state.activityTags,
      photos: state.photos,
      totalEarnings: grandTotal,
      status: state.status,
      notes: state.notes.trim(),
      weldingMethod: state.weldingMethod,
      weldingPassport: state.weldingPassport,
      timeline: editingEntry?.timeline || initialValues?.timeline,
      invoiceNumber: state.invoiceNumber.trim() || undefined,
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSave(entryToSave);
    onClose();
  }, [
    timeValidationError, editingEntry, state, totalHours, calculatedHourlyRate,
    grandTotal, initialValues, onSave, onClose, showToast
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false }}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-modal-title"
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-850 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shift-modal-title" className="text-base sm:text-lg font-black text-white leading-tight">
                {editingEntry ? 'Upravit záznam směny' : 'Nový záznam směny a montáže'}
              </h2>
              <p className="text-xs text-slate-400">
                Flexibilní kalkulačka & rychlý zápis jedním palcem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm">
          
          {/* Preset Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Rychlé šablony (Presety zakázky)
              </label>
              <span className="text-[11px] text-slate-400">Kliknutím vyplníte sazby a parametry</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex-shrink-0 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-750 hover:border-amber-500/50 border border-slate-700 text-xs font-semibold rounded-xl text-slate-200 hover:text-amber-300 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <ProjectSection 
            state={state} 
            dispatch={dispatch} 
            clientSuggestions={clientSuggestions} 
            projectSuggestions={projectSuggestions} 
            clients={settings.clients}
          />
          
          <TimeSection 
            state={state} 
            dispatch={dispatch} 
            totalHours={totalHours} 
            timeValidationError={timeValidationError} 
          />
          
          <PricingSection 
            state={state} 
            dispatch={dispatch} 
            calculatedHourlyRate={calculatedHourlyRate} 
            settings={settings} 
          />
          
          <TravelSection 
            state={state} 
            dispatch={dispatch} 
            travelTotal={travelTotal} 
            totalHours={totalHours} 
            settings={settings} 
          />
          
          <ExtrasSection 
            state={state} 
            dispatch={dispatch} 
            extrasTotal={extrasTotal} 
          />
          
          <StatusNotesSection 
            state={state} 
            dispatch={dispatch} 
          />

          <PhotoSection
            state={state}
            dispatch={dispatch}
            contractorName={settings.contractor.name}
          />

        </form>

        {/* Persistent Bottom Sticky Action Bar with LIVE GRAND TOTAL */}
        <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Live Calculation breakdown */}
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-5">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Celkový nárok za směnu:
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="hidden xs:flex flex-col text-[11px] text-slate-400 border-l border-slate-800 pl-3">
                <span>Práce: <strong className="text-slate-200">{formatCurrency(totalHours * calculatedHourlyRate)}</strong></span>
                <span>Cesta & diety: <strong className="text-slate-200">{formatCurrency(travelTotal)}</strong></span>
                {materialsTotal > 0 && (
                  <span>Materiál: <strong className="text-slate-200">{formatCurrency(materialsTotal)}</strong></span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-touch-lg flex-1 sm:flex-none px-4 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs active:scale-95 transition-all"
              >
                Zrušit
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="min-h-touch-lg flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4 stroke-[3]" />
                <span>{editingEntry ? 'ULOŽIT ZMĚNY' : 'ULOŽIT SMĚNU'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </FocusTrap>
    </div>
  );
};
