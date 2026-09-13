# E2E Test Suite Ready

## Test Runner
- Command: `npm test` (or `npx vitest run tests/e2e/`)
- Expected: All test suites pass with exit code 0 under 100% offline hermetic execution.
- Build Command: `npm run build` (`tsc -b && vite build`) passes cleanly with exit code 0.

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 179 | 29 features across R1–R5 ($\ge 6$ tests per feature) |
| 2. Boundary & Corner | 57 | 6 suites covering MPSV diets, photo size <500 KB, MOD-97 IBAN, empty canvas, markups, midnight shifts |
| 3. Cross-Feature | 14 | 4 pairwise interaction suites (§ 92e PDP + Welding, Materials + Diets + Balance, Signatures + SPAYD, Offline Dexie) |
| 4. Real-World Application | 5 | 5 realistic multi-feature workloads (Bridge railings S355, Stainless piping 1.4404, Locksmith steel gates PDP, 20h marathon hall assembly, Excavator repair) |
| Sanity & Support | 224 | Sanity harness test (13) + Milestone verification suites |
| **Total E2E Tests** | **397** | **44 test files in `tests/e2e/` (479 tests across all 48 test files in repo)** |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|:---:|:---:|:---:|:---:|
| 1. Pointer Event Signature Capture | 7 | ✓ | ✓ | ✓ |
| 2. Bézier Curve Smoothing | 6 | ✓ | ✓ | ✓ |
| 3. Retina DPR Scaling | 6 | ✓ | ✓ | ✓ |
| 4. Signature History & Reset | 7 | ✓ | ✓ | ✓ |
| 5. Bounding Box Trimming | 6 | ✓ | ✓ | ✓ |
| 6. Dual Signature Protocol | 7 | ✓ | ✓ | ✓ |
| 7. A4 Handover Protocol Document | 6 | ✓ | ✓ | ✓ |
| 8. Domestic SPAYD QR Generator | 7 | ✓ | ✓ | ✓ |
| 9. Offline Signature Storage | 6 | ✓ | ✓ | ✓ |
| 10. Welding Method ISO 4063 Selector | 6 | ✓ | ✓ | ✓ |
| 11. Base Material & Thickness | 6 | ✓ | ✓ | ✓ |
| 12. Shielding & Backing Gas Selector | 6 | ✓ | ✓ | ✓ |
| 13. Filler Material Batch Tracking | 6 | ✓ | ✓ | ✓ |
| 14. Technical Passport Protocol Block | 6 | ✓ | ✓ | ✓ |
| 15. MPSV 3-Tier Meal Allowance Engine | 7 | ✓ | ✓ | ✓ |
| 16. Automatic Duration Calculation | 6 | ✓ | ✓ | ✓ |
| 17. Manual Diet Override | 6 | ✓ | ✓ | ✓ |
| 18. § 92e PDP Toggle | 6 | ✓ | ✓ | ✓ |
| 19. Mandatory Statutory Clause Notice | 6 | ✓ | ✓ | ✓ |
| 20. Consumables Quick Catalog | 6 | ✓ | ✓ | ✓ |
| 21. Consumable Sheet with Markup | 6 | ✓ | ✓ | ✓ |
| 22. Materials Balance Integration | 6 | ✓ | ✓ | ✓ |
| 23. 1-Touch Activity Chips | 6 | ✓ | ✓ | ✓ |
| 24. Activity Tags in Protocol | 6 | ✓ | ✓ | ✓ |
| 25. Mobile Camera & File Picker | 6 | ✓ | ✓ | ✓ |
| 26. Client-Side Offline Compression | 6 | ✓ | ✓ | ✓ |
| 27. High-Contrast Watermark Stamping | 6 | ✓ | ✓ | ✓ |
| 28. Dual-Tier IndexedDB Photo Store | 6 | ✓ | ✓ | ✓ |
| 29. Photo Thumbnails in Protocol | 6 | ✓ | ✓ | ✓ |

## Test Suite Architecture
- **Location**: `tests/e2e/`
  - `tier1-features/`: 29 test files (`f01-pointer-signature.test.ts` to `f29-photo-thumbnails.test.ts`)
  - `tier2-boundaries/`: 6 test files (`mpsv-diet-boundaries`, `photo-size-boundaries`, `czech-iban-boundaries`, `signature-empty-boundaries`, `markup-boundaries`, `midnight-shift-boundaries`)
  - `tier3-cross/`: 4 test files (`pdp-with-welding-passport`, `materials-with-diets-balance`, `dual-signature-spayd-assembly`, `offline-dexie-persistence`)
  - `tier4-workloads/`: 5 test files (`scenario1-bridge-railings-s355`, `scenario2-food-piping-stainless`, `scenario3-steel-gates-pdp`, `scenario4-high-altitude-hall-20h`, `scenario5-excavator-frame-repair`)
  - `fixtures/`: `rates.fixture.ts`, `clients.fixture.ts`, `contractor.fixture.ts`, `signatures.fixture.ts`, `photos.fixture.ts`, `shifts.fixture.ts`
  - `helpers/`: `dbHelper.ts`, `canvasSpy.ts`, `markupHelper.ts`, `spaydHelper.ts`
  - `setup.ts`: `fake-indexeddb/auto`, Pure-JS HTML5 Canvas 2D mock, URL polyfills, `matchMedia` polyfill.
- **Hermetic Guarantee**: Zero external network dependencies, 100% in-memory Dexie IndexedDB and pure-JS Canvas 2D simulation.
