import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { WorkEntry, WorkEntryStatus, AppSettings, ShiftPreset } from './types';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS } from './db/seedData';
import { Header } from './components/layout/Header';
import { Navigation, ActiveTab } from './components/layout/Navigation';
import { EntriesList } from './components/entries/EntriesList';
import { ShiftModalForm } from './components/form/ShiftModalForm';
import { InvoiceReportView } from './components/report/InvoiceReportView';
import { StatsDashboard } from './components/dashboard/StatsDashboard';
import { RatesSettingsModal } from './components/settings/RatesSettingsModal';
import { useShiftTimer } from './hooks/useShiftTimer';
import { triggerHaptic } from './utils/haptics';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('entries');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<WorkEntry> | null>(null);

  // Live Shift Tracker hook with localStorage persistence & haptics
  const shiftTimer = useShiftTimer();

  // Initialize DB once on start
  useEffect(() => {
    initializeDatabase();
  }, []);

  // Handle PWA shortcuts from URL parameter (?action=start_shift, ?action=toggle_pause, ?action=manual_entry)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    if (action) {
      if (action === 'start_shift') {
        if (shiftTimer.status === 'idle') {
          shiftTimer.startShift();
        }
      } else if (action === 'toggle_pause') {
        if (shiftTimer.status === 'running') {
          shiftTimer.pauseShift();
        } else if (shiftTimer.status === 'paused') {
          shiftTimer.resumeShift();
        }
      } else if (action === 'manual_entry') {
        setEditingEntry(null);
        setInitialFormValues(null);
        setIsShiftModalOpen(true);
      }

      // Clear query params without reloading the page
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [shiftTimer]);

  // Reactive queries from IndexedDB
  const entries = useLiveQuery(() => db.entries.toArray(), []) || [];
  const presets = useLiveQuery(() => db.presets.toArray(), []) || DEFAULT_PRESETS;
  const settingsList = useLiveQuery(() => db.settings.toArray(), []) || [];
  const settings: AppSettings = settingsList[0] || DEFAULT_SETTINGS;

  // Count items ready for billing
  const pendingInvoiceCount = entries.filter(e => e.status === 'submitted').length;

  // Handlers
  const handleOpenNewShift = () => {
    setEditingEntry(null);
    setInitialFormValues(null);
    setIsShiftModalOpen(true);
  };

  const handleEditEntry = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setInitialFormValues(null);
    setIsShiftModalOpen(true);
  };

  // Called when Live Tracker finishes shift (direct or via SmartCheckout)
  const handleFinishLiveShift = (checkoutData: any) => {
    if (!checkoutData) return;

    setEditingEntry(null);
    setInitialFormValues({
      date: checkoutData.date,
      startTime: checkoutData.startTime,
      endTime: checkoutData.endTime,
      breakMinutes: checkoutData.breakMinutes,
      clientName: checkoutData.clientName,
      projectName: checkoutData.projectName,
      projectCode: checkoutData.projectCode,
      workType: checkoutData.workType,
      weldingMethod: checkoutData.weldingMethod,
      notes: checkoutData.notes,
      timeline: checkoutData.events
    });
    setIsShiftModalOpen(true);
  };

  const handleSaveEntry = async (entry: WorkEntry) => {
    await db.entries.put(entry);
    triggerHaptic('success');

    // If the saved entry came from the currently running live shift, reset the live shift tracker
    if (shiftTimer.status !== 'idle') {
      shiftTimer.resetShift();
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('Opravdu chcete smazat tento záznam směny?')) {
      await db.entries.delete(id);
      triggerHaptic('medium');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: WorkEntryStatus) => {
    await db.entries.update(id, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    triggerHaptic('light');
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await db.settings.put(newSettings);
  };

  const handleSavePresets = async (newPresets: ShiftPreset[]) => {
    await db.transaction('rw', db.presets, async () => {
      await db.presets.clear();
      await db.presets.bulkPut(newPresets);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        onNewShift={handleOpenNewShift}
        onOpenSettings={() => setActiveTab('settings')}
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
    </div>
  );
}

export default App;
