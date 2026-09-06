# Mošnýho zápisník 2.0 – Profesionální montážní & svářečský výkazník (PWA)

Robustní, moderní PWA aplikace navržená pro samostatného řemeslníka a živnostníka (svářeč, zámečník, montér), který realizuje dílenské zakázky, havarijní servisy a montáže ve výškách pro generální dodavatele.

Aplikace řeší proměnlivé ceny podle typu práce, náročnosti (polohy svárů, práce ve výškách), víkendů, nočních směn, diet a ujetých kilometrů.

---

## ⚡ Klíčové funkce

1. **Rychlý terénní formulář směny (Quick Shift Logger)**
   - **Ovládání jedním palcem přímo na stavbě:** Spodní lišta, velká dotyková tlačítka (min. 48px), rychlé číselníky.
   - **Šablony zakázek (Presety):** Výběr z přednastavených profilů (*„Standard dílna 480 Kč/h“*, *„Montáž výšky 620 Kč/h + koeficient 1.25“*, *„Víkendová havárie 850 Kč/h“*, *„TIG nerez potrubí“*).
   - **Rychlé pauzy:** Tlačítka `0 min`, `15 min`, `30 min`, `45 min`, `60 min` s mikro-krokováním.
   - **Dynamický kalkulátor v reálném čase:** Živý náhled výdělku (práce + doprava + diety + materiál) při každé změně.
   - **Ruční přepsání (Manual Override):** Možnost zadat fixní domluvenou částku za úkol / akci.

2. **100% Offline-First (IndexedDB + Dexie.js + Service Worker)**
   - Plně funkční v suterénech i plechových montážních halách bez mobilního signálu.
   - PWA manifest a offline service worker pro instalaci na plochu telefonu/tabletu.
   - Export a import kompletní zálohy do souboru JSON.

3. **Oficiální předávací protokol k faktuře (A4 Print Layout)**
   - Formát přizpůsobený tisku `@media print` na čistou A4 bez tlačítek aplikace.
   - Identifikace dodavatele (Jan Mošný, IČO, DIČ, bankovní spojení, certifikace svářeče dle ČSN EN ISO 9606-1).
   - Identifikace odběratele a stavbyvedoucího.
   - Souhrnné KPI boxy (hodiny, km, diety, celková fakturovaná částka).
   - Položková tabulka jednotlivých dní s poznámkami a metodami svárů.
   - Rozpis spotřebovaného materiálu (plyny Argon/Corgon, dráty, kotouče, kotvy).
   - Podpisová a razítková pole pro zhotovitele a objednatele.
   - Možnost přepnutí zobrazení cen (lze vytisknout pouze hodiny pro stavbyvedoucího nebo kompletní podklad s cenami pro účtárnu).
   - Okamžitý export do CSV formátu pro Microsoft Excel (s diakritikou a středníkovým oddělovačem).

4. **Sledování cashflow & Billing Pipeline (Kanban)**
   - Přehledné sloupce stavů:
     - 🟡 **Rozpracováno / Koncept**
     - 🔵 **K fakturaci / Odevzdáno**
     - 🟣 **Vyfakturováno (se splatností a odpočtem dnů)**
     - 🟢 **Zaplaceno na bankovní účet**
   - Statistiky rozložení činností (poměr dílna vs. montáže vs. havárie vs. cesťáky).
   - Měsíční graf výdělků a přehled podle odběratelů.

5. **Konfigurace sazebníků a profilu OSVČ**
   - Nastavení základních sazeb pro dílnu, montáž, havárie a řízení.
   - Příplatky za víkendy, noční a svátky (procentuálně nebo fixním příplatkem Kč/h).
   - Zákonné sazby stravného (půldenní 5–12h a celodenní nad 12h) a sazba za 1 km jízdy dodávkou.
   - Správa vlastních šablon a adresář odběratelů.

---

## 🛠 Technologický stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS 4 (vysoce kontrastní industriální tmavý režim navržený pro přímé slunce na stavbě)
- **Ikony:** Lucide React
- **Databáze:** IndexedDB přes `dexie` & `dexie-react-hooks`
- **PWA:** Web App Manifest + Service Worker offline cache

---

## 🚀 Spuštění projektu

### Vývojový režim
```bash
npm install
npm run dev
```
Aplikace poběží na `http://localhost:5173/`.

### Produkční build & náhled
```bash
npm run build
npm run preview
```

---

## 📁 Struktura zdrojových kódů

```
src/
├── types/
│   └── index.ts                 # Datové modely (WorkEntry, WorkType, Pricing, Settings)
├── db/
│   ├── index.ts                 # Dexie databáze & inicializace
│   └── seedData.ts              # Bohatá realistická česká mock data pro svářeče
├── services/
│   ├── pricingEngine.ts         # Matematický model sazeb, pauz, diet a násobků
│   └── exportService.ts         # Excel CSV export, JSON backup & restore
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Hlavička, offline indikátor, správa záloh
│   │   └── Navigation.tsx       # Spodní navigace pro palec + desktop záložky
│   ├── entries/
│   │   ├── EntriesList.tsx       # Filtrovatelný seznam s vyhledáváním a KPI
│   │   └── EntryCard.tsx        # Interaktivní karta směny s rozpadem nákladů
│   ├── form/
│   │   ├── ShiftModalForm.tsx   # Terénní formulář směny s presety a kalkulátorem
│   │   └── QuickBreakButtons.tsx# Rychlá tlačítka pro pauzu (+15, +30, +60 min)
│   ├── report/
│   │   └── InvoiceReportView.tsx# A4 předávací protokol k faktuře a tiskový layout
│   ├── dashboard/
│   │   ├── StatsDashboard.tsx   # KPI karty, statistiky, poměr dílna/montáže
│   │   └── BillingKanban.tsx    # Pipeline stavů (Koncept -> Odevzdáno -> Vyfakturováno -> Zaplaceno)
│   └── settings/
│       └── RatesSettingsModal.tsx # Konfigurace sazeb, příplatků, šablon a profilu OSVČ
├── App.tsx                      # Hlavní komponenta a reaktivní stav
└── index.css                    # Tailwind CSS a vyhrazené @media print styly pro A4
```
