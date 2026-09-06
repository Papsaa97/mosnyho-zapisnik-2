import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Plus, 
  Building2
} from 'lucide-react';
import { WorkEntry, WorkEntryStatus, ShiftPreset, AppSettings } from '../../types';
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
  onFinishLiveShift: (checkoutData: any) => void;
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
      totalHours += e.totalHours || 0;
      totalKm += e.travel.distanceKm || 0;
      totalEarnings += e.totalEarnings || 0;
      totalDiets += e.travel.dietAllowance || 0;
    });

    const avgRate = totalHours > 0 ? Math.round(totalEarnings / totalHours) : 0;

    return { totalHours, totalKm, totalEarnings, totalDiets, avgRate };
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

  const handleExportFilteredCSV = () => {
    exportEntriesToCSV(filteredEntries, `vyber_${selectedMonth}`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Dominant Smart Shift Tracker Panel */}
      <SmartShiftTracker
        timer={timer}
        onFinishShift={onFinishLiveShift}
        onOpenManualEntry={onNewShift}
        presets={presets}
        settings={settings}
      />
      
      {/* Top Filter & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat v zakázkách, poznámkách, metodách sváru..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              style={{ minHeight: '44px' }}
            />
          </div>

          {/* Quick CSV Export & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-amber-500"
                style={{ minHeight: '44px' }}
              >
                <option value="date_desc">Nejnovější směny</option>
                <option value="date_asc">Nejstarší směny</option>
                <option value="price_desc">Nejvyšší výdělek</option>
              </select>
            </div>

            <button
              onClick={handleExportFilteredCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl transition-colors"
              title="Exportovat aktuální výběr do CSV pro Excel"
              style={{ minHeight: '44px' }}
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span className="hidden xs:inline">CSV Export</span>
            </button>
          </div>
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
                onClick={() => setSelectedStatus(st.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                style={{ minHeight: '38px' }}
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

        {/* Dropdown Filters: Month, Client, Work Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800">
          {/* Měsíc */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
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
            <Building2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
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
            <Filter className="w-4 h-4 text-amber-400 flex-shrink-0" />
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
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Celkový výdělek */}
        <div className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-2xl p-3 sm:p-4 shadow">
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 block mb-1">
            Fakturovaná částka
          </span>
          <span className="text-lg sm:text-2xl font-black text-amber-300 font-mono tracking-tight block">
            {formatCurrency(summary.totalEarnings)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            průměr {summary.avgRate} Kč/h
          </span>
        </div>

        {/* Odpracováno hodin */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Odpracováno hodin
          </span>
          <span className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight block">
            {summary.totalHours.toFixed(1).replace('.', ',')} h
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold mt-0.5 block">
            {filteredEntries.length} směn v součtu
          </span>
        </div>

        {/* Ujeto km */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Ujeto kilometrů
          </span>
          <span className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight block">
            {summary.totalKm} km
          </span>
          <span className="text-[11px] text-sky-400 font-semibold mt-0.5 block">
            dodávkou na zakázky
          </span>
        </div>

        {/* Stravné celkem */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Stravné / Diety
          </span>
          <span className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight block">
            {formatCurrency(summary.totalDiets)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            zákonné náhrady
          </span>
        </div>
      </div>

      {/* Entries Cards Feed */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Nebyly nalezeny žádné záznamy směn</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Žádná směna neodpovídá zvoleným filtrům nebo ještě nemáte zapsanou žádnou práci pro toto období.
            </p>
            <button
              onClick={onNewShift}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
              style={{ minHeight: '44px' }}
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
