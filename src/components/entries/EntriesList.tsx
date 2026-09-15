import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Plus, 
  Building2,
  HardHat,
  SlidersHorizontal,
  ChevronDown,
  X,
  RotateCcw,
  ArrowUpDown
} from 'lucide-react';
import { WorkEntry, WorkEntryStatus, ShiftPreset, AppSettings, ShiftCheckoutData } from '../../types';
import { EntryCard } from './EntryCard';
import { formatCurrency } from '../../services/pricingEngine';
import { exportEntriesToCSV } from '../../services/exportService';
import { SmartShiftTracker } from '../tracker/SmartShiftTracker';
import { useShiftTimer } from '../../hooks/useShiftTimer';

interface EntriesListProps {
  entries: WorkEntry[];
  onNewShift: () => void;
  onEdit: (entry: WorkEntry) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, newStatus: WorkEntryStatus) => void;
  timer: ReturnType<typeof useShiftTimer>;
  onFinishLiveShift: (checkoutData: ShiftCheckoutData) => void;
  presets: ShiftPreset[];
  settings: AppSettings;
}

export const EntriesList: React.FC<EntriesListProps> = ({
  entries,
  onNewShift,
  onEdit,
  onDelete,
  onUpdateStatus,
  timer,
  onFinishLiveShift,
  presets,
  settings
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedWorkType, setSelectedWorkType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc'>('date_desc');

  // Available unique months from entries
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    entries.forEach(e => {
      if (e.date) {
        months.add(e.date.slice(0, 7)); // YYYY-MM
      }
    });
    return Array.from(months).sort().reverse();
  }, [entries]);

  // Available unique clients
  const availableClients = useMemo(() => {
    const clients = new Set<string>();
    entries.forEach(e => {
      if (e.clientName) clients.add(e.clientName);
    });
    return Array.from(clients).sort();
  }, [entries]);

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (selectedStatus !== 'all' && entry.status !== selectedStatus) {
        return false;
      }
      if (selectedMonth !== 'all' && !entry.date.startsWith(selectedMonth)) {
        return false;
      }
      if (selectedClient !== 'all' && entry.clientName !== selectedClient) {
        return false;
      }
      if (selectedWorkType !== 'all' && entry.workType !== selectedWorkType) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesProject = entry.projectName.toLowerCase().includes(query);
        const matchesClient = entry.clientName.toLowerCase().includes(query);
        const matchesNotes = entry.notes?.toLowerCase().includes(query);
        const matchesMethod = entry.weldingMethod?.toLowerCase().includes(query);
        const matchesInvoice = entry.invoiceNumber?.toLowerCase().includes(query);
        if (!matchesProject && !matchesClient && !matchesNotes && !matchesMethod && !matchesInvoice) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
      if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
      if (sortBy === 'price_desc') return b.totalEarnings - a.totalEarnings;
      return 0;
    });
  }, [entries, selectedStatus, selectedMonth, selectedClient, selectedWorkType, searchQuery, sortBy]);

  // Summary statistics for current filter
  const summary = useMemo(() => {
    let totalHours = 0;
    let totalKm = 0;
    let totalEarnings = 0;
    let totalDiets = 0;

    filteredEntries.forEach(e => {
      totalHours += (Number(e.totalHours) || 0);
      totalKm += (Number(e.travel?.distanceKm) || 0);
      totalEarnings += (Number(e.totalEarnings) || 0);
      totalDiets += (Number(e.travel?.dietAllowance) || 0);
    });

    // Guard: avoid NaN and division by zero
    const safeHours = Number.isFinite(totalHours) && totalHours > 0 ? totalHours : 0;
    const safeEarnings = Number.isFinite(totalEarnings) ? totalEarnings : 0;
    const avgRate = safeHours > 0 ? Math.round(safeEarnings / safeHours) : 0;

    return {
      totalHours: safeHours,
      totalKm: Number.isFinite(totalKm) ? totalKm : 0,
      totalEarnings: safeEarnings,
      totalDiets: Number.isFinite(totalDiets) ? totalDiets : 0,
      avgRate
    };
  }, [filteredEntries]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: entries.length, draft: 0, submitted: 0, invoiced: 0, paid: 0 };
    entries.forEach(e => {
      if (e.status in counts) {
        counts[e.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [entries]);

  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatus !== 'all') count++;
    if (selectedMonth !== 'all') count++;
    if (selectedClient !== 'all') count++;
    if (selectedWorkType !== 'all') count++;
    if (sortBy !== 'date_desc') count++;
    return count;
  }, [selectedStatus, selectedMonth, selectedClient, selectedWorkType, sortBy]);

  const handleResetFilters = () => {
    setSelectedStatus('all');
    setSelectedMonth('all');
    setSelectedClient('all');
    setSelectedWorkType('all');
    setSearchQuery('');
    setSortBy('date_desc');
  };

  const handleExportFilteredCSV = () => {
    exportEntriesToCSV(filteredEntries, `vyber_${selectedMonth}`);
  };

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Live Smart Shift Tracker Panel */}
      <SmartShiftTracker
        timer={timer}
        onFinishShift={onFinishLiveShift}
        onOpenManualEntry={onNewShift}
        presets={presets}
        settings={settings}
      />
      
      {/* Compact Search Bar & Filter Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search input with clear button */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat v zakázkách, poznámkách, metodách sváru..."
              className="w-full min-h-[40px] bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-8 py-1.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                title="Vymazat hledání"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Toggle Button with Active Count Badge */}
          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFiltersOpen || activeFiltersCount > 0
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
            }`}
            title="Rozbalit podrobné filtry a řazení"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Filtry</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Reset Button if any filter or search is applied */}
          {(activeFiltersCount > 0 || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[40px] px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Resetovat všechny filtry a vyhledávání"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {/* Quick CSV Export */}
          <button
            type="button"
            onClick={handleExportFilteredCSV}
            className="min-h-[40px] p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
            title="Exportovat aktuální výběr do CSV pro Excel"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">CSV</span>
          </button>
        </div>

        {/* Collapsible Filter Panel */}
        {isFiltersOpen && (
          <div className="pt-2.5 border-t border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Filtrovat záznamy podle stavu a parametrů
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resetovat filtry</span>
              </button>
            </div>

            {/* Status Chips Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {[
                { id: 'all', label: 'Všechny stavy', count: statusCounts.all },
                { id: 'draft', label: 'Koncept', count: statusCounts.draft },
                { id: 'submitted', label: 'Odevzdáno', count: statusCounts.submitted },
                { id: 'invoiced', label: 'Vyfakturováno', count: statusCounts.invoiced },
                { id: 'paid', label: 'Zaplaceno', count: statusCounts.paid },
              ].map((st) => {
                const isSelected = selectedStatus === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStatus(st.id)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
                        : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                    style={{ minHeight: '34px' }}
                  >
                    <span>{st.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {st.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dropdown Filters: Month, Client, Work Type, Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60">
              {/* Měsíc */}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="all">Všechny měsíce</option>
                  {availableMonths.map(m => {
                    const [year, month] = m.split('-');
                    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
                    return (
                      <option key={m} value={m}>{monthName}</option>
                    );
                  })}
                </select>
              </div>

              {/* Odběratel */}
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="all">Všichni odběratelé</option>
                  {availableClients.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Typ práce */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <select
                  value={selectedWorkType}
                  onChange={(e) => setSelectedWorkType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="all">Všechny typy prací</option>
                  <option value="workshop_welding">Dílna – svařování</option>
                  <option value="site_assembly">Montáž na stavbě</option>
                  <option value="service_emergency">Pohotovost / Havárie</option>
                  <option value="travel_only">Pouze cesťák</option>
                </select>
              </div>

              {/* Řazení */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'price_desc')}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none"
                >
                  <option value="date_desc">Nejnovější směny</option>
                  <option value="date_asc">Nejstarší směny</option>
                  <option value="price_desc">Nejvyšší výdělek</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Streamlined Minimalist Summary KPI Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 items-center">
          <div className="flex items-baseline justify-between md:justify-start md:gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">
              Fakturováno:
            </span>
            <span className="text-sm sm:text-base font-black text-amber-300 font-mono tracking-tight">
              {formatCurrency(summary.totalEarnings)}
            </span>
          </div>

          <div className="flex items-baseline justify-between md:justify-start md:gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Hodin:
            </span>
            <span className="text-xs sm:text-sm font-black text-white font-mono">
              {summary.totalHours.toFixed(1).replace('.', ',')} h
              <span className="text-[10px] text-slate-400 ml-1 font-normal hidden sm:inline">({filteredEntries.length} směn)</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between md:justify-start md:gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Cesty:
            </span>
            <span className="text-xs sm:text-sm font-black text-white font-mono">
              {summary.totalKm} km
            </span>
          </div>

          <div className="flex items-baseline justify-between md:justify-start md:gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Stravné:
            </span>
            <span className="text-xs sm:text-sm font-black text-white font-mono">
              {formatCurrency(summary.totalDiets)}
            </span>
          </div>
        </div>
      </div>

      {/* Entries Cards Feed */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-700/60 rounded-2xl p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <HardHat className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">
                {selectedStatus !== 'all' || selectedMonth !== 'all' || selectedClient !== 'all' || searchQuery
                  ? 'Žádné směny neodpovídají filtru'
                  : 'Zatím tu nic není'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {selectedStatus !== 'all' || selectedMonth !== 'all' || selectedClient !== 'all' || searchQuery
                  ? 'Zkuste změnit nebo resetovat filtry. Nebo přidejte novou směnu pomocí tlačítka níže.'
                  : 'Přidejte první směnu pomocí tlačítka „Zapsat směnu" nahoře, nebo použijte živý tracker výše.'}
              </p>
            </div>
            <button
              onClick={onNewShift}
              className="min-h-touch px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Zapsat novou směnu
            </button>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </div>
    </div>
  );
};

