import React, { useEffect, useRef } from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { Car, Utensils, Sparkles } from 'lucide-react';
import { AppSettings, INPUT_LIMITS } from '../../../types';
import { formatCurrency, estimateDiet, normalizeDietType } from '../../../services/pricingEngine';

interface TravelSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  travelTotal: number;
  totalHours: number;
  settings: AppSettings;
}

export const TravelSection = React.memo<TravelSectionProps>(function TravelSection({ state, dispatch, travelTotal, totalHours, settings }) {
  const prevDurationRef = useRef<number | null>(null);

  // Reactive automatic diet estimation when duration changes, unless manually overridden
  useEffect(() => {
    const totalDuration = totalHours + state.travelTimeHours;

    // Skip on initial mount: preserves existing entry saved diets and initialized state without unwanted auto-mutation
    if (prevDurationRef.current === null) {
      prevDurationRef.current = totalDuration;
      return;
    }

    // Only recalculate when duration actually changes and manual override is not active
    if (prevDurationRef.current !== totalDuration) {
      prevDurationRef.current = totalDuration;
      if (!state.isManualDiet) {
        const est = estimateDiet(totalDuration, settings.rates);
        dispatch({ type: 'SET_DIET', dietType: est.type, allowance: est.allowance, isManual: false });
      }
    }
  }, [totalHours, state.travelTimeHours, state.isManualDiet, settings.rates, dispatch]);

  const handleAutoDiet = () => {
    const totalDuration = totalHours + state.travelTimeHours;
    prevDurationRef.current = totalDuration;
    const est = estimateDiet(totalDuration, settings.rates);
    dispatch({ type: 'SET_DIET', dietType: est.type, allowance: est.allowance, isManual: false });
    if (state.isManualDiet) {
      dispatch({ type: 'SET_FIELD', field: 'isManualDiet', value: false });
    }
  };

  const band1Rate = settings.rates.dietBand1Rate ?? settings.rates.dietHalfDayRate ?? 166;
  const band2Rate = settings.rates.dietBand2Rate ?? settings.rates.dietFullDayRate ?? 256;
  const band3Rate = settings.rates.dietBand3Rate ?? settings.rates.dietOver18Rate ?? 398;

  const normalizedApplied = normalizeDietType(state.dietType);

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5 text-amber-400" />
          Cestovné, doprava a stravné (diety)
        </label>
        <div className="text-xs font-bold text-sky-400">
          Cesta celkem: {formatCurrency(travelTotal)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Ujeto km */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Ujeto km
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={state.distanceKm}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'distanceKm', value: Math.min(Math.max(0, Number(e.target.value)), INPUT_LIMITS.MAX_DISTANCE_KM) })}
              min={0}
              max={INPUT_LIMITS.MAX_DISTANCE_KM}
              className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">km</span>
          </div>
        </div>

        {/* Sazba za km */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Sazba za km
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={state.ratePerKm}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'ratePerKm', value: Number(e.target.value) })}
              min={0}
              className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">Kč/km</span>
          </div>
        </div>

        {/* Čas za volantem */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Čas řízení (h)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              value={state.travelTimeHours}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'travelTimeHours', value: Math.min(Number(e.target.value), INPUT_LIMITS.MAX_TRAVEL_HOURS) })}
              min={0}
              max={INPUT_LIMITS.MAX_TRAVEL_HOURS}
              className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">h</span>
          </div>
        </div>

        {/* Sazba za řízení */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Sazba řízení
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={state.travelHourlyRate}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'travelHourlyRate', value: Number(e.target.value) })}
              min={0}
              className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">Kč/h</span>
          </div>
        </div>
      </div>

      {/* Stravné (Diety) */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-amber-400" />
            Zákonné stravné MPSV (délka: {(totalHours + state.travelTimeHours).toFixed(1).replace('.', ',')} h):
          </span>
          <button
            type="button"
            onClick={handleAutoDiet}
            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <Sparkles className="w-3 h-3" /> Auto-doporučit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DIET', dietType: 'none', allowance: 0, isManual: false })}
            className={`min-h-touch py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
              !state.isManualDiet && (normalizedApplied === 'none' || state.dietAllowance === 0)
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Bez diet (0 Kč)
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DIET', dietType: 'band_1', allowance: band1Rate, isManual: false })}
            className={`min-h-touch py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
              !state.isManualDiet && normalizedApplied === 'band_1' && state.dietAllowance > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            5–12 h ({band1Rate} Kč)
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DIET', dietType: 'band_2', allowance: band2Rate, isManual: false })}
            className={`min-h-touch py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
              !state.isManualDiet && normalizedApplied === 'band_2' && state.dietAllowance > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            12–18 h ({band2Rate} Kč)
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_DIET', dietType: 'band_3', allowance: band3Rate, isManual: false })}
            className={`min-h-touch py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
              !state.isManualDiet && normalizedApplied === 'band_3' && state.dietAllowance > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            &gt;18 h ({band3Rate} Kč)
          </button>
        </div>

        {/* Manual Diet Override */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={!!state.isManualDiet}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  dispatch({ 
                    type: 'SET_DIET', 
                    dietType: 'custom', 
                    allowance: state.customDietRate || state.dietAllowance || 0, 
                    isManual: true 
                  });
                } else {
                  dispatch({ type: 'SET_FIELD', field: 'isManualDiet', value: false });
                  const totalDuration = totalHours + state.travelTimeHours;
                  const est = estimateDiet(totalDuration, settings.rates);
                  dispatch({ type: 'SET_DIET', dietType: est.type, allowance: est.allowance, isManual: false });
                }
              }}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
            />
            <span>Ruční úprava stravného (např. krácení za poskytnutý oběd)</span>
          </label>

          {state.isManualDiet && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-amber-300 font-semibold">Vlastní částka:</span>
              <input
                type="number"
                min={0}
                value={state.dietAllowance}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value));
                  dispatch({ type: 'SET_DIET', dietType: 'custom', allowance: val, isManual: true });
                }}
                className="w-24 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400">Kč</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
