import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  Eye, 
  EyeOff, 
  FileText, 
  Camera,
  PenTool
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  WorkEntry, 
  AppSettings, 
  ClientProfile, 
  WeldingPassport,
  ProtocolSignature,
  DualSignaturesRecord,
  SignatureRole
} from '../../types';
import { 
  formatCurrency, 
  PDP_STATUTORY_CLAUSE, 
  calculateVatAndTotal,
  formatActivityTagsForProtocol
} from '../../services/pricingEngine';
import { exportEntriesToCSV } from '../../services/exportService';
import { getNextDocumentNumber } from '../../services/documentNumbering';
import { useToast } from '../../utils/toast';
import { triggerHaptic } from '../../utils/haptics';
import { TechnicalPassportService } from '../../services/weldingPassportService';
import { preparePhotosForProtocol } from '../../services/imageCompressionService';
import { czechAccountToIban, generateSpaydString } from '../../services/spaydService';
import { SignaturePadModal } from '../signature';
import { updateEntrySignatures } from '../../db';

interface InvoiceReportViewProps {
  entries: WorkEntry[];
  settings: AppSettings;
  onSaveSettings?: (settings: AppSettings) => Promise<void>;
}

export const InvoiceReportView: React.FC<InvoiceReportViewProps> = ({
  entries,
  settings,
  onSaveSettings
}) => {
  const { showToast } = useToast();
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [showFinancials, setShowFinancials] = useState<boolean>(true); // Hide prices for technical handover if needed
  const [documentType, setDocumentType] = useState<'protocol' | 'invoice'>('protocol');
  const [protocolNumber, setProtocolNumber] = useState<string>(
    () => getNextDocumentNumber('PR', new Date().getFullYear(), [settings.lastProtocolNumber])
  );

  const recordIssuedProtocolNumber = useCallback(() => {
    if (onSaveSettings && protocolNumber.trim() && protocolNumber !== settings.lastProtocolNumber) {
      onSaveSettings({ ...settings, lastProtocolNumber: protocolNumber.trim() });
    }
  }, [protocolNumber, settings, onSaveSettings]);

  // Distinct clients
  const availableClients = useMemo(() => {
    const clients = new Set<string>();
    entries.forEach(e => { if (e.clientName) clients.add(e.clientName); });
    return Array.from(clients).sort();
  }, [entries]);

  // Distinct months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    entries.forEach(e => { if (e.date) months.add(e.date.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [entries]);

  // If no month is selected yet, default to first available
  const activeMonth = selectedMonth === 'all' && availableMonths.length > 0 ? availableMonths[0] : selectedMonth;

  // Filter entries
  const reportEntries = useMemo(() => {
    return entries.filter(e => {
      if (selectedClient !== 'all' && e.clientName !== selectedClient) return false;
      if (activeMonth !== 'all' && !e.date.startsWith(activeMonth)) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, selectedClient, activeMonth]);

  // Matched client profile
  const matchedClient: ClientProfile | undefined = useMemo(() => {
    if (selectedClient === 'all') return settings.clients[0];
    return settings.clients.find(c => c.name === selectedClient) || {
      id: 'custom',
      name: selectedClient
    };
  }, [settings.clients, selectedClient]);

  // Totals
  const totals = useMemo(() => {
    let totalHours = 0;
    let totalLaborCost = 0;
    let totalKm = 0;
    let totalTravelCost = 0;
    let totalDiets = 0;
    let totalExtras = 0;
    let grandTotal = 0;

    reportEntries.forEach(e => {
      totalHours += e.totalHours || 0;
      totalLaborCost += (e.totalHours || 0) * (e.pricing.calculatedHourlyRate || 0);
      totalKm += e.travel.distanceKm || 0;
      totalTravelCost += ((e.travel.distanceKm || 0) * (e.travel.ratePerKm || 0)) + 
                         ((e.travel.travelTimeHours || 0) * (e.travel.travelHourlyRate || 0));
      totalDiets += e.travel.dietAllowance || 0;
      const extras = (e.extraCosts || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const materials = e.consumableSlip?.totalBilledAmount || 0;
      totalExtras += (extras + materials);
      grandTotal += e.totalEarnings || 0;
    });

    return {
      totalHours,
      totalLaborCost,
      totalKm,
      totalTravelCost,
      totalDiets,
      totalExtras,
      grandTotal
    };
  }, [reportEntries]);

  // § 92e PDP document detector
  const isPdpDocument = useMemo(() => {
    const clientDefault = !!matchedClient?.isPdpDefault || !!matchedClient?.isPdp;
    if (reportEntries.length > 0) {
      // Prioritize entry-level explicit boolean; fallback to client default only when isPdp is undefined
      return reportEntries.some(e => e.isPdp ?? clientDefault);
    }
    return clientDefault;
  }, [reportEntries, matchedClient]);

  // VAT and grand total calculation
  const vatCalculation = useMemo(() => {
    return calculateVatAndTotal(totals.grandTotal, isPdpDocument, 21);
  }, [totals.grandTotal, isPdpDocument]);

  // Effective IBAN from profile or synthesized from domestic bank account
  const effectiveIban = useMemo(() => {
    if (settings.contractor.iban) {
      return czechAccountToIban(settings.contractor.iban) || settings.contractor.iban.replace(/\s+/g, '');
    }
    // In protocol mode, auto-synthesize from domestic bank account if IBAN is omitted
    if (documentType === 'protocol') {
      return czechAccountToIban(settings.contractor.bankAccount);
    }
    return null;
  }, [settings.contractor.iban, settings.contractor.bankAccount, documentType]);

  // SPAYD QR string compliant with ČBA standard
  const spaydPayload = useMemo(() => {
    if (!effectiveIban) return null;
    const vsDigits = protocolNumber.replace(/[^0-9]/g, '');
    return generateSpaydString({
      accountOrIban: effectiveIban,
      amount: vatCalculation.totalWithVat,
      variableSymbol: vsDigits,
      message: `${documentType === 'invoice' ? 'Faktura' : 'Protokol'} ${protocolNumber}`,
    });
  }, [effectiveIban, vatCalculation.totalWithVat, protocolNumber, documentType]);

  // Dual signatures management
  const initialSignatures: DualSignaturesRecord = useMemo(() => {
    const firstWithSigs = reportEntries.find(
      e => e.signatures?.contractor || e.signatures?.client || e.contractorSignature || e.clientSignature
    );
    return {
      contractor: firstWithSigs?.signatures?.contractor || firstWithSigs?.contractorSignature,
      client: firstWithSigs?.signatures?.client || firstWithSigs?.clientSignature,
    };
  }, [reportEntries]);

  const [signatures, setSignatures] = useState<DualSignaturesRecord>(initialSignatures);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [signatureModalRole, setSignatureModalRole] = useState<SignatureRole>('contractor');

  useEffect(() => {
    setSignatures(initialSignatures);
  }, [initialSignatures]);

  const handleOpenSignatureModal = (role: SignatureRole) => {
    setSignatureModalRole(role);
    setIsSignatureModalOpen(true);
  };

  const handleSaveSignature = async (sig: ProtocolSignature) => {
    const updated: DualSignaturesRecord = {
      ...signatures,
      [sig.role]: sig,
    };
    setSignatures(updated);

    try {
      await Promise.all(
        reportEntries.map(e => updateEntrySignatures(e.id, updated))
      );
      showToast(
        `Podpis ${sig.role === 'contractor' ? 'zhotovitele' : 'objednatele'} byl úspěšně uložen ✓`,
        'success'
      );
    } catch (err) {
      console.error('Failed to save signature to entries:', err);
      showToast('Chyba při ukládání podpisu do databáze.', 'error');
    }
  };

  // Distinct active welding passports for technical documentation
  const activeWeldingPassports = useMemo(() => {
    const passports: WeldingPassport[] = [];
    const seen = new Set<string>();
    reportEntries.forEach((e) => {
      if (e.weldingPassport && TechnicalPassportService.shouldRenderPassport(e.weldingPassport)) {
        const key = `${e.weldingPassport.methodCode}_${e.weldingPassport.baseMaterialGrade}_${e.weldingPassport.materialThickness}_${e.weldingPassport.fillerBatch}`;
        if (!seen.has(key)) {
          seen.add(key);
          passports.push(e.weldingPassport);
        }
      }
    });
    return passports;
  }, [reportEntries]);

  const handlePrint = useCallback(() => {
    triggerHaptic('success');
    showToast('Spouštím tisk / PDF export...', 'info');
    recordIssuedProtocolNumber();
    setTimeout(() => window.print(), 300);
  }, [showToast, recordIssuedProtocolNumber]);

  const handleExportCSV = useCallback(() => {
    exportEntriesToCSV(reportEntries, `podklad_${selectedClient}_${activeMonth}`);
    triggerHaptic('success');
    showToast('CSV soubor byl stažen ✓', 'success');
    recordIssuedProtocolNumber();
  }, [reportEntries, selectedClient, activeMonth, showToast, recordIssuedProtocolNumber]);

  const periodLabel = activeMonth === 'all' 
    ? 'Kompletní výkaz' 
    : new Date(Number(activeMonth.split('-')[0]), Number(activeMonth.split('-')[1]) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 md:pb-12">
      
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print bg-white md:bg-slate-900 border border-slate-200 md:border-slate-800 rounded-2xl p-4 shadow-sm md:shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Filters Group */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-bold text-slate-500 md:text-slate-400 uppercase tracking-wide">Měsíc:</span>
            <select
              value={activeMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 md:bg-slate-950 border border-slate-300 md:border-slate-700 rounded-xl px-3 py-2 md:py-1.5 text-sm md:text-xs font-bold text-slate-900 md:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Celé období</option>
              {availableMonths.map(m => {
                const [y, mon] = m.split('-');
                const name = new Date(Number(y), Number(mon) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{name}</option>;
              })}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-bold text-slate-500 md:text-slate-400 uppercase tracking-wide">Odběratel:</span>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="bg-slate-50 md:bg-slate-950 border border-slate-300 md:border-slate-700 rounded-xl px-3 py-2 md:py-1.5 text-sm md:text-xs font-bold text-slate-900 md:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Všichni odběratelé</option>
              {availableClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggles and Actions Group */}
        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end border-t border-slate-200 md:border-none pt-3 md:pt-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFinancials(!showFinancials)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                showFinancials
                  ? 'bg-amber-100 text-amber-700 border-amber-300 md:bg-amber-500/20 md:text-amber-300 md:border-amber-500/40'
                  : 'bg-slate-100 text-slate-500 border-slate-300 md:bg-slate-800 md:text-slate-400 md:border-slate-700'
              }`}
              title="Přepnout zobrazení cen."
            >
              {showFinancials ? <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <EyeOff className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden sm:inline">{showFinancials ? 'Ceny' : 'Skrýt ceny'}</span>
            </button>
            
            <button
              type="button"
              onClick={() => setDocumentType(prev => prev === 'protocol' ? 'invoice' : 'protocol')}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                documentType === 'invoice'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 md:bg-emerald-500/20 md:text-emerald-400 md:border-emerald-500/40'
                  : 'bg-slate-100 text-slate-500 border-slate-300 md:bg-slate-800 md:text-slate-400 md:border-slate-700'
              }`}
              title="Přepnout formát"
            >
              <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{documentType === 'invoice' ? 'Faktura' : 'Protokol'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="p-2 sm:px-3.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 md:bg-slate-800 md:hover:bg-slate-700 md:text-slate-200 border border-slate-300 md:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              title="Stáhnout CSV"
            >
              <Download className="w-4 h-4 text-amber-500 md:text-amber-400" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Tisk / PDF</span>
              <span className="sm:hidden">Tisk</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- OFFICIAL A4 PRINT CONTAINER --- */}
      <div id="printable-invoice" className="print-container bg-white text-slate-900 p-4 sm:p-10 rounded-2xl shadow-xl border border-slate-200">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] sm:text-xs px-2 py-0.5 rounded">
                OFICIÁLNÍ DOKUMENT
              </span>
              {isPdpDocument && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] sm:text-xs px-2 py-0.5 rounded">
                  § 92e PDP (PŘENESENÁ DP)
                </span>
              )}
              <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                <span>Č. dokumentu:</span>
                <input
                  type="text"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  className="no-print bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none w-24 sm:w-auto"
                  title="Kliknutím upravte číslo"
                />
                <span className="print-only font-mono">{protocolNumber}</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
              {documentType === 'invoice' 
                ? 'FAKTURA - DAŇOVÝ DOKLAD' 
                : 'PŘEDÁVACÍ PROTOKOL & PODKLAD'}
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-600 font-semibold mt-1">
              Výkaz prací za období: <span className="text-slate-950 font-black uppercase">{periodLabel}</span>
            </p>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 flex flex-row sm:flex-col justify-between sm:justify-start">
            <div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block">Datum vystavení:</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                {new Date().toLocaleDateString('cs-CZ')}
              </span>
            </div>
            {documentType === 'invoice' && (
              <div className="text-right sm:mt-2">
                <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block">Datum splatnosti (14 dní):</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-700 font-mono">
                  {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('cs-CZ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contractor & Client Info Box */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Dodavatel */}
          <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-2">
              ZHOTOVITEL (DODAVATEL)
            </span>
            <div className="text-sm font-black text-slate-950 mb-1">{settings.contractor.name}</div>
            <div className="text-slate-600 font-medium mb-1">{settings.contractor.tradeTitle}</div>
            <div className="text-slate-700 mb-2">{settings.contractor.address}, {settings.contractor.city} {settings.contractor.zip}</div>
            <div className="text-slate-900 font-mono font-semibold mb-1">
              IČO: <strong>{settings.contractor.ico}</strong> {settings.contractor.dic && <span className="ml-1">DIČ: {settings.contractor.dic}</span>}
            </div>
            <div className="text-slate-900 font-mono mb-2">
              Účet: <strong className="font-bold">{settings.contractor.bankAccount}</strong>
            </div>
            {settings.contractor.certifications && (
              <div className="text-[10px] text-slate-600 leading-tight bg-white p-2 rounded border border-slate-100">
                <strong>Kvalifikace:</strong> {settings.contractor.certifications}
              </div>
            )}
          </div>

          {/* Odběratel */}
          <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-2">
              OBJEDNATEL (ODBĚRATEL)
            </span>
            <div className="text-sm font-black text-slate-950 mb-2">
              {matchedClient?.name || (selectedClient !== 'all' ? selectedClient : 'Všichni odběratelé')}
            </div>
            {matchedClient?.address && (
              <div className="text-slate-700 mb-2">{matchedClient.address}</div>
            )}
            {matchedClient?.ico && (
              <div className="text-slate-900 font-mono font-semibold mb-2">
                IČO: <strong>{matchedClient.ico}</strong> {matchedClient.dic && <span className="ml-1">DIČ: {matchedClient.dic}</span>}
              </div>
            )}
            {matchedClient?.contactPerson && (
              <div className="text-slate-700 bg-white p-2 rounded border border-slate-100 mt-2">
                Kontakt: <strong>{matchedClient.contactPerson}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Režim přenesené daňové povinnosti (§ 92e ZDPH) Statutory Notice */}
        {isPdpDocument && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-slate-950 page-break-inside-avoid shadow-sm">
            <div className="text-xs font-black uppercase text-amber-900 tracking-wider mb-1">
              Režim přenesené daňové povinnosti (§ 92e ZDPH)
            </div>
            <div className="text-sm font-bold text-slate-900 mb-1">
              {PDP_STATUTORY_CLAUSE}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-700 leading-snug">
              Vystaveno v režimu přenesené daňové povinnosti dle § 92e zákona č. 235/2004 Sb., o dani z přidané hodnoty pro stavební a montážní práce odpovídající kódům klasifikace produkce CZ-CPA 41 až 43. Výši daně je povinen doplnit a přiznat plátce, pro kterého je plnění uskutečněno.
            </p>
          </div>
        )}

        {/* Summary Metric Boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Odpracováno</span>
            <span className="text-lg sm:text-xl font-black text-slate-950 font-mono">
              {totals.totalHours.toFixed(2).replace('.', ',')} h
            </span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Doprava</span>
            <span className="text-lg sm:text-xl font-black text-slate-950 font-mono">
              {totals.totalKm} km
            </span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Stravné celkem</span>
            <span className="text-lg sm:text-xl font-black text-slate-950 font-mono">
              {formatCurrency(totals.totalDiets)}
            </span>
          </div>

          <div className="p-3 rounded-xl border-2 border-slate-900 bg-amber-50 flex flex-col justify-center shadow-sm">
            <span className="text-[10px] uppercase font-black text-amber-900 mb-1">
              {showFinancials ? 'Celkem k fakturaci' : 'Počet směn'}
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-950 font-mono">
              {showFinancials ? formatCurrency(totals.grandTotal) : `${reportEntries.length} směn`}
            </span>
          </div>
        </div>

        {/* Svářečský & technický pasport zakázky */}
        {activeWeldingPassports.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-300 page-break-inside-avoid shadow-sm text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-3 mb-4 gap-2">
              <div className="flex items-center flex-wrap gap-2">
                <span className="bg-slate-900 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                  EN 1090-2 / ISO 9606-1
                </span>
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight">
                  SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                Doklad shody pro TDI
              </span>
            </div>

            <div className="space-y-3">
              {activeWeldingPassports.map((p, idx) => {
                const block = TechnicalPassportService.formatPassportBlock(p);
                return (
                  <div key={idx} className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Metoda (ISO 4063):</span>
                      <span className="font-bold text-slate-900 text-[11px] sm:text-xs">{block.methodDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Materiál & tloušťka:</span>
                      <span className="font-bold text-slate-900 text-[11px] sm:text-xs">{block.materialDisplay}</span>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Plyn:</span>
                      <span className="font-bold text-slate-900 text-[11px] sm:text-xs">{block.gasDisplay}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Přídavný mat. (3.1):</span>
                      <span className="font-mono text-slate-800 text-[11px] sm:text-xs">{block.fillerDisplay || 'Neuvedeno'}</span>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Kvalifikace (9606-1):</span>
                      <span className="font-mono text-slate-800 text-[11px] sm:text-xs">{block.welderCertDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block mb-0.5">VT2 (ISO 5817):</span>
                      <span className={`text-[11px] sm:text-xs font-black ${block.vtInspection.isCompliant ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {block.vtInspection.labelCz}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Entries */}
        <div className="mb-6">
          <h3 className="text-sm font-black text-slate-900 uppercase mb-3 border-b-2 border-slate-900 pb-2 inline-block">
            Rozpis odpracovaných směn
          </h3>
          
          {/* Desktop/Print Table */}
          <div className="hidden md:block print:block overflow-x-auto">
            <table className="hidden md:table w-full text-left text-xs border-collapse border border-slate-300">

              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border border-slate-300">Datum</th>
                  <th className="p-2 border border-slate-300">Projekt / Popis činnosti</th>
                  <th className="p-2 border border-slate-300 text-center">Čas</th>
                  <th className="p-2 border border-slate-300 text-center">Pauza</th>
                  <th className="p-2 border border-slate-300 text-right">Hodiny</th>
                  {showFinancials && (
                    <>
                      <th className="p-2 border border-slate-300 text-right">Sazba</th>
                      <th className="p-2 border border-slate-300 text-right">Práce</th>
                      <th className="p-2 border border-slate-300 text-right">Doprava</th>
                      <th className="p-2 border border-slate-300 text-right">Diety</th>
                      <th className="p-2 border border-slate-300 text-right">Ostatní</th>
                      <th className="p-2 border border-slate-300 text-right font-black bg-slate-200/50">Celkem</th>
                    </>
                  )}
                  <th className="p-2 border border-slate-300 text-center">Stav</th>
                </tr>
              </thead>
              <tbody>
                {reportEntries.map((e, index) => {
                  const laborEarnings = Math.round(e.totalHours * e.pricing.calculatedHourlyRate);
                  const travelCosts = Math.round(
                    (e.travel.distanceKm * e.travel.ratePerKm) +
                    (e.travel.travelTimeHours * e.travel.travelHourlyRate)
                  );
                  const extras = (e.extraCosts || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
                  const materials = e.consumableSlip?.totalBilledAmount || 0;
                  const totalMaterialsAndExtras = extras + materials;

                  return (
                    <tr key={e.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border border-slate-300 font-mono font-medium whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="p-2 border border-slate-300">
                        <div className="font-bold text-slate-900">{e.projectName}</div>
                        {((e.activityTags && e.activityTags.length > 0) || (e.workActionTags && e.workActionTags.length > 0)) && (
                          <div className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded my-0.5 inline-block">
                            Činnosti: {formatActivityTagsForProtocol(e.activityTags || e.workActionTags)}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {e.weldingPassport && TechnicalPassportService.shouldRenderPassport(e.weldingPassport) ? (
                            <span className="font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mr-1">
                              ISO 4063: {e.weldingPassport.methodCode} ({e.weldingPassport.baseMaterialGrade}, tl. {e.weldingPassport.materialThickness})
                            </span>
                          ) : (
                            e.weldingMethod && e.weldingMethod !== 'NONE' && `[${e.weldingMethod}] `
                          )}
                          {e.notes || ''}
                        </div>
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono whitespace-nowrap">
                        {e.startTime}–{e.endTime}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono">
                        {e.breakMinutes}m
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">
                        {e.totalHours.toFixed(2).replace('.', ',')}
                      </td>

                      {showFinancials && (
                        <>
                          <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap">
                            {e.pricing.calculatedHourlyRate} Kč
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap">
                            {formatCurrency(laborEarnings)}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap text-slate-500">
                            {e.travel.distanceKm > 0 ? formatCurrency(travelCosts) : '–'}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap text-slate-500">
                            {e.travel.dietAllowance > 0 ? formatCurrency(e.travel.dietAllowance) : '–'}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap text-slate-500">
                            {totalMaterialsAndExtras > 0 ? formatCurrency(totalMaterialsAndExtras) : '–'}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-mono font-black text-slate-950 whitespace-nowrap bg-slate-50">
                            {formatCurrency(e.totalEarnings)}
                          </td>
                        </>
                      )}

                      <td className="p-2 border border-slate-300 text-center font-semibold text-[9px] uppercase whitespace-nowrap text-slate-500">
                        {e.status === 'paid' ? 'Zaplaceno' :
                         e.status === 'invoiced' ? 'Vyfakturováno' :
                         e.status === 'submitted' ? 'Odevzdáno' : 'Koncept'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-black">
                  <td colSpan={4} className="p-2 border border-slate-700 text-right uppercase tracking-wider text-[10px]">
                    CELKEM ZA OBDOBÍ:
                  </td>
                  <td className="p-2 border border-slate-700 text-right font-mono font-black text-sm">
                    {totals.totalHours.toFixed(2).replace('.', ',')} h
                  </td>
                  {showFinancials && (
                    <>
                      <td className="p-2 border border-slate-700"></td>
                      <td className="p-2 border border-slate-700 text-right font-mono">{formatCurrency(totals.totalLaborCost)}</td>
                      <td className="p-2 border border-slate-700 text-right font-mono">{formatCurrency(totals.totalTravelCost)}</td>
                      <td className="p-2 border border-slate-700 text-right font-mono">{formatCurrency(totals.totalDiets)}</td>
                      <td className="p-2 border border-slate-700 text-right font-mono">{formatCurrency(totals.totalExtras)}</td>
                      <td className="p-2 border border-slate-700 text-right font-mono text-base font-black text-amber-400">
                        {formatCurrency(totals.grandTotal)}
                      </td>
                    </>
                  )}
                  <td className="p-2 border border-slate-700"></td>
                </tr>
              </tfoot>
            
          </table>
          
          {/* Mobile view of items */}
          <div className="md:hidden space-y-3 print:hidden">
            {reportEntries.map((e, _index) => {
              const laborEarnings = Math.round(e.totalHours * e.pricing.calculatedHourlyRate);
              const travelCosts = Math.round(
                (e.travel.distanceKm * e.travel.ratePerKm) +
                (e.travel.travelTimeHours * e.travel.travelHourlyRate)
              );
              const extras = (e.extraCosts || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
              const materials = e.consumableSlip?.totalBilledAmount || 0;
              const totalMaterialsAndExtras = extras + materials;

              return (
                <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{e.projectName}</div>
                      <div className="text-xs text-slate-500 font-mono">{new Date(e.date).toLocaleDateString('cs-CZ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 font-mono">{e.totalHours.toFixed(2).replace('.', ',')} h</div>
                      <div className="text-xs text-slate-500 font-mono">{e.startTime}–{e.endTime}</div>
                    </div>
                  </div>
                  
                  {((e.activityTags && e.activityTags.length > 0) || (e.workActionTags && e.workActionTags.length > 0) || e.weldingMethod !== 'NONE' || e.notes) && (
                    <div className="mb-2 text-xs">
                      {((e.activityTags && e.activityTags.length > 0) || (e.workActionTags && e.workActionTags.length > 0)) && (
                        <div className="font-bold text-sky-800 bg-sky-50 px-2 py-1 rounded inline-block mb-1 mr-1">
                          {formatActivityTagsForProtocol(e.activityTags || e.workActionTags)}
                        </div>
                      )}
                      {e.weldingPassport && TechnicalPassportService.shouldRenderPassport(e.weldingPassport) ? (
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded inline-block mb-1 mr-1">
                          ISO 4063: {e.weldingPassport.methodCode} ({e.weldingPassport.baseMaterialGrade}, tl. {e.weldingPassport.materialThickness})
                        </span>
                      ) : e.weldingMethod !== 'NONE' ? (
                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block mb-1 mr-1">
                          [{e.weldingMethod}]
                        </span>
                      ) : null}
                      <div className="text-slate-600 italic mt-1">{e.notes}</div>
                    </div>
                  )}

                  {showFinancials && (
                    <div className="bg-slate-50 rounded-lg p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Práce ({e.pricing.calculatedHourlyRate} Kč/h):</span>
                        <span className="font-mono font-medium">{formatCurrency(laborEarnings)}</span>
                      </div>
                      {e.travel.distanceKm > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Doprava ({e.travel.distanceKm}km):</span>
                          <span className="font-mono">{formatCurrency(travelCosts)}</span>
                        </div>
                      )}
                      {e.travel.dietAllowance > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Diety:</span>
                          <span className="font-mono">{formatCurrency(e.travel.dietAllowance)}</span>
                        </div>
                      )}
                      {totalMaterialsAndExtras > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Materiál/Ostatní:</span>
                          <span className="font-mono">{formatCurrency(totalMaterialsAndExtras)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                        <span className="font-bold text-slate-900">Celkem za směnu:</span>
                        <span className="font-black text-slate-900 font-mono text-sm">{formatCurrency(e.totalEarnings)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2 text-right">
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                      e.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                      e.status === 'invoiced' ? 'bg-sky-100 text-sky-800' :
                      e.status === 'submitted' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {e.status === 'paid' ? 'Zaplaceno' : e.status === 'invoiced' ? 'Vyfakturováno' : e.status === 'submitted' ? 'Odevzdáno' : 'Koncept'}
                    </span>
                  </div>
                </div>
              );
            })}
            
            <div className="bg-slate-800 text-white rounded-xl p-4 shadow-sm mt-4">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">Celkem za období</div>
              <div className="flex justify-between items-end border-b border-slate-700 pb-2 mb-2">
                <span className="text-slate-300">Odpracováno:</span>
                <span className="font-mono font-black text-lg text-amber-400">{totals.totalHours.toFixed(2).replace('.', ',')} h</span>
              </div>
              {showFinancials && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Práce:</span><span className="font-mono">{formatCurrency(totals.totalLaborCost)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Doprava:</span><span className="font-mono">{formatCurrency(totals.totalTravelCost)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Diety:</span><span className="font-mono">{formatCurrency(totals.totalDiets)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Materiál:</span><span className="font-mono">{formatCurrency(totals.totalExtras)}</span></div>
                  <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                    <span className="font-bold text-white">CELKEM:</span>
                    <span className="font-mono font-black text-xl text-emerald-400">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Mobile Cards (Hidden on Desktop & Print) */}
          <div className="md:hidden print:hidden flex flex-col gap-3" aria-hidden="true">
            {reportEntries.map((e) => {
              const laborEarnings = Math.round(e.totalHours * e.pricing.calculatedHourlyRate);
              const travelCosts = Math.round(
                (e.travel.distanceKm * e.travel.ratePerKm) +
                (e.travel.travelTimeHours * e.travel.travelHourlyRate)
              );
              const extras = (e.extraCosts || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
              const materials = e.consumableSlip?.totalBilledAmount || 0;
              const totalMaterialsAndExtras = extras + materials;

              return (
                <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-sm">
                      {new Date(e.date).toLocaleDateString('cs-CZ')}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-500">
                      {e.status === 'paid' ? 'Zaplaceno' :
                       e.status === 'invoiced' ? 'Vyfakturováno' :
                       e.status === 'submitted' ? 'Odevzdáno' : 'Koncept'}
                    </div>
                  </div>

                  <div className="mb-3 border-l-2 border-amber-500 pl-3">
                    <div className="font-bold text-slate-900 text-base leading-tight">{e.projectName}</div>
                    {((e.activityTags && e.activityTags.length > 0) || (e.workActionTags && e.workActionTags.length > 0)) && (
                      <div className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        Činnosti: {formatActivityTagsForProtocol(e.activityTags || e.workActionTags)}
                      </div>
                    )}
                    {(e.notes || e.weldingMethod) && (
                      <div className="text-xs text-slate-600 mt-1.5 bg-slate-50 p-2 rounded">
                        {e.weldingPassport && TechnicalPassportService.shouldRenderPassport(e.weldingPassport) ? (
                          <span className="font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded mr-1 inline-block mb-1">
                            ISO 4063: {e.weldingPassport.methodCode} ({e.weldingPassport.baseMaterialGrade}, tl. {e.weldingPassport.materialThickness})
                          </span>
                        ) : (
                          e.weldingMethod && e.weldingMethod !== 'NONE' && <span className="font-bold mr-1">[{e.weldingMethod}]</span>
                        )}
                        {e.notes || ''}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-2.5 rounded-lg text-sm border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Čas & Pauza</span>
                      <span className="font-mono text-slate-900">{e.startTime}–{e.endTime} <span className="text-slate-400 text-xs">({e.breakMinutes}m)</span></span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Odpracováno</span>
                      <span className="font-mono font-black text-slate-900 text-base">{e.totalHours.toFixed(2).replace('.', ',')} h</span>
                    </div>
                  </div>

                  {showFinancials && (
                    <div className="space-y-1.5 text-sm pt-3 border-t border-slate-100 mt-1">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="text-xs">Práce ({e.pricing.calculatedHourlyRate} Kč/h):</span>
                        <span className="font-mono font-medium">{formatCurrency(laborEarnings)}</span>
                      </div>
                      {e.travel.distanceKm > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-xs">Doprava ({e.travel.distanceKm}km):</span>
                          <span className="font-mono font-medium">{formatCurrency(travelCosts)}</span>
                        </div>
                      )}
                      {e.travel.dietAllowance > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-xs">Diety:</span>
                          <span className="font-mono font-medium">{formatCurrency(e.travel.dietAllowance)}</span>
                        </div>
                      )}
                      {totalMaterialsAndExtras > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="text-xs">Materiál/Ostatní:</span>
                          <span className="font-mono font-medium">{formatCurrency(totalMaterialsAndExtras)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold mt-1">
                        <span className="text-[10px] uppercase text-slate-500">Celkem položka:</span>
                        <span className="font-mono font-black text-slate-900 text-base">{formatCurrency(e.totalEarnings)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Consumables Slip Itemized Table */}
        {showFinancials && reportEntries.some(e => e.consumableSlip && e.consumableSlip.items && e.consumableSlip.items.length > 0) && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs page-break-inside-avoid shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between border-b border-slate-300 pb-2 mb-3 gap-2">
              <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] sm:text-xs">
                Materiálový lístek
              </span>
              <span className="text-slate-700 font-bold text-[11px] sm:text-xs">
                Celkem materiál: {formatCurrency(reportEntries.reduce((sum, e) => sum + (e.consumableSlip?.totalBilledAmount || 0), 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 font-bold">
                    <th className="p-1.5 border border-slate-300 text-left">Datum</th>
                    <th className="p-1.5 border border-slate-300 text-left">Položka materiálu</th>
                    <th className="p-1.5 border border-slate-300 text-left hidden sm:table-cell">Kategorie</th>
                    <th className="p-1.5 border border-slate-300 text-center">Mn.</th>
                    <th className="p-1.5 border border-slate-300 text-right hidden md:table-cell">Nákupní cena</th>
                    <th className="p-1.5 border border-slate-300 text-right hidden md:table-cell">Marže</th>
                    <th className="p-1.5 border border-slate-300 text-right">Cena</th>
                  </tr>
                </thead>
                <tbody>
                  {reportEntries.flatMap((e) => {
                    if (!e.consumableSlip || !e.consumableSlip.items) return [];
                    const rows = e.consumableSlip.items.map((item, itemIdx) => (
                      <tr key={`${e.id}-${item.id || itemIdx}`} className="border-b border-slate-200 hover:bg-slate-100/60">
                        <td className="p-1.5 border border-slate-300 font-mono whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString('cs-CZ')}
                        </td>
                        <td className="p-1.5 border border-slate-300 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-slate-600 hidden sm:table-cell">
                          {item.category === 'cutting_grinding' ? 'Kotouče' :
                           item.category === 'technical_gases' ? 'Plyny' :
                           item.category === 'anchors' ? 'Kotvy' :
                           item.category === 'fasteners' ? 'Spojovací' :
                           item.category === 'welding_consumables' ? 'Svařovací' : 'Ostatní'}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-center font-mono whitespace-nowrap">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono whitespace-nowrap hidden md:table-cell text-slate-500">
                          {item.unitPrice} Kč
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono whitespace-nowrap hidden md:table-cell text-slate-500">
                          {item.markupPercent !== undefined ? `+${item.markupPercent}%` : `+${e.consumableSlip?.overheadMarkupPercent || 0}%`}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                          {formatCurrency(item.billedPrice)}
                        </td>
                      </tr>
                    ));

                    if (e.consumableSlip.fixedOverheadFee && e.consumableSlip.fixedOverheadFee > 0) {
                      rows.push(
                        <tr key={`${e.id}-fixed-fee`} className="bg-amber-50/50 text-slate-700 italic border-b border-slate-200">
                          <td className="p-1.5 border border-slate-300 font-mono whitespace-nowrap">
                            {new Date(e.date).toLocaleDateString('cs-CZ')}
                          </td>
                          <td colSpan={5} className="p-1.5 border border-slate-300 hidden md:table-cell">
                            Manipulační a závozový paušál
                          </td>
                          <td colSpan={3} className="p-1.5 border border-slate-300 md:hidden">
                            Manipulační paušál
                          </td>
                          <td className="p-1.5 border border-slate-300 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(e.consumableSlip.fixedOverheadFee)}
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Miscellaneous Extra Costs Box if any */}
        {showFinancials && reportEntries.some(e => e.extraCosts && e.extraCosts.length > 0) && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs page-break-inside-avoid">
            <span className="font-bold text-slate-900 uppercase block mb-2 border-b border-slate-200 pb-1">
              Ostatní vedlejší výdaje a vícepráce
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              {reportEntries.flatMap(e => (e.extraCosts || []).map(item => (
                <div key={item.id} className="flex justify-between items-center border-b border-slate-200 pb-1">
                  <span><span className="font-mono text-[10px] text-slate-500 mr-2">{e.date}</span> {item.description}</span>
                  <strong className="font-mono text-slate-900">{formatCurrency(item.amount)}</strong>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* Invoice Mode VAT Breakdown Box */}
        {documentType === 'invoice' && showFinancials && totals.grandTotal > 0 && (
          <div className="mb-6 p-4 md:p-5 rounded-xl border border-slate-300 bg-slate-50 text-xs page-break-inside-avoid">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-3 border-b-2 border-slate-800 pb-1 inline-block">
              Rekapitulace DPH a částka k úhradě
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Základ daně:</span>
                <span className="text-sm md:text-base font-black text-slate-900 font-mono">{formatCurrency(vatCalculation.taxBase)}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sazba DPH:</span>
                <span className="text-sm md:text-base font-black text-slate-900 font-mono">
                  {isPdpDocument ? '0 % (přenesená)' : `${vatCalculation.vatRatePercent} %`}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Výše DPH:</span>
                <span className="text-sm md:text-base font-black text-slate-900 font-mono">{formatCurrency(vatCalculation.vatAmount)}</span>
              </div>
              <div className="p-3 rounded-lg bg-amber-100 border-2 border-amber-500 flex flex-col justify-center shadow-md">
                <span className="text-[10px] uppercase font-black text-amber-900 mb-1">Celkem k úhradě:</span>
                <span className="text-base md:text-lg font-black text-amber-900 font-mono">{formatCurrency(vatCalculation.totalWithVat)}</span>
              </div>
            </div>
            {isPdpDocument && (
              <div className="mt-3 text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                {PDP_STATUTORY_CLAUSE}
              </div>
            )}
          </div>
        )}

        {/* Payment QR Code Box (SPAYD) */}
        {showFinancials && totals.grandTotal > 0 && (
          <div className="mb-6 p-4 sm:p-5 border-2 border-emerald-500/30 bg-emerald-50/50 rounded-xl flex flex-col sm:flex-row items-center gap-5 sm:gap-8 page-break-inside-avoid print:break-inside-avoid shadow-sm">
            {spaydPayload ? (
              <div className="bg-white p-2.5 rounded-xl shadow-md border border-slate-200 shrink-0 mx-auto sm:mx-0">
                <QRCodeSVG 
                  value={spaydPayload} 
                  size={120} 
                  level="M" 
                />
              </div>
            ) : (
              <div className="w-[120px] h-[120px] bg-slate-100 rounded-xl flex items-center justify-center text-center p-3 text-[10px] text-slate-400 border border-slate-200 shrink-0 mx-auto sm:mx-0">
                Doplňte IBAN v nastavení
              </div>
            )}
            <div className="w-full text-center sm:text-left">
              <h3 className="text-sm font-black text-slate-900 uppercase mb-3">Platební údaje (SPAYD QR)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">Částka:</span>
                  <div className="font-black text-slate-900 text-sm font-mono">{formatCurrency(vatCalculation.totalWithVat)}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">Variabilní symbol:</span>
                  <div className="font-bold text-slate-900 font-mono">{protocolNumber.replace(/[^0-9]/g, '') || 'není'}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">Číslo účtu:</span>
                  <div className="font-bold text-slate-900 font-mono">{settings.contractor.bankAccount || 'Nenastaven'}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">IBAN:</span>
                  <div className="font-bold text-slate-900 font-mono break-all">{effectiveIban || 'Nenastaven'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Documentation Appendix */}
        {(() => {
          const allPhotos = preparePhotosForProtocol(reportEntries.flatMap(e => e.photos || []));
          if (allPhotos.length === 0) return null;

          return (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl page-break-inside-avoid print:break-inside-avoid shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between border-b border-slate-300 pb-2 mb-4 gap-2">
                <span className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-600" />
                  Fotodokumentace ({allPhotos.length} snímků)
                </span>
                <span className="text-slate-500 text-[10px] uppercase font-bold">
                  S časovým a projektovým vodoznakem
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {allPhotos.map(item => (
                  <div 
                    key={item.id} 
                    className="border border-slate-300 rounded-lg overflow-hidden bg-white p-2 flex flex-col items-center page-break-inside-avoid print:break-inside-avoid shadow-sm"
                  >
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.caption} 
                      className="h-32 sm:h-40 w-full object-contain rounded mb-2 bg-slate-50" 
                    />
                    <div className="w-full text-left text-[10px] text-slate-700">
                      <div className="font-bold text-slate-900 truncate mb-0.5" title={item.caption}>{item.caption}</div>
                      <div className="text-slate-500 font-mono">{item.dateStr} {item.timeStr}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Acceptance Note & Signatures */}
        <div className="print-signature-box page-break-inside-avoid mt-8 pt-6 border-t-2 border-slate-200">
          <p className="text-[10px] sm:text-[11px] text-slate-500 mb-6 leading-relaxed text-justify">
            Podpisem tohoto protokolu obě smluvní strany stvrzují, že výše uvedené práce, montážní činnosti a sváry byly provedeny řádně, v požadovaném rozsahu a kvalitě dle platných technických norem a výkresové dokumentace. Tento protokol slouží jako neoddělitelný podklad k vystavení daňového dokladu.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            {/* Zhotovitel */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center min-h-[160px] print:border-slate-300 print:bg-white">
              <div className="w-full mb-2">
                <span className="text-xs font-black uppercase text-slate-800 block mb-1">
                  Za zhotovitele (Montér / Svářeč)
                </span>
                <span className="text-[11px] text-slate-600 font-bold block">
                  {signatures.contractor?.signerName || settings.contractor.name}
                </span>
              </div>

              <div className="my-3 w-full flex flex-col items-center justify-center flex-1">
                {signatures.contractor?.dataUrl ? (
                  <img 
                    src={signatures.contractor.dataUrl} 
                    alt="Podpis zhotovitele" 
                    className="signature-img h-16 sm:h-20 object-contain mx-auto mix-blend-multiply" 
                  />
                ) : (
                  <div className="w-full max-w-[200px] border-b-2 border-dashed border-slate-300 py-4 text-[10px] text-slate-400 font-mono">
                    Podpis a razítko
                  </div>
                )}
              </div>

              <div className="w-full pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex flex-row items-center justify-between">
                <span className="font-medium">
                  {signatures.contractor?.signedAt 
                    ? `Dne: ${new Date(signatures.contractor.signedAt).toLocaleDateString('cs-CZ')}` 
                    : 'Zatím nepodepsáno'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSignatureModal('contractor')}
                  className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{signatures.contractor ? 'Změnit' : 'Podepsat'}</span>
                </button>
              </div>
            </div>

            {/* Objednatel */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center min-h-[160px] print:border-slate-300 print:bg-white">
              <div className="w-full mb-2">
                <span className="text-xs font-black uppercase text-slate-800 block mb-1">
                  Za objednatele (Stavbyvedoucí / TDI)
                </span>
                <span className="text-[11px] text-slate-600 font-bold block">
                  {signatures.client?.signerName || matchedClient?.contactPerson || 'Odpovědný zástupce stavby'}
                </span>
              </div>

              <div className="my-3 w-full flex flex-col items-center justify-center flex-1">
                {signatures.client?.dataUrl ? (
                  <img 
                    src={signatures.client.dataUrl} 
                    alt="Podpis objednatele" 
                    className="signature-img h-16 sm:h-20 object-contain mx-auto mix-blend-multiply" 
                  />
                ) : (
                  <div className="w-full max-w-[200px] border-b-2 border-dashed border-slate-300 py-4 text-[10px] text-slate-400 font-mono">
                    Podpis převzetí
                  </div>
                )}
              </div>

              <div className="w-full pt-3 border-t border-slate-200 text-[10px] text-slate-500 flex flex-row items-center justify-between">
                <span className="font-medium">
                  {signatures.client?.signedAt 
                    ? `Dne: ${new Date(signatures.client.signedAt).toLocaleDateString('cs-CZ')}` 
                    : 'Zatím nepodepsáno'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSignatureModal('client')}
                  className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{signatures.client ? 'Změnit' : 'Podepsat'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Signature Pad Modal Dialog */}
      <SignaturePadModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        role={signatureModalRole}
        defaultSignerName={
          signatureModalRole === 'contractor'
            ? (signatures.contractor?.signerName || settings.contractor.name)
            : (signatures.client?.signerName || matchedClient?.contactPerson || '')
        }
        existingSignature={
          signatureModalRole === 'contractor'
            ? signatures.contractor
            : signatures.client
        }
      />
    </div>
  );
};
