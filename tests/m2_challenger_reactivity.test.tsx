import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { useReducer } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  shiftFormReducer, 
  createInitialState 
} from '../src/components/form/shiftFormReducer';
import { ProjectSection } from '../src/components/form/sections/ProjectSection';
import { EntryCard } from '../src/components/entries/EntryCard';
import { InvoiceReportView } from '../src/components/report/InvoiceReportView';
import { TechnicalPassportService } from '../src/services/weldingPassportService';
import { 
  AppSettings, 
  WorkEntry, 
  WeldingPassport 
} from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { createIsolatedTestDb } from './helpers/dbHelper';

describe('Milestone M2 Adversarial Challenger 2 (UI Reactivity, Form State, Persistence & Report Rendering)', () => {
  const testSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    contractor: {
      name: 'Pavel Svářeč',
      tradeTitle: 'Certifikovaný svářeč & potrubář',
      ico: '12345678',
      dic: 'CZ12345678',
      address: 'Průmyslová 10',
      city: 'Brno',
      zip: '60200',
      bankAccount: '123456789/0800',
      iban: 'CZ6508000000000123456789',
      phone: '+420 777 111 222',
      email: 'pavel.svarec@example.cz',
      certifications: 'ČSN EN ISO 9606-1 (141 T BW FM5 S s3.0 D50 H-L045)',
    },
    clients: [
      {
        id: 'c1',
        name: 'Metrostav DIZ s.r.o.',
        ico: '00014915',
        dic: 'CZ00014915',
        address: 'Koželužská 2450/4, 180 00 Praha 8',
        contactPerson: 'Ing. Jan Stavbyvedoucí',
        isPdpDefault: true,
      },
      {
        id: 'c2',
        name: 'Kovo Novák s.r.o.',
        ico: '87654321',
        dic: 'CZ87654321',
        address: 'Dílenská 12, Brno',
        contactPerson: 'Petr Novák',
        isPdpDefault: false,
      },
    ],
  };

  // Helper component to mount ProjectSection with reducer
  function ProjectSectionTestHarness({ 
    initialEntry = null,
    initialValues = null,
  }: { 
    initialEntry?: WorkEntry | null;
    initialValues?: Partial<WorkEntry> | null;
  }) {
    const [state, dispatch] = useReducer(
      shiftFormReducer,
      createInitialState(initialEntry, initialValues, testSettings)
    );

    return (
      <div>
        <div data-testid="current-method">{state.weldingMethod}</div>
        <div data-testid="current-passport-method">{state.weldingPassport?.methodCode || 'NONE'}</div>
        <div data-testid="current-material">{state.weldingPassport?.baseMaterialGrade || ''}</div>
        <div data-testid="current-thickness">{state.weldingPassport?.materialThickness || ''}</div>
        <div data-testid="current-gas">{state.weldingPassport?.shieldingGas || ''}</div>
        <div data-testid="current-root-backing">{state.weldingPassport?.rootBackingGas ? 'true' : 'false'}</div>
        <div data-testid="current-filler">{state.weldingPassport?.fillerBatch || ''}</div>
        <div data-testid="current-vt">{state.weldingPassport?.weldInspectionVT || ''}</div>
        <div data-testid="current-cert">{state.weldingPassport?.welderCertNumber || ''}</div>

        <ProjectSection
          state={state}
          dispatch={dispatch}
          clientSuggestions={['Metrostav DIZ s.r.o.', 'Kovo Novák s.r.o.']}
          projectSuggestions={['Hala C – potrubí', 'Most ev.č. 201']}
          clients={testSettings.clients}
        />
      </div>
    );
  }

  // =========================================================================
  // 1. UI Method Switching & Reactivity Stress Testing
  // =========================================================================
  describe('1. UI Method Switching & Reactivity (ProjectSection & Reducer)', () => {
    it('verifies initial form state synchronization (weldingMethod TIG with active default weldingPassport 141)', () => {
      // 1. Brand new entry without pre-filled values:
      // Reducer sets weldingMethod: 'TIG', and synchronizes weldingPassport to active 141 TIG passport
      const { unmount } = render(<ProjectSectionTestHarness />);
      expect(screen.getByTestId('current-method').textContent).toBe('TIG');
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141');
      // Passport box is active initially because TechnicalPassportService.shouldRenderPassport(initialWeldingPassport) is true
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();

      // Clicking 141 TIG button keeps the passport active in form state
      const tigBtn = screen.getByRole('button', { name: '141 TIG' });
      fireEvent.click(tigBtn);
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141');
      expect(screen.getByTestId('current-material').textContent).toBe('1.4301');
      expect(screen.getByTestId('current-thickness').textContent).toBe('3.0 mm');
      expect(screen.getByTestId('current-gas').textContent).toContain('Argon 4.6');
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();

      unmount();

      // 2. Pre-filled entry with weldingMethod: 'TIG' creates active initial passport
      render(<ProjectSectionTestHarness initialValues={{ weldingMethod: 'TIG' }} />);
      expect(screen.getByTestId('current-method').textContent).toBe('TIG');
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141');
      expect(screen.getByTestId('current-material').textContent).toBe('1.4301');
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();
    });

    it('simulates rapid switching 141 -> NONE -> 135 -> NONE and verifies collapse and absence of stale N/A data', () => {
      // Start with active 141 TIG passport
      render(<ProjectSectionTestHarness initialValues={{ weldingMethod: 'TIG' }} />);

      // Step 1: Initial state is 141
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141');
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();

      // Customize some fields while on 141
      const fillerInput = screen.getByPlaceholderText(/např. Böhler Thermanit/i);
      fireEvent.change(fillerInput, { target: { value: 'Böhler Thermanit GE-316L, šarže #849102' } });
      expect(screen.getByTestId('current-filler').textContent).toBe('Böhler Thermanit GE-316L, šarže #849102');

      // Step 2: Switch to NONE ("Bez sváru")
      const noneBtn = screen.getByRole('button', { name: 'Bez sváru' });
      fireEvent.click(noneBtn);

      // Verify that selecting NONE collapses the passport and sets clean placeholder/disabled state
      expect(screen.getByTestId('current-method').textContent).toBe('NONE');
      expect(screen.getByTestId('current-passport-method').textContent).toBe('NONE');
      expect(screen.getByTestId('current-material').textContent).toBe('N/A');
      expect(screen.getByTestId('current-thickness').textContent).toBe('N/A');
      expect(screen.getByTestId('current-gas').textContent).toBe('N/A');
      expect(screen.getByTestId('current-filler').textContent).toBe('N/A');
      expect(screen.getByTestId('current-root-backing').textContent).toBe('false');
      expect(screen.getByTestId('current-vt').textContent).toBe('not_required');

      // Crucial: Passport card must be completely removed from DOM
      expect(screen.queryByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeNull();

      // Step 3: Switch to 135 MAG
      const magBtn = screen.getByRole('button', { name: '135 MAG' });
      fireEvent.click(magBtn);

      // Passport section reappears
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();
      expect(screen.getByTestId('current-method').textContent).toBe('MIG_MAG');
      expect(screen.getByTestId('current-passport-method').textContent).toBe('135');

      // Crucial: Stale 'N/A' strings from NONE MUST NOT contaminate restored passport
      expect(screen.getByTestId('current-material').textContent).toBe('S355J2');
      expect(screen.getByTestId('current-thickness').textContent).toBe('3.0 mm');
      expect(screen.getByTestId('current-gas').textContent).toContain('CORGON 18');
      expect(screen.getByTestId('current-filler').textContent).toBe('');
      // VT inspection resets to standard 'passed_B' from 'not_required' after leaving NONE
      expect(screen.getByTestId('current-vt').textContent).toBe('passed_B');

      // Step 4: Switch to NONE again
      fireEvent.click(screen.getByRole('button', { name: 'Bez sváru' }));
      expect(screen.queryByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeNull();
      expect(screen.getByTestId('current-passport-method').textContent).toBe('NONE');

      // Step 5: Switch to multi-process 141/135 TIG+MAG
      const combinedBtn = screen.getByRole('button', { name: '141/135 TIG+MAG' });
      fireEvent.click(combinedBtn);
      expect(screen.getByText(/Technický & svářečský pasport \(ČSN EN 1090-2\)/i)).toBeDefined();
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141_135');
      expect(screen.getByTestId('current-method').textContent).toBe('COMBINED');
    });

    it('empirically tests Auto-doporučit plyn behavior and reveals closure overwrite bug', () => {
      // Start with active 141 TIG passport on stainless 1.4301
      render(<ProjectSectionTestHarness initialValues={{ weldingMethod: 'TIG' }} />);

      // On 141 TIG, default material 1.4301 is stainless steel
      // Click Auto-doporučit plyn
      const autoRecBtn = screen.getByRole('button', { name: /Auto-doporučit plyn/i });
      fireEvent.click(autoRecBtn);

      // Stainless requires backing gas and 100% Argon
      expect(screen.getByTestId('current-gas').textContent).toContain('Argon 4.6');
      expect(screen.getByTestId('current-root-backing').textContent).toBe('true');

      // Switch material to S355J2 (carbon steel)
      const s355Chip = screen.getByRole('button', { name: 'S355J2' });
      fireEvent.click(s355Chip);
      expect(screen.getByTestId('current-material').textContent).toBe('S355J2');

      // Click Auto-doporučit plyn again
      fireEvent.click(autoRecBtn);
      // For carbon steel TIG, root backing is false
      expect(screen.getByTestId('current-root-backing').textContent).toBe('false');
    });

    it('verifies atomic update in handleAutoRecommendGas without closure clobbering', () => {
      // Setup initial state: 135 MAG, but holding stale gas 'Argon 4.6' and rootBackingGas: true
      const initialEntry: Partial<WorkEntry> = {
        weldingMethod: 'MIG_MAG',
        weldingPassport: {
          methodCode: '135',
          baseMaterialGrade: 'S355J2',
          materialThickness: '5.0 mm',
          shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
          fillerBatch: 'ESAB #123',
          rootBackingGas: true,
          weldInspectionVT: 'passed_B',
        }
      };

      render(<ProjectSectionTestHarness initialValues={initialEntry} />);

      expect(screen.getByTestId('current-passport-method').textContent).toBe('135');
      expect(screen.getByTestId('current-gas').textContent).toBe('Argon 4.6 (100% Ar, ISO 14175 I1)');
      expect(screen.getByTestId('current-root-backing').textContent).toBe('true');

      // Click Auto-doporučit plyn
      // Expected: gas becomes CORGON 18 and rootBacking becomes false atomically in one render
      const autoRecBtn = screen.getByRole('button', { name: /Auto-doporučit plyn/i });
      fireEvent.click(autoRecBtn);

      // Root backing was successfully updated to false:
      expect(screen.getByTestId('current-root-backing').textContent).toBe('false');

      // Shielding gas is atomically updated and NOT clobbered:
      const actualGas = screen.getByTestId('current-gas').textContent;
      expect(actualGas).toContain('CORGON 18');
      expect(actualGas).not.toBe('Argon 4.6 (100% Ar, ISO 14175 I1)');
    });

    it('re-recommends shielding gas on direct welding method switch (e.g. 141 TIG -> 135 MAG)', () => {
      // Start with 141 TIG on S355J2 with Argon 4.6
      const initialEntry: Partial<WorkEntry> = {
        weldingMethod: 'TIG',
        weldingPassport: {
          methodCode: '141',
          baseMaterialGrade: 'S355J2',
          materialThickness: '3.0 mm',
          shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
          fillerBatch: '',
          rootBackingGas: false,
          weldInspectionVT: 'passed_B',
        }
      };

      render(<ProjectSectionTestHarness initialValues={initialEntry} />);
      expect(screen.getByTestId('current-passport-method').textContent).toBe('141');
      expect(screen.getByTestId('current-gas').textContent).toContain('Argon 4.6');

      // Switch directly to 135 MAG without going through NONE
      const magBtn = screen.getByRole('button', { name: '135 MAG' });
      fireEvent.click(magBtn);

      expect(screen.getByTestId('current-passport-method').textContent).toBe('135');
      // Should automatically recommend CORGON 18 for MAG instead of keeping stale Argon 4.6
      expect(screen.getByTestId('current-gas').textContent).toContain('CORGON 18');
    });

    it('updates thickness presets, base material presets, and VT visual inspection rating', () => {
      // Start with active 141 TIG passport
      render(<ProjectSectionTestHarness initialValues={{ weldingMethod: 'TIG' }} />);

      // Click base material preset chip 'HARDOX 450'
      const hardoxBtn = screen.getByRole('button', { name: 'HARDOX 450' });
      fireEvent.click(hardoxBtn);
      expect(screen.getByTestId('current-material').textContent).toBe('HARDOX 450');

      // Click thickness preset chip '12.0 mm'
      const thickBtn = screen.getByRole('button', { name: '12.0 mm' });
      fireEvent.click(thickBtn);
      expect(screen.getByTestId('current-thickness').textContent).toBe('12.0 mm');

      // Click VT inspection degree 'Stupeň C (Střední)'
      const vtCBtn = screen.getByRole('button', { name: /Stupeň C/i });
      fireEvent.click(vtCBtn);
      expect(screen.getByTestId('current-vt').textContent).toBe('passed_C');

      // Click VT inspection degree 'NEVYHOVĚL'
      const vtFailedBtn = screen.getByRole('button', { name: /NEVYHOVĚL/i });
      fireEvent.click(vtFailedBtn);
      expect(screen.getByTestId('current-vt').textContent).toBe('failed');

      // Toggle Root Backing Gas checkbox manually
      const backingCheckbox = screen.getByLabelText(/Formování kořene plynem/i);
      fireEvent.click(backingCheckbox);
      expect(screen.getByTestId('current-root-backing').textContent).toBe('true');
      fireEvent.click(backingCheckbox);
      expect(screen.getByTestId('current-root-backing').textContent).toBe('false');
    });
  });

  // =========================================================================
  // 2. Form Submission & Dexie Persistence Roundtrip
  // =========================================================================
  describe('2. Form Submission & Dexie Persistence Roundtrip', () => {
    let testDb: ReturnType<typeof createIsolatedTestDb>;

    beforeEach(() => {
      testDb = createIsolatedTestDb('ChallengerM2Db');
    });

    afterEach(async () => {
      await testDb.cleanup();
    });

    it('saves entry with full WeldingPassport, retrieves it and asserts types and invariants', async () => {
      const passport: WeldingPassport = {
        methodCode: '141',
        methodName: 'Obloukové svařování TIG (ČSN EN ISO 4063: 141)',
        baseMaterialGrade: '1.4404 (AISI 316L)',
        materialThickness: '3.0 mm',
        shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
        fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
        rootBackingGas: true,
        welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
        weldInspectionVT: 'passed_B',
      };

      const entry: WorkEntry = {
        id: 'entry-welding-01',
        date: '2026-05-10',
        projectCode: 'POTRUBI-DN150',
        projectName: 'Montáž a svařování nerezového potrubí DN150',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '17:00',
        breakMinutes: 30,
        totalHours: 9.5,
        pricing: {
          baseHourlyRate: 650,
          complexityMultiplier: 1.0,
          shiftSurcharges: [],
          calculatedHourlyRate: 650,
        },
        travel: {
          distanceKm: 25,
          ratePerKm: 11,
          travelTimeHours: 0.5,
          travelHourlyRate: 350,
          dietAllowance: 166,
          dietType: 'band_1',
        },
        extraCosts: [],
        totalEarnings: 9.5 * 650 + 25 * 11 + 0.5 * 350 + 166,
        status: 'submitted',
        notes: 'Sváry kontrolovány VT2, plně vyhovují.',
        weldingMethod: 'TIG',
        weldingPassport: passport,
        isPdp: true,
        createdAt: '2026-05-10T18:00:00Z',
        updatedAt: '2026-05-10T18:00:00Z',
      };

      // Put to Dexie
      await testDb.instance.entries.put(entry);

      // Read back
      const retrieved = await testDb.instance.entries.get('entry-welding-01');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('entry-welding-01');
      expect(retrieved?.weldingPassport).toBeDefined();
      expect(retrieved?.weldingPassport?.methodCode).toBe('141');
      expect(retrieved?.weldingPassport?.baseMaterialGrade).toBe('1.4404 (AISI 316L)');
      expect(retrieved?.weldingPassport?.materialThickness).toBe('3.0 mm');
      expect(retrieved?.weldingPassport?.shieldingGas).toContain('Argon 4.6');
      expect(retrieved?.weldingPassport?.rootBackingGas).toBe(true);
      expect(retrieved?.weldingPassport?.fillerBatch).toBe('Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102');
      expect(retrieved?.weldingPassport?.weldInspectionVT).toBe('passed_B');
      expect(retrieved?.weldingPassport?.welderCertNumber).toBe('CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045');

      // Verify shouldRenderPassport
      expect(TechnicalPassportService.shouldRenderPassport(retrieved?.weldingPassport)).toBe(true);
    });

    it('saves non-welding shift with methodCode NONE, verifying persistence and shouldRenderPassport false', async () => {
      const nonWeldingPassport: WeldingPassport = {
        methodCode: 'NONE',
        methodName: 'Bez sváru – čistá zámečnická montáž',
        baseMaterialGrade: 'N/A',
        materialThickness: 'N/A',
        shieldingGas: 'N/A',
        fillerBatch: 'N/A',
        rootBackingGas: false,
        weldInspectionVT: 'not_required',
      };

      const entry: WorkEntry = {
        id: 'entry-locksmith-01',
        date: '2026-05-11',
        projectCode: 'MONT-01',
        projectName: 'Zámečnická montáž kotevních patek',
        clientName: 'Kovo Novák s.r.o.',
        workType: 'site_assembly',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 30,
        totalHours: 7.5,
        pricing: {
          baseHourlyRate: 500,
          complexityMultiplier: 1.0,
          shiftSurcharges: [],
          calculatedHourlyRate: 500,
        },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 166,
          dietType: 'band_1',
        },
        extraCosts: [],
        totalEarnings: 7.5 * 500 + 166,
        status: 'draft',
        notes: 'Pouze mechanické kotvení do betonu M16',
        weldingMethod: 'NONE',
        weldingPassport: nonWeldingPassport,
        isPdp: false,
        createdAt: '2026-05-11T16:30:00Z',
        updatedAt: '2026-05-11T16:30:00Z',
      };

      await testDb.instance.entries.put(entry);

      const retrieved = await testDb.instance.entries.get('entry-locksmith-01');
      expect(retrieved).toBeDefined();
      expect(retrieved?.weldingMethod).toBe('NONE');
      expect(retrieved?.weldingPassport?.methodCode).toBe('NONE');
      expect(TechnicalPassportService.shouldRenderPassport(retrieved?.weldingPassport)).toBe(false);
    });

    it('executes bulk storage of diverse shifts and performs complex querying and updates', async () => {
      const entries: WorkEntry[] = [
        {
          id: 'shift-1',
          date: '2026-05-01',
          projectCode: 'P1',
          projectName: 'Projekt 1',
          clientName: 'Metrostav DIZ s.r.o.',
          workType: 'workshop_welding',
          startTime: '07:00',
          endTime: '15:30',
          breakMinutes: 30,
          totalHours: 8.0,
          pricing: { baseHourlyRate: 550, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 550 },
          travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
          extraCosts: [],
          totalEarnings: 4566,
          status: 'submitted',
          notes: '',
          weldingMethod: 'TIG',
          weldingPassport: {
            methodCode: '141',
            baseMaterialGrade: '1.4301',
            materialThickness: '2.0 mm',
            shieldingGas: 'Argon 4.6',
            fillerBatch: 'ESAB 308L',
            weldInspectionVT: 'passed_B',
          },
          createdAt: '2026-05-01',
          updatedAt: '2026-05-01',
        },
        {
          id: 'shift-2',
          date: '2026-05-02',
          projectCode: 'P1',
          projectName: 'Projekt 1',
          clientName: 'Metrostav DIZ s.r.o.',
          workType: 'workshop_welding',
          startTime: '07:00',
          endTime: '15:30',
          breakMinutes: 30,
          totalHours: 8.0,
          pricing: { baseHourlyRate: 550, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 550 },
          travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
          extraCosts: [],
          totalEarnings: 4566,
          status: 'submitted',
          notes: '',
          weldingMethod: 'MIG_MAG',
          weldingPassport: {
            methodCode: '135',
            baseMaterialGrade: 'S355J2',
            materialThickness: '8.0 mm',
            shieldingGas: 'CORGON 18',
            fillerBatch: 'Böhler EMK 8',
            weldInspectionVT: 'passed_C',
          },
          createdAt: '2026-05-02',
          updatedAt: '2026-05-02',
        },
        {
          id: 'shift-3',
          date: '2026-05-03',
          projectCode: 'P2',
          projectName: 'Projekt 2',
          clientName: 'Kovo Novák s.r.o.',
          workType: 'site_assembly',
          startTime: '07:00',
          endTime: '15:30',
          breakMinutes: 30,
          totalHours: 8.0,
          pricing: { baseHourlyRate: 500, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 500 },
          travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
          extraCosts: [],
          totalEarnings: 4166,
          status: 'draft',
          notes: 'Čistá montáž',
          weldingMethod: 'NONE',
          createdAt: '2026-05-03',
          updatedAt: '2026-05-03',
        },
      ];

      await testDb.instance.entries.bulkPut(entries);

      // Verify count
      expect(await testDb.instance.entries.count()).toBe(3);

      // Query by client
      const metrostav = await testDb.instance.entries.where('clientName').equals('Metrostav DIZ s.r.o.').toArray();
      expect(metrostav).toHaveLength(2);

      // Filter in memory for active welding shifts
      const activeWelds = (await testDb.instance.entries.toArray()).filter((e) =>
        TechnicalPassportService.shouldRenderPassport(e.weldingPassport)
      );
      expect(activeWelds).toHaveLength(2);
      expect(activeWelds.map((w) => w.weldingPassport?.methodCode)).toEqual(['141', '135']);

      // Update shift-1: change VT to failed
      await testDb.instance.entries.update('shift-1', {
        'weldingPassport.weldInspectionVT': 'failed',
        updatedAt: '2026-05-01T20:00:00Z',
      });

      const updatedShift1 = await testDb.instance.entries.get('shift-1');
      expect(updatedShift1?.weldingPassport?.weldInspectionVT).toBe('failed');
    });
  });

  // =========================================================================
  // 3. Report Rendering: Mixed Shifts & Passport Box Activation
  // =========================================================================
  describe('3. Report Rendering (InvoiceReportView) with Mixed Shifts', () => {
    const shiftWelding1: WorkEntry = {
      id: 'rep-w1',
      date: '2026-05-05',
      projectCode: 'P-WELD-1',
      projectName: 'Mostní zábradlí S355',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'workshop_welding',
      startTime: '07:00',
      endTime: '15:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: { baseHourlyRate: 550, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 550 },
      travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
      extraCosts: [],
      totalEarnings: 4566,
      status: 'submitted',
      notes: 'Svařeno metodou 135 MAG',
      weldingMethod: 'MIG_MAG',
      weldingPassport: {
        methodCode: '135',
        methodName: 'Obloukové svařování MAG (ČSN EN ISO 4063: 135)',
        baseMaterialGrade: 'S355J2',
        materialThickness: '6.0 mm',
        shieldingGas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
        fillerBatch: 'Böhler EMK 8, Ø 1.2 mm, šarže #98214',
        rootBackingGas: false,
        weldInspectionVT: 'passed_B',
      },
      isPdp: true,
      createdAt: '2026-05-05',
      updatedAt: '2026-05-05',
    };

    const shiftWelding2: WorkEntry = {
      id: 'rep-w2',
      date: '2026-05-06',
      projectCode: 'P-WELD-2',
      projectName: 'Nerezové potrubí TIG',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'site_assembly',
      startTime: '07:00',
      endTime: '15:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: { baseHourlyRate: 650, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 650 },
      travel: { distanceKm: 20, ratePerKm: 11, travelTimeHours: 0.5, travelHourlyRate: 350, dietAllowance: 166, dietType: 'band_1' },
      extraCosts: [],
      totalEarnings: 8.0 * 650 + 220 + 175 + 166,
      status: 'submitted',
      notes: 'Svařeno TIG nerez 1.4404',
      weldingMethod: 'TIG',
      weldingPassport: {
        methodCode: '141',
        methodName: 'Obloukové svařování TIG (ČSN EN ISO 4063: 141)',
        baseMaterialGrade: '1.4404',
        materialThickness: '3.0 mm',
        shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
        fillerBatch: 'Böhler Thermanit, Ø 2.0 mm, šarže #55123',
        rootBackingGas: true,
        weldInspectionVT: 'passed_B',
      },
      isPdp: true,
      createdAt: '2026-05-06',
      updatedAt: '2026-05-06',
    };

    const shiftNonWelding: WorkEntry = {
      id: 'rep-non-weld',
      date: '2026-05-07',
      projectCode: 'P-NON-WELD',
      projectName: 'Kotvení sloupů',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'site_assembly',
      startTime: '07:00',
      endTime: '15:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: { baseHourlyRate: 500, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 500 },
      travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
      extraCosts: [],
      totalEarnings: 4166,
      status: 'submitted',
      notes: 'Bez svařování',
      weldingMethod: 'NONE',
      weldingPassport: {
        methodCode: 'NONE',
        baseMaterialGrade: 'N/A',
        materialThickness: 'N/A',
        shieldingGas: 'N/A',
        fillerBatch: 'N/A',
        rootBackingGas: false,
        weldInspectionVT: 'not_required',
      },
      isPdp: true,
      createdAt: '2026-05-07',
      updatedAt: '2026-05-07',
    };

    const shiftLegacyNoPassport: WorkEntry = {
      id: 'rep-legacy',
      date: '2026-05-08',
      projectCode: 'P-LEGACY',
      projectName: 'Oprava rámu stará směna',
      clientName: 'Kovo Novák s.r.o.',
      workType: 'workshop_welding',
      startTime: '07:00',
      endTime: '15:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: { baseHourlyRate: 500, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 500 },
      travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 166, dietType: 'band_1' },
      extraCosts: [],
      totalEarnings: 4166,
      status: 'submitted',
      notes: 'Historický záznam bez pasportu',
      weldingMethod: 'MMA',
      // No weldingPassport defined!
      isPdp: false,
      createdAt: '2026-05-08',
      updatedAt: '2026-05-08',
    };

    it('renders the Technical Passport protocol box when active welding shifts are present', () => {
      render(
        <InvoiceReportView
          entries={[shiftWelding1, shiftWelding2, shiftNonWelding]}
          settings={testSettings}
        />
      );

      // Verify the normative header is present
      expect(screen.getByText('SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY')).toBeDefined();
      expect(screen.getByText('EN 1090-2 / ISO 9606-1')).toBeDefined();
      expect(screen.getByText(/Doklad shody pro TDI/i)).toBeDefined();

      // Verify method 135 MAG details
      expect(screen.getByText(/Obloukové svařování MAG/i)).toBeDefined();
      const s355Elements = screen.getAllByText(/S355J2, tl. 6.0 mm/i);
      expect(s355Elements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Böhler EMK 8, Ø 1.2 mm, šarže #98214/i)).toBeDefined();

      // Verify method 141 TIG details
      expect(screen.getByText(/Obloukové svařování TIG/i)).toBeDefined();
      const inoxElements = screen.getAllByText(/1.4404, tl. 3.0 mm/i);
      expect(inoxElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Argon 4.6 \(100% Ar, ISO 14175 I1\) \(vč. formování kořene\)/i)).toBeDefined();
      expect(screen.getByText(/Böhler Thermanit, Ø 2.0 mm, šarže #55123/i)).toBeDefined();

      // Non-welding shift must NOT have a passport box
      expect(screen.queryByText(/Bez sváru – čistá zámečnická montáž/i)).toBeNull();
    });

    it('does NOT render the Technical Passport box when ALL entries in the report are non-welding shifts', () => {
      render(
        <InvoiceReportView
          entries={[shiftNonWelding]}
          settings={testSettings}
        />
      );

      // The passport box must be absent
      expect(screen.queryByText('SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY')).toBeNull();
      expect(screen.queryByText('EN 1090-2 / ISO 9606-1')).toBeNull();
    });

    it('does NOT render Technical Passport box when entries only have legacy weldingMethod without passport', () => {
      render(
        <InvoiceReportView
          entries={[shiftLegacyNoPassport]}
          settings={testSettings}
        />
      );

      // Box must be absent
      expect(screen.queryByText('SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY')).toBeNull();

      // But table row should gracefully display legacy method [MMA]
      expect(screen.getAllByText(/\[MMA\]/i)[0]).toBeDefined();
    });

    it('deduplicates identical welding passports across multiple shifts in the protocol', () => {
      // 3 shifts with exactly the same welding parameters
      const shiftWelding1Duplicate1: WorkEntry = {
        ...shiftWelding1,
        id: 'rep-w1-dup1',
        date: '2026-05-12',
      };
      const shiftWelding1Duplicate2: WorkEntry = {
        ...shiftWelding1,
        id: 'rep-w1-dup2',
        date: '2026-05-13',
      };

      render(
        <InvoiceReportView
          entries={[shiftWelding1, shiftWelding1Duplicate1, shiftWelding1Duplicate2]}
          settings={testSettings}
        />
      );

      // The table has 3 rows for the 3 dates
      expect(screen.getAllByText('5. 5. 2026')[0]).toBeDefined();
      expect(screen.getAllByText('12. 5. 2026')[0]).toBeDefined();
      expect(screen.getAllByText('13. 5. 2026')[0]).toBeDefined();

      // In the Technical Passport box, exactly 1 passport block should exist
      // In the passport card, the element has exact text 'S355J2, tl. 6.0 mm'
      const exactPassportMaterialSpans = screen.getAllByText('S355J2, tl. 6.0 mm');
      expect(exactPassportMaterialSpans).toHaveLength(1);
    });

    it('renders BOTH § 92e PDP statutory clause and Technical Passport box when PDP is active on welding shifts', () => {
      render(
        <InvoiceReportView
          entries={[shiftWelding1, shiftWelding2]}
          settings={testSettings}
        />
      );

      // PDP Clause present
      expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();
      expect(screen.getByText(/CZ-CPA 41 až 43/i)).toBeDefined();

      // Technical Passport present
      expect(screen.getByText('SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY')).toBeDefined();
    });
  });

  // =========================================================================
  // 4. EntryCard Edge Cases & Badges
  // =========================================================================
  describe('4. EntryCard Rendering & Edge Cases', () => {
    const defaultEntry: WorkEntry = {
      id: 'card-entry-01',
      date: '2026-05-15',
      projectCode: 'CARD-P1',
      projectName: 'Výroba nerezové nádrže',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'workshop_welding',
      startTime: '06:00',
      endTime: '14:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: {
        baseHourlyRate: 600,
        complexityMultiplier: 1.0,
        shiftSurcharges: [],
        calculatedHourlyRate: 600,
      },
      travel: {
        distanceKm: 0,
        ratePerKm: 11,
        travelTimeHours: 0,
        travelHourlyRate: 350,
        dietAllowance: 166,
        dietType: 'band_1',
      },
      extraCosts: [],
      totalEarnings: 8.0 * 600 + 166,
      status: 'submitted',
      notes: 'TIG sváry prověřeny kapilární a vizuální kontrolou VT2.',
      weldingMethod: 'TIG',
      weldingPassport: {
        methodCode: '141',
        baseMaterialGrade: '1.4404',
        materialThickness: '4.0 mm',
        shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
        fillerBatch: 'Böhler Thermanit GE-316L, šarže #77123',
        rootBackingGas: true,
        welderCertNumber: 'CZ-9606-1-141',
        weldInspectionVT: 'passed_B',
      },
      createdAt: '2026-05-15',
      updatedAt: '2026-05-15',
    };

    it('renders normal active welding badges on EntryCard top bar', () => {
      render(
        <EntryCard
          entry={defaultEntry}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      // Method badge
      expect(screen.getByText('ISO 141')).toBeDefined();

      // Material badge with thickness
      expect(screen.getByText('1.4404 (4.0 mm)')).toBeDefined();

      // Gas badge with root backing indication
      expect(screen.getByText('Argon 4.6 + kořen')).toBeDefined();

      // Filler batch badge
      expect(screen.getByText('Böhler Thermanit GE-316L, šarže #77123')).toBeDefined();

      // VT inspection badge: passed_B -> Stupeň B
      expect(screen.getByText('VT: Stupeň B')).toBeDefined();
    });

    it('handles VT inspection status variants (passed_C and failed) with appropriate color cues', () => {
      // 1. passed_C
      const entryC: WorkEntry = {
        ...defaultEntry,
        id: 'card-c',
        weldingPassport: {
          ...defaultEntry.weldingPassport!,
          weldInspectionVT: 'passed_C',
        },
      };

      const { rerender } = render(
        <EntryCard
          entry={entryC}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      expect(screen.getByText('VT: Stupeň C')).toBeDefined();

      // 2. failed
      const entryFailed: WorkEntry = {
        ...defaultEntry,
        id: 'card-failed',
        weldingPassport: {
          ...defaultEntry.weldingPassport!,
          weldInspectionVT: 'failed',
        },
      };

      rerender(
        <EntryCard
          entry={entryFailed}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      const failedBadge = screen.getByText('VT: Nevyhověl');
      expect(failedBadge).toBeDefined();
      expect(failedBadge.className).toContain('text-rose-300');
    });

    it('gracefully handles missing optional passport fields without crashing or rendering empty brackets', () => {
      const entryMissingOptionals: WorkEntry = {
        ...defaultEntry,
        id: 'card-missing-opt',
        weldingPassport: {
          methodCode: '135',
          baseMaterialGrade: 'S355J2',
          materialThickness: '', // Missing thickness
          shieldingGas: '', // Missing gas
          fillerBatch: '', // Missing filler batch
          welderCertNumber: undefined, // Missing cert
          weldInspectionVT: 'not_required', // No VT required
        },
      };

      render(
        <EntryCard
          entry={entryMissingOptionals}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      // Method badge present
      expect(screen.getByText('ISO 135')).toBeDefined();

      // Material badge should NOT render "S355J2 ()" with empty parentheses
      expect(screen.getByText('S355J2')).toBeDefined();
      expect(screen.queryByText(/S355J2 \(\)/i)).toBeNull();

      // VT not_required should NOT render any VT badge on the top header
      expect(screen.queryByText(/VT:/i)).toBeNull();

      // Expand card to verify fallback in detailed technical passport block
      const expandBtn = screen.getByRole('button', { name: /Zobrazit rozpis & poznámku/i });
      fireEvent.click(expandBtn);

      expect(screen.getByText('Neuvedeno')).toBeDefined(); // Filler batch fallback
      // EntryCard intentionally omits welder cert row when welderCertNumber is empty/undefined to keep compact
      expect(screen.queryByText(/Certifikát svářeče \(ISO 9606-1\):/i)).toBeNull();
    });

    it('renders custom exotic material grades (HARDOX 450, AlMg3, composite pipe) cleanly', () => {
      const entryExotic: WorkEntry = {
        ...defaultEntry,
        id: 'card-exotic',
        weldingPassport: {
          methodCode: '135',
          baseMaterialGrade: 'HARDOX 450',
          materialThickness: '15.0 mm',
          shieldingGas: 'CORGON 18',
          fillerBatch: 'Kowax G3Si1',
          weldInspectionVT: 'passed_B',
        },
      };

      render(
        <EntryCard
          entry={entryExotic}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      expect(screen.getByText('HARDOX 450 (15.0 mm)')).toBeDefined();
    });

    it('does NOT render welding passport badges when methodCode is NONE or entry is pure locksmithing', () => {
      const entryNone: WorkEntry = {
        ...defaultEntry,
        id: 'card-none',
        weldingMethod: 'NONE',
        weldingPassport: {
          methodCode: 'NONE',
          baseMaterialGrade: 'N/A',
          materialThickness: 'N/A',
          shieldingGas: 'N/A',
          fillerBatch: 'N/A',
          rootBackingGas: false,
          weldInspectionVT: 'not_required',
        },
      };

      render(
        <EntryCard
          entry={entryNone}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      expect(screen.queryByText(/ISO/i)).toBeNull();
      expect(screen.queryByText(/VT:/i)).toBeNull();

      // Expand card to ensure technical passport protocol card does NOT appear
      fireEvent.click(screen.getByRole('button', { name: /Zobrazit rozpis & poznámku/i }));
      expect(screen.queryByText(/Technický pasport svaru/i)).toBeNull();
    });

    it('renders legacy welding badge when weldingPassport is absent but weldingMethod is set', () => {
      const entryLegacy: WorkEntry = {
        ...defaultEntry,
        id: 'card-legacy',
        weldingMethod: 'MMA',
        weldingPassport: undefined,
      };

      render(
        <EntryCard
          entry={entryLegacy}
          onEdit={() => {}}
          onDelete={() => {}}
          onUpdateStatus={() => {}}
        />
      );

      // Shows legacy badge MMA
      expect(screen.getByText('MMA')).toBeDefined();
      expect(screen.queryByText(/ISO 111/i)).toBeNull();
    });
  });
});
