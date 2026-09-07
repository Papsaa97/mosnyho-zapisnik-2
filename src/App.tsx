import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { WorkEntry, WorkEntryStatus, AppSettings, ShiftPreset, ShiftCheckoutData } from './types';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS } from './db/seedData';
import { Header } from './components/layout/Header';
import { Navigation, ActiveTab } from './components/layout/Navigation';
import { EntriesList } from './components/entries/EntriesList';
import { ShiftModalForm } from './components/form/ShiftModalForm';
import { InvoiceReportView } from './components/report/InvoiceReportView';
import { StatsDashboard } from './components/dashboard/StatsDashboard';
import { RatesSettingsModal } from './components/settings/RatesSettingsModal';
import { SmartCheckoutModal } from './components/tracker/SmartCheckoutModal';
import { useShiftTimer } from './hooks/useShiftTimer';
import { triggerHaptic } from './utils/haptics';
import { useToast } from './utils/toastContext';

// Stable references so useLiveQuery's "not loaded yet" fallback doesn't
// produce a brand-new array on every render (which would defeat useMemo).
const EMPTY_ENTRIES: WorkEntry[] = [];
const EMPTY_SETTINGS_LIST: AppSettings[] = [];

export function App() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('entries');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<WorkEntry> | null>(null);
  const [appSmartCheckoutData, setAppSmartCheckoutData] = useState<ShiftCheckoutData | null>(null);

  // Live Shift Tracker hook with localStorage persistence & haptics
  const settingsList = useLiveQuery(() => db.settings.toArray(), []) || EMPTY_SETTINGS_LIST;
  const settings: AppSettings = useMemo(() => {
    const stored = settingsList[0];
    if (!stored) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      rates: {
        ...DEFAULT_SETTINGS.rates,
        ...stored.rates,
        surcharges: { ...DEFAULT_SETTINGS.rates.surcharges, ...stored.rates?.surcharges }
      },
      contractor: { ...DEFAULT_SETTINGS.contractor, ...stored.contractor }
    };
  }, [settingsList]);
  const shiftTimer = useShiftTimer(settings.shiftAnomalyLimitHours || 16);

  // Initialize DB once on start
  useEffect(() => {
    initializeDatabase();
  }, []);

  // Called when Live Tracker finishes shift (direct or via SmartCheckout)
  const handleFinishLiveShift = useCallback((checkoutData: ShiftCheckoutData) => {
    if (!checkoutData) return;

    setEditingEntry(null);
    setInitialFormValues({
      date: checkoutData.date,
      startTime: checkoutData.startTime,
      endTime: checkoutData.endTime,
      breakMinutes: checkoutData.breakMinutes,
      clientName: checkoutData.clientName,
      projectName: checkoutData.projectName,
      workType: checkoutData.workType,
      weldingMethod: checkoutData.weldingMethod,
      notes: checkoutData.notes,
      timeline: checkoutData.events
    });
    setIsShiftModalOpen(true);
  }, []);

  const handleAppSmartCheckoutConfirm = useCallback((adjusted: {
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    correctionNote: string;
  }) => {
    const data = appSmartCheckoutData;
    setAppSmartCheckoutData(null);
    if (!data) return;

    const adjustedData: ShiftCheckoutData = {
      ...data,
      date: adjusted.date,
      startTime: adjusted.startTime,
      endTime: adjusted.endTime,
      breakMinutes: adjusted.breakMinutes,
      notes: `${data.notes}\n\n${adjusted.correctionNote}`
    };

    handleFinishLiveShift(adjustedData);
  }, [appSmartCheckoutData, handleFinishLiveShift]);

  // Handle actions triggered from iOS Shortcuts / home-screen widgets via a
  // "?akce=" URL parameter (also used by the PWA manifest shortcuts below).
  // This synchronizes with an external system (the launch URL) right after
  // mount – it can't be an event handler since no user action fires it.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action') || urlParams.get('akce');

    if (action) {
      if (action === 'start_shift' || action === 'start') {
        if (shiftTimer.status === 'idle') {
          shiftTimer.startShift();
          showToast('Směna zahájena', 'success');
        }
      } else if (action === 'end_shift' || action === 'stop') {
        if (shiftTimer.status !== 'idle') {
          const data = shiftTimer.getShiftCheckoutData();
          if (data) {
            if (data.isAnomaly) {
              // oxlint-disable-next-line react/set-state-in-effect
              setAppSmartCheckoutData(data);
            } else {
              handleFinishLiveShift(data);
            }
          }
        }
      } else if (action === 'toggle_pause' || action === 'pauza') {
        if (shiftTimer.status === 'running') {
          shiftTimer.pauseShift();
        } else if (shiftTimer.status === 'paused') {
          shiftTimer.resumeShift();
        }
      } else if (action === 'manual_entry' || action === 'novy') {
        setEditingEntry(null);
        setInitialFormValues(null);
        setIsShiftModalOpen(true);
      }

      // Clear the query param so a page refresh (F5) doesn't repeat the action
      window.history.replaceState({}, '', '/');
    }
  }, [shiftTimer, handleFinishLiveShift, showToast]);

  // Reactive queries from IndexedDB
  const entries = useLiveQuery(() => db.entries.toArray(), []) || EMPTY_ENTRIES;
  const presets = useLiveQuery(() => db.presets.toArray(), []) || DEFAULT_PRESETS;


  // Count items ready for billing
  const pendingInvoiceCount = useMemo(
    () => entries.filter(e => e.status === 'submitted').length,
    [entries]
  );

  // Handlers
  const handleOpenNewShift = useCallback(() => {
    setEditingEntry(null);
    setInitialFormValues(null);
    setIsShiftModalOpen(true);
  }, []);

  const handleEditEntry = useCallback((entry: WorkEntry) => {
    setEditingEntry(entry);
    setInitialFormValues(null);
    setIsShiftModalOpen(true);
  }, []);

  const handleSaveEntry = useCallback(async (entry: WorkEntry) => {
    try {
      await db.entries.put(entry);
      triggerHaptic('success');
      showToast('Směna byla uložena ✓', 'success');

      // If the saved entry came from the currently running live shift, reset the live shift tracker
      if (shiftTimer.status !== 'idle') {
        shiftTimer.resetShift();
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
      showToast('Chyba při ukládání záznamu', 'error');
      triggerHaptic('error');
    }
  }, [shiftTimer, showToast]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    if (window.confirm('Opravdu chcete smazat tento záznam směny?')) {
      try {
        await db.entries.delete(id);
        triggerHaptic('medium');
        showToast('Záznam byl smazán', 'warning');
      } catch (err) {
        console.error('Failed to delete entry:', err);
        showToast('Chyba při mazání záznamu', 'error');
      }
    }
  }, [showToast]);

  const handleUpdateStatus = useCallback(async (id: string, newStatus: WorkEntryStatus) => {
    try {
      await db.entries.update(id, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      triggerHaptic('light');
      const statusLabels: Record<WorkEntryStatus, string> = {
        draft: 'Vráceno do konceptu',
        submitted: 'Označeno jako odevzdáno',
        invoiced: 'Označeno jako vyfakturováno',
        paid: 'Označeno jako zaplaceno ✓'
      };
      showToast(statusLabels[newStatus] || 'Stav byl aktualizován', 'info');
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast('Chyba při aktualizaci stavu', 'error');
    }
  }, [showToast]);

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await db.settings.put(newSettings);
      showToast('Nastavení bylo uloženo ✓', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Chyba při ukládání nastavení', 'error');
    }
  }, [showToast]);

  const handleSavePresets = useCallback(async (newPresets: ShiftPreset[]) => {
    try {
      await db.transaction('rw', db.presets, async () => {
        await db.presets.clear();
        await db.presets.bulkPut(newPresets);
      });
      showToast('Presety byly uloženy ✓', 'success');
    } catch (err) {
      console.error('Failed to save presets:', err);
      showToast('Chyba při ukládání presetů', 'error');
    }
  }, [showToast]);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        onNewShift={handleOpenNewShift}
        entriesCount={entries.length}
      />

      {/* Navigation (Desktop subheader & Mobile fixed bottom) */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingInvoiceCount={pendingInvoiceCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {activeTab === 'entries' && (
          <EntriesList
            entries={entries}
            onNewShift={handleOpenNewShift}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            onUpdateStatus={handleUpdateStatus}
            timer={shiftTimer}
            onFinishLiveShift={handleFinishLiveShift}
            presets={presets}
            settings={settings}
          />
        )}

        {activeTab === 'report' && (
          <InvoiceReportView
            entries={entries}
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeTab === 'pipeline' && (
          <StatsDashboard
            entries={entries}
            onUpdateStatus={handleUpdateStatus}
            onEdit={handleEditEntry}
          />
        )}

        {activeTab === 'settings' && (
          <RatesSettingsModal
            settings={settings}
            presets={presets}
            onSaveSettings={handleSaveSettings}
            onSavePresets={handleSavePresets}
          />
        )}
      </main>

      {/* Shift Form Modal */}
      {isShiftModalOpen && (
        <ShiftModalForm
          isOpen={isShiftModalOpen}
          onClose={() => {
            setIsShiftModalOpen(false);
            setEditingEntry(null);
            setInitialFormValues(null);
          }}
          onSave={handleSaveEntry}
          editingEntry={editingEntry}
          initialValues={initialFormValues}
          presets={presets}
          settings={settings}
          existingEntries={entries}
        />
      )}

      {/* Smart Checkout Modal triggered by the "?akce=stop" shortcut */}
      {appSmartCheckoutData && (
        <SmartCheckoutModal
          isOpen={Boolean(appSmartCheckoutData)}
          onClose={() => setAppSmartCheckoutData(null)}
          data={appSmartCheckoutData}
          onConfirmAdjusted={handleAppSmartCheckoutConfirm}
          onDiscardShift={() => {
            setAppSmartCheckoutData(null);
            shiftTimer.resetShift();
          }}
        />
      )}
    </div>
  );
}

export default App;
