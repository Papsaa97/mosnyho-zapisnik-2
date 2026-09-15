import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  WifiOff, 
  Plus, 
  ShieldCheck
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface HeaderProps {
  onNewShift: () => void;
  entriesCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onNewShift, entriesCount }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white px-3 sm:px-6 py-2.5 shadow-lg pt-[max(0.625rem,env(safe-area-inset-top))]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 border border-amber-400/40">
            <Flame className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                MOŠNYHO ZÁPISNÍK
                <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                  2.0 PRO
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Montážní & svářečský výkazník | 100% Offline-First
            </p>
          </div>
        </div>

        {/* Status Indicators & Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline / Storage Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300"
            title="Aplikace ukládá data do lokální IndexedDB v zařízení. Funguje i v plechové hale bez signálu."
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Lokální DB</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {isOnline ? (
              <span className="text-[10px] text-emerald-400/80 ml-0.5">(Online)</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-bold ml-0.5 flex items-center gap-0.5">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </div>

          {/* Entry count badge */}
          {entriesCount > 0 && (
            <span className="hidden md:flex text-[11px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">
              {entriesCount} záznamů
            </span>
          )}

          {/* New Shift CTA Button (Mobile & Desktop thumb target) */}
          <button
            onClick={() => { onNewShift(); triggerHaptic('success'); }}
            className="min-h-touch flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-sm tracking-wide"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span className="hidden xs:inline font-extrabold">ZAPSAT SMĚNU</span>
            <span className="xs:hidden">ZÁPIS</span>
          </button>
        </div>
      </div>
    </header>
  );
};
