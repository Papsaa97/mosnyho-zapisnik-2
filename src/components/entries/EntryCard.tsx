import React, { useState } from 'react';
import { 
  Flame, 
  Wrench, 
  AlertTriangle, 
  Truck, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Trash2, 
  Car, 
  Utensils, 
  Layers, 
  Calendar, 
  ArrowRight
} from 'lucide-react';

import { WorkEntry, WorkType, WorkEntryStatus } from '../../types';
import { formatCurrency, formatHours } from '../../services/pricingEngine';

interface EntryCardProps {
  entry: WorkEntry;
  onEdit: (entry: WorkEntry) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, newStatus: WorkEntryStatus) => void;
}

const WORK_TYPE_CONFIG: Record<WorkType, { label: string; icon: React.ElementType; color: string }> = {
  workshop_welding: { label: 'Dílna – svařování', icon: Flame, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  site_assembly: { label: 'Montáž na stavbě', icon: Wrench, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' },
  service_emergency: { label: 'Pohotovost / Havárie', icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' },
  travel_only: { label: 'Pouze cesťák', icon: Truck, color: 'text-slate-300 bg-slate-800 border-slate-700' }
};

const STATUS_CONFIG: Record<WorkEntryStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Koncept', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  submitted: { label: 'Odevzdáno', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  invoiced: { label: 'Vyfakturováno', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  paid: { label: 'Zaplaceno', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' }
};

export const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  onEdit,
  onDelete,
  onUpdateStatus
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const typeConfig = WORK_TYPE_CONFIG[entry.workType] || WORK_TYPE_CONFIG.site_assembly;
  const statusConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.draft;
  const TypeIcon = typeConfig.icon;

  const dateObj = new Date(entry.date);
  const formattedDate = dateObj.toLocaleDateString('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  });

  const nextStatusMap: Record<WorkEntryStatus, WorkEntryStatus> = {
    draft: 'submitted',
    submitted: 'invoiced',
    invoiced: 'paid',
    paid: 'draft'
  };

  const nextStatusLabelMap: Record<WorkEntryStatus, string> = {
    draft: 'Označit jako Odevzdáno',
    submitted: 'Označit jako Vyfakturováno',
    invoiced: 'Označit jako Zaplaceno',
    paid: 'Vrátit do Konceptu'
  };

  const travelTotal = (entry.travel.distanceKm * entry.travel.ratePerKm) +
                      (entry.travel.travelTimeHours * entry.travel.travelHourlyRate) +
                      (entry.travel.dietAllowance || 0);

  const laborTotal = entry.totalHours * entry.pricing.calculatedHourlyRate;
  const extrasTotal = (entry.extraCosts || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 shadow-lg transition-all duration-200">
      {/* Top Header: Date, Badges & Price */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Work Type Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeConfig.color}`}>
            <TypeIcon className="w-3.5 h-3.5" />
            {typeConfig.label}
          </span>

          {/* Status Badge */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
            {statusConfig.label}
          </span>

          {/* Welding Method if any */}
          {entry.weldingMethod && entry.weldingMethod !== 'NONE' && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono font-bold border border-slate-700">
              {entry.weldingMethod}
            </span>
          )}

          {/* Shift Surcharges */}
          {entry.pricing.shiftSurcharges.map(sc => (
            <span key={sc} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold border border-amber-500/30">
              +{sc === 'weekend' ? 'Víkend' : sc === 'night' ? 'Noční' : 'Svátek'}
            </span>
          ))}
        </div>

        {/* Grand Total Price */}
        <div className="text-right flex-shrink-0">
          <span className="text-base sm:text-xl font-black text-amber-400 font-mono tracking-tight block">
            {formatCurrency(entry.totalEarnings)}
          </span>
          {entry.invoiceNumber && (
            <span className="text-[10px] text-purple-400 font-bold">
              {entry.invoiceNumber}
            </span>
          )}
        </div>
      </div>

      {/* Project & Client */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm sm:text-base font-black text-white leading-tight">
            {entry.projectName}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{entry.clientName}</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            {formattedDate}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            {entry.startTime} – {entry.endTime} ({formatHours(entry.totalHours)})
          </span>
        </div>
      </div>

      {/* Breakdown Strip (Quick Overview) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Čistý čas</span>
          <span className="font-mono font-bold text-slate-200">
            {entry.totalHours.toFixed(2).replace('.', ',')} h
          </span>
          <span className="text-[10px] text-slate-400 ml-1">({entry.pricing.calculatedHourlyRate} Kč/h)</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Práce celkem</span>
          <span className="font-mono font-bold text-slate-200">{formatCurrency(laborTotal)}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Doprava & Diety</span>
          <span className="font-mono font-bold text-slate-200">
            {entry.travel.distanceKm > 0 || (entry.travel.dietAllowance || 0) > 0 
              ? formatCurrency(travelTotal) 
              : '0 Kč'}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Materiál & Vícepráce</span>
          <span className="font-mono font-bold text-slate-200">
            {extrasTotal > 0 ? formatCurrency(extrasTotal) : '0 Kč'}
          </span>
        </div>
      </div>

      {/* Expandable Technical Details & Notes */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300 animate-in fade-in">
          {/* Notes */}
          {entry.notes && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                Technická poznámka & protokol svárů:
              </span>
              <p className="font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {entry.notes}
              </p>
            </div>
          )}

          {/* Travel & Extras Detail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {entry.travel.distanceKm > 0 && (
              <div className="p-2 bg-slate-950/40 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Car className="w-3.5 h-3.5 text-amber-400" />
                  Cestovné ({entry.travel.distanceKm} km × {entry.travel.ratePerKm} Kč/km + {entry.travel.travelTimeHours}h řízení):
                </span>
                <span className="font-bold text-slate-200">
                  {formatCurrency((entry.travel.distanceKm * entry.travel.ratePerKm) + (entry.travel.travelTimeHours * entry.travel.travelHourlyRate))}
                </span>
              </div>
            )}

            {(entry.travel.dietAllowance || 0) > 0 && (
              <div className="p-2 bg-slate-950/40 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  Stravné (diety):
                </span>
                <span className="font-bold text-slate-200">{formatCurrency(entry.travel.dietAllowance)}</span>
              </div>
            )}
          </div>

          {/* Extra Costs Itemized */}
          {entry.extraCosts && entry.extraCosts.length > 0 && (
            <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" />
                Rozpis materiálu a nákladů:
              </span>
              <div className="space-y-1">
                {entry.extraCosts.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-slate-300">
                    <span>{i.description}</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(i.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar: Expand, Status Change, Edit, Delete */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
        {/* Toggle Details */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-semibold py-1 px-1.5 rounded hover:bg-slate-800"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Skrýt detaily
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Zobrazit rozpis & poznámku
            </>
          )}
        </button>

        {/* Status progress button + Edit/Delete */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateStatus(entry.id, nextStatusMap[entry.status])}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
            title={nextStatusLabelMap[entry.status]}
          >
            <span>{nextStatusLabelMap[entry.status]}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Upravit záznam"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Smazat záznam"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
