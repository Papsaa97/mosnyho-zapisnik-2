import React from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { Clock, AlertTriangle } from 'lucide-react';
import { QuickBreakButtons } from '../QuickBreakButtons';

interface TimeSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  totalHours: number;
  timeValidationError: string | null;
}

export const TimeSection = React.memo<TimeSectionProps>(function TimeSection({ state, dispatch, totalHours, timeValidationError }) {
  return (
    <div className={`bg-slate-950/50 border rounded-xl p-3.5 sm:p-4 space-y-4 transition-colors ${timeValidationError ? 'border-rose-500/60' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          Časový fond a odpracované hodiny
        </label>
        <div className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          timeValidationError
            ? 'text-rose-400 bg-rose-950/40 border-rose-500/30'
            : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
        }`}>
          Čistý čas: <span className="text-sm">{totalHours.toFixed(2).replace('.', ',')} h</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Začátek směny (Od)
          </label>
          <input
            type="time"
            value={state.startTime}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'startTime', value: e.target.value })}
            required
            aria-invalid={!!timeValidationError || undefined}
            className={`min-h-touch w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none ${timeValidationError ? 'border-rose-500' : 'border-slate-700'}`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Konec směny (Do)
            {totalHours > 0 && <span className="ml-1 text-slate-500">(noční = +1 den, OK)</span>}
          </label>
          <input
            type="time"
            value={state.endTime}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'endTime', value: e.target.value })}
            required
            aria-invalid={!!timeValidationError || undefined}
            className={`min-h-touch w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none ${timeValidationError ? 'border-rose-500' : 'border-slate-700'}`}
          />
        </div>
      </div>

      {/* Time validation error banner */}
      {timeValidationError && (
        <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/40 rounded-lg px-3 py-2 text-xs text-rose-300 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          {timeValidationError}
        </div>
      )}

      {/* Quick Break Buttons */}
      <QuickBreakButtons 
        value={state.breakMinutes} 
        onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'breakMinutes', value: val })} 
      />
    </div>
  );
});
