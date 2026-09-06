import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  WifiOff, 
  Plus, 
  Download, 
  Upload, 
  RotateCcw, 
  Database,
  ShieldCheck
} from 'lucide-react';
import { exportDatabaseBackupToJSON, importDatabaseBackupFromJSON } from '../../services/exportService';
import { resetToDemoData } from '../../db';


interface HeaderProps {
  onNewShift: () => void;
  onOpenSettings: () => void;
  entriesCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onNewShift, onOpenSettings, entriesCount }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [showBackupMenu, setShowBackupMenu] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleResetData = async () => {
    if (window.confirm('Opravdu chcete obnovit výchozí ukázková data svářeče? Všechny úpravy budou přepsány ukázkou.')) {
      await resetToDemoData();
      showToast('Ukázková data byla úspěšně obnovena');
      setShowBackupMenu(false);
    }
  };

  const handleBackupExport = async () => {
    try {
      await exportDatabaseBackupToJSON();
      showToast('Kompletní záloha JSON byla stažena');
      setShowBackupMenu(false);
    } catch {
      showToast('Chyba při exportu zálohy');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importDatabaseBackupFromJSON(content);
      if (success) {
        showToast('Záloha byla úspěšně nahrána');
      } else {
        showToast('Chyba při obnově: neplatný soubor');
      }
      setShowBackupMenu(false);
    };
    reader.readAsText(file);
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="no-print sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white px-3 sm:px-6 py-2.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 border border-amber-400/40">
            <Flame className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                MOŠNÝHO ZÁPISNÍK
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

        {/* Status Indicators & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline / Storage Badge */}
          <div 
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300"
            title="Aplikace ukládá data do lokální IndexedDB v zařízení. Funguje i v plechové hale bez signálu."
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lokální DB</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {isOnline ? (
              <span className="text-[10px] text-emerald-400/80 ml-0.5">(Online)</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-bold ml-0.5 flex items-center gap-0.5">
                <WifiOff className="w-3 h-3" /> Offline mód
              </span>
            )}
          </div>

          {/* Backup / Restore Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowBackupMenu(!showBackupMenu)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Správa dat a záloha"
            >
              <Database className="w-4 h-4 text-amber-400" />
            </button>

            {showBackupMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-850 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-sm animate-in fade-in zoom-in-95">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Data a zálohování
                </div>

                <button
                  onClick={handleBackupExport}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2 text-xs font-medium transition-colors"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  Stáhnout zálohu (JSON)
                </button>

                <label className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-sky-400" />
                  Obnovit ze zálohy (JSON)
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>

                <div className="border-t border-slate-800 my-1"></div>

                <button
                  onClick={handleResetData}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-950/40 text-rose-300 flex items-center gap-2 text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  Obnovit ukázková data
                </button>
              </div>
            )}
          </div>

          {/* New Shift CTA Button (Mobile & Desktop thumb target) */}
          <button
            onClick={onNewShift}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-sm tracking-wide"
            style={{ minHeight: '44px' }}
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span className="hidden xs:inline font-extrabold">ZAPSAT SMĚNU</span>
            <span className="xs:hidden">ZÁPIS</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-amber-400 border border-amber-500/40 px-4 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}
    </header>
  );
};
