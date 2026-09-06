import React from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Edit3
} from 'lucide-react';
import { WorkEntry, WorkEntryStatus } from '../../types';

import { formatCurrency, formatHours } from '../../services/pricingEngine';

interface BillingKanbanProps {
  entries: WorkEntry[];
  onUpdateStatus: (id: string, newStatus: WorkEntryStatus) => void;
  onEdit: (entry: WorkEntry) => void;
}

const COLUMNS: Array<{
  id: WorkEntryStatus;
  title: string;
  subtitle: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  headerAccent: string;
}> = [
  {
    id: 'draft',
    title: 'Rozpracováno',
    subtitle: 'Koncepty ke kontrole',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    headerAccent: 'from-amber-500/20 to-transparent'
  },
  {
    id: 'submitted',
    title: 'K fakturaci',
    subtitle: 'Odevzdáno stavbyvedoucímu',
    borderColor: 'border-sky-500/30',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-400',
    headerAccent: 'from-sky-500/20 to-transparent'
  },
  {
    id: 'invoiced',
    title: 'Vyfakturováno',
    subtitle: 'Vystavena faktura (čeká na úhradu)',
    borderColor: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-400',
    headerAccent: 'from-purple-500/20 to-transparent'
  },
  {
    id: 'paid',
    title: 'Zaplaceno',
    subtitle: 'Peníze na bankovním účtu',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    headerAccent: 'from-emerald-500/20 to-transparent'
  }
];

export const BillingKanban: React.FC<BillingKanbanProps> = ({
  entries,
  onUpdateStatus,
  onEdit
}) => {
  const getDaysUntilDue = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 md:pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            Pipeline zakázek a fakturace
          </h2>
          <p className="text-xs text-slate-400">
            Sledování toku peněz od zapsání směny po připsání na účet
          </p>
        </div>
      </div>

      {/* 4 Responsive Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colEntries = entries.filter(e => e.status === col.id);
          const colTotal = colEntries.reduce((sum, e) => sum + (e.totalEarnings || 0), 0);
          const colHours = colEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);

          return (
            <div
              key={col.id}
              className={`bg-slate-900/90 rounded-2xl border ${col.borderColor} flex flex-col h-full shadow-lg overflow-hidden`}
            >
              {/* Column Header */}
              <div className={`p-3.5 border-b border-slate-800/80 bg-gradient-to-b ${col.headerAccent}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-sm text-white">{col.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-black ${col.badgeBg} ${col.badgeText}`}>
                    {colEntries.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-amber-400">
                    {formatCurrency(colTotal)}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {colHours.toFixed(1).replace('.', ',')} h
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{col.subtitle}</div>
              </div>

              {/* Column Cards List */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin">
                {colEntries.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-medium border border-dashed border-slate-800 rounded-xl">
                    Žádné položky
                  </div>
                ) : (
                  colEntries.map((entry) => {
                    const daysDue = entry.paymentDueDate ? getDaysUntilDue(entry.paymentDueDate) : null;

                    return (
                      <div
                        key={entry.id}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow text-xs space-y-2 transition-all"
                      >
                        {/* Title & Price */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-200 line-clamp-1 leading-snug">
                            {entry.projectName}
                          </span>
                          <span className="font-mono font-bold text-amber-400 flex-shrink-0">
                            {formatCurrency(entry.totalEarnings)}
                          </span>
                        </div>

                        {/* Client & Date */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate max-w-[120px]">{entry.clientName}</span>
                          <span className="font-mono">{entry.date}</span>
                        </div>

                        {/* Time & Welding Method */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                            {formatHours(entry.totalHours)}
                          </span>
                          {entry.weldingMethod && entry.weldingMethod !== 'NONE' && (
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                              {entry.weldingMethod}
                            </span>
                          )}
                          {entry.travel.distanceKm > 0 && (
                            <span className="text-slate-500">
                              {entry.travel.distanceKm} km
                            </span>
                          )}
                        </div>

                        {/* Invoice & Due date alert */}
                        {entry.invoiceNumber && (
                          <div className="pt-1 border-t border-slate-900 flex items-center justify-between text-[10px]">
                            <span className="text-purple-400 font-semibold">{entry.invoiceNumber}</span>
                            {daysDue !== null && (
                              <span className={`font-bold ${
                                daysDue < 0 ? 'text-rose-400 animate-pulse' : daysDue <= 3 ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {daysDue < 0 ? `Po splatnosti ${Math.abs(daysDue)} d!` : `Splatnost za ${daysDue} d`}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card Footer Actions */}
                        <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(entry)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Upravit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Status Mover Buttons */}
                          <div className="flex items-center gap-1">
                            {col.id !== 'draft' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const prevMap: Record<WorkEntryStatus, WorkEntryStatus> = {
                                    submitted: 'draft',
                                    invoiced: 'submitted',
                                    paid: 'invoiced',
                                    draft: 'draft'
                                  };
                                  onUpdateStatus(entry.id, prevMap[col.id]);
                                }}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                                title="Posunout zpět"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}

                            {col.id !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextMap: Record<WorkEntryStatus, WorkEntryStatus> = {
                                    draft: 'submitted',
                                    submitted: 'invoiced',
                                    invoiced: 'paid',
                                    paid: 'paid'
                                  };
                                  onUpdateStatus(entry.id, nextMap[col.id]);
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold flex items-center gap-1"
                                title="Posunout do další fáze"
                              >
                                <span>Posunout</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
