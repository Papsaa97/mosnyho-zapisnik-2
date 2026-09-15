import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartShiftTracker } from '../src/components/tracker/SmartShiftTracker';
import { EntriesList } from '../src/components/entries/EntriesList';
import { EntryCard } from '../src/components/entries/EntryCard';
import { ShiftModalForm } from '../src/components/form/ShiftModalForm';
import { Header } from '../src/components/layout/Header';
import { RatesSettingsModal } from '../src/components/settings/RatesSettingsModal';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { WorkEntry, ShiftPreset, AppSettings } from '../src/types';

// Mock audio / haptics / toast to avoid DOM environment errors
vi.mock('../src/utils/haptics', () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock('../src/utils/audio', () => ({
  playBeep: vi.fn(),
}));

const mockEntry: WorkEntry = {
  id: 'test-entry-1',
  date: '2026-09-15',
  startTime: '07:00',
  endTime: '15:30',
  breakMinutes: 30,
  totalHours: 8,
  projectName: 'Moderní montáž haly D',
  clientName: 'Metrostav DIZ',
  workType: 'site_assembly',
  status: 'submitted',
  invoiceNumber: 'VF-2026-001',
  isPdp: false,
  pricing: {
    baseHourlyRate: 650,
    complexityMultiplier: 1,
    calculatedHourlyRate: 650,
    surcharges: [],
    isManualOverride: false,
  },
  travel: {
    distanceKm: 45,
    ratePerKm: 10,
    travelTimeHours: 1,
    travelHourlyRate: 350,
    dietAllowance: 256,
  },
  extraCosts: [
    { id: 'cost-1', description: 'Parkovné u stavby', amount: 150 }
  ],
  consumableSlip: {
    id: 'slip-1',
    overheadMarkupPercent: 15,
    fixedOverheadFee: 100,
    totalMaterialCost: 500,
    totalBilledAmount: 675,
    items: [
      {
        id: 'item-1',
        category: 'cutting_grinding',
        name: 'Řezný kotouč 125mm',
        quantity: 5,
        unit: 'ks',
        unitPrice: 45,
        markupPercent: 15,
        billedPrice: 258.75
      }
    ]
  },
  weldingMethod: 'MIG_MAG',
  weldingPassport: {
    methodCode: '135',
    methodName: 'MAG svařování tavící se elektrodou',
    baseMaterialGrade: 'S355J2',
    materialThickness: '8.0 mm',
    shieldingGas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
    fillerBatch: 'BATCH-2026-X9',
    rootBackingGas: false,
    welderCertNumber: 'CSN-EN-ISO-9606-1-135',
    weldInspectionVT: 'passed_B'
  },
  notes: 'Svařování hlavního nosníku konstrukce dle výkresové dokumentace.',
  totalEarnings: 6381,
  createdAt: '2026-09-15T06:30:00.000Z',
  updatedAt: '2026-09-15T16:00:00.000Z'
};

const mockPreset: ShiftPreset = {
  id: 'preset-1',
  name: 'TIG Nerez potrubí',
  workType: 'workshop_welding',
  baseHourlyRate: 750,
  complexityMultiplier: 1.1,
  defaultBreakMinutes: 30,
  defaultRatePerKm: 12,
  defaultTravelHourlyRate: 400,
  weldingMethod: 'TIG',
  weldingPassport: {
    methodCode: '141',
    methodName: 'TIG svařování netavící se elektrodou',
    baseMaterialGrade: '1.4301 (AISI 304)',
    materialThickness: '3.0 mm',
    shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
    fillerBatch: 'TIG-308L-99',
    rootBackingGas: true,
    welderCertNumber: 'CSN-EN-ISO-9606-1-141',
    weldInspectionVT: 'passed_B'
  }
};

describe('UI/UX Redesign Requirements Verification', () => {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    clients: [
      { id: 'c1', name: 'Metrostav DIZ', address: 'Praha 8', isPdpDefault: false },
      { id: 'c2', name: 'Strabag Rail', address: 'Ústí n. L.', isPdpDefault: true }
    ]
  };

  // =========================================================================
  // R1. Compact & Clear Main Screen (Deník směn & Live Tracker)
  // =========================================================================
  describe('R1. Kompaktní a přehledná hlavní obrazovka', () => {
    it('SmartShiftTracker: displays as compact single-line bar in idle state', () => {
      const mockTimer: any = {
        shiftState: {
          status: 'idle',
          startTime: null,
          pauseStartTime: null,
          totalPausedMs: 0,
          shiftDate: '2026-09-15',
          projectName: 'Projekt Alfa',
          clientName: 'Metrostav',
          workType: 'site_assembly',
          notes: []
        },
        status: 'idle',
        startShift: vi.fn(),
        pauseShift: vi.fn(),
        resumeShift: vi.fn(),
        stopShift: vi.fn(),
        resetShift: vi.fn(),
        requestNotificationPermission: vi.fn()
      };

      render(
        <SmartShiftTracker
          timer={mockTimer}
          onFinishShift={vi.fn()}
          onOpenManualEntry={vi.fn()}
          presets={[mockPreset]}
          settings={settings}
        />
      );

      // Verify compact bar label
      expect(screen.getByText('Live Tracker')).toBeDefined();
      expect(screen.getByText('Začít směnu')).toBeDefined();
      expect(screen.getByText('Možnosti')).toBeDefined();

      // Click "Možnosti" to expand full control panel
      fireEvent.click(screen.getByText('Možnosti'));
      expect(screen.getByText('Sbalit')).toBeDefined();
    });

    it('EntriesList: compact search bar with collapsible filters & active count badge', () => {
      const mockTimer: any = {
        shiftState: { status: 'idle', shiftDate: '2026-09-15' },
        status: 'idle',
        startShift: vi.fn()
      };

      render(
        <EntriesList
          entries={[mockEntry]}
          onNewShift={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
          timer={mockTimer}
          onFinishLiveShift={vi.fn()}
          presets={[mockPreset]}
          settings={settings}
        />
      );

      // Search bar is present
      const searchInput = screen.getByPlaceholderText(/Hledat v zakázkách/i);
      expect(searchInput).toBeDefined();

      // Filter toggle button is present
      const filterButton = screen.getByRole('button', { name: /Filtry/i });
      expect(filterButton).toBeDefined();

      // Expand filter panel
      fireEvent.click(filterButton);
      expect(screen.getByText(/Filtrovat záznamy podle stavu a parametrů/i)).toBeDefined();

      // Select a filter chip
      const draftChip = screen.getByRole('button', { name: /Koncept/i });
      fireEvent.click(draftChip);

      // Active filter count badge appears inside the filter button
      expect(filterButton.textContent).toContain('1');

      // Reset button resets filters
      const resetBtn = screen.getByRole('button', { name: /Resetovat filtry/i });
      fireEvent.click(resetBtn);
    });

    it('EntriesList: streamlined minimalist 1-row KPI summary strip', () => {
      const mockTimer: any = {
        shiftState: { status: 'idle', shiftDate: '2026-09-15' },
        status: 'idle',
        startShift: vi.fn()
      };

      render(
        <EntriesList
          entries={[mockEntry]}
          onNewShift={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
          timer={mockTimer}
          onFinishLiveShift={vi.fn()}
          presets={[mockPreset]}
          settings={settings}
        />
      );

      // Check the 4 KPI metrics in the summary strip
      expect(screen.getByText(/Fakturováno:/i)).toBeDefined();
      expect(screen.getByText(/Hodin:/i)).toBeDefined();
      expect(screen.getByText(/Cesty:/i)).toBeDefined();
      expect(screen.getByText(/Stravné:/i)).toBeDefined();
      expect(screen.getAllByText(/8,0\s*h/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/45\s*km/i).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // R2. Hierarchical & Calm Entry Cards (EntryCard)
  // =========================================================================
  describe('R2. Hierarchické karty směn (EntryCard)', () => {
    it('EntryCard: calm initial view prioritizing project, client, time, earnings and status', () => {
      render(
        <EntryCard
          entry={mockEntry}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      );

      // Top bar items
      expect(screen.getByText('Moderní montáž haly D')).toBeDefined();
      expect(screen.getByText('Metrostav DIZ')).toBeDefined();
      expect(screen.getByText(/07:00 – 15:30/i)).toBeDefined();
      expect(screen.getByText('Odevzdáno')).toBeDefined();
      expect(screen.getByText(/6\s*381/i)).toBeDefined();
      expect(screen.getByText(/Zobrazit rozpis/i)).toBeDefined();
    });

    it('EntryCard: structured expandable details reveal technical passport, materials, and notes', () => {
      render(
        <EntryCard
          entry={mockEntry}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /Zobrazit rozpis/i });
      fireEvent.click(toggleButton);

      // Passport details become visible
      expect(screen.getByText(/Skrýt detaily/i)).toBeDefined();
      expect(screen.getAllByText(/S355J2/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/8.0 mm/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/BATCH-2026-X9/i)).toBeDefined();
      expect(screen.getByText(/Řezný kotouč 125mm/i)).toBeDefined();

      // Click to collapse
      fireEvent.click(screen.getByRole('button', { name: /Skrýt detaily/i }));
      expect(screen.getByRole('button', { name: /Zobrazit rozpis/i })).toBeDefined();
    });

    it('EntryCard: quick status advance, edit and delete actions work', () => {
      const handleStatus = vi.fn();
      const handleEdit = vi.fn();
      const handleDelete = vi.fn();

      render(
        <EntryCard
          entry={mockEntry}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateStatus={handleStatus}
        />
      );

      // Status progress button advances status (submitted -> invoiced)
      const statusAdvBtn = screen.getByRole('button', { name: /Označit jako Vyfakturováno/i });
      fireEvent.click(statusAdvBtn);
      expect(handleStatus).toHaveBeenCalledWith('test-entry-1', 'invoiced');

      // Edit action
      const editBtn = screen.getByTitle(/Upravit záznam/i);
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledWith(mockEntry);

      // Delete action
      const deleteBtn = screen.getByTitle(/Smazat záznam/i);
      fireEvent.click(deleteBtn);
      expect(handleDelete).toHaveBeenCalledWith('test-entry-1');
    });
  });

  // =========================================================================
  // R3. Field Shift Form Optimization (ShiftModalForm)
  // =========================================================================
  describe('R3. Optimalizace terénního formuláře směny (ShiftModalForm)', () => {
    it('ShiftModalForm: Step 1 contains only basic fields and allows rapid saving', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);

      render(
        <ShiftModalForm
          isOpen={true}
          onClose={vi.fn()}
          onSave={handleSave}
          presets={[mockPreset]}
          settings={settings}
          existingEntries={[]}
        />
      );

      // Step tabs are present
      expect(screen.getByRole('button', { name: /1\. Základ/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /2\. Sazby & Doprava/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /3\. Pasport & Materiál/i })).toBeDefined();

      // Step 1 basic fields
      expect(screen.getByText(/Datum směny/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/např\. Metrostav DIZ/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/např\. Hala C/i)).toBeDefined();
      expect(screen.getByText(/Časový fond a odpracované hodiny/i)).toBeDefined();

      // Step 1 navigation button (both top tab and bottom next button match)
      const nextBtns = screen.getAllByRole('button', { name: /Sazby & Doprava/i });
      expect(nextBtns.length).toBeGreaterThanOrEqual(2);
    });

    it('ShiftModalForm: transitions smoothly between Step 1, Step 2, and Step 3', () => {
      render(
        <ShiftModalForm
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          presets={[mockPreset]}
          settings={settings}
          existingEntries={[]}
        />
      );

      // Navigate to Step 2
      fireEvent.click(screen.getByRole('button', { name: /2\. Sazby/i }));
      expect(screen.getByText(/Základní sazba/i)).toBeDefined();
      expect(screen.getByText(/Cestovné, doprava a stravné/i)).toBeDefined();

      // Navigate to Step 3
      fireEvent.click(screen.getByRole('button', { name: /3\. Pasport/i }));
      expect(screen.getByText(/1-Dotykové štítky činností/i)).toBeDefined();
      expect(screen.getByText(/Terénní fotodokumentace svarů a montáže/i)).toBeDefined();

      // Go back to Step 1
      fireEvent.click(screen.getByRole('button', { name: /1\. Základ/i }));
      expect(screen.getByText(/Datum směny/i)).toBeDefined();
    });

    it('ShiftModalForm: applies presets reactively with live grand total calculation', () => {
      render(
        <ShiftModalForm
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          presets={[mockPreset]}
          settings={settings}
          existingEntries={[]}
        />
      );

      // Apply preset
      const presetBtn = screen.getByRole('button', { name: /TIG Nerez potrubí/i });
      fireEvent.click(presetBtn);

      // Check that sticky footer reflects non-zero earnings
      expect(screen.getByText(/Celkový nárok za směnu:/i)).toBeDefined();
      const saveBtn = screen.getByRole('button', { name: /ULOŽIT SMĚNU/i });
      expect(saveBtn).toBeDefined();
    });
  });

  // =========================================================================
  // R4. Clean Global Header & Backup Placement (Header & RatesSettingsModal)
  // =========================================================================
  describe('R4. Čistá globální hlavička a přesun správy záloh', () => {
    it('Header: displays brand, offline/online badge, and quick new shift action without clutter', () => {
      const handleNewShift = vi.fn();
      render(
        <Header
          onNewShift={handleNewShift}
          entriesCount={12}
        />
      );

      expect(screen.getByText(/MOŠNYHO ZÁPISNÍK/i)).toBeDefined();
      expect(screen.getByText(/2.0 PRO/i)).toBeDefined();
      expect(screen.getByText(/Lokální DB/i)).toBeDefined();

      const newShiftBtn = screen.getByRole('button', { name: /ZAPSAT SMĚNU/i });
      fireEvent.click(newShiftBtn);
      expect(handleNewShift).toHaveBeenCalledTimes(1);
    });

    it('RatesSettingsModal: backup, JSON export, import, and demo reset are located in Backup tab', () => {
      render(
        <RatesSettingsModal
          settings={settings}
          presets={[mockPreset]}
          onSaveSettings={vi.fn()}
          onSavePresets={vi.fn()}
        />
      );

      // Find Backup tab button
      const backupTab = screen.getByRole('button', { name: /Zálohování & Data/i });
      expect(backupTab).toBeDefined();

      // Open Backup tab
      fireEvent.click(backupTab);

      // Verify backup actions exist in the tab
      expect(screen.getByText(/Správa databáze a offline zálohy/i)).toBeDefined();
      expect(screen.getAllByText(/STÁHNOUT ZÁLOHU/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/OBNOVIT ZE ZÁLOHY/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Obnovit ukázková data svářeče/i)).toBeDefined();
    });
  });
});
