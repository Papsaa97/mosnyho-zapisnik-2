# Mošnyho zápisník 2.0 – Profesionální montážní & svářečský výkazník (PWA)

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

3. **Oficiální předávací protokol k faktuře (A4 Print Layout) & Sign-on-Glass**
   - Formát přizpůsobený tisku `@media print` na čistou A4 bez tlačítek aplikace.
   - **Digitální podpis na displeji (Sign-on-Glass):** Dotykové plátno s Bézierovým vyhlazováním a Retina DPR škálováním pro podpis zhotovitele i objednatele/stavbyvedoucího přímo na mobilu.
   - **Platební QR kód SPAYD:** Automatické generování tuzemského QR kódu dle standardu ČBA pro bleskovou úhradu bankovním převodem.
   - Identifikace dodavatele (Kryštof Mošner / firma, IČO, DIČ, bankovní spojení, certifikace svářeče dle ČSN EN ISO 9606-1).
   - Identifikace odběratele a stavbyvedoucího.
   - Souhrnné KPI boxy (hodiny, km, diety, celková fakturovaná částka).
   - Položková tabulka jednotlivých dní s poznámkami a metodami svárů.
   - Rozpis spotřebovaného materiálu (plyny Argon/Corgon, dráty, kotouče, kotvy).
   - Okamžitý export do CSV formátu pro Microsoft Excel (s diakritikou a středníkovým oddělovačem).

4. **Svářečský & technický pasport zakázky (ČSN EN 1090-2 / ISO 9606-1)**
   - Číselník svařovacích metod dle ISO 4063 (141 TIG, 135 MAG, 136 trubička, 111 MMA, 311 Autogen).
   - Výběr jakostí oceli (S235, S355, 1.4301 nerez, 1.4404, AlMg3), tloušťky materiálu a plynů dle ISO 14175.
   - Evidence šarží přídavných drátů a elektrod dle EN 10204 3.1 a blok vizuální kontroly (VT2) v protokolu.

5. **Soulad s legislativou ČR (MPSV diety & Přenesená daňová povinnost § 92e ZDPH)**
   - Automatická kalkulace stravného dle 3 pásem MPSV ČR (5–12 h, 12–18 h, >18 h) dle délky směny.
   - Přepínač režimu PDP generující povinnou doložku: *„Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH“*.

6. **Montážní materiálový lístek & rychlé terénní štítky**
   - Katalog montážního spotřebního materiálu (kotouče 125/150/230 mm, technické plyny, kotvy, spojovací materiál).
   - Automatický výpočet marže v % a volitelný paušální režijní příplatek k zakázce.
   - Rychlé dotykové štítky činností (`Příprava`, `Svařování`, `Montáž ve výškách`, `Broušení`, `Kotvení`) s haptickou odezvou.

7. **Terénní fotodokumentace svarů s offline kompresí**
   - Přímé snímání z fotoaparátu mobilu nebo galerie s klientskou kompresí pod 500 KB do IndexedDB.
   - Automatický časový a projektový vodoznak vypálený přímo do pixelů snímku pro technický dozor.
   - Miniatury a fotopříloha v tiskovém protokolu A4.

8. **Sledování cashflow & Billing Pipeline (Kanban)**
   - Přehledné sloupce stavů:
     - 🟡 **Rozpracováno / Koncept**
     - 🔵 **K fakturaci / Odevzdáno**
     - 🟣 **Vyfakturováno (se splatností a odpočtem dnů)**
     - 🟢 **Zaplaceno na bankovní účet**
   - Statistiky rozložení činností (poměr dílna vs. montáže vs. havárie vs. cesťáky).
   - Měsíční graf výdělků a přehled podle odběratelů.

9. **Konfigurace sazebníků a profilu OSVČ**
   - Nastavení základních sazeb pro dílnu, montáž, havárie a řízení.
   - Příplatky za víkendy, noční a svátky (procentuálně nebo fixním příplatkem Kč/h).
   - Zákonné sazby stravného a sazba za 1 km jízdy dodávkou.
   - Správa vlastních šablon a adresář odběratelů.

---

## 🛠 Technologický stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS 4 (vysoce kontrastní industriální tmavý režim navržený pro přímé slunce na stavbě)
- **Ikony:** Lucide React
- **Databáze:** IndexedDB přes `dexie` & `dexie-react-hooks`
- **Podpisový engine:** Vlastní Pointer Events s Bézier vyhlazováním & Retina DPR škálováním
- **QR platby:** SPAYD (Short Payment Descriptor) generátor dle ČBA
- **PWA:** Web App Manifest + Service Worker offline cache
- **Testování:** Vitest + Happy DOM (774 testů, 100% pass)
- **Linter:** Oxlint

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

### Spuštění testů
```bash
npm test
```

---

## 📁 Struktura zdrojových kódů

```
src/
├── types/
│   └── index.ts                 # Datové modely (WorkEntry, Svařování, Podpisy, Fotky)
├── db/
│   ├── index.ts                 # Dexie databáze & migrace schémat
│   └── seedData.ts              # Bohatá realistická česká mock data pro svářeče
├── services/
│   ├── pricingEngine.ts         # Matematický model sazeb, pauz, MPSV diet a násobků
│   ├── weldingPassportService.ts# Číselníky metod ISO 4063, jakostí oceli a plynů
│   ├── consumablesCatalog.ts    # Katalog montážního spotřebního materiálu a marží
│   ├── imageCompressionService.ts# Klientská offline komprese pod 500 KB a vodoznak
│   ├── spaydService.ts          # Generátor bankovního QR kódu SPAYD s validací IBAN
│   ├── exportService.ts         # Excel CSV export, JSON backup & restore
│   └── aresService.ts           # Online načítání firemních údajů z registru ARES
├── components/
│   ├── signature/
│   │   ├── SignaturePad.tsx     # Dotykové plátno s vyhlazováním Bézier a Retina škálováním
│   │   └── SignaturePadModal.tsx# Dialog pro podpis zhotovitele a objednatele
│   ├── layout/
│   │   ├── Header.tsx           # Hlavička, offline indikátor, správa záloh
│   │   └── Navigation.tsx       # Spodní navigace pro palec + desktop záložky
│   ├── entries/
│   │   ├── EntriesList.tsx       # Filtrovatelný seznam s vyhledáváním a KPI
│   │   └── EntryCard.tsx        # Interaktivní karta směny s rychlým podpisem a fotkami
│   ├── form/
│   │   ├── ShiftModalForm.tsx   # Terénní formulář směny s presety a kalkulátorem
│   │   ├── QuickBreakButtons.tsx# Rychlá tlačítka pro pauzu
│   │   └── sections/            # Modulární sekce formuláře (Project, Time, Travel, Photo, Extras...)
│   ├── report/
│   │   └── InvoiceReportView.tsx# A4 předávací protokol, podpisy, fotky a SPAYD QR
│   ├── dashboard/
│   │   ├── StatsDashboard.tsx   # KPI karty, statistiky, poměr dílna/montáže
│   │   └── BillingKanban.tsx    # Pipeline stavů (Koncept -> Odevzdáno -> Vyfakturováno -> Zaplaceno)
│   └── settings/
│       └── RatesSettingsModal.tsx # Konfigurace sazeb, příplatků, šablon a profilu OSVČ
├── App.tsx                      # Hlavní komponenta a reaktivní stav
└── index.css                    # Tailwind CSS a vyhrazené @media print styly pro A4
```
