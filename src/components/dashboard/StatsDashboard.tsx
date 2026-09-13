import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Flame, 
  Wrench, 
  AlertTriangle, 
  Truck, 
  KanbanSquare, 
  BarChart3,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { WorkEntry, WorkEntryStatus, WorkType } from '../../types';

import { BillingKanban } from './BillingKanban';
import { formatCurrency, formatHours } from '../../services/pricingEngine';

interface StatsDashboardProps {
  entries: WorkEntry[];
  onUpdateStatus: (id: string, newStatus: WorkEntryStatus) => void;
  onEdit: (entry: WorkEntry) => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  entries,
  onUpdateStatus,
  onEdit
}) => {
  const [subView, setSubView] = useState<'kanban' | 'charts'>('kanban');

  // Overall calculations
  const stats = useMemo(() => {
    let totalEarnings = 0;
    let paidEarnings = 0;
    let invoicedPendingEarnings = 0;
    let draftSubmittedEarnings = 0;
    let totalHours = 0;
    let totalKm = 0;

    const workTypeMap: Record<WorkType, { hours: number; earnings: number; count: number }> = {
      workshop_welding: { hours: 0, earnings: 0, count: 0 },
      site_assembly: { hours: 0, earnings: 0, count: 0 },
      service_emergency: { hours: 0, earnings: 0, count: 0 },
      travel_only: { hours: 0, earnings: 0, count: 0 }
    };

    const clientMap: Record<string, { earnings: number; hours: number }> = {};
    const monthMap: Record<string, number> = {};

    let rolling12MonthsTurnover = 0;
    let currentYearTurnover = 0;
    const now = new Date();
    const currentYearStr = String(now.getFullYear());
    
    // Pro výpočet DPH (obrat za 12 po sobě jdoucích měsíců)
    // Např. teď je září, takže počítáme od 1. října předchozího roku do 30. září tohoto roku
    const dphLimitStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7);

    entries.forEach(e => {
      const earn = e.totalEarnings || 0;
      const h = e.totalHours || 0;
      totalEarnings += earn;
      totalHours += h;
      totalKm += e.travel.distanceKm || 0;

      if (e.status === 'paid') paidEarnings += earn;
      else if (e.status === 'invoiced') invoicedPendingEarnings += earn;
      else draftSubmittedEarnings += earn;

      // Obrat se počítá jen z fakturovaných a zaplacených
      if (e.status === 'invoiced' || e.status === 'paid') {
        const entryMonth = e.date.slice(0, 7);
        if (entryMonth >= dphLimitStart) {
          rolling12MonthsTurnover += earn;
        }
        if (e.date.startsWith(currentYearStr)) {
          currentYearTurnover += earn;
        }
      }

      if (workTypeMap[e.workType]) {
        workTypeMap[e.workType].hours += h;
        workTypeMap[e.workType].earnings += earn;
        workTypeMap[e.workType].count += 1;
      }

      if (e.clientName) {
        if (!clientMap[e.clientName]) clientMap[e.clientName] = { earnings: 0, hours: 0 };
        clientMap[e.clientName].earnings += earn;
        clientMap[e.clientName].hours += h;
      }

      if (e.date) {
        const mon = e.date.slice(0, 7);
        monthMap[mon] = (monthMap[mon] || 0) + earn;
      }
    });

    const avgHourly = totalHours > 0 ? Math.round(totalEarnings / totalHours) : 0;
    
    // Paušální daň odhad (60 % výdaje) pro aktuální rok
    const pausalExpenses = currentYearTurnover * 0.6;
    const taxBase = Math.max(0, currentYearTurnover - pausalExpenses);
    const estimatedTax15 = taxBase * 0.15; // Daň 15% (bez odečtu slevy na poplatníka apod.)

    return {
      totalEarnings,
      paidEarnings,
      invoicedPendingEarnings,
      draftSubmittedEarnings,
      totalHours,
      totalKm,
      avgHourly,
      workTypeMap,
      clientMap,
      monthMap,
      rolling12MonthsTurnover,
      currentYearTurnover,
      pausalExpenses,
      taxBase,
      estimatedTax15
    };
  }, [entries]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 md:pb-12">
      
      {/* Sub-tabs: Kanban vs Charts */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSubView('kanban')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              subView === 'kanban'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
            style={{ minHeight: '40px' }}
          >
            <KanbanSquare className="w-4 h-4" />
            <span>Billing Pipeline (Kanban)</span>
          </button>

          <button
            onClick={() => setSubView('charts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              subView === 'charts'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
            style={{ minHeight: '40px' }}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Statistiky & Poměry výdělků</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Celkový obrat */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Celkový obrat
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight block">
            {formatCurrency(stats.totalEarnings)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Průměrně: <strong className="text-slate-200">{stats.avgHourly} Kč/h</strong>
          </span>
        </div>

        {/* Již zaplaceno */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Uhrazeno na účet
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight block">
            {formatCurrency(stats.paidEarnings)}
          </span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-400 h-full rounded-full"
              style={{ width: `${stats.totalEarnings > 0 ? (stats.paidEarnings / stats.totalEarnings) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Čeká na úhradu */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Vyfakturované pohledávky
          </span>
          <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight block">
            {formatCurrency(stats.invoicedPendingEarnings)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            vystavené faktury před splatností
          </span>
        </div>

        {/* K vystavení faktury */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            K vyfakturování
          </span>
          <span className="text-xl sm:text-2xl font-black text-sky-300 font-mono tracking-tight block">
            {formatCurrency(stats.draftSubmittedEarnings)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            připraveno na fakturu
          </span>
        </div>
      </div>

      {/* Main View Area */}
      {subView === 'kanban' ? (
        <BillingKanban
          entries={entries}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
        />
      ) : (
        <div className="space-y-4">
          
          {/* Fakturoid-style Tax & VAT Tracking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* VAT Limit (Obrat DPH) */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
              <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Daňový semafor: Limit DPH (2 000 000 Kč)
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Obrat za 12 měsíců:</span>
                  <span className="font-mono">{formatCurrency(stats.rolling12MonthsTurnover)}</span>
                </div>
                
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      stats.rolling12MonthsTurnover > 1800000 
                        ? 'bg-rose-500' 
                        : stats.rolling12MonthsTurnover > 1500000 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${Math.min(100, (stats.rolling12MonthsTurnover / 2000000) * 100)}%` }}
                  ></div>
                  <div className="absolute top-0 bottom-0 left-[75%] border-l-2 border-dashed border-slate-950 opacity-50" title="1.5M - blížící se limit"></div>
                </div>
                
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Zákonný limit pro povinnou registraci plátce DPH je obrat 2 000 000 Kč za posledních 12 po sobě jdoucích kalendářních měsíců. 
                  Zbývá <strong className="text-slate-300">{formatCurrency(Math.max(0, 2000000 - stats.rolling12MonthsTurnover))}</strong>.
                </div>
              </div>
            </div>

            {/* Tax estimation */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
              <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                Odhad daně z příjmů (60% paušál)
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Příjmy v aktuálním roce:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(stats.currentYearTurnover)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Uplatněné výdaje (60 %):</span>
                  <span className="font-mono text-rose-400">− {formatCurrency(stats.pausalExpenses)}</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2 font-bold">
                  <span>Základ daně (odhad):</span>
                  <span className="font-mono">{formatCurrency(stats.taxBase)}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-bold border-t border-slate-800 pt-2 text-sm mt-1">
                  <span>Vypočtená daň (15 %):</span>
                  <span className="font-mono">{formatCurrency(stats.estimatedTax15)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Částka nezahrnuje slevu na poplatníka (obvykle 30 840 Kč ročně) ani další možné odpočty (děti, úroky). Slouží k orientační představě o zisku.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Work Type Breakdown */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Rozložení činností (Dílna vs. Montáže vs. Havárie)
            </h3>

            <div className="space-y-3">
              {[
                { type: 'site_assembly' as WorkType, label: 'Montáže na stavbě', icon: Wrench, color: 'bg-sky-500' },
                { type: 'workshop_welding' as WorkType, label: 'Dílenské svařování', icon: Flame, color: 'bg-amber-500' },
                { type: 'service_emergency' as WorkType, label: 'Pohotovost a havárie', icon: AlertTriangle, color: 'bg-rose-500' },
                { type: 'travel_only' as WorkType, label: 'Doprava a cesťáky', icon: Truck, color: 'bg-slate-500' }
              ].map(item => {
                const data = stats.workTypeMap[item.type];
                const percentage = stats.totalEarnings > 0 ? Math.round((data.earnings / stats.totalEarnings) * 100) : 0;
                const Icon = item.icon;

                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-bold text-slate-200">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        {item.label}
                      </span>
                      <span className="font-mono text-slate-300">
                        {formatCurrency(data.earnings)} ({percentage} %)
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${percentage}%` }}></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{data.count} směn celkem</span>
                      <span>{formatHours(data.hours)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Client Breakdown */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Výnosy podle odběratelů
            </h3>

            <div className="space-y-3">
              {Object.entries(stats.clientMap).map(([client, data]) => {
                const percentage = stats.totalEarnings > 0 ? Math.round((data.earnings / stats.totalEarnings) * 100) : 0;

                return (
                  <div key={client} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 truncate max-w-[200px]">{client}</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {formatCurrency(data.earnings)} ({percentage} %)
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Odpracováno: {formatHours(data.hours)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Revenue Bars */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Měsíční vývoj obratu
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(stats.monthMap).map(([mon, amt]) => {
                const [y, m] = mon.split('-');
                const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

                return (
                  <div key={mon} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      {monthName}
                    </span>
                    <span className="text-base font-black text-amber-400 font-mono block">
                      {formatCurrency(amt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
