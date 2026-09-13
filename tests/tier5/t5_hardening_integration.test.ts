import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { render, fireEvent } from '@testing-library/react';

import { generateSpaydString } from '../../src/services/spaydService';
import { BaseMaterialService } from '../../src/services/weldingPassportService';
import { calculateConsumableSlipTotals } from '../../src/services/pricingEngine';
import { checkStorageQuota, getDatabaseStorageEstimate } from '../../src/db';
import {
  compressImageToUnder500KB,
  MAX_PHOTO_BYTES,
} from '../../src/services/imageCompressionService';
import {
  SignaturePad,
  SignaturePadHandle,
} from '../../src/components/signature/SignaturePad';

describe('Tier 5 Codebase Hardening & Integration Tests', () => {
  describe('1. SPAYD Currency Parameter Sanitization (Delimiters & Injection)', () => {
    const validAcc = '19-2000145399/0800';

    it('sanitizes currency with delimiter injection attempts to standard 3-letter code', () => {
      const malicious = 'CZK*AM:0.01*X-HACK:1';
      const spayd = generateSpaydString({
        accountOrIban: validAcc,
        amount: 500,
        currency: malicious,
      });

      expect(spayd).not.toBeNull();
      expect(spayd).toContain('*CC:CZK*');
      expect(spayd).not.toContain('X-HACK');
      // Must contain exactly 1 AM parameter
      expect((spayd?.match(/AM:/g) || []).length).toBe(1);
    });

    it('uppercases valid lowercase ISO currencies like eur', () => {
      const spayd = generateSpaydString({
        accountOrIban: validAcc,
        amount: 250,
        currency: 'eur',
      });
      expect(spayd).toContain('*CC:EUR*');
    });

    it('falls back to CZK on malformed currency inputs', () => {
      const inputs = ['', 'US', 'TOOLONG', '123', '$$$'];
      for (const cur of inputs) {
        const spayd = generateSpaydString({
          accountOrIban: validAcc,
          amount: 100,
          currency: cur,
        });
        expect(spayd).toContain('*CC:CZK*');
      }
    });
  });

  describe('2. Welding Thickness Decimal Comma Handling & Zero Rejection', () => {
    it('strictly rejects zero thickness formatted with Czech decimal comma', () => {
      expect(() => BaseMaterialService.formatThickness('0,0 mm')).toThrow(/must be positive/i);
      expect(() => BaseMaterialService.formatThickness('0,0')).toThrow(/must be positive/i);
      expect(() => BaseMaterialService.formatThickness('0,00 mm')).toThrow(/must be positive/i);
      expect(() => BaseMaterialService.formatThickness('+0,0 mm')).toThrow(/must be positive/i);

      expect(BaseMaterialService.validateThickness('0,0 mm')).toBe(false);
      expect(BaseMaterialService.validateThickness('0,00 mm')).toBe(false);
    });

    it('correctly parses and normalizes positive thickness with Czech decimal comma', () => {
      expect(BaseMaterialService.formatThickness('3,5 mm')).toBe('3.5 mm');
      expect(BaseMaterialService.formatThickness('0,8')).toBe('0.8 mm');
      expect(BaseMaterialService.formatThickness('12,4 mm')).toBe('12.4 mm');

      expect(BaseMaterialService.validateThickness('3,5 mm')).toBe(true);
      expect(BaseMaterialService.validateThickness('0,8')).toBe(true);
    });

    it('normalizes thickness ranges with decimal commas', () => {
      expect(BaseMaterialService.formatThickness('2,5 - 5,0 mm')).toBe('2.5–5 mm');
      expect(BaseMaterialService.formatThickness('0,8 – 2,0')).toBe('0.8–2 mm');
    });
  });

  describe('3. European Standard Aluminum (EN AW) Classification', () => {
    it('classifies EN AW designations as aluminum and Skupina 22', () => {
      const grades = [
        'EN AW-6060',
        'EN AW-5754',
        'EN-AW 6082',
        'ENAW-6060',
        'en aw-5083',
        'EN AW 7075',
      ];

      for (const grade of grades) {
        const res = BaseMaterialService.resolveMaterial(grade);
        expect(res.category).toBe('aluminum');
        expect(res.materialGroup).toBe('Skupina 22');
      }
    });

    it('preserves carbon steel and stainless steel group resolution', () => {
      const s355 = BaseMaterialService.resolveMaterial('S355J2+N');
      expect(s355.category).toBe('carbon_steel');
      expect(s355.materialGroup).toBe('Skupina 1.2');

      const ss = BaseMaterialService.resolveMaterial('1.4404');
      expect(ss.category).toBe('stainless_steel');
      expect(ss.materialGroup).toBe('Skupina 8.1');
    });
  });

  describe('4. Consumables Slip Negative Guard', () => {
    it('clamps negative quantities and unit prices to zero', () => {
      const items = [
        { id: '1', category: 'fasteners' as const, name: 'Negative bolts', quantity: -10, unit: 'ks', unitPrice: 50, billedPrice: -500 },
        { id: '2', category: 'fasteners' as const, name: 'Negative price', quantity: 10, unit: 'ks', unitPrice: -50, billedPrice: -500 },
      ];

      const totals = calculateConsumableSlipTotals(items, 15, -100);
      expect(totals.totalMaterialCost).toBe(0);
      expect(totals.totalBilledAmount).toBe(0);
    });

    it('accurately calculates valid items even if mixed with empty or negative entries', () => {
      const items = [
        { id: '1', category: 'fasteners' as const, name: 'Valid bolts', quantity: 10, unit: 'ks', unitPrice: 20, billedPrice: 230 },
        { id: '2', category: 'fasteners' as const, name: 'Bad bolts', quantity: -5, unit: 'ks', unitPrice: 20, billedPrice: -100 },
      ];

      const totals = calculateConsumableSlipTotals(items, 15, 100);
      expect(totals.totalMaterialCost).toBe(200); // 10 * 20
      expect(totals.totalBilledAmount).toBe(330); // 230 + 0 + 100 fixed fee
    });
  });

  describe('5. Storage API Property Guard', () => {
    it('handles undefined navigator.storage safely without throwing', async () => {
      const originalStorage = navigator.storage;
      try {
        Object.defineProperty(navigator, 'storage', {
          value: undefined,
          configurable: true,
        });

        await expect(checkStorageQuota()).resolves.not.toThrow();
        const est = await getDatabaseStorageEstimate();
        expect(est).toBeNull();
      } finally {
        Object.defineProperty(navigator, 'storage', {
          value: originalStorage,
          configurable: true,
        });
      }
    });

    it('returns structured storage estimate when API is present', async () => {
      const originalStorage = navigator.storage;
      try {
        Object.defineProperty(navigator, 'storage', {
          value: {
            estimate: vi.fn().mockResolvedValue({ usage: 20 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
            persist: vi.fn().mockResolvedValue(true),
          },
          configurable: true,
        });

        const est = await getDatabaseStorageEstimate();
        expect(est).toEqual({
          usage: 20 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
          usedPercent: 20,
        });
      } finally {
        Object.defineProperty(navigator, 'storage', {
          value: originalStorage,
          configurable: true,
        });
      }
    });
  });

  describe('6. SignaturePad Multi-Undo Functional State Updater', () => {
    it('pops successive strokes deterministically on synchronous rapid undo calls', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      render(React.createElement(SignaturePad, { ref: padRef, width: 300, height: 150 }));

      const canvas = document.querySelector('canvas')!;
      const draw = (x: number, y: number, id: number) => {
        fireEvent.pointerDown(canvas, { pointerId: id, isPrimary: true, clientX: x, clientY: y, pressure: 0.5 });
        fireEvent.pointerMove(canvas, { pointerId: id, isPrimary: true, clientX: x + 10, clientY: y + 10, pressure: 0.5 });
        fireEvent.pointerUp(canvas, { pointerId: id, isPrimary: true, clientX: x + 20, clientY: y + 20, pressure: 0.5 });
      };

      draw(10, 10, 1);
      draw(30, 30, 2);
      draw(50, 50, 3);
      draw(70, 70, 4);
      expect(padRef.current?.getStrokes()).toHaveLength(4);

      // Rapidly call undo 3 times in a single synchronous block
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
        expect(padRef.current?.undo()).toBe(true);
        expect(padRef.current?.undo()).toBe(true);
      });

      expect(padRef.current?.getStrokes()).toHaveLength(1);

      // Rapidly call redo 2 times in a single synchronous block
      act(() => {
        expect(padRef.current?.redo()).toBe(true);
        expect(padRef.current?.redo()).toBe(true);
      });

      expect(padRef.current?.getStrokes()).toHaveLength(3);
    });
  });

  describe('7. Image Compression Titration Ceiling Robustness', () => {
    it('guarantees final size strictly under 500 KB for payloads up to 20 MB', () => {
      const testSizes = [
        1_200 * 1024,       // ~1.2 MB
        1_500 * 1024,       // 1.5 MB
        2 * 1024 * 1024,    // 2 MB
        5 * 1024 * 1024,    // 5 MB
        10 * 1024 * 1024,   // 10 MB
        20 * 1024 * 1024,   // 20 MB
      ];

      for (const size of testSizes) {
        const result = compressImageToUnder500KB(size);
        expect(result.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
        expect(result.finalSizeBytes).toBeGreaterThan(0);
        expect(result.iterations).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
