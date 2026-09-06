import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  Clock, 
  Coffee, 
  MessageSquarePlus, 
  ChevronDown, 
  ChevronUp, 
  BellRing,
  History
} from 'lucide-react';
import { useShiftTimer, formatDurationMs, formatTimestampToTime } from '../../hooks/useShiftTimer';
import { ShiftPreset, AppSettings, WorkType, WeldingMethod } from '../../types';
import { SmartCheckoutModal } from './SmartCheckoutModal';
import { triggerHaptic } from '../../utils/haptics';

interface LiveTrackerPanelProps {
  timer: ReturnType<typeof useShiftTimer>;
  onFinishShift: (checkoutData: ReturnType<ReturnType<typeof useShiftTimer>['getShiftCheckoutData']>) => void;
  onOpenManualEntry: () => void;
  presets: ShiftPreset[];
  settings: AppSettings;
}

const QUICK_NOTE_SUGGESTIONS = [
  'Čekám na materiál',
  'Zdržen jeřábem',
  'Práce v plošině',
  'Předehřev 250°C',
  'VT2 zkouška OK',
  'Převoz na stavbu'
];

export const LiveTrackerPanel: React.FC<LiveTrackerPanelProps> = ({
  timer,
  onFinishShift,
  onOpenManualEntry,
  presets,
  settings
}) => {
  const {
    shiftState,
    status,
    pausedMs,
    netWorkedMs,
    isAnomaly,
    anomalyReason,
    startShift,
    pauseShift,
    resumeShift,
    addTimelineNote,
    updateMetadata,
    getShiftCheckoutData,
    resetShift,
    requestNotificationPermission
  } = timer;

  const [noteInput, setNoteInput] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showTimeline, setShowTimeline] = useState<boolean>(true);
  const [isSmartCheckoutOpen, setIsSmartCheckoutOpen] = useState<boolean>(false);
  const [smartCheckoutData, setSmartCheckoutData] = useState<any>(null);

  // Formatted timer displays
  const netWorkedFormatted = formatDurationMs(netWorkedMs);
  const pausedFormatted = formatDurationMs(pausedMs);

  const handleStart = () => {
    triggerHaptic('success');
    startShift({
      clientName: shiftState.clientName || settings.clients[0]?.name || 'Metrostav DIZ s.r.o.',
      projectName: shiftState.projectName || 'Montáž ocelových konstrukcí',
      projectCode: shiftState.projectCode || 'Hala-C',
      workType: shiftState.workType || 'site_assembly',
      weldingMethod: shiftState.weldingMethod || 'TIG'
    });
  };

  const handlePause = () => {
    triggerHaptic('warning');
    pauseShift();
  };

  const handleResume = () => {
    triggerHaptic('success');
    resumeShift();
  };

  const handleEndShiftClick = () => {
    triggerHaptic('heavy');
    const data = getShiftCheckoutData();
    if (!data) return;

    if (data.isAnomaly || data.elapsedHours >= 14) {
      setSmartCheckoutData(data);
      setIsSmartCheckoutOpen(true);
    } else {
      onFinishShift(data);
    }
  };

  const handleSmartCheckoutConfirm = (adjusted: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    correctionNote: string;
  }) => {
    setIsSmartCheckoutOpen(false);
    const data = getShiftCheckoutData();
    if (!data) return;

    const adjustedData = {
      ...data,
      date: adjusted.date,
      startTime: adjusted.startTime,
      endTime: adjusted.endTime,
      breakMinutes: adjusted.breakMinutes,
      notes: `${data.notes}\n\n${adjusted.correctionNote}`
    };

    onFinishShift(adjustedData);
  };

  const handleAddNote = (textToAdd?: string) => {
    const text = textToAdd || noteInput;
    if (!text.trim()) return;
    addTimelineNote(text);
    setNoteInput('');
  };

  return (
    <section 
      aria-label="Panel živé směny"
      className={`rounded-3xl border transition-all duration-300 shadow-2xl overflow-hidden relative ${
        isAnomaly
          ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/20'
          : status === 'running'
          ? 'bg-slate-900/95 border-emerald-500/50 ring-1 ring-emerald-500/20'
          : status === 'paused'
          ? 'bg-slate-900/95 border-amber-500/50 ring-1 ring-amber-500/20'
          : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      {/* Top Status Bar & Indicators */}
      <div className="px-4 sm:px-6 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`w-3.5 h-3.5 rounded-full ${
            status === 'running' 
              ? 'bg-emerald-400 animate-ping' 
              : status === 'paused'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-slate-600'
          }`} />
          <div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5 leading-none">
              Aktuální směna (Live Tracker)
              {status === 'running' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  BĚŽÍ
                </span>
              )}
              {status === 'paused' && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/40">
                  PAUZA
                </span>
              )}
              {status === 'idle' && (
                <span className="text-[10px] bg-slate-800 text-slate-400 font-extrabold px-2 py-0.5 rounded-full border border-slate-700">
                  PŘIPRAVENO
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {status === 'idle' 
                ? 'Rychlé píchačky pro dnešní den na iPhonu' 
                : `${shiftState.projectName || 'Práce'} • ${shiftState.clientName || 'Klient'}`}
            </p>
          </div>
        </div>

        {/* Action icons / toggles */}
        <div className="flex items-center gap-2">
          {/* Notification Permission Prompt if needed */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <button
              onClick={requestNotificationPermission}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Povolit notifikace po 10h práce"
            >
              <BellRing className="w-3 h-3" />
              <span>Hlídač 10h</span>
            </button>
          )}

          {/* Collapsible details toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Detaily</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Anomaly Banner (>14h or overnight) */}
      {isAnomaly && (
        <div className="bg-gradient-to-r from-amber-600/30 via-rose-600/30 to-amber-600/30 border-b border-amber-500/50 px-4 py-2.5 flex items-center gap-2.5 text-amber-300 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="text-xs font-bold leading-tight">
            <span className="text-amber-200 font-extrabold block">Běží to nějak dlouho! ({anomalyReason})</span>
            Nezapomněl jsi ukončit směnu včera? Při ukončení ti nabídneme bleskovou opravu skutečného konce.
          </div>
        </div>
      )}

      {/* Optional Metadata Config Accordion */}
      {showConfig && (
        <div className="bg-slate-950/70 border-b border-slate-800 p-4 space-y-3 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Odběratel */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Odběratel / Firma
              </label>
              <select
                value={shiftState.clientName}
                onChange={(e) => updateMetadata({ clientName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {settings.clients.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Název zakázky */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Název zakázky / Místo
              </label>
              <input
                type="text"
                value={shiftState.projectName}
                onChange={(e) => updateMetadata({ projectName: e.target.value })}
                placeholder="např. Montáž haly B - sloupy"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Typ práce & Metoda */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Typ práce
                </label>
                <select
                  value={shiftState.workType}
                  onChange={(e) => updateMetadata({ workType: e.target.value as WorkType })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="site_assembly">Montáž stavba</option>
                  <option value="workshop_welding">Dílna sváření</option>
                  <option value="service_emergency">Pohotovost</option>
                  <option value="travel_only">Cesťák</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Metoda
                </label>
                <select
                  value={shiftState.weldingMethod}
                  onChange={(e) => updateMetadata({ weldingMethod: e.target.value as WeldingMethod })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="TIG">TIG (141)</option>
                  <option value="MIG_MAG">MIG/MAG (135)</option>
                  <option value="MMA">Elektroda (111)</option>
                  <option value="AUTOGEN">Plamen (311)</option>
                  <option value="COMBINED">Kombinované</option>
                  <option value="NONE">Montáž bez sváru</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick presets if available */}
          {presets && presets.length > 0 && (
            <div className="pt-2 border-t border-slate-850">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Rychlé předvolby práce
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      updateMetadata({
                        workType: p.workType,
                        weldingMethod: p.weldingMethod || 'TIG',
                        projectName: p.name
                      });
                      triggerHaptic('light');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-amber-400 border border-slate-700 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Tracker Core: Digital Time & Dominant Buttons */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Central Display */}
        <div className="flex flex-col items-center justify-center text-center py-2">
          {status === 'idle' ? (
            <div className="space-y-1">
              <span className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-slate-500">
                00:00:00
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-400">
                Aplikace je připravena k odpíchnutí dnešní směny.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 w-full">
              {/* Primary Running Time */}
              <div className="flex items-baseline justify-center gap-2">
                <span className={`text-4xl sm:text-6xl font-black font-mono tracking-tight ${
                  status === 'running' 
                    ? 'text-white' 
                    : 'text-amber-400 animate-pulse'
                }`}>
                  {netWorkedFormatted.display}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  ČISTÝ ČAS
                </span>
              </div>

              {/* Sub-stats: Start, Pause, Total */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Start: <strong className="text-white font-mono">{formatTimestampToTime(shiftState.startTimestamp!)}</strong>
                </span>

                <span className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  Pauza: <strong className="text-amber-300 font-mono">{pausedFormatted.display}</strong>
                </span>

                <span className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Hodin celkem: <strong className="text-sky-300 font-mono">{(netWorkedMs / 3600000).toFixed(1)} h</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dominant Thumb-Friendly Action Buttons */}
        <div className="pt-1">
          {status === 'idle' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-lg sm:text-xl uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25 active:scale-98 transition-all"
                style={{ minHeight: '64px' }}
              >
                <Play className="w-7 h-7 fill-slate-950 stroke-[2.5]" />
                <span>Zahájit směnu</span>
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onOpenManualEntry}
                  className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800/60"
                  style={{ minHeight: '36px' }}
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Zadat směnu zpětně (Manuální záznam)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfig ? 'Skrýt volby' : 'Přednastavit zakázku'}
                </button>
              </div>
            </div>
          )}

          {status === 'running' && (
            <div className="grid grid-cols-2 gap-3">
              {/* Yellow Pause Button */}
              <button
                type="button"
                onClick={handlePause}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
                style={{ minHeight: '60px' }}
              >
                <Pause className="w-6 h-6 fill-slate-950 stroke-[2.5]" />
                <span>Pauza</span>
              </button>

              {/* Red End Button */}
              <button
                type="button"
                onClick={handleEndShiftClick}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 active:scale-98 transition-all"
                style={{ minHeight: '60px' }}
              >
                <Square className="w-6 h-6 fill-white stroke-[2.5]" />
                <span>Ukončit</span>
              </button>
            </div>
          )}

          {status === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              {/* Green Resume Button */}
              <button
                type="button"
                onClick={handleResume}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all"
                style={{ minHeight: '60px' }}
              >
                <Play className="w-6 h-6 fill-slate-950 stroke-[2.5]" />
                <span>Pokračovat</span>
              </button>

              {/* Red End Button */}
              <button
                type="button"
                onClick={handleEndShiftClick}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 active:scale-98 transition-all"
                style={{ minHeight: '60px' }}
              >
                <Square className="w-6 h-6 fill-white stroke-[2.5]" />
                <span>Ukončit</span>
              </button>
            </div>
          )}
        </div>

        {/* Timeline Log Section (Časová osa událostí) */}
        {status !== 'idle' && (
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Časová osa dnešní směny ({shiftState.events.length} událostí)
              </span>
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="text-xs font-semibold text-slate-400 hover:text-white"
              >
                {showTimeline ? 'Skrýt' : 'Zobrazit'}
              </button>
            </div>

            {showTimeline && (
              <div className="space-y-2.5">
                {/* Events list */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                  {shiftState.events.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-2.5 text-xs">
                      <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {evt.timeStr}
                      </span>
                      <div className="flex-1">
                        <span className="font-bold text-slate-200 block">{evt.title}</span>
                        {evt.description && (
                          <span className="text-[11px] text-slate-400 block">{evt.description}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick note input & chips */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddNote();
                      }}
                      placeholder="Přidat rychlou poznámku (např. čekám na materiál)..."
                      className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      style={{ minHeight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNote()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                      style={{ minHeight: '42px' }}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Uložit</span>
                    </button>
                  </div>

                  {/* 1-tap quick suggestions chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NOTE_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddNote(sug)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart Checkout Anomaly Correction Modal */}
      {isSmartCheckoutOpen && smartCheckoutData && (
        <SmartCheckoutModal
          isOpen={isSmartCheckoutOpen}
          onClose={() => setIsSmartCheckoutOpen(false)}
          data={smartCheckoutData}
          onConfirmAdjusted={handleSmartCheckoutConfirm}
          onDiscardShift={() => {
            setIsSmartCheckoutOpen(false);
            resetShift();
          }}
        />
      )}
    </section>
  );
};
