import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { czechAccountToIban, generateSpaydString, SpaydService } from '../src/services/spaydService';
import { SignaturePad, validateSignatureStrokes, SignaturePadHandle } from '../src/components/signature/SignaturePad';
import { SignaturePadModal } from '../src/components/signature/SignaturePadModal';
import { db, updateEntrySignatures } from '../src/db';
import { WorkEntry, AppSettings, ProtocolSignature } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { EntryCard } from '../src/components/entries/EntryCard';
import { InvoiceReportView } from '../src/components/report/InvoiceReportView';
import { CONTRACTOR_PNG_DATA_URL, CLIENT_PNG_DATA_URL } from './fixtures/signatures.fixture';

describe('Milestone M5: Digital Handover Protocol, Sign-on-Glass & SPAYD', () => {

  beforeEach(async () => {
    if (!db.isOpen()) {
      await db.open();
    }
    await db.transaction('rw', db.entries, db.presets, db.settings, db.photos, async () => {
      await db.entries.clear();
      await db.presets.clear();
      await db.settings.clear();
      await db.photos.clear();
    });
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.transaction('rw', db.entries, db.presets, db.settings, db.photos, async () => {
        await db.entries.clear();
        await db.presets.clear();
        await db.settings.clear();
        await db.photos.clear();
      });
    }
  });

  // =========================================================================
  // Feature 8: SPAYD Generator & Czech Account to IBAN Synthesizer
  // =========================================================================
  describe('Feature 8: SPAYD Service & MOD-97 Czech IBAN Synthesizer', () => {
    it('synthesizes standard 24-character Czech IBAN without prefix', () => {
      const iban = czechAccountToIban('123456789/0100');
      expect(iban).toBe('CZ1801000000000123456789');
      expect(iban).toHaveLength(24);
    });

    it('synthesizes Czech IBAN with domestic prefix (e.g. 19-2000145399/0800)', () => {
      const iban = czechAccountToIban('19-2000145399/0800');
      expect(iban).toBe('CZ6508000000192000145399');
    });

    it('synthesizes Czech IBAN with 6-digit prefix', () => {
      const iban = czechAccountToIban('123456-2000145399/0800');
      expect(iban).not.toBeNull();
      expect(iban?.slice(8, 14)).toBe('123456');
    });

    it('validates existing valid 24-char Czech IBAN', () => {
      const input = 'CZ6508000000192000145399';
      const output = czechAccountToIban(input);
      expect(output).toBe(input);
    });

    it('rejects existing IBAN with corrupt checksum', () => {
      const corrupted = 'CZ0008000000192000145399';
      expect(czechAccountToIban(corrupted)).toBeNull();
    });

    it('rejects malformed account numbers', () => {
      expect(czechAccountToIban('')).toBeNull();
      expect(czechAccountToIban(null)).toBeNull();
      expect(czechAccountToIban(undefined)).toBeNull();
      expect(czechAccountToIban('invalid-acc')).toBeNull();
      expect(czechAccountToIban('12345/abc')).toBeNull();
      expect(czechAccountToIban('1234567-123456/0100')).toBeNull(); // prefix > 6 digits
      expect(czechAccountToIban('12345678901/0100')).toBeNull(); // account > 10 digits
      expect(czechAccountToIban('1/0100')).toBeNull(); // account < 2 digits
    });

    it('generates standard ČBA SPAYD 1.0 string with all valid fields', () => {
      const spayd = generateSpaydString({
        accountOrIban: '19-2000145399/0800',
        amount: 14500.50,
        currency: 'CZK',
        variableSymbol: '2026/03-01',
        constantSymbol: '0308',
        specificSymbol: '1234',
        dueDate: '20260315',
        message: 'Montáž ocelových konstrukcí & sváry *Most*',
      });

      expect(spayd).not.toBeNull();
      expect(spayd?.startsWith('SPD*1.0*')).toBe(true);
      expect(spayd).toContain('ACC:CZ6508000000192000145399');
      expect(spayd).toContain('AM:14500.50*CC:CZK');
      expect(spayd).toContain('X-VS:20260301');
      expect(spayd).toContain('X-KS:0308');
      expect(spayd).toContain('X-SS:1234');
      expect(spayd).toContain('DT:20260315');
      // Diacritics removed, asterisk replaced
      expect(spayd).toContain('MSG:Montaz ocelovych konstrukci svary Most');
      expect(spayd?.endsWith('*')).toBe(true);
    });

    it('handles SpaydService class methods correctly', () => {
      expect(SpaydService.czechAccountToIban('123456789/0100')).toBe('CZ1801000000000123456789');
      const spayd = SpaydService.generateSpaydString({
        accountOrIban: '123456789/0100',
        amount: 500,
      });
      expect(spayd).toContain('ACC:CZ1801000000000123456789');
    });

    it('returns null on invalid spayd amount or missing account', () => {
      expect(generateSpaydString({ accountOrIban: '', amount: 100 })).toBeNull();
      expect(generateSpaydString({ accountOrIban: '123456789/0100', amount: -50 })).toBeNull();
      expect(generateSpaydString({ accountOrIban: '123456789/0100', amount: NaN })).toBeNull();
    });
  });

  // =========================================================================
  // Feature 1-5: SignaturePad & Validation
  // =========================================================================
  describe('Feature 1-5: SignaturePad Canvas Engine & Validation', () => {
    it('validates empty strokes or insufficient movement', () => {
      expect(validateSignatureStrokes([]).isValid).toBe(false);
      expect(validateSignatureStrokes([{ points: [] }]).isValid).toBe(false);
      // Single point tap (< 3 points)
      expect(validateSignatureStrokes([{ points: [{ x: 10, y: 10 }] }]).isValid).toBe(false);
      // Static zero-movement tap
      expect(validateSignatureStrokes([{
        points: [
          { x: 10, y: 10 },
          { x: 10, y: 10 },
          { x: 10, y: 10 },
        ]
      }]).isValid).toBe(false);
    });

    it('validates realistic handwriting stroke', () => {
      const result = validateSignatureStrokes([{
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 25 },
          { x: 35, y: 50 },
        ]
      }]);
      expect(result.isValid).toBe(true);
      expect(result.totalPoints).toBe(3);
      expect(result.boundingBox).toBeDefined();
      expect(result.boundingBox?.width).toBeGreaterThan(0);
    });

    it('renders SignaturePad component and exposes handle methods via ref', () => {
      const ref = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={ref} width={400} height={180} />);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.style.touchAction).toBe('none');

      expect(ref.current).not.toBeNull();
      expect(ref.current?.isEmpty()).toBe(true);
      expect(ref.current?.canUndo()).toBe(false);
      expect(ref.current?.canRedo()).toBe(false);
      expect(ref.current?.getStrokes()).toEqual([]);
      expect(ref.current?.getTrimmedDataUrl()).toBeNull();
    });
  });

  // =========================================================================
  // Feature 6: Dual Signature Protocol & Modal
  // =========================================================================
  describe('Feature 6: SignaturePadModal Dialog Component', () => {
    it('renders contractor modal with role title and pre-filled signer name', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <SignaturePadModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          role="contractor"
          defaultSignerName="Jan Novák (Montér)"
        />
      );

      expect(screen.getByText('Podpis zhotovitele (Montér / Svářeč)')).toBeDefined();
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Jan Novák (Montér)');
    });

    it('renders client modal with client title', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <SignaturePadModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          role="client"
          defaultSignerName="Ing. Karel Dvořák (TDI)"
        />
      );

      expect(screen.getByText('Podpis objednatele (Stavbyvedoucí / TDI)')).toBeDefined();
    });

    it('blocks confirmation and shows toast when signer name is blank', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <SignaturePadModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          role="contractor"
          defaultSignerName=""
        />
      );

      const confirmBtn = screen.getByText('Potvrdit podpis');
      fireEvent.click(confirmBtn);

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Feature 9: Offline Database Storage
  // =========================================================================
  describe('Feature 9: Offline Storage & updateEntrySignatures helper', () => {
    it('persists dual signatures into Dexie using updateEntrySignatures', async () => {
      const testEntry: WorkEntry = {
        id: 'entry-sig-test-1',
        date: '2026-03-02',
        projectCode: 'P-101',
        projectName: 'Most ev. č. 201',
        clientName: 'Metrostav DIZ',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8,
        pricing: {
          baseHourlyRate: 450,
          complexityMultiplier: 1.0,
          calculatedHourlyRate: 450,
        },
        travel: {
          distanceKm: 20,
          ratePerKm: 10,
          travelTimeHours: 1,
          travelHourlyRate: 250,
        },
        extraCosts: [],
        totalEarnings: 3850,
        status: 'submitted',
        notes: 'Montáž zábradlí',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.entries.put(testEntry);

      const contractorSig: ProtocolSignature = {
        role: 'contractor',
        signerName: 'Jan Novák (Zhotovitel)',
        dataUrl: CONTRACTOR_PNG_DATA_URL,
        signedAt: '2026-03-02T16:00:00.000Z',
      };

      const clientSig: ProtocolSignature = {
        role: 'client',
        signerName: 'Ing. Karel Dvořák (TDI)',
        dataUrl: CLIENT_PNG_DATA_URL,
        signedAt: '2026-03-02T16:15:00.000Z',
      };

      await updateEntrySignatures('entry-sig-test-1', {
        contractor: contractorSig,
        client: clientSig,
      });

      const updated = await db.entries.get('entry-sig-test-1');
      expect(updated).toBeDefined();
      expect(updated?.signatures?.contractor?.signerName).toBe('Jan Novák (Zhotovitel)');
      expect(updated?.signatures?.client?.signerName).toBe('Ing. Karel Dvořák (TDI)');
      expect(updated?.contractorSignature?.signerName).toBe('Jan Novák (Zhotovitel)');
      expect(updated?.clientSignature?.signerName).toBe('Ing. Karel Dvořák (TDI)');
    });
  });

  // =========================================================================
  // Feature 9: EntryCard Signature Status Badge & Card
  // =========================================================================
  describe('Feature 9: EntryCard Signature Badges & Preview', () => {
    it('displays "Oboustranně podepsáno ✓" badge when both parties signed', () => {
      const entry: WorkEntry = {
        id: 'entry-both',
        date: '2026-03-02',
        projectCode: 'P-101',
        projectName: 'Most SO201',
        clientName: 'Metrostav',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8,
        pricing: { baseHourlyRate: 450, complexityMultiplier: 1.0, calculatedHourlyRate: 450 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0 },
        extraCosts: [],
        totalEarnings: 3600,
        status: 'submitted',
        notes: '',
        signatures: {
          contractor: {
            role: 'contractor',
            signerName: 'Novák',
            dataUrl: CONTRACTOR_PNG_DATA_URL,
            signedAt: '2026-03-02T16:00:00.000Z',
          },
          client: {
            role: 'client',
            signerName: 'Dvořák',
            dataUrl: CLIENT_PNG_DATA_URL,
            signedAt: '2026-03-02T16:15:00.000Z',
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(
        <EntryCard
          entry={entry}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      );

      expect(screen.getByText(/Oboustranně podepsáno ✓/i)).toBeDefined();
    });

    it('displays "Částečně podepsáno" badge when only contractor signed', () => {
      const entry: WorkEntry = {
        id: 'entry-contractor-only',
        date: '2026-03-02',
        projectCode: 'P-101',
        projectName: 'Most SO201',
        clientName: 'Metrostav',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8,
        pricing: { baseHourlyRate: 450, complexityMultiplier: 1.0, calculatedHourlyRate: 450 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0 },
        extraCosts: [],
        totalEarnings: 3600,
        status: 'submitted',
        notes: '',
        signatures: {
          contractor: {
            role: 'contractor',
            signerName: 'Novák',
            dataUrl: CONTRACTOR_PNG_DATA_URL,
            signedAt: '2026-03-02T16:00:00.000Z',
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(
        <EntryCard
          entry={entry}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      );

      expect(screen.getByText(/Částečně podepsáno/i)).toBeDefined();
    });
  });

  // =========================================================================
  // Feature 7: InvoiceReportView Protocol & Sign-on-Glass
  // =========================================================================
  describe('Feature 7: InvoiceReportView Handover Protocol Layout', () => {
    it('renders handover protocol with contractor, client and SPAYD QR data', () => {
      const entry: WorkEntry = {
        id: 'proto-entry-1',
        date: '2026-03-02',
        projectCode: 'P-101',
        projectName: 'Most ev. č. 201',
        clientName: 'Metrostav DIZ',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8,
        pricing: { baseHourlyRate: 450, complexityMultiplier: 1.0, calculatedHourlyRate: 450 },
        travel: { distanceKm: 20, ratePerKm: 10, travelTimeHours: 1, travelHourlyRate: 250 },
        extraCosts: [],
        totalEarnings: 4050,
        status: 'submitted',
        notes: 'Montáž ocelových prvků',
        signatures: {
          contractor: {
            role: 'contractor',
            signerName: 'Jan Novák (Zhotovitel)',
            dataUrl: CONTRACTOR_PNG_DATA_URL,
            signedAt: '2026-03-02T16:00:00.000Z',
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        contractor: {
          ...DEFAULT_SETTINGS.contractor,
          bankAccount: '19-2000145399/0800',
          iban: '',
        },
      };

      const { container } = render(
        <InvoiceReportView entries={[entry]} settings={settings} />
      );

      // Verify protocol text
      expect(screen.getByText(/Předávací protokol/i)).toBeDefined();
      expect(screen.getByText(/Za zhotovitele \(Montér \/ Svářeč\)/i)).toBeDefined();
      expect(screen.getByText(/Za objednatele \(Stavbyvedoucí \/ TDI\)/i)).toBeDefined();

      // Check synthesized IBAN is rendered in payment details
      expect(screen.getByText(/Platební údaje \(SPAYD QR\)/i)).toBeDefined();
      expect(screen.getByText(/CZ6508000000192000145399/i)).toBeDefined();

      // Check contractor signature image exists
      const contractorImg = container.querySelector('img[alt="Podpis zhotovitele"]');
      expect(contractorImg).not.toBeNull();
    });
  });
});
