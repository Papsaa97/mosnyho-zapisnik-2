import { 
  WorkEntry, 
  ShiftPreset, 
  AppSettings 
} from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  contractor: {
    name: 'Kryštof Mošner',
    tradeTitle: 'Svářečské, zámečnické a montážní práce',
    ico: '87452190',
    dic: 'CZ8905141234',
    address: 'Průmyslová 1420/8',
    city: 'Plzeň',
    zip: '301 00',
    bankAccount: '2401897654/2010',
    bankCode: '2010',
    iban: 'CZ7820100000002401897654',
    swift: 'FIOBCZPPXXX',
    phone: '+420 775 892 341',
    email: 'krystof.mosner@seznam.cz',
    certifications: 'ČSN EN ISO 9606-1 (141 TIG nerez/černý, 135 MAG ocel), Vazačský & Jeřábnický průkaz, Práce ve výškách'
  },
  rates: {
    defaultWorkshopRate: 480,       // Kč/h dílna
    defaultSiteAssemblyRate: 620,   // Kč/h montáž na stavbě
    defaultEmergencyRate: 850,      // Kč/h havárie/pohotovost
    defaultTravelOnlyRate: 350,     // Kč/h čas na cestě (řízení)
    defaultRatePerKm: 11,           // Kč/km náhrada za opotřebení + PHM dodávky
    defaultTravelHourlyRate: 350,   // Kč/h za volantem
    dietHalfDayRate: 170,           // 5-12 hod
    dietFullDayRate: 290,           // nad 12 hod
    surcharges: {
      weekendPercent: 25,
      nightPercent: 20,
      holidayPercent: 50,
      fixedWeekendBonus: 120,
      fixedNightBonus: 100,
      fixedHolidayBonus: 250,
      useFixedBonus: false
    }
  },
  clients: [
    {
      id: 'client_metrostav',
      name: 'Metrostav DIZ s.r.o.',
      ico: '24235281',
      dic: 'CZ24235281',
      address: 'Koželužská 2450/4, 180 00 Praha 8',
      contactPerson: 'Ing. Karel Dvořák (hlavní stavbyvedoucí)',
      phone: '+420 602 114 887',
      email: 'dvorak.karel@metrostav.cz',
      defaultKm: 95
    },
    {
      id: 'client_technomont',
      name: 'TechnoMont Industrial s.r.o.',
      ico: '05432987',
      dic: 'CZ05432987',
      address: 'Železniční 15, 301 00 Plzeň',
      contactPerson: 'Miroslav Beran (vedoucí výroby)',
      phone: '+420 739 554 210',
      email: 'beran@technomont.cz',
      defaultKm: 25
    },
    {
      id: 'client_kovo_novak',
      name: 'KovoVýroba & Zámečnictví Novák s.r.o.',
      ico: '28741029',
      address: 'Tovární 44, 330 23 Nýřany',
      contactPerson: 'Petr Novák (jednatel)',
      phone: '+420 777 401 239',
      email: 'novak@kovo-novak.cz',
      defaultKm: 18
    }
  ],
  materialCatalog: [
    { id: 'mat_argon', name: 'Argon 4.6 (láhev)', unitPrice: 650, unit: 'ks' },
    { id: 'mat_tig_wire', name: 'Přídavný drát TIG ER316L', unitPrice: 240, unit: 'kg' },
    { id: 'mat_sg2_wire', name: 'Svářecí drát SG2 15kg (cívka)', unitPrice: 1100, unit: 'ks' },
    { id: 'mat_cutting_discs', name: 'Řezné kotouče 125mm (balení 10ks)', unitPrice: 350, unit: 'bal' },
    { id: 'mat_anchors', name: 'Kotevní materiál / svorníky M16', unitPrice: 800, unit: 'bal' }
  ],
  darkMode: true,
  currencySymbol: 'Kč'
};

export const DEFAULT_PRESETS: ShiftPreset[] = [
  {
    id: 'preset_workshop_std',
    name: 'Dílna – Standard svařování (480 Kč/h)',
    workType: 'workshop_welding',
    baseHourlyRate: 480,
    complexityMultiplier: 1.0,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'MIG_MAG',
    notesTemplate: 'Dílenská příprava a stehování dle výkresové dokumentace.',
    isDefault: true
  },
  {
    id: 'preset_site_heights',
    name: 'Montáž stavba – Výšky / nerez (620 Kč/h + násobič 1.25)',
    workType: 'site_assembly',
    baseHourlyRate: 620,
    complexityMultiplier: 1.25,
    defaultBreakMinutes: 45,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'TIG',
    notesTemplate: 'Montáž a zavaření ve výšce z montážní plošiny. Vizuální kontrola svárů VT2.'
  },
  {
    id: 'preset_emergency_weekend',
    name: 'Havárie / Víkendová pohotovost (850 Kč/h)',
    workType: 'service_emergency',
    baseHourlyRate: 850,
    complexityMultiplier: 1.5,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 450,
    weldingMethod: 'MMA',
    notesTemplate: 'Havarijní oprava prasklého rámu/potrubí v době provozní odstávky.'
  },
  {
    id: 'preset_tig_pipe',
    name: 'TIG Potrubí – Zrcátko / stísněné prostory (700 Kč/h)',
    workType: 'site_assembly',
    baseHourlyRate: 700,
    complexityMultiplier: 1.3,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'TIG',
    notesTemplate: 'Svařování metodou 141 (TIG) s formováním kořene argonem. Pozice H-L045.'
  },
  {
    id: 'preset_travel_delivery',
    name: 'Pouze cesťák a převoz materiálu',
    workType: 'travel_only',
    baseHourlyRate: 350,
    complexityMultiplier: 1.0,
    defaultBreakMinutes: 0,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'NONE',
    notesTemplate: 'Převoz konstrukčních prvků na žárové zinkování.'
  }
];

export const INITIAL_MOCK_ENTRIES: WorkEntry[] = [
  {
    id: 'entry-01',
    date: '2026-03-02',
    projectName: 'Hala C – Nerezová potrubní trasa DN150',
    clientName: 'Metrostav DIZ s.r.o.',
    workType: 'site_assembly',
    startTime: '07:00',
    endTime: '16:30',
    breakMinutes: 45,
    totalHours: 8.75,
    pricing: {
      baseHourlyRate: 620,
      complexityMultiplier: 1.25, // práce ve výškách 8m
      shiftSurcharges: [],
      calculatedHourlyRate: 775 // 620 * 1.25
    },
    travel: {
      distanceKm: 85,
      ratePerKm: 11,
      travelTimeHours: 1.5,
      travelHourlyRate: 350,
      dietAllowance: 170, // 5-12h
      dietType: 'half_day'
    },
    extraCosts: [
      { id: 'cost-1', description: 'Formovací plyn Argon 4.6 (1 lahev doplatková)', amount: 650 },
      { id: 'cost-2', description: 'Přídavný drát ER316L 2.0mm (2 kg)', amount: 480 }
    ],
    totalEarnings: 875 * 7.75 + (85 * 11 + 1.5 * 350 + 170) + 1130, // 6781.25 + 1630 + 1130 = 9541
    status: 'invoiced',
    notes: 'Svařování potrubní větve chlazení ve výšce z nůžkové plošiny. Vizuální zkouška VT provedena bez vad.',
    weldingMethod: 'TIG',
    invoiceNumber: 'VF-2026/028',
    invoiceDate: '2026-03-05',
    paymentDueDate: '2026-03-25',
    createdAt: '2026-03-02T17:00:00.000Z',
    updatedAt: '2026-03-05T09:15:00.000Z'
  },
  {
    id: 'entry-02',
    date: '2026-03-03',
    projectName: 'Hala C – Nerezová potrubní trasa DN150',
    clientName: 'Metrostav DIZ s.r.o.',
    workType: 'site_assembly',
    startTime: '07:00',
    endTime: '17:00',
    breakMinutes: 30,
    totalHours: 9.5,
    pricing: {
      baseHourlyRate: 620,
      complexityMultiplier: 1.25,
      shiftSurcharges: [],
      calculatedHourlyRate: 775
    },
    travel: {
      distanceKm: 85,
      ratePerKm: 11,
      travelTimeHours: 1.5,
      travelHourlyRate: 350,
      dietAllowance: 170,
      dietType: 'half_day'
    },
    extraCosts: [
      { id: 'cost-3', description: 'Kotvy Hilti M12 pro nerezové konzole (20 ks)', amount: 760 }
    ],
    totalEarnings: Math.round(9.5 * 775 + (85 * 11 + 1.5 * 350 + 170) + 760),
    status: 'invoiced',
    notes: 'Montáž a ukotvení podpěrných třmenů potrubí. Tlaková zkouška úseku 1 splněna.',
    weldingMethod: 'TIG',
    invoiceNumber: 'VF-2026/028',
    invoiceDate: '2026-03-05',
    paymentDueDate: '2026-03-25',
    createdAt: '2026-03-03T17:30:00.000Z',
    updatedAt: '2026-03-05T09:15:00.000Z'
  },
  {
    id: 'entry-03',
    date: '2026-03-04',
    projectName: 'Dílna – Nosníky a patky HEB 240 pro přístavek',
    clientName: 'TechnoMont Industrial s.r.o.',
    workType: 'workshop_welding',
    startTime: '06:30',
    endTime: '15:00',
    breakMinutes: 30,
    totalHours: 8.0,
    pricing: {
      baseHourlyRate: 480,
      complexityMultiplier: 1.0,
      shiftSurcharges: [],
      calculatedHourlyRate: 480
    },
    travel: {
      distanceKm: 22,
      ratePerKm: 11,
      travelTimeHours: 0.5,
      travelHourlyRate: 350,
      dietAllowance: 170,
      dietType: 'half_day'
    },
    extraCosts: [
      { id: 'cost-4', description: 'Směsný plyn CORGON 18 (podíl)', amount: 450 },
      { id: 'cost-5', description: 'Drát SG2 1.2mm cívka 15kg', amount: 1100 }
    ],
    totalEarnings: Math.round(8.0 * 480 + (22 * 11 + 0.5 * 350 + 170) + 1550),
    status: 'paid',
    notes: 'Svařování kotevních desek a výztuh na HEB 240. Vícevrstvé koutové sváry a=8mm. Připraveno na tryskání.',
    weldingMethod: 'MIG_MAG',
    invoiceNumber: 'VF-2026/027',
    invoiceDate: '2026-03-04',
    paymentDueDate: '2026-03-18',
    paidDate: '2026-03-05',
    createdAt: '2026-03-04T15:30:00.000Z',
    updatedAt: '2026-03-05T14:00:00.000Z'
  },
  {
    id: 'entry-04',
    date: '2026-03-05',
    projectName: 'Havarijní oprava stolu lisu 400t – Noční směna',
    clientName: 'KovoVýroba & Zámečnictví Novák s.r.o.',
    workType: 'service_emergency',
    startTime: '21:00',
    endTime: '04:30',
    breakMinutes: 30,
    totalHours: 7.0,
    pricing: {
      baseHourlyRate: 850,
      complexityMultiplier: 1.5,
      shiftSurcharges: ['night'],
      calculatedHourlyRate: 1530 // 850 * 1.5 * 1.20
    },
    travel: {
      distanceKm: 36,
      ratePerKm: 11,
      travelTimeHours: 1.0,
      travelHourlyRate: 450,
      dietAllowance: 170,
      dietType: 'half_day'
    },
    extraCosts: [
      { id: 'cost-6', description: 'Speciální elektrody na litinu UTP 86 FN (1 balení)', amount: 1850 },
      { id: 'cost-7', description: 'Drážkovací uhlíky Gouging + předehřev hořákem', amount: 620 }
    ],
    totalEarnings: Math.round(7.0 * 1530 + (36 * 11 + 1.0 * 450 + 170) + 2470),
    status: 'submitted',
    notes: 'Vyřezání a vybroušení únavové praskliny v litinovém loži lisu. Postupný předehřev na 250°C a vykovávání každé vrstvy sváru. Provoz obnoven.',
    weldingMethod: 'MMA',
    createdAt: '2026-03-05T05:00:00.000Z',
    updatedAt: '2026-03-05T05:00:00.000Z'
  },
  {
    id: 'entry-05',
    date: '2026-03-06',
    projectName: 'Technologická lávka a zábradlí – montáž ve výšce 14m',
    clientName: 'Metrostav DIZ s.r.o.',
    workType: 'site_assembly',
    startTime: '07:30',
    endTime: '16:00',
    breakMinutes: 30,
    totalHours: 8.0,
    pricing: {
      baseHourlyRate: 620,
      complexityMultiplier: 1.25,
      shiftSurcharges: [],
      calculatedHourlyRate: 775
    },
    travel: {
      distanceKm: 85,
      ratePerKm: 11,
      travelTimeHours: 1.5,
      travelHourlyRate: 350,
      dietAllowance: 170,
      dietType: 'half_day'
    },
    extraCosts: [
      { id: 'cost-8', description: 'Spojovací materiál pevnostní 8.8 pozink M16x60 (50 ks)', amount: 890 }
    ],
    totalEarnings: Math.round(8.0 * 775 + (85 * 11 + 1.5 * 350 + 170) + 890),
    status: 'draft',
    notes: 'Usazení dílů lávky jeřábem, svrtání patek a zavaření styčníkových plechů. Počasí: silný vítr, nutno jistit vazačským lanem.',
    weldingMethod: 'COMBINED',
    createdAt: '2026-03-06T16:30:00.000Z',
    updatedAt: '2026-03-06T16:30:00.000Z'
  }
];
