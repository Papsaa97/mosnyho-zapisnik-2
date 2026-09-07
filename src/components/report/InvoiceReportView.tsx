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

      {/* --- A4 PREVIEW STAGE: true-to-scale on-screen miniature of the ---
          --- printed sheet, identical on iPhone, iPad and desktop.    --- */}
      <div className="pr-stage">
        <div id="printable-invoice">

          {/* Document Header */}
          <div
            className="pr-avoid-break"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '6mm',
              borderBottom: '1pt solid #0f172a',
              paddingBottom: '4mm',
              marginBottom: '4mm'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                <span style={{ background: '#f59e0b', color: '#000000', fontWeight: 900, fontSize: '7pt', padding: '0.8mm 2mm' }}>
                  OFICIÁLNÍ DOKUMENT
                </span>
                <span className="pr-label" style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
                  Č. protokolu:
                  <input
                    type="text"
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    className="no-print"
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontWeight: 800,
                      fontSize: '7pt',
                      border: '0.5pt solid #cbd5e1',
                      background: '#f1f5f9',
                      padding: '0.5mm 1.5mm',
                      color: '#0f172a'
                    }}
                    title="Kliknutím upravte číslo protokolu"
                  />
                  <span className="print-only pr-mono" style={{ fontWeight: 800 }}>{protocolNumber}</span>
                </span>
              </div>
              <h1 className="pr-h1" style={{ marginTop: '1.5mm' }}>
                PŘEDÁVACÍ PROTOKOL &amp; PODKLAD K FAKTURACI
              </h1>
              <p className="pr-text" style={{ fontWeight: 700, marginTop: '1mm' }}>
                Výkaz provedených svářečských a montážních prací za období:{' '}
                <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{periodLabel}</span>
              </p>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span className="pr-label" style={{ display: 'block' }}>Datum vystavení výkazu:</span>
              <span className="pr-text pr-mono" style={{ fontWeight: 800 }}>
                {new Date().toLocaleDateString('cs-CZ')}
              </span>
            </div>
          </div>

          {/* Contractor & Client Info — fixed 2 columns, never stacks */}
          <div className="pr-grid-2 pr-box" style={{ marginBottom: '5mm', background: '#f8fafc' }}>
            <div>
              <span className="pr-label" style={{ display: 'block', borderBottom: '0.5pt solid #cbd5e1', paddingBottom: '1mm', marginBottom: '1mm' }}>
                ZHOTOVITEL (DODAVATEL / OSVČ)
              </span>
              <div className="pr-text" style={{ fontWeight: 900 }}>{settings.contractor.name}</div>
              <div className="pr-text">{settings.contractor.tradeTitle}</div>
              <div className="pr-text">{settings.contractor.address}, {settings.contractor.city} {settings.contractor.zip}</div>
              <div className="pr-text pr-mono" style={{ marginTop: '1mm' }}>
                IČO: <strong>{settings.contractor.ico}</strong>{settings.contractor.dic && ` | DIČ: ${settings.contractor.dic}`}
              </div>
              <div className="pr-text pr-mono">Číslo účtu: <strong>{settings.contractor.bankAccount}</strong></div>
              {settings.contractor.certifications && (
                <div className="pr-small" style={{ marginTop: '1mm' }}>
                  <strong>Svářečská kvalifikace:</strong> {settings.contractor.certifications}
                </div>
              )}
            </div>

            <div>
              <span className="pr-label" style={{ display: 'block', borderBottom: '0.5pt solid #cbd5e1', paddingBottom: '1mm', marginBottom: '1mm' }}>
                OBJEDNATEL (ODBĚRATEL / GENERÁLNÍ DODAVATEL)
              </span>
              <div className="pr-text" style={{ fontWeight: 900 }}>
                {matchedClient?.name || (selectedClient !== 'all' ? selectedClient : 'Všichni odběratelé')}
              </div>
              {matchedClient?.address && <div className="pr-text">{matchedClient.address}</div>}
              {matchedClient?.ico && (
                <div className="pr-text pr-mono" style={{ marginTop: '1mm' }}>
                  IČO: <strong>{matchedClient.ico}</strong>{matchedClient.dic && ` | DIČ: ${matchedClient.dic}`}
                </div>
              )}
              {matchedClient?.contactPerson && (
                <div className="pr-text">Kontaktní osoba: <strong>{matchedClient.contactPerson}</strong></div>
              )}
            </div>
          </div>

          {/* Summary KPI strip — fixed 4 columns */}
          <div className="pr-grid-4" style={{ marginBottom: '5mm' }}>
            <div className="pr-box" style={{ textAlign: 'center' }}>
              <span className="pr-label" style={{ display: 'block' }}>Celkem odpracováno</span>
              <span className="pr-h2 pr-mono">{totals.totalHours.toFixed(2).replace('.', ',')} h</span>
            </div>
            <div className="pr-box" style={{ textAlign: 'center' }}>
              <span className="pr-label" style={{ display: 'block' }}>Ujeto kilometrů</span>
              <span className="pr-h2 pr-mono">{totals.totalKm} km</span>
            </div>
            <div className="pr-box" style={{ textAlign: 'center' }}>
              <span className="pr-label" style={{ display: 'block' }}>Stravné celkem</span>
              <span className="pr-h2 pr-mono">{formatCurrency(totals.totalDiets)}</span>
            </div>
            <div className="pr-box" style={{ textAlign: 'center', background: '#fffbeb', border: '1pt solid #0f172a' }}>
              <span className="pr-label" style={{ display: 'block', color: '#78350f' }}>
                {showFinancials ? 'Celkem k fakturaci' : 'Počet směn'}
              </span>
              <span className="pr-h2 pr-mono">
                {showFinancials ? formatCurrency(totals.grandTotal) : `${reportEntries.length} směn`}
              </span>
            </div>
          </div>

          {/* Itemized table — fixed mm column widths via <colgroup>, never reflows */}
          <table className="pr-table" style={{ marginBottom: '5mm' }}>
            <colgroup>
              <col style={{ width: '22mm' }} />
              <col />
              <col style={{ width: '18mm' }} />
              {showFinancials && <col style={{ width: '20mm' }} />}
              {showFinancials && <col style={{ width: '22mm' }} />}
              {showFinancials && <col style={{ width: '26mm' }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Popis prací a svárů</th>
                <th style={{ textAlign: 'right' }}>Hodiny</th>
                {showFinancials && <th style={{ textAlign: 'right' }}>Sazba</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Cesta / Diety</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Celkem</th>}
              </tr>
            </thead>
            <tbody>
              {reportEntries.map((e) => {
                const travelCosts = Math.round(
                  (e.travel.distanceKm * e.travel.ratePerKm) +
                  (e.travel.travelTimeHours * e.travel.travelHourlyRate)
                );
                const travelAndDiet = travelCosts + (e.travel.dietAllowance || 0);

                return (
                  <tr key={e.id}>
                    <td>
                      {new Date(e.date).toLocaleDateString('cs-CZ')}
                      <div className="pr-small">
                        {e.startTime}–{e.endTime}{e.breakMinutes > 0 ? ` (${e.breakMinutes}m pauza)` : ''}
                      </div>
                    </td>
                    <td className="pr-col-wrap">
                      <div style={{ fontWeight: 800 }}>{e.projectName}</div>
                      {((e.weldingMethod && e.weldingMethod !== 'NONE') || e.notes) && (
                        <div className="pr-small">
                          {e.weldingMethod && e.weldingMethod !== 'NONE' && `[${e.weldingMethod}] `}
                          {e.notes || ''}
                        </div>
                      )}
                    </td>
                    <td className="pr-mono" style={{ textAlign: 'right', fontWeight: 800 }}>
                      {e.totalHours.toFixed(2).replace('.', ',')}
                    </td>
                    {showFinancials && (
                      <td className="pr-mono" style={{ textAlign: 'right' }}>{e.pricing.calculatedHourlyRate} Kč</td>
                    )}
                    {showFinancials && (
                      <td className="pr-mono" style={{ textAlign: 'right' }}>
                        {travelAndDiet > 0 ? formatCurrency(travelAndDiet) : '–'}
                        {e.travel.distanceKm > 0 && <div className="pr-small">{e.travel.distanceKm} km</div>}
                      </td>
                    )}
                    {showFinancials && (
                      <td className="pr-mono" style={{ textAlign: 'right', fontWeight: 900 }}>
                        {formatCurrency(e.totalEarnings)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e2e8f0', fontWeight: 900 }}>
                <td colSpan={2} style={{ textAlign: 'right' }}>CELKEM ZA OBDOBÍ:</td>
                <td className="pr-mono" style={{ textAlign: 'right' }}>
                  {totals.totalHours.toFixed(2).replace('.', ',')} h
                </td>
                {showFinancials && <td>&nbsp;</td>}
                {showFinancials && (
                  <td className="pr-mono" style={{ textAlign: 'right' }}>
                    {formatCurrency(totals.totalTravelCost + totals.totalDiets)}
                  </td>
                )}
                {showFinancials && (
                  <td className="pr-mono" style={{ textAlign: 'right' }}>{formatCurrency(totals.grandTotal)}</td>
                )}
              </tr>
            </tfoot>
          </table>

          {/* Consumables / Extra Costs Detailed Box if any */}
          {totals.totalExtras > 0 && showFinancials && (
            <div className="pr-box pr-avoid-break" style={{ marginBottom: '5mm', background: '#f8fafc' }}>
              <span className="pr-label" style={{ display: 'block', marginBottom: '1.5mm' }}>
                Podrobný rozpis spotřebovaného materiálu a víceprací:
              </span>
              <div className="pr-grid-2">
                {reportEntries.flatMap(e => (e.extraCosts || []).map(item => (
                  <div
                    key={item.id}
                    className="pr-text"
                    style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '0.5pt solid #e2e8f0', paddingBottom: '0.5mm' }}
                  >
                    <span>{e.date} – {item.description}</span>
                    <strong className="pr-mono">{formatCurrency(item.amount)}</strong>
                  </div>
                )))}
              </div>
            </div>
          )}

          {/* Acceptance Note & Signatures */}
          <div className="pr-avoid-break" style={{ paddingTop: '4mm', borderTop: '0.5pt solid #cbd5e1' }}>
            <p className="pr-small" style={{ marginBottom: '6mm' }}>
              Podpisem tohoto protokolu obě smluvní strany stvrzují, že výše uvedené práce, montážní činnosti a sváry byly provedeny řádně, v požadovaném rozsahu a kvalitě dle platných technických norem a výkresové dokumentace. Tento protokol slouží jako neoddělitelný podklad k vystavení daňového dokladu (faktury).
            </p>

            <div className="pr-grid-2" style={{ gap: '10mm' }}>
              {/* Zhotovitel */}
              <div style={{ borderTop: '0.5pt solid #64748b', paddingTop: '2mm', textAlign: 'center' }}>
                <span className="pr-text" style={{ fontWeight: 800, display: 'block' }}>
                  Za zhotovitele (Montér / Svářeč)
                </span>
                <span className="pr-small" style={{ display: 'block', marginBottom: '8mm' }}>
                  {settings.contractor.name}
                </span>
                <div className="pr-small" style={{ borderTop: '0.5pt dashed #cbd5e1', paddingTop: '1mm' }}>
                  Podpis a razítko
                </div>
              </div>

              {/* Objednatel */}
              <div style={{ borderTop: '0.5pt solid #64748b', paddingTop: '2mm', textAlign: 'center' }}>
                <span className="pr-text" style={{ fontWeight: 800, display: 'block' }}>
                  Za objednatele (Stavbyvedoucí / TDI)
                </span>
                <span className="pr-small" style={{ display: 'block', marginBottom: '8mm' }}>
                  {matchedClient?.contactPerson || 'Odpovědný zástupce stavby'}
                </span>
                <div className="pr-small" style={{ borderTop: '0.5pt dashed #cbd5e1', paddingTop: '1mm' }}>
                  Podpis a razítko převzetí
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
