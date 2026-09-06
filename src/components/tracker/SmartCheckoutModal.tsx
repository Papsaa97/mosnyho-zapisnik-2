import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Coffee, 
  CheckCircle2, 
  Trash2, 
  X,
  Sparkles,
  Edit3,
  ShieldCheck
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
    startTimestamp?: number | null;
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
  const [date, setDate] = useState<string>(() => data?.date || '');
  const [startTime, setStartTime] = useState<string>(() => data?.startTime || '07:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(30);
  const [showManualPicker, setShowManualPicker] = useState<boolean>(false);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const roundedHours = Math.round(data.elapsedHours);
  const calculatedNet = calculateNetHours(startTime, endTime, breakMinutes);

  // Determine human-readable relative day in Czech
  const getRelativeDayPhrase = (dateStr: string) => {
    if (!dateStr) return 'včera';
    const [y, m, d] = dateStr.split('-').map(Number);
    const shiftDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    shiftDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - shiftDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'dnes';
    if (diffDays === 1) return 'včera';
    if (diffDays === 2) return 'předevčírem';

    const dayNames = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'];
    return dayNames[shiftDate.getDay()];
  };

  const relativeDay = getRelativeDayPhrase(data.date);

  // Action 1: Quick finish at 16:00
  const handleQuickEnd16 = () => {
    triggerHaptic('success');
    const note = `[Oprava zapomenuté směny]: Stopky běžely ${data.elapsedHours.toFixed(1)} h (${data.anomalyReason || 'překročen limit'}). Korigováno na konec v 16:00 (${data.date}, pauza 30 min).`;
    onConfirmAdjusted({
      date: data.date,
      startTime: data.startTime,
      endTime: '16:00',
      breakMinutes: 30,
      correctionNote: note
    });
  };

  // Action 2: Quick finish at 18:00
  const handleQuickEnd18 = () => {
    triggerHaptic('success');
    const note = `[Oprava zapomenuté směny]: Stopky běžely ${data.elapsedHours.toFixed(1)} h (${data.anomalyReason || 'překročen limit'}). Korigováno na konec v 18:00 (${data.date}, pauza 45 min).`;
    onConfirmAdjusted({
      date: data.date,
      startTime: data.startTime,
      endTime: '18:00',
      breakMinutes: 45,
      correctionNote: note
    });
  };

  // Action 3: Save without change (real marathon work)
  const handleSaveWithoutChange = () => {
    triggerHaptic('medium');
    const note = `[Potvrzena plná směna]: Uživatel potvrdil nepřetržitou práci v kuse (${data.elapsedHours.toFixed(1)} h). Uloženo beze změny.`;
    onConfirmAdjusted({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes,
      correctionNote: note
    });
  };

  // Action 4: Confirm manual picker values
  const handleConfirmManual = () => {
    triggerHaptic('success');
    const note = `[Oprava zapomenuté směny]: Stopky běžely ${data.elapsedHours.toFixed(1)} h. Ručně korigováno na ${startTime}–${endTime} (${breakMinutes}m pauza, datum ${date}).`;
    onConfirmAdjusted({
      date,
      startTime,
      endTime,
      breakMinutes,
      correctionNote: note
    });
  };

  const handleDiscard = () => {
    if (window.confirm('Opravdu chcete tuto zapomenutou směnu smazat bez uložení?')) {
      triggerHaptic('heavy');
      onDiscardShift();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-checkout-title"
    >
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl w-full max-w-lg shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden my-auto">
        
        {/* Warning Header */}
        <div className="bg-gradient-to-r from-amber-600/30 via-rose-600/30 to-amber-600/30 p-5 border-b border-amber-500/40 relative">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                Bezpečnostní pojistka • Smart Checkout
              </span>
              <h2 id="smart-checkout-title" className="text-lg sm:text-xl font-black text-white leading-tight">
                Tato směna trvala {roundedHours} hodin. Nezapomněli jste si odpíchnout?
              </h2>
            </div>
          </div>
          
          <p className="mt-3 text-xs sm:text-sm text-slate-300 font-medium leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-amber-500/20">
            Zahájeno dne <strong className="text-white">{data.date}</strong> v <strong className="text-white font-mono">{data.startTime}</strong>. 
            Aby se do výkazů nedostaly nesmyslné hodiny, zvolte níže skutečný čas konce práce.
          </p>
        </div>

        {/* Quick Correction Options */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Rychlé volby pro opravu:
            </span>

            {/* Option 1: Skončil jsem včera v 16:00 */}
            <button
              type="button"
              onClick={handleQuickEnd16}
              className="w-full p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-amber-500/60 text-left transition-all flex items-center justify-between group active:scale-[0.99]"
              style={{ minHeight: '56px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                    Skončil jsem {relativeDay} v 16:00
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Začátek {data.startTime} • Konec 16:00 • 30 min pauza (čistý čas: {calculateNetHours(data.startTime, '16:00', 30).toFixed(1).replace('.', ',')} h)
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
            </button>

            {/* Option 2: Skončil jsem včera v 18:00 */}
            <button
              type="button"
              onClick={handleQuickEnd18}
              className="w-full p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-amber-500/60 text-left transition-all flex items-center justify-between group active:scale-[0.99]"
              style={{ minHeight: '56px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                    Skončil jsem {relativeDay} v 18:00
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Začátek {data.startTime} • Konec 18:00 • 45 min pauza (čistý čas: {calculateNetHours(data.startTime, '18:00', 45).toFixed(1).replace('.', ',')} h)
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
            </button>

            {/* Option 3: Zadat čas konce ručně (toggle simple time-picker) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowManualPicker(!showManualPicker);
              }}
              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between active:scale-[0.99] ${
                showManualPicker
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-755 border-slate-700 text-white'
              }`}
              style={{ minHeight: '56px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">
                    Zadat čas konce ručně
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Upravit přesný čas konce, pauzu nebo datum směny
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400">
                {showManualPicker ? 'Skrýt výběr' : 'Otevřít výběr'}
              </span>
            </button>

            {/* Manual Picker Panel (when expanded) */}
            {showManualPicker && (
              <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
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
                      Začátek
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
                      Pauza (min)
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

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-300">
                    Vypočtený čistý čas: <strong className="text-amber-400 font-mono">{calculatedNet.toFixed(1).replace('.', ',')} h</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmManual}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    Potvrdit ruční zadání
                  </button>
                </div>
              </div>
            )}

            {/* Option 4: Ne, opravdu jsem pracoval v kuse (Uložit beze změny) */}
            <button
              type="button"
              onClick={handleSaveWithoutChange}
              className="w-full p-3.5 rounded-2xl bg-slate-850/80 hover:bg-slate-800 border border-slate-700/80 text-left transition-all flex items-center justify-between group active:scale-[0.99]"
              style={{ minHeight: '52px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                    Ne, opravdu jsem pracoval v kuse (Uložit beze změny)
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500">
                    Ponechat celý naměřený čas ({data.elapsedHours.toFixed(1)} h) a přejít k finálnímu uložení
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Secondary Footer Actions: Discard shift or Return to running timer */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDiscard}
              className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
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
  );
};
