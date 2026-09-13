import React from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { FileCheck2, Tag, Sparkles, Check } from 'lucide-react';
import { WorkEntryStatus, QuickActionTag } from '../../../types';
import { MANDATORY_ACTIVITY_CHIPS } from '../../../services/consumablesCatalog';
import { triggerHaptic } from '../../../utils/haptics';

const COMMON_TAGS = [
  'VT2 zkouška OK',
  'Práce v plošině',
  'Předehřev 250°C',
  'Tlaková zkouška splněna',
  'Formování kořene Argon',
  'Zdržen jinou profesí'
];

interface StatusNotesSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
}

export const StatusNotesSection = React.memo<StatusNotesSectionProps>(function StatusNotesSection({ state, dispatch }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
      {/* 1. 5 Glove-Friendly 1-Touch Activity Chips (min 48px height) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            1-Dotykové štítky činností (výběr pro montážní protokol)
          </label>
          <span className="text-[11px] text-slate-400 hidden xs:inline">Velká dotyková tlačítka pro rukavice</span>
        </div>

        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
          {MANDATORY_ACTIVITY_CHIPS.map((chip: QuickActionTag) => {
            const isSelected = (state.activityTags || []).includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  dispatch({ type: 'TOGGLE_ACTIVITY_TAG', tag: chip });
                }}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 text-center ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 text-amber-400 stroke-[3] flex-shrink-0" />}
                <span className="truncate">{chip}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Stav položky */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
          <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
          Stav položky
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: 'draft' as WorkEntryStatus, label: 'Koncept / Rozpracováno', color: 'border-amber-500/50 text-amber-400 bg-amber-500/10' },
            { key: 'submitted' as WorkEntryStatus, label: 'Odevzdáno firmě', color: 'border-sky-500/50 text-sky-400 bg-sky-500/10' },
            { key: 'invoiced' as WorkEntryStatus, label: 'Vyfakturováno', color: 'border-purple-500/50 text-purple-400 bg-purple-500/10' },
            { key: 'paid' as WorkEntryStatus, label: 'Zaplaceno', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' },
          ].map((st) => {
            const isSelected = state.status === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'status', value: st.key })}
                className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                  isSelected
                    ? `${st.color} shadow-md`
                    : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fakturační číslo pokud je vyfakturováno */}
      {state.status === 'invoiced' && (
        <div className="animate-in fade-in">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Číslo faktury (např. VF-2026/028)
          </label>
          <input
            type="text"
            value={state.invoiceNumber}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'invoiceNumber', value: e.target.value })}
            placeholder="VF-2026/028"
            className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-amber-500 focus:outline-none"
          />
        </div>
      )}

      {/* Technická poznámka & doplňkové textové tagy */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-300">
            Technická poznámka (kontrola svárů, pozice, vady stavby):
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {COMMON_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                dispatch({ type: 'APPEND_NOTE_TAG', tag });
              }}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition-all"
            >
              <Tag className="w-3 h-3 text-amber-400" />
              {tag}
            </button>
          ))}
        </div>

        <textarea
          value={state.notes}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'notes', value: e.target.value })}
          rows={3}
          placeholder="např. Svařování potrubní trasy metodou 141 (TIG). Formováno argonem 4.6. Vizuální zkouška VT2 bez vad..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono leading-relaxed focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
});
