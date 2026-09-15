import React from 'react';
import { ShiftFormState, ShiftFormAction } from '../shiftFormReducer';
import { Calendar, AlertTriangle, Wrench, Flame, Truck, ShieldCheck, Sparkles } from 'lucide-react';
import { WorkType, WeldingMethod, WeldingMethodCode, WeldingPassport, ClientProfile } from '../../../types';
import { isDateWeekend } from '../../../services/pricingEngine';
import {
  WeldingMethodService,
  ShieldingGasService,
  TechnicalPassportService,
} from '../../../services/weldingPassportService';

interface ProjectSectionProps {
  state: ShiftFormState;
  dispatch: React.Dispatch<ShiftFormAction>;
  clientSuggestions: string[];
  projectSuggestions: string[];
  clients?: ClientProfile[];
  mode?: 'all' | 'basic' | 'passport';
}

const ISO_METHODS: { code: WeldingMethodCode; label: string; legacy: WeldingMethod }[] = [
  { code: '141', label: '141 TIG', legacy: 'TIG' },
  { code: '135', label: '135 MAG', legacy: 'MIG_MAG' },
  { code: '136', label: '136 MAG trubička', legacy: 'MIG_MAG' },
  { code: '131', label: '131 MIG', legacy: 'MIG_MAG' },
  { code: '111', label: '111 MMA (Elektroda)', legacy: 'MMA' },
  { code: '311', label: '311 Autogen', legacy: 'AUTOGEN' },
  { code: '141_135', label: '141/135 TIG+MAG', legacy: 'COMBINED' },
  { code: '141_111', label: '141/111 TIG+MMA', legacy: 'COMBINED' },
  { code: 'NONE', label: 'Bez sváru', legacy: 'NONE' },
];

const BASE_MATERIAL_PRESETS = [
  'S235JR',
  'S355J2',
  '1.4301',
  '1.4404',
  'AlMg3',
  '16Mo3',
  'HARDOX 450',
];

const THICKNESS_PRESETS = [
  '1.5 mm',
  '2.0 mm',
  '3.0 mm',
  '4.0 mm',
  '5.0 mm',
  '6.0 mm',
  '8.0 mm',
  '10.0 mm',
  '12.0 mm',
  '20.0 mm',
];

const COMMON_GASES = [
  'Argon 4.6 (100% Ar, ISO 14175 I1)',
  'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
  'CORGON 8 (92% Ar + 8% CO2, ISO 14175 M20)',
  'Kysličník uhličitý (100% CO2, ISO 14175 C1)',
  'Bez ochranného plynu (tavidlo obalu elektrody)',
  'Kyslík + Acetylén',
];

export const ProjectSection = React.memo<ProjectSectionProps>(function ProjectSection({
  state,
  dispatch,
  clientSuggestions,
  projectSuggestions,
  clients,
  mode = 'all',
}) {
  const handleClientChange = (name: string) => {
    dispatch({ type: 'SET_FIELD', field: 'clientName', value: name });
    if (clients && clients.length > 0) {
      const matched = clients.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (matched) {
        dispatch({ type: 'SET_FIELD', field: 'isPdp', value: !!matched.isPdpDefault });
      }
    }
  };

  const currentMethodCode: WeldingMethodCode =
    state.weldingPassport?.methodCode ??
    (state.weldingMethod === 'TIG'
      ? '141'
      : state.weldingMethod === 'MIG_MAG'
      ? '135'
      : state.weldingMethod === 'MMA'
      ? '111'
      : state.weldingMethod === 'AUTOGEN'
      ? '311'
      : state.weldingMethod === 'COMBINED'
      ? '141_135'
      : state.weldingMethod === 'NONE'
      ? 'NONE'
      : '141');

  const isPassportActive =
    currentMethodCode !== 'NONE' &&
    TechnicalPassportService.shouldRenderPassport(state.weldingPassport);

  const updatePassportField = <K extends keyof WeldingPassport>(
    field: K,
    val: WeldingPassport[K]
  ) => {
    const current = state.weldingPassport || {
      methodCode: currentMethodCode,
      baseMaterialGrade: 'S355J2',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: '',
      rootBackingGas: false,
      weldInspectionVT: 'passed_B',
    };

    dispatch({
      type: 'SET_FIELD',
      field: 'weldingPassport',
      value: {
        ...current,
        [field]: val,
      },
    });
  };

  const handleMethodSelect = (code: WeldingMethodCode, legacy: WeldingMethod) => {
    dispatch({ type: 'SET_FIELD', field: 'weldingMethod', value: legacy });

    if (code === 'NONE') {
      dispatch({
        type: 'SET_FIELD',
        field: 'weldingPassport',
        value: {
          methodCode: 'NONE',
          methodName: 'Bez sváru – čistá zámečnická montáž',
          baseMaterialGrade: 'N/A',
          materialThickness: 'N/A',
          shieldingGas: 'N/A',
          fillerBatch: 'N/A',
          rootBackingGas: false,
          weldInspectionVT: 'not_required',
        },
      });
      return;
    }

    const info = WeldingMethodService.getMethod(code);
    const prev = state.weldingPassport;
    const isMethodChanging = prev?.methodCode !== code;
    const matGrade =
      prev?.baseMaterialGrade && prev.baseMaterialGrade !== 'N/A'
        ? prev.baseMaterialGrade
        : 'S355J2';
    const rec = ShieldingGasService.recommendGas(code, matGrade);

    const gas = (!isMethodChanging && prev?.shieldingGas && prev.shieldingGas !== 'N/A')
      ? prev.shieldingGas
      : rec.gas;
    const backing = (!isMethodChanging && prev?.rootBackingGas !== undefined)
      ? prev.rootBackingGas
      : rec.rootBackingGasRecommended;

    dispatch({
      type: 'SET_FIELD',
      field: 'weldingPassport',
      value: {
        methodCode: code,
        methodName: info?.fullNameCz || `Metoda ${code}`,
        baseMaterialGrade: matGrade,
        materialThickness:
          prev?.materialThickness && prev.materialThickness !== 'N/A'
            ? prev.materialThickness
            : '3.0 mm',
        shieldingGas: gas,
        fillerBatch:
          prev?.fillerBatch && prev.fillerBatch !== 'N/A' ? prev.fillerBatch : '',
        rootBackingGas: backing,
        welderCertNumber: prev?.welderCertNumber || '',
        weldInspectionVT: (prev?.weldInspectionVT && prev.weldInspectionVT !== 'not_required')
          ? prev.weldInspectionVT
          : 'passed_B',
      },
    });
  };

  const handleAutoRecommendGas = () => {
    const mat = state.weldingPassport?.baseMaterialGrade || 'S355J2';
    const rec = ShieldingGasService.recommendGas(currentMethodCode, mat);
    dispatch({
      type: 'SET_FIELD',
      field: 'weldingPassport',
      value: {
        ...(state.weldingPassport || {
          methodCode: currentMethodCode,
          baseMaterialGrade: mat,
          materialThickness: '3.0 mm',
          fillerBatch: '',
          weldInspectionVT: 'passed_B',
        }),
        shieldingGas: rec.gas,
        rootBackingGas: rec.rootBackingGasRecommended,
      },
    });
  };

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
      {/* Základní údaje směny (Datum, Klient, Zakázka, PDP, Typ práce) */}
      {(mode === 'all' || mode === 'basic') && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Datum */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Datum směny *
              </label>
              <input
                type="date"
                value={state.date}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'date', value: e.target.value })}
                required
                className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {isDateWeekend(state.date) && (
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
                value={state.clientName}
                onChange={(e) => handleClientChange(e.target.value)}
                placeholder="např. Metrostav DIZ"
                required
                className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-amber-500 focus:outline-none"
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
                value={state.projectName}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'projectName', value: e.target.value })}
                placeholder="např. Hala C – potrubí DN150"
                required
                className="min-h-touch w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-amber-500 focus:outline-none"
              />
              <datalist id="project-list">
                {projectSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Režim přenesené daňové povinnosti (§ 92e ZDPH) */}
          <div className="flex items-center justify-between p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex flex-col pr-3">
              <label htmlFor="pdp-toggle" className="text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-1.5 flex-wrap">
                <span>Režim přenesené daňové povinnosti (§ 92e ZDPH)</span>
                {state.isPdp && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    PDP aktivní (0 % DPH)
                  </span>
                )}
              </label>
              <span className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                Stavební a montážní práce CZ-CPA 41–43 (daň odvede zákazník)
              </span>
            </div>
            <input
              id="pdp-toggle"
              type="checkbox"
              checked={!!state.isPdp}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'isPdp', value: e.target.checked })}
              className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500 shrink-0"
            />
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
                const isSelected = state.workType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_FIELD', field: 'workType', value: item.type })}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md font-bold'
                        : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-xs leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Svářečské metody ISO a technický pasport EN 1090 */}
      {(mode === 'all' || mode === 'passport') && (
        <>
          {/* Metoda svařování dle ISO 4063 */}
          <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Metoda svařování (ČSN EN ISO 4063)
          </span>
          {currentMethodCode !== 'NONE' && (
            <span className="text-[10px] text-amber-400 font-mono font-bold">
              ISO {currentMethodCode}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ISO_METHODS.map((m) => {
            const isSelected = currentMethodCode === m.code;
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => handleMethodSelect(m.code, m.legacy)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-850'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Svářečský & technický pasport (ČSN EN 1090-2 / ISO 9606-1) */}
      {isPassportActive && (
        <div className="p-3.5 bg-slate-900/90 border-2 border-amber-500/30 rounded-xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                Technický & svářečský pasport (ČSN EN 1090-2)
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoRecommendGas}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30"
              title="Doporučit ochranný plyn a formování kořene pro zvolený materiál a metodu"
            >
              <Sparkles className="w-3 h-3" /> Auto-doporučit plyn
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Základní materiál */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Základní materiál (jakost oceli / slitiny) *
              </label>
              <input
                type="text"
                value={state.weldingPassport?.baseMaterialGrade || ''}
                onChange={(e) => updatePassportField('baseMaterialGrade', e.target.value)}
                placeholder="např. S355J2, 1.4404, HARDOX 450"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {BASE_MATERIAL_PRESETS.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => updatePassportField('baseMaterialGrade', grade)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      state.weldingPassport?.baseMaterialGrade === grade
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Tloušťka materiálu */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Tloušťka materiálu (t v mm / rozměr trubky) *
              </label>
              <input
                type="text"
                value={state.weldingPassport?.materialThickness || ''}
                onChange={(e) => updatePassportField('materialThickness', e.target.value)}
                placeholder="např. 3.0 mm, 4-10 mm, Ø 76.1 x 3.6 mm"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {THICKNESS_PRESETS.map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => updatePassportField('materialThickness', th)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      state.weldingPassport?.materialThickness === th
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ochranný plyn a formování kořene */}
          <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Ochranný plyn (ČSN EN ISO 14175) *
                </label>
                <input
                  type="text"
                  value={state.weldingPassport?.shieldingGas || ''}
                  onChange={(e) => updatePassportField('shieldingGas', e.target.value)}
                  placeholder="např. Argon 4.6 (100% Ar, ISO 14175 I1)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_GASES.map((gas) => (
                    <button
                      key={gas}
                      type="button"
                      onClick={() => updatePassportField('shieldingGas', gas)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border text-left truncate max-w-[260px] ${
                        state.weldingPassport?.shieldingGas === gas
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      title={gas}
                    >
                      {gas.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[11px] font-bold text-slate-300 mb-1">
                  Ochrana kořene sváru
                </span>
                <label className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!state.weldingPassport?.rootBackingGas}
                    onChange={(e) => updatePassportField('rootBackingGas', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-200">
                      Formování kořene plynem (Root Backing Gas)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Vyžadováno pro nerezové rozvody a tlakové nádoby (ČSN EN 1090-2)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Přídavný materiál & Šarže (Traceability Atest 3.1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Přídavný materiál & číslo šarže / tavby (EN 10204 3.1) *
              </label>
              <input
                type="text"
                value={state.weldingPassport?.fillerBatch || ''}
                onChange={(e) => updatePassportField('fillerBatch', e.target.value)}
                placeholder="např. Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Uveďte výrobce, typ drátu/elektrody, průměr a číslo tavby pro shodu s TDI.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Číslo certifikátu svářeče (ČSN EN ISO 9606-1)
              </label>
              <input
                type="text"
                value={state.weldingPassport?.welderCertNumber || ''}
                onChange={(e) => updatePassportField('welderCertNumber', e.target.value)}
                placeholder="např. CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Osvědčení zkušebního orgánu (TÜV / Výzkumný ústav svářečský).
              </span>
            </div>
          </div>

          {/* Vizuální kontrola svarů (VT2 dle ČSN EN ISO 5817) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
              Vizuální kontrola svaru (VT2 / ČSN EN ISO 5817) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  code: 'passed_B' as const,
                  label: 'Stupeň B (Přísné)',
                  desc: 'Vyhovuje – přísné požadavky',
                  activeStyle: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
                },
                {
                  code: 'passed_C' as const,
                  label: 'Stupeň C (Střední)',
                  desc: 'Vyhovuje – běžné konstrukce',
                  activeStyle: 'bg-sky-500/20 border-sky-400 text-sky-300',
                },
                {
                  code: 'failed' as const,
                  label: 'NEVYHOVĚL',
                  desc: 'Zjištěny vady svaru',
                  activeStyle: 'bg-rose-500/20 border-rose-400 text-rose-300',
                },
                {
                  code: 'not_required' as const,
                  label: 'Bez VT kontroly',
                  desc: 'Není předepsáno',
                  activeStyle: 'bg-slate-800 border-slate-600 text-slate-300',
                },
              ].map((vt) => {
                const isSelected =
                  (state.weldingPassport?.weldInspectionVT || 'passed_B') === vt.code;
                return (
                  <button
                    key={vt.code}
                    type="button"
                    onClick={() => updatePassportField('weldInspectionVT', vt.code)}
                    className={`p-2 rounded-lg border text-left flex flex-col transition-all ${
                      isSelected
                        ? `${vt.activeStyle} font-bold shadow-sm`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold leading-snug">{vt.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-0.5">{vt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
});
