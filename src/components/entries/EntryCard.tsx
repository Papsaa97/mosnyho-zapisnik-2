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
  ArrowRight,
  ShieldCheck,
  Camera,
  Maximize2,
  X,
  Image as ImageIcon,
  PenTool,
  CheckCheck
} from 'lucide-react';

import { WorkEntry, WorkType, WorkEntryStatus, EntryPhoto } from '../../types';
import { formatCurrency, formatHours } from '../../services/pricingEngine';
import { triggerHaptic } from '../../utils/haptics';
import { TechnicalPassportService } from '../../services/weldingPassportService';

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
  draft: { label: 'Koncept', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
  submitted: { label: 'Odevzdáno', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  invoiced: { label: 'Vyfakturováno', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' },
  paid: { label: 'Zaplaceno', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' }
};

export const EntryCard: React.FC<EntryCardProps> = React.memo(({
  entry,
  onEdit,
  onDelete,
  onUpdateStatus
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<EntryPhoto | null>(null);

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

  const contractorSig = entry.signatures?.contractor || entry.contractorSignature;
  const clientSig = entry.signatures?.client || entry.clientSignature;
  const isFullySigned = Boolean(contractorSig && clientSig);
  const isPartiallySigned = Boolean((contractorSig || clientSig) && !isFullySigned);

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

          {/* Signature Badges */}
          {isFullySigned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCheck className="w-3.5 h-3.5" />
              Oboustranně podepsáno ✓
            </span>
          )}
          {isPartiallySigned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <PenTool className="w-3.5 h-3.5" />
              Částečně podepsáno
            </span>
          )}

          {/* Welding Passport Badges or Legacy Welding Method */}
          {entry.weldingPassport && TechnicalPassportService.shouldRenderPassport(entry.weldingPassport) ? (
            <>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/30">
                ISO {entry.weldingPassport.methodCode}
              </span>
              {entry.weldingPassport.baseMaterialGrade && entry.weldingPassport.baseMaterialGrade !== 'N/A' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                  {entry.weldingPassport.baseMaterialGrade}
                  {entry.weldingPassport.materialThickness && entry.weldingPassport.materialThickness !== 'N/A' ? ` (${entry.weldingPassport.materialThickness})` : ''}
                </span>
              )}
              {entry.weldingPassport.shieldingGas && entry.weldingPassport.shieldingGas !== 'N/A' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                  {entry.weldingPassport.shieldingGas.split('(')[0].trim()}
                  {entry.weldingPassport.rootBackingGas ? ' + kořen' : ''}
                </span>
              )}
              {entry.weldingPassport.fillerBatch && entry.weldingPassport.fillerBatch !== 'N/A' && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-mono border border-slate-700 truncate max-w-[180px]" title={entry.weldingPassport.fillerBatch}>
                  {entry.weldingPassport.fillerBatch}
                </span>
              )}
              {entry.weldingPassport.weldInspectionVT && entry.weldingPassport.weldInspectionVT !== 'not_required' && (
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  entry.weldingPassport.weldInspectionVT === 'passed_B'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : entry.weldingPassport.weldInspectionVT === 'passed_C'
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}>
                  VT: {entry.weldingPassport.weldInspectionVT === 'passed_B' ? 'Stupeň B' : entry.weldingPassport.weldInspectionVT === 'passed_C' ? 'Stupeň C' : 'Nevyhověl'}
                </span>
              )}
            </>
          ) : (
            entry.weldingMethod && entry.weldingMethod !== 'NONE' && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono font-bold border border-slate-700">
                {entry.weldingMethod}
              </span>
            )
          )}

          {/* Shift Surcharges */}
          {(entry.pricing.shiftSurcharges || []).map(sc => (
            <span key={sc} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold border border-amber-500/30">
              +{sc === 'weekend' ? 'Víkend' : sc === 'night' ? 'Noční' : 'Svátek'}
            </span>
          ))}

          {/* Activity Tags Badges */}
          {(entry.activityTags || entry.workActionTags || []).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[11px] font-bold border border-sky-500/30">
              {tag}
            </span>
          ))}

          {/* Photo Count Badge */}
          {entry.photos && entry.photos.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold border border-amber-500/30">
              <Camera className="w-3 h-3 text-amber-400" />
              {entry.photos.length} {entry.photos.length === 1 ? 'fotka' : entry.photos.length >= 2 && entry.photos.length <= 4 ? 'fotky' : 'fotek'}
            </span>
          )}
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
            {((entry.consumableSlip?.totalBilledAmount || 0) + extrasTotal) > 0 
              ? formatCurrency((entry.consumableSlip?.totalBilledAmount || 0) + extrasTotal) 
              : '0 Kč'}
          </span>
        </div>
      </div>

      {/* Photo Thumbnails Strip (Feature 29) */}
      {entry.photos && entry.photos.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {entry.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="relative flex-shrink-0 group rounded-lg overflow-hidden border border-slate-700 hover:border-amber-400 transition-colors"
              title={photo.caption || 'Zobrazit fotografii'}
            >
              <img
                src={photo.thumbnailUrl}
                alt={photo.caption || 'Fotodokumentace'}
                className="w-16 h-12 object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

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

          {/* Technical Passport Protocol Card */}
          {entry.weldingPassport && TechnicalPassportService.shouldRenderPassport(entry.weldingPassport) && (() => {
            const block = TechnicalPassportService.formatPassportBlock(entry.weldingPassport);
            return (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-amber-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Technický pasport svaru (ČSN EN 1090-2)
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                    block.vtInspection.isCompliant
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {block.vtInspection.labelCz.split('–')[0].trim()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Metoda svařování:</span>
                    <span className="font-semibold text-white">{block.methodDisplay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Základní materiál:</span>
                    <span className="font-semibold text-white">{block.materialDisplay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Ochranný plyn:</span>
                    <span className="font-semibold text-white">{block.gasDisplay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Přídavný materiál (šarže):</span>
                    <span className="font-mono text-amber-300">{block.fillerDisplay || 'Neuvedeno'}</span>
                  </div>
                  {entry.weldingPassport.welderCertNumber && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Certifikát svářeče (ISO 9606-1):</span>
                      <span className="font-mono text-slate-300">{block.welderCertDisplay}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Consumables Slip Card */}
          {entry.consumableSlip && entry.consumableSlip.items && entry.consumableSlip.items.length > 0 && (
            <div className="p-3 bg-slate-950/70 rounded-xl border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Materiálový lístek ({entry.consumableSlip.items.length} položek)
                </span>
                <span className="font-mono font-black text-amber-400 text-xs">
                  {formatCurrency(entry.consumableSlip.totalBilledAmount)}
                </span>
              </div>

              <div className="space-y-1">
                {entry.consumableSlip.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-slate-300 text-[11px]">
                    <span className="truncate flex-1 pr-2">
                      {item.name} ({item.quantity} {item.unit} × {item.unitPrice} Kč{item.markupPercent !== undefined ? ` +${item.markupPercent}%` : ''})
                    </span>
                    <span className="font-mono font-bold text-slate-200 whitespace-nowrap">
                      {formatCurrency(item.billedPrice)}
                    </span>
                  </div>
                ))}
              </div>

              {(entry.consumableSlip.fixedOverheadFee || 0) > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Manipulační / závozový paušál:</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {formatCurrency(entry.consumableSlip.fixedOverheadFee)}
                  </span>
                </div>
              )}
            </div>
          )}

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

          {/* Timeline Events if any */}
          {entry.timeline && entry.timeline.length > 0 && (
            <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Zaznamenaná časová osa ({entry.timeline.length} událostí):
              </span>
              <div className="space-y-1.5">
                {entry.timeline.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-amber-400 font-bold text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {evt.timeStr}
                    </span>
                    <div>
                      <span className="text-slate-200 font-semibold">{evt.title}</span>
                      {evt.description && (
                        <span className="text-slate-400 text-[11px] ml-1.5">({evt.description})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos Appendix Card */}
          {entry.photos && entry.photos.length > 0 && (
            <div className="p-3 bg-slate-950/70 rounded-xl border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Fotodokumentace ({entry.photos.length} snímků)
                </span>
                <span className="text-[10px] text-slate-500">Kliknutím zvětšíte s vodoznakem</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {entry.photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="cursor-pointer group p-1.5 rounded-lg border border-slate-800 hover:border-amber-400/60 bg-slate-900/60 transition-all flex flex-col"
                  >
                    <div className="relative rounded overflow-hidden aspect-[4/3] bg-slate-950 flex items-center justify-center mb-1">
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.caption || 'Foto'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-200 truncate" title={photo.caption}>
                      {photo.caption || 'Bez popisu'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {Math.round(photo.sizeBytes / 1024)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures Appendix Card */}
          {(contractorSig || clientSig) && (
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-amber-400" />
                  Předávací podpisy (Sign-on-Glass)
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  isFullySigned 
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {isFullySigned ? 'Oboustranně podepsáno ✓' : 'Částečně podepsáno'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Contractor Signature Card */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Za zhotovitele: {contractorSig?.signerName || 'Nepodepsáno'}
                    </span>
                    {contractorSig?.dataUrl ? (
                      <div className="my-1.5 bg-white/95 rounded-md p-1.5 flex items-center justify-center">
                        <img src={contractorSig.dataUrl} alt="Podpis zhotovitele" className="h-10 object-contain" />
                      </div>
                    ) : (
                      <div className="my-1.5 text-center py-2 text-[10px] text-slate-500 italic bg-slate-950/40 rounded">
                        Podpis chybí
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1">
                    {contractorSig?.signedAt ? `Podepsáno: ${new Date(contractorSig.signedAt).toLocaleString('cs-CZ')}` : '–'}
                  </span>
                </div>

                {/* Client Signature Card */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Za objednatele: {clientSig?.signerName || 'Nepodepsáno'}
                    </span>
                    {clientSig?.dataUrl ? (
                      <div className="my-1.5 bg-white/95 rounded-md p-1.5 flex items-center justify-center">
                        <img src={clientSig.dataUrl} alt="Podpis objednatele" className="h-10 object-contain" />
                      </div>
                    ) : (
                      <div className="my-1.5 text-center py-2 text-[10px] text-slate-500 italic bg-slate-950/40 rounded">
                        Podpis chybí
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1">
                    {clientSig?.signedAt ? `Podepsáno: ${new Date(clientSig.signedAt).toLocaleString('cs-CZ')}` : '–'}
                  </span>
                </div>
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
            onClick={() => {
              onUpdateStatus(entry.id, nextStatusMap[entry.status]);
              triggerHaptic('light');
            }}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
            title={nextStatusLabelMap[entry.status]}
          >
            <span>{nextStatusLabelMap[entry.status]}</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => { onEdit(entry); triggerHaptic('light'); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="Upravit záznam"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { onDelete(entry.id); triggerHaptic('warning'); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors flex items-center justify-center"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="Smazat záznam"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal enlarged photo preview */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Fotodokumentace s časovým a projektovým vodoznakem
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/60">
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.caption || 'Fotodokumentace'}
                className="max-h-[70vh] w-auto object-contain rounded-lg border border-slate-800 shadow-lg"
              />
            </div>

            <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200">
                {selectedPhoto.caption || 'Bez popisu'}
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span>{selectedPhoto.width} × {selectedPhoto.height} px</span>
                <span>•</span>
                <span>{Math.round(selectedPhoto.sizeBytes / 1024)} KB</span>
                <span>•</span>
                <span>{new Date(selectedPhoto.createdAt).toLocaleString('cs-CZ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

EntryCard.displayName = 'EntryCard';

