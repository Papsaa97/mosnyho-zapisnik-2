import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Coffee, 
  CheckCircle2, 
  Trash2, 
  X,
  Sparkles
} from 'lucide-react';
import { calculateNetHours } from '../../services/pricingEngine';
import { triggerHaptic } from '../../utils/haptics';

interface SmartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    elapsedHours: number;
    anomalyReason: string;
    projectName?: string;
  };
  onConfirmAdjusted: (adjusted: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    correctionNote: string;
  }) => void;
  onDiscardShift: () => void;
}

export const SmartCheckoutModal: React.FC<SmartCheckoutModalProps> = ({
  isOpen,
  onClose,
  data,
  onConfirmAdjusted,
  onDiscardShift
}) => {
  const [date, setDate] = useState<string>(data?.date || '');
  const [startTime, setStartTime] = useState<string>(data?.startTime || '07:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(30);

  if (!isOpen || !data) return null;

  const roundedHours = Math.round(data.elapsedHours);
  const calculatedNet = calculateNetHours(startTime, endTime, breakMinutes);

  const applyPreset = (presetEnd: string, presetBreak: number) => {
    triggerHaptic('light');
    setEndTime(presetEnd);
    setBreakMinutes(presetBreak);
  };

  const handleConfirm = () => {
    triggerHaptic('success');
    const note = `[Oprava zapomenuté směny]: Stopky běžely ${data.elapsedHours.toFixed(1)} h (${data.anomalyReason || 'přesčas'}). Korigováno na ${startTime}–${endTime} (${breakMinutes}m pauza).`;
    onConfirmAdjusted({
      date,
      startTime,
      endTime,
      breakMinutes,
      correctionNote: note
    });
  };

  const handleDiscard = () => {
    if (window.confirm('Opravdu chcete tuto zapomenutou směnu smazat a začít znovu?')) {
      triggerHaptic('heavy');
      onDiscardShift();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden my-auto">
        
        {/* Pulsating Warning Header */}
        <div className="bg-gradient-to-r from-amber-600/30 via-rose-600/30 to-amber-600/30 p-5 border-b border-amber-500/40 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
              <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                Bezpečnostní pojistka proti zapomenuté směně
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Tato směna běžela {roundedHours} hodin!
              </h2>
            </div>
          </div>
          
          <p className="mt-3 text-xs sm:text-sm text-slate-300 font-medium leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-amber-500/20">
            Nezapomněl jsi včera nebo před víkendem píchnout odchod? 
            Zabraňujeme chybnému uložení do výkaznictví. Zvol níže skutečný čas konce práce.
          </p>
        </div>

        {/* Quick Correction Presets */}
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Rychlé předvolby skutečného konce:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { end: '15:30', brk: 30, label: '15:30' },
                { end: '16:00', brk: 30, label: '16:00' },
                { end: '17:00', brk: 45, label: '17:00' },
                { end: '18:00', brk: 45, label: '18:00' },
              ].map((p) => (
                <button
                  key={p.end}
                  type="button"
                  onClick={() => applyPreset(p.end, p.brk)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all border ${
                    endTime === p.end && breakMinutes === p.brk
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750 hover:border-slate-600'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  {p.label} <span className="text-[10px] opacity-80">({p.brk}m)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time and Break Inputs */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
            {/* Date and Start */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Datum směny
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Začátek směny
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>

            {/* End Time and Break */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Skutečný konec
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-amber-500/80 rounded-xl px-3 py-2 text-sm font-black text-amber-400 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  Pauza (minuty)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 text-center"
                    style={{ minHeight: '44px' }}
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setBreakMinutes(30)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded"
                    >
                      30m
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakMinutes(60)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded"
                    >
                      60m
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated summary badge */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Korigovaná odpracovaná doba:
              </span>
              <span className="text-base font-black text-amber-400 font-mono">
                {calculatedNet.toFixed(1).replace('.', ',')} hodiny
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all"
              style={{ minHeight: '52px' }}
            >
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              Upravit a pokračovat k uložení
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                style={{ minHeight: '44px' }}
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                Zahodit tuto směnu
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center transition-colors"
                style={{ minHeight: '44px' }}
              >
                Zpět k běžícím stopkám
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
