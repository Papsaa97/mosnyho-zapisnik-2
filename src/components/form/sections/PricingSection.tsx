import React from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { DollarSign, CheckCircle2 } from 'lucide-react';
import { AppSettings, ShiftSurchargeType, INPUT_LIMITS } from '../../../types';

interface PricingSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  calculatedHourlyRate: number;
  settings: AppSettings;
}

export const PricingSection = React.memo<PricingSectionProps>(function PricingSection({ state, dispatch, calculatedHourlyRate, settings }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          Sazby, náročnost a příplatky
        </label>
        <div className="text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
          Účtováno: <span className="text-sm">{calculatedHourlyRate} Kč/h</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Základní hodinová sazba */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Základní sazba (Kč/h)
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={state.baseHourlyRate}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'baseHourlyRate', value: Math.min(Number(e.target.value), INPUT_LIMITS.MAX_HOURLY_RATE) })}
              min={0}
              max={INPUT_LIMITS.MAX_HOURLY_RATE}
              className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">Kč/h</span>
          </div>
        </div>

        {/* Násobič náročnosti */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Násobič náročnosti (koeficient)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { val: 1.0, label: '1.0x std' },
              { val: 1.15, label: '1.15x' },
              { val: 1.25, label: '1.25x výšky' },
              { val: 1.5, label: '1.5x těžká' },
            ].map((item) => {
              const isSelected = state.complexityMultiplier === item.val;
              return (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_FIELD', field: 'complexityMultiplier', value: item.val })}
                  className={`min-h-touch py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Příplatky směny (Víkend, Noční, Svátek) */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Příplatky za směnu:
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'weekend' as ShiftSurchargeType, label: `Víkend (+${settings.rates.surcharges.weekendPercent}%)` },
            { type: 'night' as ShiftSurchargeType, label: `Noční (+${settings.rates.surcharges.nightPercent}%)` },
            { type: 'holiday' as ShiftSurchargeType, label: `Svátek (+${settings.rates.surcharges.holidayPercent}%)` }
          ].map((item) => {
            const isChecked = state.shiftSurcharges.includes(item.type);
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_SURCHARGE', surcharge: item.type })}
                className={`min-h-touch p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isChecked
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${isChecked ? 'text-amber-400' : 'text-slate-600'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Override (Úkolová mzda / Paušál) */}
      <div className="pt-2 border-t border-slate-800/80">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
          <input
            type="checkbox"
            checked={state.isManualOverride}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'isManualOverride', value: e.target.checked })}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
          />
          <span>Přepsat na pevnou částku (Úkolová mzda / Domluvený paušál za akci)</span>
        </label>

        {state.isManualOverride && (
          <div className="mt-2.5 max-w-xs animate-in fade-in">
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={state.manualTotalOverride}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'manualTotalOverride', value: Number(e.target.value) })}
                placeholder="např. 6500"
                className="min-h-touch w-full bg-slate-900 border border-amber-500 rounded-xl px-3 py-2 text-amber-400 font-mono text-base font-bold focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-xs text-amber-400 font-bold">Kč fixně</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
