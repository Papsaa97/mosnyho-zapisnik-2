import React from 'react';
import { 
  ClipboardList, 
  FileText, 
  KanbanSquare, 
  SlidersHorizontal 
} from 'lucide-react';


export type ActiveTab = 'entries' | 'report' | 'pipeline' | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  pendingInvoiceCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  pendingInvoiceCount
}) => {
  const navItems = [
    {
      id: 'entries' as ActiveTab,
      label: 'Deník směn',
      shortLabel: 'Směny',
      icon: ClipboardList,
      badge: null
    },
    {
      id: 'report' as ActiveTab,
      label: 'Podklad k faktuře',
      shortLabel: 'Protokol A4',
      icon: FileText,
      badge: null
    },
    {
      id: 'pipeline' as ActiveTab,
      label: 'Pipeline & Cashflow',
      shortLabel: 'Cashflow',
      icon: KanbanSquare,
      badge: pendingInvoiceCount > 0 ? pendingInvoiceCount : null
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Sazebník & Profil',
      shortLabel: 'Sazebník',
      icon: SlidersHorizontal,
      badge: null
    }
  ];

  return (
    <>
      {/* Desktop subheader tabs */}
      <div className="no-print hidden md:block bg-slate-900/60 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <nav className="flex space-x-1 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all relative ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== null && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[11px] font-black rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Thumb Zone Bar (Fixed at bottom for 1-thumb reach) */}
      <nav 
        aria-label="Spodní navigace"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_20px_rgba(0,0,0,0.4)]"
      >
        <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 transition-all relative py-1 ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ minHeight: '48px' }}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5] scale-110' : 'stroke-[1.8]'}`} />
                  {item.badge !== null && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] leading-tight font-bold tracking-tight ${isActive ? 'font-extrabold text-amber-400' : ''}`}>
                  {item.shortLabel}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
