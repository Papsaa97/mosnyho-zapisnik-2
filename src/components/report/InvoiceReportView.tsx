import React, { useState, useMemo, useCallback } from 'react';
import {
  Printer,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { WorkEntry, AppSettings, ClientProfile } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';
import { exportEntriesToCSV } from '../../services/exportService';
import { getNextDocumentNumber } from '../../services/documentNumbering';
import { useToast } from '../../utils/toastContext';
import { triggerHaptic } from '../../utils/haptics';

interface InvoiceReportViewProps {
  entries: WorkEntry[];
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
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
  // Auto-detect the next protocol number from the highest one issued so far this year
  const [protocolNumber, setProtocolNumber] = useState<string>(
    () => getNextDocumentNumber('PR', new Date().getFullYear(), [settings.lastProtocolNumber])
  );

  // Persist the just-used protocol number so the next report defaults to +1
  const recordIssuedProtocolNumber = useCallback(() => {
    if (protocolNumber.trim() && protocolNumber !== settings.lastProtocolNumber) {
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
      totalExtras += extras;
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
        </div>

        {/* CTA Buttons for Print and CSV */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            style={{ minHeight: '44px' }}
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Excel CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            style={{ minHeight: '44px' }}
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>VYTISKNOUT A4 / PDF</span>
          </button>
        </div>
      </div>

      {/* --- OFFICIAL A4 PRINT CONTAINER --- */}
      <div className="print-container bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-2xl border border-slate-200">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded">
                OFICIÁLNÍ DOKUMENT
              </span>
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
              PŘEDÁVACÍ PROTOKOL & PODKLAD K FAKTURACI
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold">
              Výkaz provedených svářečských a montážních prací za období: <span className="text-slate-950 font-black uppercase">{periodLabel}</span>
            </p>
          </div>

          <div className="text-right sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-bold block">Datum vystavení výkazu:</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              {new Date().toLocaleDateString('cs-CZ')}
            </span>
          </div>
        </div>

        {/* Contractor & Client Info Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          {/* Dodavatel (Kryštof Mošner) */}
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

                return (
                  <tr key={e.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border border-slate-300 font-mono font-medium whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('cs-CZ')}
                    </td>
                    <td className="p-2 border border-slate-300">
                      <div className="font-bold text-slate-900">{e.projectName}</div>
                      <div className="text-[10px] text-slate-600">
                        {e.weldingMethod && e.weldingMethod !== 'NONE' && `[${e.weldingMethod}] `}
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
                          {extras > 0 ? formatCurrency(extras) : '–'}
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

        {/* Consumables / Extra Costs Detailed Box if any */}
        {totals.totalExtras > 0 && showFinancials && (
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs page-break-inside-avoid">
            <span className="font-bold text-slate-900 uppercase block mb-1">
              Podrobný rozpis spotřebovaného materiálu a víceprací:
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

        {/* Acceptance Note & Signatures (Page Break Avoid) */}
        <div className="page-break-inside-avoid pt-4 border-t border-slate-200">
          <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
            Podpisem tohoto protokolu obě smluvní strany stvrzují, že výše uvedené práce, montážní činnosti a sváry byly provedeny řádně, v požadovaném rozsahu a kvalitě dle platných technických norem a výkresové dokumentace. Tento protokol slouží jako neoddělitelný podklad k vystavení daňového dokladu (faktury).
          </p>

          <div className="grid grid-cols-2 gap-8 pt-4">
            {/* Zhotovitel */}
            <div className="border-t border-slate-400 pt-2 text-center">
              <span className="text-xs font-bold text-slate-800 block">
                Za zhotovitele (Montér / Svářeč)
              </span>
              <span className="text-[11px] text-slate-500 block mb-8">
                {settings.contractor.name}
              </span>
              <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-1">
                Podpis a razítko
              </div>
            </div>

            {/* Objednatel */}
            <div className="border-t border-slate-400 pt-2 text-center">
              <span className="text-xs font-bold text-slate-800 block">
                Za objednatele (Stavbyvedoucí / TDI)
              </span>
              <span className="text-[11px] text-slate-500 block mb-8">
                {matchedClient?.contactPerson || 'Odpovědný zástupce stavby'}
              </span>
              <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-1">
                Podpis a razítko převzetí
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
