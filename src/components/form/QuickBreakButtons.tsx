import React from 'react';
import { Coffee, Plus, Minus } from 'lucide-react';

interface QuickBreakButtonsProps {
  value: number;
  onChange: (breakMinutes: number) => void;
}

const PRESET_BREAKS = [0, 15, 30, 45, 60];

export const QuickBreakButtons: React.FC<QuickBreakButtonsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
        <span className="flex items-center gap-1.5">
          <Coffee className="w-3.5 h-3.5 text-amber-400" />
          Pauza na oběd / odpočinek:
        </span>
        <span className="font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
          {value} minut
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {PRESET_BREAKS.map((min) => {
          const isSelected = value === min;
          return (
            <button
              key={min}
              type="button"
              onClick={() => onChange(min)}
              className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              style={{ minHeight: '44px' }}
            >
              {min === 0 ? '0 min' : `${min}m`}
            </button>
          );
        })}
      </div>

      {/* Micro adjustment +/- 5 min */}
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 5))}
          disabled={value <= 0}
          className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 flex items-center gap-1 border border-slate-700"
        >
          <Minus className="w-3 h-3" /> 5 min
        </button>
        <button
          type="button"
          onClick={() => onChange(value + 5)}
          className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 border border-slate-700"
        >
          <Plus className="w-3 h-3" /> 5 min
        </button>
      </div>
    </div>
  );
};
