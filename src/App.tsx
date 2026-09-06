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

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('entries');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);

  // Initialize DB once on start
  useEffect(() => {
    initializeDatabase();
  }, []);

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
    setIsShiftModalOpen(true);
  };

  const handleEditEntry = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setIsShiftModalOpen(true);
  };

  const handleSaveEntry = async (entry: WorkEntry) => {
    await db.entries.put(entry);
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('Opravdu chcete smazat tento záznam směny?')) {
      await db.entries.delete(id);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: WorkEntryStatus) => {
    await db.entries.update(id, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
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
          }}
          onSave={handleSaveEntry}
          editingEntry={editingEntry}
          presets={presets}
          settings={settings}
          existingEntries={entries}
        />
      )}
    </div>
  );
}

export default App;
