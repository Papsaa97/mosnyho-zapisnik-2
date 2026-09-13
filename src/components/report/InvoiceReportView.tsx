import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  Eye, 
  EyeOff, 
  FileText, 
  Camera,
  PenTool,
  CheckCircle2
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
    <div className="max-w-5xl mx-auto space-y-4 pb-24 md:pb-12">
      
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Měsíc */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">Měsíc:</span>
            <select
              value={activeMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
            >
              <option value="all">Celé období</option>
              {availableMonths.map(m => {
                const [y, mon] = m.split('-');
                const name = new Date(Number(y), Number(mon) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{name}</option>;
              })}
            </select>
          </div>

          {/* Odběratel */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">Odběratel:</span>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
            >
              <option value="all">Všichni odběratelé</option>
              {availableClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Přepínač Cen / Pouze výkon */}
          <button
            type="button"
            onClick={() => setShowFinancials(!showFinancials)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              showFinancials
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Přepnout zobrazení cen. Pokud vypnuto, vytiskne se pouze technický předávací protokol s hodinami pro stavbyvedoucího."
          >
            {showFinancials ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showFinancials ? 'Ceny zapnuty' : 'Pouze výkaz hodin (bez cen)'}</span>
          </button>
          
          {/* Přepínač Protokol / Faktura */}
          <button
            type="button"
            onClick={() => setDocumentType(prev => prev === 'protocol' ? 'invoice' : 'protocol')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              documentType === 'invoice'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Přepnout na formát faktury (včetně QR kódu)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{documentType === 'invoice' ? 'Režim: Faktura' : 'Režim: Protokol'}</span>
          </button>
        </div>

        {/* CTA Buttons for Print and CSV */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="min-h-touch px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Excel CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="min-h-touch px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>VYTISKNOUT A4 / PDF</span>
          </button>
        </div>
      </div>

      {/* --- OFFICIAL A4 PRINT CONTAINER --- */}
      <div id="printable-invoice" className="print-container bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-2xl border border-slate-200">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded">
                OFICIÁLNÍ DOKUMENT
              </span>
              {isPdpDocument && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs px-2 py-0.5 rounded">
                  § 92e PDP (PŘENESENÁ DP)
                </span>
              )}
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <span>Č. protokolu:</span>
                <input
                  type="text"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  className="no-print bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  title="Kliknutím upravte číslo protokolu"
                />
                <span className="print-only font-mono">{protocolNumber}</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1">
              {documentType === 'invoice' 
                ? 'FAKTURA - DAŇOVÝ DOKLAD' 
                : 'PŘEDÁVACÍ PROTOKOL & PODKLAD K FAKTURACI'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold">
              Výkaz provedených svářečských a montážních prací za období: <span className="text-slate-950 font-black uppercase">{periodLabel}</span>
            </p>
          </div>

          <div className="text-right sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            {documentType === 'invoice' && (
              <div className="mb-2">
                <span className="text-[11px] text-slate-500 uppercase font-bold block">Datum splatnosti (14 dní):</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('cs-CZ')}
                </span>
              </div>
            )}
            <span className="text-[11px] text-slate-500 uppercase font-bold block">Datum vystavení:</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              {new Date().toLocaleDateString('cs-CZ')}
            </span>
          </div>
        </div>

        {/* Contractor & Client Info Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          {/* Dodavatel (Zhotovitel / OSVČ) */}
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1">
              ZHOTOVITEL (DODAVATEL / OSVČ)
            </span>
            <div className="text-sm font-black text-slate-950">{settings.contractor.name}</div>
            <div className="text-slate-600 font-medium">{settings.contractor.tradeTitle}</div>
            <div className="text-slate-700">{settings.contractor.address}, {settings.contractor.city} {settings.contractor.zip}</div>
            <div className="pt-1 text-slate-900 font-mono font-semibold">
              IČO: <strong>{settings.contractor.ico}</strong> {settings.contractor.dic && `| DIČ: ${settings.contractor.dic}`}
            </div>
            <div className="text-slate-900 font-mono">
              Číslo účtu: <strong className="font-bold">{settings.contractor.bankAccount}</strong>
            </div>
            {settings.contractor.certifications && (
              <div className="pt-1 text-[11px] text-slate-600 leading-tight">
                <strong>Svářečská kvalifikace:</strong> {settings.contractor.certifications}
              </div>
            )}
          </div>

          {/* Odběratel */}
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1">
              OBJEDNATEL (ODBĚRATEL / GENERÁLNÍ DODAVATEL)
            </span>
            <div className="text-sm font-black text-slate-950">
              {matchedClient?.name || (selectedClient !== 'all' ? selectedClient : 'Všichni odběratelé')}
            </div>
            {matchedClient?.address && (
              <div className="text-slate-700">{matchedClient.address}</div>
            )}
            {matchedClient?.ico && (
              <div className="pt-1 text-slate-900 font-mono font-semibold">
                IČO: <strong>{matchedClient.ico}</strong> {matchedClient.dic && `| DIČ: ${matchedClient.dic}`}
              </div>
            )}
            {matchedClient?.contactPerson && (
              <div className="text-slate-700">
                Kontaktní osoba: <strong>{matchedClient.contactPerson}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Režim přenesené daňové povinnosti (§ 92e ZDPH) Statutory Notice */}
        {isPdpDocument && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border-2 border-amber-600/70 text-slate-950 page-break-inside-avoid shadow-sm">
            <div className="text-xs font-black uppercase text-amber-900 tracking-wider mb-1">
              Zákonné ustanovení – Režim přenesené daňové povinnosti dle § 92e zákona o DPH
            </div>
            <div className="text-sm font-black text-slate-950">
              {PDP_STATUTORY_CLAUSE}
            </div>
            <p className="text-[11px] text-slate-700 mt-1 leading-snug">
              Vystaveno v režimu přenesené daňové povinnosti dle § 92e zákona č. 235/2004 Sb., o dani z přidané hodnoty pro stavební a montážní práce odpovídající kódům klasifikace produkce CZ-CPA 41 až 43. Výši daně je povinen doplnit a přiznat plátce, pro kterého je plnění uskutečněno.
            </p>
          </div>
        )}

        {/* Summary Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Celkem odpracováno</span>
            <span className="text-lg font-black text-slate-950 font-mono">
              {totals.totalHours.toFixed(2).replace('.', ',')} h
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Ujeto kilometrů</span>
            <span className="text-lg font-black text-slate-950 font-mono">
              {totals.totalKm} km
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Stravné celkem</span>
            <span className="text-lg font-black text-slate-950 font-mono">
              {formatCurrency(totals.totalDiets)}
            </span>
          </div>

          <div className="p-3 rounded-lg border-2 border-slate-900 bg-amber-50 text-center">
            <span className="text-[10px] uppercase font-black text-amber-900 block">
              {showFinancials ? 'Celkem k fakturaci' : 'Počet směn'}
            </span>
            <span className="text-lg font-black text-slate-950 font-mono">
              {showFinancials ? formatCurrency(totals.grandTotal) : `${reportEntries.length} směn`}
            </span>
          </div>
        </div>

        {/* Svářečský & technický pasport zakázky (ČSN EN 1090-2 / ISO 9606-1 / ISO 5817) */}
        {activeWeldingPassports.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border-2 border-slate-900 page-break-inside-avoid shadow-sm text-xs">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <span className="bg-slate-900 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider mr-2">
                  ČSN EN 1090-2 / ISO 9606-1
                </span>
                <h3 className="text-sm font-black text-slate-950 inline-block uppercase tracking-tight">
                  SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                Doklad materiálové shody a jakosti svarů pro TDI
              </span>
            </div>

            <div className="space-y-3">
              {activeWeldingPassports.map((p, idx) => {
                const block = TechnicalPassportService.formatPassportBlock(p);
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 bg-white rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Metoda svařování (ISO 4063):</span>
                      <span className="font-bold text-slate-950 text-xs">{block.methodDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Základní materiál & tloušťka:</span>
                      <span className="font-bold text-slate-950 text-xs">{block.materialDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Ochranný & formovací plyn:</span>
                      <span className="font-bold text-slate-950 text-xs">{block.gasDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Přídavný materiál & šarže (Atest 3.1):</span>
                      <span className="font-mono text-slate-900 text-xs font-semibold">{block.fillerDisplay || 'Neuvedeno'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Kvalifikace svářeče (ISO 9606-1):</span>
                      <span className="font-mono text-slate-900 text-xs">{block.welderCertDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Vizuální kontrola svarů (VT2 / ISO 5817):</span>
                      <span className={`text-xs font-black ${block.vtInspection.isCompliant ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {block.vtInspection.labelCz}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Table of Days */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
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
                    <th className="p-2 border border-slate-300 text-right">Materiál</th>
                    <th className="p-2 border border-slate-300 text-right font-black">Celkem</th>
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
                      <div className="text-[10px] text-slate-600">
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
                        <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap">
                          {e.travel.distanceKm > 0 ? `${formatCurrency(travelCosts)} (${e.travel.distanceKm}km)` : '–'}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap">
                          {e.travel.dietAllowance > 0 ? formatCurrency(e.travel.dietAllowance) : '–'}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono whitespace-nowrap">
                          {totalMaterialsAndExtras > 0 ? formatCurrency(totalMaterialsAndExtras) : '–'}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                          {formatCurrency(e.totalEarnings)}
                        </td>
                      </>
                    )}

                    <td className="p-2 border border-slate-300 text-center font-semibold text-[10px] uppercase whitespace-nowrap">
                      {e.status === 'paid' ? 'Zaplaceno' :
                       e.status === 'invoiced' ? 'Vyfakturováno' :
                       e.status === 'submitted' ? 'Odevzdáno' : 'Koncept'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footers */}
            <tfoot>
              <tr className="bg-slate-200 text-slate-950 font-black border-t-2 border-slate-900">
                <td colSpan={4} className="p-2 border border-slate-300 text-right">
                  CELKEM ZA OBDOBÍ:
                </td>
                <td className="p-2 border border-slate-300 text-right font-mono font-black">
                  {totals.totalHours.toFixed(2).replace('.', ',')} h
                </td>
                {showFinancials && (
                  <>
                    <td className="p-2 border border-slate-300 text-right">–</td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {formatCurrency(totals.totalLaborCost)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {formatCurrency(totals.totalTravelCost)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {formatCurrency(totals.totalDiets)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {formatCurrency(totals.totalExtras)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-mono text-sm font-black text-slate-950">
                      {formatCurrency(totals.grandTotal)}
                    </td>
                  </>
                )}
                <td className="p-2 border border-slate-300"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Consumables Slip Itemized Table */}
        {showFinancials && reportEntries.some(e => e.consumableSlip && e.consumableSlip.items && e.consumableSlip.items.length > 0) && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs page-break-inside-avoid shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
              <span className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
                Soupis spotřebovaného materiálu a montážních komponent (Materiálový lístek)
              </span>
              <span className="text-slate-600 font-bold">
                Celkem materiál: {formatCurrency(reportEntries.reduce((sum, e) => sum + (e.consumableSlip?.totalBilledAmount || 0), 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 font-bold">
                    <th className="p-1.5 border border-slate-300 text-left">Datum</th>
                    <th className="p-1.5 border border-slate-300 text-left">Položka materiálu</th>
                    <th className="p-1.5 border border-slate-300 text-left">Kategorie</th>
                    <th className="p-1.5 border border-slate-300 text-center">Množství</th>
                    <th className="p-1.5 border border-slate-300 text-right">Nákupní cena</th>
                    <th className="p-1.5 border border-slate-300 text-right">Marže %</th>
                    <th className="p-1.5 border border-slate-300 text-right">Cena pro odběratele</th>
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
                        <td className="p-1.5 border border-slate-300 text-slate-600">
                          {item.category === 'cutting_grinding' ? 'Kotouče' :
                           item.category === 'technical_gases' ? 'Technické plyny' :
                           item.category === 'anchors' ? 'Kotevní technika' :
                           item.category === 'fasteners' ? 'Spojovací materiál' :
                           item.category === 'welding_consumables' ? 'Svařovací materiál' : 'Ostatní'}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-center font-mono whitespace-nowrap">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono whitespace-nowrap">
                          {item.unitPrice} Kč/{item.unit}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right font-mono whitespace-nowrap">
                          {item.markupPercent !== undefined ? `+${item.markupPercent} %` : `+${e.consumableSlip?.overheadMarkupPercent || 0} %`}
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
                          <td colSpan={5} className="p-1.5 border border-slate-300">
                            Manipulační a závozový paušál (nákup a doprava komponent na stavbu)
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
                <tfoot>
                  <tr className="bg-slate-200 text-slate-950 font-bold border-t-2 border-slate-900">
                    <td colSpan={6} className="p-1.5 border border-slate-300 text-right uppercase">
                      Celková účtovaná částka za spotřebovaný materiál:
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                      {formatCurrency(reportEntries.reduce((sum, e) => sum + (e.consumableSlip?.totalBilledAmount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Miscellaneous Extra Costs Box if any */}
        {showFinancials && reportEntries.some(e => e.extraCosts && e.extraCosts.length > 0) && (
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs page-break-inside-avoid">
            <span className="font-bold text-slate-900 uppercase block mb-1">
              Ostatní vedlejší výdaje a vícepráce (parkovné, povolení, poplatky):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              {reportEntries.flatMap(e => (e.extraCosts || []).map(item => (
                <div key={item.id} className="flex justify-between border-b border-slate-200 pb-0.5">
                  <span>{e.date} – {item.description}</span>
                  <strong className="font-mono">{formatCurrency(item.amount)}</strong>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* Invoice Mode VAT Breakdown Box */}
        {documentType === 'invoice' && showFinancials && totals.grandTotal > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs page-break-inside-avoid">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2">
              Rekapitulace DPH a celková částka k úhradě
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Základ daně:</span>
                <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(vatCalculation.taxBase)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sazba DPH:</span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {isPdpDocument ? '0 % (přenesená DP)' : `${vatCalculation.vatRatePercent} %`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Výše DPH:</span>
                <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(vatCalculation.vatAmount)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <span className="text-[10px] uppercase font-bold text-amber-900 block">Celkem k úhradě:</span>
                <span className="text-sm font-black text-amber-900 font-mono">{formatCurrency(vatCalculation.totalWithVat)}</span>
              </div>
            </div>
            {isPdpDocument && (
              <div className="mt-2.5 text-[11px] font-bold text-amber-900 bg-amber-100/60 p-2 rounded-lg border border-amber-300/60">
                {PDP_STATUTORY_CLAUSE}
              </div>
            )}
          </div>
        )}

        {/* Payment QR Code Box (SPAYD) */}
        {showFinancials && totals.grandTotal > 0 && (
          <div className="mb-6 p-4 border-2 border-emerald-500/20 bg-emerald-50/50 rounded-xl flex flex-col sm:flex-row items-center gap-6 page-break-inside-avoid print:break-inside-avoid">
            {spaydPayload ? (
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 shrink-0">
                <QRCodeSVG 
                  value={spaydPayload} 
                  size={120} 
                  level="M" 
                />
              </div>
            ) : (
              <div className="w-[120px] h-[120px] bg-slate-100 rounded-lg flex items-center justify-center text-center p-2 text-[10px] text-slate-400 border border-slate-200 shrink-0">
                Pro zobrazení QR kódu doplňte IBAN v nastavení profilu.
              </div>
            )}
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase mb-2">Platební údaje (SPAYD QR)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-500">Částka k úhradě:</span>
                  <div className="font-bold text-slate-900 text-sm font-mono">{formatCurrency(vatCalculation.totalWithVat)}</div>
                  {isPdpDocument && (
                    <span className="text-[10px] text-amber-800 font-bold block">0 % DPH – Režim přenesené daňové povinnosti</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Variabilní symbol:</span>
                  <div className="font-bold text-slate-900 font-mono">{protocolNumber.replace(/[^0-9]/g, '') || 'není'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Číslo účtu:</span>
                  <div className="font-bold text-slate-900 font-mono">{settings.contractor.bankAccount || 'Nenastaven'}</div>
                </div>
                <div>
                  <span className="text-slate-500">IBAN:</span>
                  <div className="font-bold text-slate-900 font-mono">{effectiveIban || 'Nenastaven'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Documentation Appendix (Feature 29) */}
        {(() => {
          const allPhotos = preparePhotosForProtocol(reportEntries.flatMap(e => e.photos || []));
          if (allPhotos.length === 0) return null;

          return (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl page-break-inside-avoid print:break-inside-avoid">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
                <span className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  Fotodokumentace svarů a montáže ({allPhotos.length} snímků)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Terénní fotodokumentace s časovým a projektovým vodoznakem
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {allPhotos.map(item => (
                  <div 
                    key={item.id} 
                    className="border border-slate-300 rounded-lg overflow-hidden bg-white p-2 flex flex-col items-center page-break-inside-avoid print:break-inside-avoid"
                  >
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.caption} 
                      className="max-h-[160px] w-auto object-contain rounded mb-1.5" 
                    />
                    <div className="w-full text-left text-[10px] text-slate-700">
                      <div className="font-bold text-slate-900 truncate">{item.caption}</div>
                      <div className="text-slate-500 font-mono">{item.dateStr} {item.timeStr}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Acceptance Note & Signatures (Page Break Avoid) */}
        <div className="print-signature-box page-break-inside-avoid pt-4 border-t border-slate-200">
          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            Podpisem tohoto protokolu obě smluvní strany stvrzují, že výše uvedené práce, montážní činnosti a sváry byly provedeny řádně, v požadovaném rozsahu a kvalitě dle platných technických norem a výkresové dokumentace. Tento protokol slouží jako neoddělitelný podklad k vystavení daňového dokladu (faktury).
          </p>

          <div className="grid grid-cols-2 gap-6 pt-2">
            {/* Zhotovitel */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 flex flex-col items-center justify-between text-center min-h-[140px] print:border-slate-300 print:bg-white">
              <div className="w-full">
                <span className="text-xs font-bold text-slate-800 block">
                  Za zhotovitele (Montér / Svářeč)
                </span>
                <span className="text-[11px] text-slate-600 font-medium block">
                  {signatures.contractor?.signerName || settings.contractor.name}
                </span>
              </div>

              <div className="my-2 w-full flex flex-col items-center justify-center min-h-[56px]">
                {signatures.contractor?.dataUrl ? (
                  <img 
                    src={signatures.contractor.dataUrl} 
                    alt="Podpis zhotovitele" 
                    className="signature-img h-14 object-contain mx-auto" 
                  />
                ) : (
                  <div className="w-full border-b border-dashed border-slate-400 py-3 text-[11px] text-slate-400 font-mono">
                    [ Podpis a razítko zhotovitele ]
                  </div>
                )}
              </div>

              <div className="w-full pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-1">
                <span>
                  {signatures.contractor?.signedAt 
                    ? `Dne: ${new Date(signatures.contractor.signedAt).toLocaleDateString('cs-CZ')}` 
                    : 'Zatím nepodepsáno'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSignatureModal('contractor')}
                  className="no-print inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  <PenTool className="w-3 h-3" />
                  <span>{signatures.contractor ? 'Změnit podpis' : 'Podepsat'}</span>
                </button>
              </div>
            </div>

            {/* Objednatel */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 flex flex-col items-center justify-between text-center min-h-[140px] print:border-slate-300 print:bg-white">
              <div className="w-full">
                <span className="text-xs font-bold text-slate-800 block">
                  Za objednatele (Stavbyvedoucí / TDI)
                </span>
                <span className="text-[11px] text-slate-600 font-medium block">
                  {signatures.client?.signerName || matchedClient?.contactPerson || 'Odpovědný zástupce stavby'}
                </span>
              </div>

              <div className="my-2 w-full flex flex-col items-center justify-center min-h-[56px]">
                {signatures.client?.dataUrl ? (
                  <img 
                    src={signatures.client.dataUrl} 
                    alt="Podpis objednatele" 
                    className="signature-img h-14 object-contain mx-auto" 
                  />
                ) : (
                  <div className="w-full border-b border-dashed border-slate-400 py-3 text-[11px] text-slate-400 font-mono">
                    [ Podpis a razítko převzetí ]
                  </div>
                )}
              </div>

              <div className="w-full pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-1">
                <span>
                  {signatures.client?.signedAt 
                    ? `Dne: ${new Date(signatures.client.signedAt).toLocaleDateString('cs-CZ')}` 
                    : 'Zatím nepodepsáno'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSignatureModal('client')}
                  className="no-print inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  <PenTool className="w-3 h-3" />
                  <span>{signatures.client ? 'Změnit podpis' : 'Podepsat'}</span>
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
