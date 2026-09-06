import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Clock, 
  MapPin, 
  Wrench, 
  Flame, 
  Truck, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Sparkles,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  Car,
  Utensils,
  FileCheck2,
  Tag
} from 'lucide-react';
import { 
  WorkEntry, 
  WorkType, 
  ShiftPreset, 
  ShiftSurchargeType, 
  WeldingMethod, 
  ExtraCostItem, 
  WorkEntryStatus,
  AppSettings
} from '../../types';
import { 
  calculateNetHours, 
  calculateEffectiveHourlyRate, 
  calculateGrandTotal, 
  calculateTravelTotal,
  calculateExtraCostsTotal,
  formatCurrency, 
  isDateWeekend,
  estimateDiet
} from '../../services/pricingEngine';
import { QuickBreakButtons } from './QuickBreakButtons';

interface ShiftModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: WorkEntry) => Promise<void>;
  editingEntry?: WorkEntry | null;
  presets: ShiftPreset[];
  settings: AppSettings;
  existingEntries: WorkEntry[];
}

const COMMON_TAGS = [
  'VT2 zkouška OK',
  'Práce v plošině',
  'Předehřev 250°C',
  'Tlaková zkouška splněna',
  'Formování kořene Argon',
  'Zdržen jinou profesí'
];

const COMMON_EXTRAS = [
  { description: 'Formovací plyn Argon 4.6 (lahev)', amount: 650 },
  { description: 'Přídavný drát TIG ER316L (kg)', amount: 240 },
  { description: 'Drát SG2 1.2mm cívka 15kg', amount: 1100 },
  { description: 'Kotouče řezné 125x1.0 (balení 10ks)', amount: 350 },
  { description: 'Kotevní materiál / svorníky M16', amount: 800 }
];

export const ShiftModalForm: React.FC<ShiftModalFormProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEntry,
  presets,
  settings,
  existingEntries
}) => {
  if (!isOpen) return null;

  // Form State
  const [date, setDate] = useState<string>(
    editingEntry ? editingEntry.date : new Date().toISOString().slice(0, 10)
  );
  const [projectCode, setProjectCode] = useState<string>(
    editingEntry ? editingEntry.projectCode : 'Hala-C'
  );
  const [projectName, setProjectName] = useState<string>(
    editingEntry ? editingEntry.projectName : ''
  );
  const [clientName, setClientName] = useState<string>(
    editingEntry ? editingEntry.clientName : (settings.clients[0]?.name || 'Metrostav DIZ s.r.o.')
  );
  const [workType, setWorkType] = useState<WorkType>(
    editingEntry ? editingEntry.workType : 'site_assembly'
  );
  const [weldingMethod, setWeldingMethod] = useState<WeldingMethod>(
    editingEntry ? (editingEntry.weldingMethod || 'TIG') : 'TIG'
  );

  // Time
  const [startTime, setStartTime] = useState<string>(
    editingEntry ? editingEntry.startTime : '07:00'
  );
  const [endTime, setEndTime] = useState<string>(
    editingEntry ? editingEntry.endTime : '16:00'
  );
  const [breakMinutes, setBreakMinutes] = useState<number>(
    editingEntry ? editingEntry.breakMinutes : 30
  );

  // Pricing
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(
    editingEntry ? editingEntry.pricing.baseHourlyRate : settings.rates.defaultSiteAssemblyRate
  );
  const [complexityMultiplier, setComplexityMultiplier] = useState<number>(
    editingEntry ? editingEntry.pricing.complexityMultiplier : 1.0
  );
  const [shiftSurcharges, setShiftSurcharges] = useState<ShiftSurchargeType[]>(
    editingEntry ? editingEntry.pricing.shiftSurcharges : []
  );
  const [isManualOverride, setIsManualOverride] = useState<boolean>(
    editingEntry ? (editingEntry.pricing.isManualOverride || false) : false
  );
  const [manualTotalOverride, setManualTotalOverride] = useState<number>(
    editingEntry ? (editingEntry.pricing.manualTotalOverride || 0) : 0
  );

  // Travel
  const [distanceKm, setDistanceKm] = useState<number>(
    editingEntry ? editingEntry.travel.distanceKm : 0
  );
  const [ratePerKm, setRatePerKm] = useState<number>(
    editingEntry ? editingEntry.travel.ratePerKm : settings.rates.defaultRatePerKm
  );
  const [travelTimeHours, setTravelTimeHours] = useState<number>(
    editingEntry ? editingEntry.travel.travelTimeHours : 0
  );
  const [travelHourlyRate, setTravelHourlyRate] = useState<number>(
    editingEntry ? editingEntry.travel.travelHourlyRate : settings.rates.defaultTravelHourlyRate
  );
  const [dietAllowance, setDietAllowance] = useState<number>(
    editingEntry ? editingEntry.travel.dietAllowance : 0
  );
  const [dietType, setDietType] = useState<'none' | 'half_day' | 'full_day' | 'custom'>(
    editingEntry ? (editingEntry.travel.dietType || 'none') : 'none'
  );

  // Extras & Notes
  const [extraCosts, setExtraCosts] = useState<ExtraCostItem[]>(
    editingEntry ? (editingEntry.extraCosts || []) : []
  );
  const [notes, setNotes] = useState<string>(
    editingEntry ? editingEntry.notes : ''
  );
  const [status, setStatus] = useState<WorkEntryStatus>(
    editingEntry ? editingEntry.status : 'draft'
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    editingEntry ? (editingEntry.invoiceNumber || '') : ''
  );

  // Auto detect weekend when date changes
  useEffect(() => {
    if (!editingEntry && isDateWeekend(date)) {
      if (!shiftSurcharges.includes('weekend')) {
        setShiftSurcharges(prev => [...prev, 'weekend']);
      }
    }
  }, [date, editingEntry]);

  // Client suggestions
  const clientSuggestions = useMemo(() => {
    const list = new Set<string>();
    settings.clients.forEach(c => list.add(c.name));
    existingEntries.forEach(e => { if (e.clientName) list.add(e.clientName); });
    return Array.from(list);
  }, [settings.clients, existingEntries]);

  // Project suggestions
  const projectSuggestions = useMemo(() => {
    const list = new Set<string>();
    existingEntries.forEach(e => { if (e.projectName) list.add(e.projectName); });
    return Array.from(list);
  }, [existingEntries]);

  // Calculations
  const totalHours = useMemo(() => {
    return calculateNetHours(startTime, endTime, breakMinutes);
  }, [startTime, endTime, breakMinutes]);

  const calculatedHourlyRate = useMemo(() => {
    return calculateEffectiveHourlyRate(
      baseHourlyRate,
      complexityMultiplier,
      shiftSurcharges,
      settings.rates.surcharges
    );
  }, [baseHourlyRate, complexityMultiplier, shiftSurcharges, settings.rates.surcharges]);

  const travelTotal = useMemo(() => {
    return calculateTravelTotal(distanceKm, ratePerKm, travelTimeHours, travelHourlyRate, dietAllowance);
  }, [distanceKm, ratePerKm, travelTimeHours, travelHourlyRate, dietAllowance]);

  const extrasTotal = useMemo(() => {
    return calculateExtraCostsTotal(extraCosts);
  }, [extraCosts]);

  const grandTotal = useMemo(() => {
    return calculateGrandTotal({
      totalHours,
      pricing: {
        calculatedHourlyRate,
        manualTotalOverride,
        isManualOverride
      },
      travel: {
        distanceKm,
        ratePerKm,
        travelTimeHours,
        travelHourlyRate,
        dietAllowance
      },
      extraCosts
    });
  }, [totalHours, calculatedHourlyRate, manualTotalOverride, isManualOverride, distanceKm, ratePerKm, travelTimeHours, travelHourlyRate, dietAllowance, extraCosts]);

  // Apply a preset
  const handleApplyPreset = (preset: ShiftPreset) => {
    setWorkType(preset.workType);
    setBaseHourlyRate(preset.baseHourlyRate);
    setComplexityMultiplier(preset.complexityMultiplier);
    setBreakMinutes(preset.defaultBreakMinutes);
    setRatePerKm(preset.defaultRatePerKm);
    setTravelHourlyRate(preset.defaultTravelHourlyRate);
    if (preset.weldingMethod) {
      setWeldingMethod(preset.weldingMethod);
    }
    if (preset.notesTemplate && !notes) {
      setNotes(preset.notesTemplate);
    }
  };

  // Toggle Surcharge
  const toggleSurcharge = (type: ShiftSurchargeType) => {
    setShiftSurcharges(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Handle Diet Preset Click
  const handleDietClick = (type: 'none' | 'half_day' | 'full_day') => {
    setDietType(type);
    if (type === 'none') setDietAllowance(0);
    if (type === 'half_day') setDietAllowance(settings.rates.dietHalfDayRate);
    if (type === 'full_day') setDietAllowance(settings.rates.dietFullDayRate);
  };

  // Auto estimate diet
  const handleAutoDiet = () => {
    const totalDuration = totalHours + travelTimeHours;
    const est = estimateDiet(totalDuration, settings.rates);
    setDietAllowance(est.allowance);
    setDietType(est.type);
  };

  // Add extra cost row
  const handleAddExtra = (description: string, amount: number) => {
    setExtraCosts(prev => [
      ...prev,
      { id: `extra-${Date.now()}-${Math.random()}`, description, amount }
    ]);
  };

  const handleRemoveExtra = (id: string) => {
    setExtraCosts(prev => prev.filter(i => i.id !== id));
  };

  // Append note tag
  const appendNoteTag = (tag: string) => {
    setNotes(prev => (prev ? `${prev} | ${tag}` : tag));
  };

  // Save handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const entryToSave: WorkEntry = {
      id: editingEntry ? editingEntry.id : `entry-${Date.now()}`,
      date,
      projectCode: projectCode.trim() || 'Zakázka',
      projectName: projectName.trim() || (projectCode.trim() || 'Montážní práce'),
      clientName: clientName.trim() || 'Odběratel',
      workType,
      startTime,
      endTime,
      breakMinutes,
      totalHours,
      pricing: {
        baseHourlyRate,
        complexityMultiplier,
        shiftSurcharges,
        calculatedHourlyRate,
        manualTotalOverride: isManualOverride ? manualTotalOverride : undefined,
        isManualOverride
      },
      travel: {
        distanceKm,
        ratePerKm,
        travelTimeHours,
        travelHourlyRate,
        dietAllowance,
        dietType
      },
      extraCosts,
      totalEarnings: grandTotal,
      status,
      notes: notes.trim(),
      weldingMethod,
      invoiceNumber: invoiceNumber.trim() || undefined,
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSave(entryToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-modal-title"
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-850 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shift-modal-title" className="text-base sm:text-lg font-black text-white leading-tight">
                {editingEntry ? 'Upravit záznam směny' : 'Nový záznam směny a montáže'}
              </h2>
              <p className="text-xs text-slate-400">
                Flexibilní kalkulačka & rychlý zápis jedním palcem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm">
          
          {/* Preset Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Rychlé šablony (Presety zakázky)
              </label>
              <span className="text-[11px] text-slate-400">Kliknutím vyplníte sazby a parametry</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex-shrink-0 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-750 hover:border-amber-500/50 border border-slate-700 text-xs font-semibold rounded-xl text-slate-200 hover:text-amber-300 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Datum, Odběratel, Projekt */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Datum */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Datum směny *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ minHeight: '44px' }}
                />
                {isDateWeekend(date) && (
                  <span className="text-[11px] text-amber-400 font-bold mt-1 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Víkendový den
                  </span>
                )}
              </div>

              {/* Odběratel */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Odběratel / Firma *
                </label>
                <input
                  type="text"
                  list="client-list"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="např. Metrostav DIZ"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-amber-500 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
                <datalist id="client-list">
                  {clientSuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Kód / Název projektu */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Kód / Název zakázky *
                </label>
                <input
                  type="text"
                  list="project-list"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="např. Hala C – potrubí DN150"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-amber-500 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
                <datalist id="project-list">
                  {projectSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Typ činnosti (Velké dlaždice pro palec) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Typ činnosti
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'workshop_welding' as WorkType, label: 'Dílna – svařování', icon: Flame },
                  { type: 'site_assembly' as WorkType, label: 'Montáž stavba', icon: Wrench },
                  { type: 'service_emergency' as WorkType, label: 'Pohotovost / Havárie', icon: AlertTriangle },
                  { type: 'travel_only' as WorkType, label: 'Pouze cesťák', icon: Truck },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = workType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setWorkType(item.type)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md font-bold'
                          : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="text-xs leading-snug">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metoda svařování */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-400">Metoda sváru:</span>
              {(['TIG', 'MIG_MAG', 'MMA', 'AUTOGEN', 'COMBINED', 'NONE'] as WeldingMethod[]).map((method) => {
                const isSelected = weldingMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setWeldingMethod(method)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {method === 'MIG_MAG' ? 'MIG/MAG (135)' :
                     method === 'TIG' ? 'TIG (141)' :
                     method === 'MMA' ? 'Elektroda (111)' :
                     method === 'AUTOGEN' ? 'Autogen (311)' :
                     method === 'COMBINED' ? 'Kombinace' : 'Bez sváru'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Časový fond (Od - Do, Pauza, Výpočet čistých hodin) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Časový fond a odpracované hodiny
              </label>
              <div className="text-xs font-extrabold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                Čistý čas: <span className="text-sm">{totalHours.toFixed(2).replace('.', ',')} h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Začátek směny (Od)
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Konec směny (Do)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>

            {/* Quick Break Buttons */}
            <QuickBreakButtons value={breakMinutes} onChange={setBreakMinutes} />
          </div>

          {/* Section 3: Flexibilní kalkulátor sazeb & Příplatky */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                Sazby, náročnost a příplatky
              </label>
              <div className="text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                Účtováno: <span className="text-sm">{calculatedHourlyRate} Kč/h</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Základní hodinová sazba */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Základní sazba (Kč/h)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={baseHourlyRate}
                    onChange={(e) => setBaseHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">Kč/h</span>
                </div>
              </div>

              {/* Násobič náročnosti */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Násobič náročnosti (koeficient)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 1.0, label: '1.0x std' },
                    { val: 1.15, label: '1.15x' },
                    { val: 1.25, label: '1.25x výšky' },
                    { val: 1.5, label: '1.5x těžká' },
                  ].map((item) => {
                    const isSelected = complexityMultiplier === item.val;
                    return (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setComplexityMultiplier(item.val)}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Příplatky směny (Víkend, Noční, Svátek) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Příplatky za směnu:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'weekend' as ShiftSurchargeType, label: `Víkend (+${settings.rates.surcharges.weekendPercent}%)` },
                  { type: 'night' as ShiftSurchargeType, label: `Noční (+${settings.rates.surcharges.nightPercent}%)` },
                  { type: 'holiday' as ShiftSurchargeType, label: `Svátek (+${settings.rates.surcharges.holidayPercent}%)` }
                ].map((item) => {
                  const isChecked = shiftSurcharges.includes(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => toggleSurcharge(item.type)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isChecked
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${isChecked ? 'text-amber-400' : 'text-slate-600'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Override (Úkolová mzda / Paušál) */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={isManualOverride}
                  onChange={(e) => setIsManualOverride(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                />
                <span>Přepsat na pevnou částku (Úkolová mzda / Domluvený paušál za akci)</span>
              </label>

              {isManualOverride && (
                <div className="mt-2.5 max-w-xs animate-in fade-in">
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={manualTotalOverride}
                      onChange={(e) => setManualTotalOverride(Number(e.target.value))}
                      placeholder="např. 6500"
                      className="w-full bg-slate-900 border border-amber-500 rounded-xl px-3 py-2 text-amber-400 font-mono text-base font-bold focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-amber-400 font-bold">Kč fixně</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Cestovné a Diety (Kilometry, Cesťák, Stravné) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-amber-400" />
                Cestovné, doprava a stravné (diety)
              </label>
              <div className="text-xs font-bold text-sky-400">
                Cesta celkem: {formatCurrency(travelTotal)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Ujeto km */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ujeto km
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">km</span>
                </div>
              </div>

              {/* Sazba za km */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sazba za km
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ratePerKm}
                    onChange={(e) => setRatePerKm(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">Kč/km</span>
                </div>
              </div>

              {/* Čas za volantem */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Čas řízení (h)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={travelTimeHours}
                    onChange={(e) => setTravelTimeHours(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">h</span>
                </div>
              </div>

              {/* Sazba za řízení */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sazba řízení
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={travelHourlyRate}
                    onChange={(e) => setTravelHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>
            </div>

            {/* Stravné (Diety) */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  Stravné (Diety dle délky výkonu):
                </span>
                <button
                  type="button"
                  onClick={handleAutoDiet}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" /> Auto-doporučit
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDietClick('none')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    dietAllowance === 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  Bez diet (0 Kč)
                </button>
                <button
                  type="button"
                  onClick={() => handleDietClick('half_day')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    dietAllowance === settings.rates.dietHalfDayRate
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  Půldenní ({settings.rates.dietHalfDayRate} Kč)
                </button>
                <button
                  type="button"
                  onClick={() => handleDietClick('full_day')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    dietAllowance === settings.rates.dietFullDayRate
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  Celodenní ({settings.rates.dietFullDayRate} Kč)
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Vícepráce a materiál (Plyny, dráty, spojovák) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Materiál, ochranné plyny a vícepráce
              </label>
              <div className="text-xs font-bold text-amber-400">
                Materiál celkem: {formatCurrency(extrasTotal)}
              </div>
            </div>

            {/* Quick Common Items */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_EXTRAS.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddExtra(c.description, c.amount)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  {c.description.split('(')[0]} ({c.amount} Kč)
                </button>
              ))}
            </div>

            {/* Added Items List */}
            {extraCosts.length > 0 && (
              <div className="space-y-2 pt-1">
                {extraCosts.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs"
                  >
                    <span className="font-medium text-slate-200 flex-1">{item.description}</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(item.amount)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtra(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6: Stav a Poznámky ke svárům */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                Stav položky
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'draft' as WorkEntryStatus, label: 'Koncept / Rozpracováno', color: 'border-amber-500/50 text-amber-400 bg-amber-500/10' },
                  { key: 'submitted' as WorkEntryStatus, label: 'Odevzdáno firmě', color: 'border-sky-500/50 text-sky-400 bg-sky-500/10' },
                  { key: 'invoiced' as WorkEntryStatus, label: 'Vyfakturováno', color: 'border-purple-500/50 text-purple-400 bg-purple-500/10' },
                  { key: 'paid' as WorkEntryStatus, label: 'Zaplaceno', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' },
                ].map((st) => {
                  const isSelected = status === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setStatus(st.key)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        isSelected
                          ? `${st.color} shadow-md`
                          : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
                      }`}
                      style={{ minHeight: '48px' }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fakturační číslo pokud je vyfakturováno */}
            {status === 'invoiced' && (
              <div className="animate-in fade-in">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Číslo faktury (např. VF-2026/028)
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="VF-2026/028"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-amber-500 focus:outline-none"
                  style={{ minHeight: '44px' }}
                />
              </div>
            )}

            {/* Poznámka ke svárům & rychlé tagy */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300">
                  Technická poznámka (kontrola svárů, pozice, vady stavby):
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendNoteTag(tag)}
                    className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 rounded text-[11px] font-medium flex items-center gap-1"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </button>
                ))}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="např. Svařování potrubní trasy metodou 141 (TIG). Formováno argonem 4.6. Vizuální zkouška VT2 bez vad..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono leading-relaxed focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Persistent Bottom Sticky Action Bar with LIVE GRAND TOTAL */}
        <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Live Calculation breakdown */}
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-5">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Celkový nárok za směnu:
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="hidden xs:flex flex-col text-[11px] text-slate-400 border-l border-slate-800 pl-3">
                <span>Práce: <strong className="text-slate-200">{formatCurrency(totalHours * calculatedHourlyRate)}</strong></span>
                <span>Cesta & diety: <strong className="text-slate-200">{formatCurrency(travelTotal)}</strong></span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs active:scale-95 transition-all"
                style={{ minHeight: '48px' }}
              >
                Zrušit
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
              >
                <Save className="w-4 h-4 stroke-[3]" />
                <span>{editingEntry ? 'ULOŽIT ZMĚNY' : 'ULOŽIT SMĚNU'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
