import React, { useState, useCallback } from 'react';
import {
  SlidersHorizontal,
  DollarSign,
  Car,
  User,
  Plus,
  Trash2,
  Save,
  Check,
  Sparkles,
  Building2,
  Search,
  Loader2,
  Layers,
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { AppSettings, ShiftPreset, ClientProfile, MaterialCatalogItem } from '../../types';
import { fetchAresData } from '../../services/aresService';
import { exportDatabaseBackupToJSON, importDatabaseBackupFromJSON } from '../../services/exportService';
import { resetToDemoData } from '../../db';
import { triggerHaptic } from '../../utils/haptics';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../../utils/toast';

const CATALOG_UNITS = ['ks', 'bal', 'm', 'kg', 'hod'];

interface RatesSettingsModalProps {
  settings: AppSettings;
  presets: ShiftPreset[];
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onSavePresets: (presets: ShiftPreset[]) => Promise<void>;
}

export const RatesSettingsModal: React.FC<RatesSettingsModalProps> = ({
  settings,
  presets,
  onSaveSettings,
  onSavePresets
}) => {
  const [activeTab, setActiveTab] = useState<'rates' | 'contractor' | 'presets' | 'catalog' | 'clients' | 'backup'>('rates');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [localPresets, setLocalPresets] = useState<ShiftPreset[]>(presets);
  const [savedAlert, setSavedAlert] = useState<boolean>(false);
  const [aresLoading, setAresLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const { showToast } = useToast();

  const handleResetData = useCallback(() => {
    setConfirmReset(true);
  }, []);

  const executeResetData = useCallback(async () => {
    try {
      await resetToDemoData();
      showToast('Ukázková data byla úspěšně obnovena', 'success');
      triggerHaptic('success');
      setConfirmReset(false);
    } catch {
      showToast('Chyba při obnově dat', 'error');
      triggerHaptic('error');
    }
  }, [showToast]);

  const handleBackupExport = useCallback(async () => {
    try {
      await exportDatabaseBackupToJSON();
      showToast('Kompletní záloha JSON byla stažena ✓', 'success');
      triggerHaptic('success');
    } catch {
      showToast('Chyba při exportu zálohy', 'error');
      triggerHaptic('error');
    }
  }, [showToast]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const success = await importDatabaseBackupFromJSON(content);
        if (success) {
          showToast('Záloha byla úspěšně nahrána ✓', 'success');
          triggerHaptic('success');
        } else {
          showToast('Chyba při obnově: neplatný soubor', 'error');
          triggerHaptic('error');
        }
      } catch {
        showToast('Chyba při obnově: neplatný soubor', 'error');
        triggerHaptic('error');
      }
    };
    reader.readAsText(file);
  }, [showToast]);

  const handleLoadAresContractor = async () => {
    if (!formData.contractor.ico) return;
    setAresLoading('contractor');
    try {
      const data = await fetchAresData(formData.contractor.ico);
      setFormData(prev => ({
        ...prev,
        contractor: {
          ...prev.contractor,
          name: data.obchodniJmeno,
          address: data.sidlo.textovaAdresa.split(',')[0] || '', // simple split
          dic: data.dic || prev.contractor.dic,
        }
      }));
      showToast('Údaje úspěšně načteny z ARES', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chyba ARES', 'error');
    } finally {
      setAresLoading(null);
    }
  };

  const handleLoadAresClient = async (clientId: string, ico: string | undefined) => {
    if (!ico) return;
    setAresLoading(clientId);
    try {
      const data = await fetchAresData(ico);
      setFormData(prev => ({
        ...prev,
        clients: prev.clients.map(c => 
          c.id === clientId 
            ? { ...c, name: data.obchodniJmeno, address: data.sidlo.textovaAdresa, dic: data.dic } 
            : c
        )
      }));
      showToast('Odběratel úspěšně načten z ARES', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chyba ARES', 'error');
    } finally {
      setAresLoading(null);
    }
  };

  const handleSettingsChange = (field: keyof AppSettings, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRateChange = (field: keyof AppSettings['rates'], value: number) => {
    setFormData(prev => ({
      ...prev,
      rates: {
        ...prev.rates,
        [field]: value
      }
    }));
  };

  const handleSurchargeChange = (field: keyof AppSettings['rates']['surcharges'], value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      rates: {
        ...prev.rates,
        surcharges: {
          ...prev.rates.surcharges,
          [field]: value
        }
      }
    }));
  };

  const handleContractorChange = (field: keyof AppSettings['contractor'], value: string) => {
    setFormData(prev => ({
      ...prev,
      contractor: {
        ...prev.contractor,
        [field]: value
      }
    }));
  };

  const handleAddClient = () => {
    const newClient: ClientProfile = {
      id: `client-${Date.now()}`,
      name: 'Nový odběratel s.r.o.',
      ico: '',
      address: '',
      contactPerson: '',
      defaultKm: 0
    };
    setFormData(prev => ({
      ...prev,
      clients: [...prev.clients, newClient]
    }));
  };

  const handleUpdateClient = (id: string, field: keyof ClientProfile, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handleRemoveClient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== id)
    }));
  };

  // Preset operations
  const handleUpdatePreset = (id: string, field: keyof ShiftPreset, value: string | number | boolean | string[]) => {
    setLocalPresets(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleAddPreset = () => {
    const newP: ShiftPreset = {
      id: `preset-${Date.now()}`,
      name: 'Nová šablona montáže',
      workType: 'site_assembly',
      baseHourlyRate: 600,
      complexityMultiplier: 1.0,
      defaultBreakMinutes: 30,
      defaultRatePerKm: formData.rates.defaultRatePerKm,
      defaultTravelHourlyRate: formData.rates.defaultTravelHourlyRate,
      weldingMethod: 'TIG',
      notesTemplate: ''
    };
    setLocalPresets(prev => [...prev, newP]);
  };

  const handleRemovePreset = (id: string) => {
    setLocalPresets(prev => prev.filter(p => p.id !== id));
  };

  // Material catalog operations (Argon, dráty, kotouče, vícepráce...)
  const handleAddCatalogItem = () => {
    const newItem: MaterialCatalogItem = {
      id: `mat-${Date.now()}`,
      name: 'Nová položka',
      unitPrice: 0,
      unit: 'ks'
    };
    setFormData(prev => ({
      ...prev,
      materialCatalog: [...prev.materialCatalog, newItem]
    }));
  };

  const handleUpdateCatalogItem = (id: string, field: keyof MaterialCatalogItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      materialCatalog: prev.materialCatalog.map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  const handleRemoveCatalogItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      materialCatalog: prev.materialCatalog.filter(m => m.id !== id)
    }));
  };

  const handleSaveAll = async () => {
    await onSaveSettings(formData);
    await onSavePresets(localPresets);
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 md:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            Konfigurace sazebníků a profilu OSVČ
          </h2>
          <p className="text-xs text-slate-400">
            Výchozí ceny, příplatky za víkendy, diety a fakturační údaje
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all self-start sm:self-auto"
          
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>ULOŽIT VŠECHNA NASTAVENÍ</span>
        </button>
      </div>

      {savedAlert && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          Veškerá nastavení a sazebníky byla úspěšně uložena do IndexedDB.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
        {[
          { id: 'rates' as const, label: 'Sazebník & Příplatky', icon: DollarSign },
          { id: 'presets' as const, label: 'Šablony zakázek (Presety)', icon: Sparkles },
          { id: 'catalog' as const, label: 'Katalog materiálu', icon: Layers },
          { id: 'contractor' as const, label: 'Profil dodavatele (OSVČ)', icon: User },
          { id: 'clients' as const, label: 'Adresář odběratelů', icon: Building2 },
          { id: 'backup' as const, label: 'Zálohování & Data', icon: Database },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{ minHeight: '40px' }}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Sazebník & Příplatky */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          {/* Základní hodinové sazby dle typu prací */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Základní hodinové sazby prací (Kč/hod)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Dílenské svařování (standard dílna)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultWorkshopRate}
                    onChange={(e) => handleRateChange('defaultWorkshopRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Montáž na stavbě (výchozí sazba)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultSiteAssemblyRate}
                    onChange={(e) => handleRateChange('defaultSiteAssemblyRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pohotovostní servis / Noční havárie
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultEmergencyRate}
                    onChange={(e) => handleRateChange('defaultEmergencyRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Čas na cestě (hodinová sazba za řízení)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultTravelHourlyRate}
                    onChange={(e) => handleRateChange('defaultTravelHourlyRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pouze cesťák (bez montáže/dílny)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultTravelOnlyRate}
                    onChange={(e) => handleRateChange('defaultTravelOnlyRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '44px' }}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Surové příplatky (Víkendy, Noční, Svátky) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Příplatky za směnu (Víkend, Noc, Svátek)
              </h3>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rates.surcharges.useFixedBonus}
                  onChange={(e) => handleSurchargeChange('useFixedBonus', e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
                />
                <span>Použít fixní Kč/h bonus místo %</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Víkendový příplatek
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.surcharges.useFixedBonus ? formData.rates.surcharges.fixedWeekendBonus : formData.rates.surcharges.weekendPercent}
                    onChange={(e) => handleSurchargeChange(
                      formData.rates.surcharges.useFixedBonus ? 'fixedWeekendBonus' : 'weekendPercent',
                      Number(e.target.value)
                    )}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                    {formData.rates.surcharges.useFixedBonus ? 'Kč/h' : '%'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Noční příplatek
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.surcharges.useFixedBonus ? formData.rates.surcharges.fixedNightBonus : formData.rates.surcharges.nightPercent}
                    onChange={(e) => handleSurchargeChange(
                      formData.rates.surcharges.useFixedBonus ? 'fixedNightBonus' : 'nightPercent',
                      Number(e.target.value)
                    )}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                    {formData.rates.surcharges.useFixedBonus ? 'Kč/h' : '%'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sváteční příplatek
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.surcharges.useFixedBonus ? formData.rates.surcharges.fixedHolidayBonus : formData.rates.surcharges.holidayPercent}
                    onChange={(e) => handleSurchargeChange(
                      formData.rates.surcharges.useFixedBonus ? 'fixedHolidayBonus' : 'holidayPercent',
                      Number(e.target.value)
                    )}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                    
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                    {formData.rates.surcharges.useFixedBonus ? 'Kč/h' : '%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cestovné & Diety */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
              <Car className="w-4 h-4 text-amber-400" />
              Náhrady za dopravu & Stravné (Diety)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Limit pro upozornění na zapomenutou směnu (h)
                </label>
                <div className="relative mb-4">
                  <input
                    type="number"
                    min={8}
                    max={24}
                    value={formData.shiftAnomalyLimitHours || 16}
                    onChange={(e) => handleSettingsChange('shiftAnomalyLimitHours', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    style={{ minHeight: '44px' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sazba za 1 km jízdy dodávkou
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.defaultRatePerKm}
                    onChange={(e) => handleRateChange('defaultRatePerKm', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč/km</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pásmo 1 (5–12 hodin)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.dietHalfDayRate}
                    onChange={(e) => handleRateChange('dietHalfDayRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pásmo 2 (12–18 hodin)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.dietFullDayRate}
                    onChange={(e) => handleRateChange('dietFullDayRate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pásmo 3 (nad 18 hodin)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.rates.dietOver18Rate ?? 398}
                    onChange={(e) => handleRateChange('dietOver18Rate', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Kč</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Presety zakázek */}
      {activeTab === 'presets' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white">Šablony zakázek pro rychlý zápis</h3>
              <p className="text-xs text-slate-400">Kliknutím na šablonu v terénu okamžitě předvyplníte správné sazby</p>
            </div>
            <button
              type="button"
              onClick={handleAddPreset}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Přidat šablonu</span>
            </button>
          </div>

          <div className="space-y-3">
            {localPresets.map((preset) => (
              <div key={preset.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={preset.name}
                    onChange={(e) => handleUpdatePreset(preset.id, 'name', e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold text-white flex-1 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePreset(preset.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    title="Smazat šablonu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Základní sazba</label>
                    <input
                      type="number"
                      value={preset.baseHourlyRate}
                      onChange={(e) => handleUpdatePreset(preset.id, 'baseHourlyRate', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Násobič náročnosti</label>
                    <input
                      type="number"
                      step="0.05"
                      value={preset.complexityMultiplier}
                      onChange={(e) => handleUpdatePreset(preset.id, 'complexityMultiplier', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Pauza (min)</label>
                    <input
                      type="number"
                      value={preset.defaultBreakMinutes}
                      onChange={(e) => handleUpdatePreset(preset.id, 'defaultBreakMinutes', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Výchozí metoda sváru</label>
                    <input
                      type="text"
                      value={preset.weldingMethod || ''}
                      onChange={(e) => handleUpdatePreset(preset.id, 'weldingMethod', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Katalog materiálu, plynů a víceprací */}
      {activeTab === 'catalog' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white">Katalog materiálu, plynů a víceprací</h3>
              <p className="text-xs text-slate-400">Položky odsud jde v zápisu směny rychle vybrat a přidat i s množstvím</p>
            </div>
            <button
              type="button"
              onClick={handleAddCatalogItem}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Přidat položku</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {formData.materialCatalog.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium border border-dashed border-slate-800 rounded-xl">
                Katalog je zatím prázdný. Přidejte první položku (např. Argon, svářecí drát, kotouče).
              </div>
            ) : (
              formData.materialCatalog.map((item) => (
                <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                    placeholder="např. Argon 4.6 / láhev"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:border-amber-500 focus:outline-none"
                    style={{ minHeight: '40px' }}
                  />
                  <div className="relative w-full sm:w-28">
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => handleUpdateCatalogItem(item.id, 'unitPrice', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2 pr-8 py-1.5 text-white font-mono font-bold"
                      style={{ minHeight: '40px' }}
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400">Kč</span>
                  </div>
                  <select
                    value={item.unit}
                    onChange={(e) => handleUpdateCatalogItem(item.id, 'unit', e.target.value)}
                    className="w-full sm:w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-semibold"
                    style={{ minHeight: '40px' }}
                  >
                    {CATALOG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveCatalogItem(item.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 flex items-center justify-center"
                    style={{ minWidth: '40px', minHeight: '40px' }}
                    title="Smazat položku"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Profil Dodavatele (OSVČ) */}
      {activeTab === 'contractor' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <User className="w-4 h-4 text-amber-400" />
            Fakturační údaje řemeslníka (OSVČ) – pro tiskový protokol A4
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Jméno a příjmení / Název</label>
              <input
                type="text"
                value={formData.contractor.name}
                onChange={(e) => handleContractorChange('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Předmět podnikání / Obor</label>
              <input
                type="text"
                value={formData.contractor.tradeTitle}
                onChange={(e) => handleContractorChange('tradeTitle', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">IČO</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.contractor.ico}
                  onChange={(e) => handleContractorChange('ico', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleLoadAresContractor}
                  disabled={aresLoading === 'contractor' || !formData.contractor.ico}
                  className="px-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 disabled:opacity-50 flex items-center justify-center transition-all"
                  title="Načíst údaje z ARES"
                >
                  {aresLoading === 'contractor' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">DIČ (pokud jste plátce DPH)</label>
              <input
                type="text"
                value={formData.contractor.dic || ''}
                onChange={(e) => handleContractorChange('dic', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Ulice a číslo</label>
              <input
                type="text"
                value={formData.contractor.address}
                onChange={(e) => handleContractorChange('address', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Město</label>
                <input
                  type="text"
                  value={formData.contractor.city}
                  onChange={(e) => handleContractorChange('city', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">PSČ</label>
                <input
                  type="text"
                  value={formData.contractor.zip}
                  onChange={(e) => handleContractorChange('zip', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Bankovní účet</label>
              <input
                type="text"
                value={formData.contractor.bankAccount}
                onChange={(e) => handleContractorChange('bankAccount', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Telefon</label>
              <input
                type="text"
                value={formData.contractor.phone}
                onChange={(e) => handleContractorChange('phone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">
                Svářečské zkoušky a certifikáty (ČSN EN ISO, certifikace, výšky)
              </label>
              <input
                type="text"
                value={formData.contractor.certifications || ''}
                onChange={(e) => handleContractorChange('certifications', e.target.value)}
                placeholder="ČSN EN ISO 9606-1 (141 TIG, 135 MAG), Vazačský průkaz, Práce ve výškách"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Adresář Odběratelů */}
      {activeTab === 'clients' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white">Adresář odběratelů a firem</h3>
              <p className="text-xs text-slate-400">Nastavení údajů firem pro tiskové protokoly</p>
            </div>
            <button
              type="button"
              onClick={handleAddClient}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nový odběratel</span>
            </button>
          </div>

          <div className="space-y-3">
            {formData.clients.map((client) => (
              <div key={client.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={client.name}
                    onChange={(e) => handleUpdateClient(client.id, 'name', e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold text-white flex-1 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveClient(client.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block">IČO</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={client.ico || ''}
                        onChange={(e) => handleUpdateClient(client.id, 'ico', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleLoadAresClient(client.id, client.ico)}
                        disabled={aresLoading === client.id || !client.ico}
                        className="px-2 bg-slate-800 text-amber-400 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center transition-all"
                        title="Načíst z ARES"
                      >
                        {aresLoading === client.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 block">Sídlo / Adresa</label>
                    <input
                      type="text"
                      value={client.address || ''}
                      onChange={(e) => handleUpdateClient(client.id, 'address', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Stavbyvedoucí / Kontakt</label>
                    <input
                      type="text"
                      value={client.contactPerson || ''}
                      onChange={(e) => handleUpdateClient(client.id, 'contactPerson', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Výchozí vzdálenost (km)</label>
                    <input
                      type="number"
                      value={client.defaultKm || 0}
                      onChange={(e) => handleUpdateClient(client.id, 'defaultKm', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block">
                      Výchozí režim § 92e PDP
                    </label>
                    <span className="text-[10px] text-slate-500 block">
                      Přenesená daňová povinnost dle § 92e ZDPH (CZ-CPA 41–43)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!client.isPdpDefault}
                    onChange={(e) => handleUpdateClient(client.id, 'isPdpDefault', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Zálohování & Data */}
      {activeTab === 'backup' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              Správa databáze a offline zálohy
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bezpečná správa vašich záznamů směn, sazebníků a fotodokumentace
            </p>
          </div>

          {/* Local storage info card */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs space-y-1">
              <span className="font-bold text-white block">100% Offline-First bezpečnost dat</span>
              <p className="text-slate-400 leading-relaxed">
                Veškerá data o zakázkách, cenách, fotkách a podpisech jsou bezpečně uložena přímo ve vašem prohlížeči (IndexedDB).
                Žádná data se neposílají na cizí servery. Pravidelným stažením JSON zálohy ochráníte svá data před nechtěným smazáním mezipaměti zařízení.
              </p>
            </div>
          </div>

          {/* Backup & Restore Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export JSON */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Download className="w-4 h-4" />
                  <span>Stáhnout zálohu databáze</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Exportuje kompletní databázi (směny, sazebníky, profily klientů i fotodokumentaci) do jednoho JSON souboru.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackupExport}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow"
                style={{ minHeight: '44px' }}
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>STÁHNOUT ZÁLOHU (JSON)</span>
              </button>
            </div>

            {/* Import JSON */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                  <Upload className="w-4 h-4" />
                  <span>Obnovit data ze zálohy</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Nahraje dříve stažený JSON soubor a obnoví veškeré záznamy a nastavení do této aplikace.
                </p>
              </div>

              <label className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-sky-300 hover:text-sky-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow"
                style={{ minHeight: '44px' }}>
                <Upload className="w-4 h-4 text-sky-400" />
                <span>OBNOVIT ZE ZÁLOHY (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset Demo Data Danger Zone */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  Obnovit ukázková data svářeče (Reset)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Vrátí databázi do výchozího stavu s ukázkovými montážemi, šablonami a certifikacemi.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetData}
                className="px-4 py-2 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto transition-colors shrink-0"
                style={{ minHeight: '40px' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Obnovit ukázku</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={confirmReset}
        title="Obnovit ukázková data?"
        message="Opravdu chcete obnovit výchozí ukázková data svářeče? Všechny úpravy budou přepsány ukázkou."
        confirmLabel="Obnovit"
        cancelLabel="Zrušit"
        variant="warning"
        onConfirm={executeResetData}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};
