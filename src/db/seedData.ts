import { 
  WorkEntry, 
  ShiftPreset, 
  AppSettings 
} from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  contractor: {
    name: 'Montér / Svářeč',
    tradeTitle: 'Svářečské, zámečnické a montážní práce',
    ico: '12345678',
    dic: '',
    address: 'Průmyslová 100',
    city: 'Praha',
    zip: '110 00',
    bankAccount: '123456789/0100',
    bankCode: '0100',
    iban: 'CZ6501000000000123456789',
    swift: 'KOMBCZPPXXX',
    phone: '+420 777 000 000',
    email: 'montaz@email.cz',
    certifications: 'ČSN EN ISO 9606-1 (141 TIG nerez/černý, 135 MAG ocel), Vazačský & Jeřábnický průkaz, Práce ve výškách'
  },
  rates: {
    defaultWorkshopRate: 480,       // Kč/h dílna
    defaultSiteAssemblyRate: 620,   // Kč/h montáž na stavbě
    defaultEmergencyRate: 850,      // Kč/h havárie/pohotovost
    defaultTravelOnlyRate: 350,     // Kč/h čas na cestě (řízení)
    defaultRatePerKm: 11,           // Kč/km náhrada za opotřebení + PHM dodávky
    defaultTravelHourlyRate: 350,   // Kč/h za volantem
    dietHalfDayRate: 166,           // 5-12 hod (Pásmo 1 MPSV)
    dietFullDayRate: 256,           // 12-18 hod (Pásmo 2 MPSV)
    dietOver18Rate: 398,            // nad 18 hod (Pásmo 3 MPSV)
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
      defaultKm: 95,
      isPdpDefault: true
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
  darkMode: true,
  currencySymbol: 'Kč'
};

export const DEFAULT_PRESETS: ShiftPreset[] = [
  {
    id: 'preset_workshop_std',
    name: 'Dílna – Standard svařování (480 Kč/h)',
    description: 'Příprava, zámečnické sesazení a svařování v dílně s plným vybavením.',
    workType: 'workshop_welding',
    baseHourlyRate: 480,
    complexityMultiplier: 1.0,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'MIG_MAG',
    weldingPassport: {
      methodCode: '135',
      methodName: 'MAG – Obloukové svařování tavící se elektrodou v aktivním plynu',
      baseMaterialGrade: 'S235JR',
      materialThickness: '10.0 mm',
      shieldingGas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
      fillerBatch: 'ESAB OK Autrod 12.51, Ø 1.2 mm, šarže #E94120',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-135-P-FW-FM1-S-t10',
      weldInspectionVT: 'passed_B',
    },
    activityTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    workActionTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    notesTemplate: 'Dílenská příprava a stehování dle výkresové dokumentace.',
    isDefault: true
  },
  {
    id: 'preset_site_heights',
    name: 'Montáž stavba – Výšky / nerez (620 Kč/h + násobič 1.25)',
    description: 'Montáž na stavbě v plošině nebo na lešení, potrubní rozvody.',
    workType: 'site_assembly',
    baseHourlyRate: 620,
    complexityMultiplier: 1.25,
    defaultBreakMinutes: 45,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'TIG',
    weldingPassport: {
      methodCode: '141',
      methodName: 'TIG – Obloukové svařování wolframovou elektrodou v inertním plynu',
      baseMaterialGrade: '1.4404 (AISI 316L nerez)',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
      rootBackingGas: true,
      welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0',
      weldInspectionVT: 'passed_B',
    },
    activityTags: ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'],
    workActionTags: ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'],
    notesTemplate: 'Montáž a zavaření ve výšce z montážní plošiny. Vizuální kontrola svárů VT2.'
  },
  {
    id: 'preset_emergency_weekend',
    name: 'Havárie / Víkendová pohotovost (850 Kč/h)',
    description: 'Okamžitý výjezd, odstávka výroby, havarijní oprava technologií.',
    workType: 'service_emergency',
    baseHourlyRate: 850,
    complexityMultiplier: 1.5,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 450,
    weldingMethod: 'MMA',
    weldingPassport: {
      methodCode: '111',
      methodName: 'MMA – Ruční obloukové svařování obalenou elektrodou',
      baseMaterialGrade: 'HARDOX 450',
      materialThickness: '20.0 mm',
      shieldingGas: 'Bez ochranného plynu (tavidlo obalu elektrody)',
      fillerBatch: 'Böhler FOX EV 50, Ø 3.2 mm, šarže #H58201',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-111-P-BW-FM2-B-t20',
      weldInspectionVT: 'passed_C',
    },
    activityTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    workActionTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    notesTemplate: 'Havarijní oprava prasklého rámu/potrubí v době provozní odstávky.'
  },
  {
    id: 'preset_tig_pipe',
    name: 'TIG Potrubí – Zrcátko / stísněné prostory (700 Kč/h)',
    description: 'Náročné sváry nerez/tlakových rozvodů pod rentgen/ultrazvuk.',
    workType: 'site_assembly',
    baseHourlyRate: 700,
    complexityMultiplier: 1.3,
    defaultBreakMinutes: 30,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'TIG',
    weldingPassport: {
      methodCode: '141',
      methodName: 'TIG – Obloukové svařování wolframovou elektrodou v inertním plynu',
      baseMaterialGrade: '1.4404 (AISI 316L nerez)',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.4 mm, šarže #849102',
      rootBackingGas: true,
      welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
      weldInspectionVT: 'passed_B',
    },
    activityTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    workActionTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    notesTemplate: 'Svařování metodou 141 (TIG) s formováním kořene argonem. Pozice H-L045.'
  },
  {
    id: 'preset_travel_delivery',
    name: 'Pouze cesťák a převoz materiálu',
    description: 'Závoz svařenců na lakovnu, nákup hutního materiálu a technických plynů.',
    workType: 'travel_only',
    baseHourlyRate: 350,
    complexityMultiplier: 1.0,
    defaultBreakMinutes: 0,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    weldingMethod: 'NONE',
    weldingPassport: {
      methodCode: 'NONE',
      methodName: 'Bez svářečských prací – převoz a závoz materiálu',
      baseMaterialGrade: 'N/A',
      materialThickness: 'N/A',
      shieldingGas: 'N/A',
      fillerBatch: 'N/A',
      rootBackingGas: false,
      weldInspectionVT: 'not_required',
    },
    activityTags: ['Příprava'],
    workActionTags: ['Příprava'],
    notesTemplate: 'Převoz konstrukčních prvků na žárové zinkování.'
  }
];

export const INITIAL_MOCK_ENTRIES: WorkEntry[] = [
  {
    id: 'entry-01',
    date: '2026-03-02',
    projectCode: 'Hala-C/2026',
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
      dietAllowance: 166, // 5-12h (Pásmo 1 MPSV)
      dietType: 'band_1'
    },
    extraCosts: [
      { id: 'cost-1', description: 'Formovací plyn Argon 4.6 (1 lahev doplatková)', amount: 650 },
      { id: 'cost-2', description: 'Přídavný drát ER316L 2.0mm (2 kg)', amount: 480 }
    ],
    totalEarnings: Math.round(8.75 * 775 + (85 * 11 + 1.5 * 350 + 166) + 1130),
    status: 'invoiced',
    isPdp: true,
    notes: 'Svařování potrubní větve chlazení ve výšce z nůžkové plošiny. Vizuální zkouška VT provedena bez vad.',
    activityTags: ['Příprava', 'Svařování', 'Montáž ve výškách'],
    workActionTags: ['Příprava', 'Svařování', 'Montáž ve výškách'],
    consumableSlip: {
      overheadMarkupPercent: 15,
      fixedOverheadFee: 0,
      totalMaterialCost: 1130,
      totalBilledAmount: 1130,
      items: [
        {
          id: 'cost-1',
          category: 'technical_gases',
          name: 'Formovací plyn Argon 4.6 (1 lahev doplatková)',
          quantity: 1,
          unit: 'lahev',
          unitPrice: 650,
          markupPercent: 0,
          billedPrice: 650
        },
        {
          id: 'cost-2',
          category: 'welding_consumables',
          name: 'Přídavný drát ER316L 2.0mm (2 kg)',
          quantity: 2,
          unit: 'kg',
          unitPrice: 240,
          markupPercent: 0,
          billedPrice: 480
        }
      ]
    },
    weldingMethod: 'TIG',
    weldingPassport: {
      methodCode: '141',
      methodName: 'TIG – Obloukové svařování wolframovou elektrodou v inertním plynu',
      baseMaterialGrade: '1.4404 (AISI 316L nerez)',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
      rootBackingGas: true,
      welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
      weldInspectionVT: 'passed_B',
    },
    invoiceNumber: 'VF-2026/028',
    invoiceDate: '2026-03-05',
    paymentDueDate: '2026-03-25',
    createdAt: '2026-03-02T17:00:00.000Z',
    updatedAt: '2026-03-05T09:15:00.000Z'
  },
  {
    id: 'entry-02',
    date: '2026-03-03',
    projectCode: 'Hala-C/2026',
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
      dietAllowance: 166,
      dietType: 'band_1'
    },
    extraCosts: [
      { id: 'cost-3', description: 'Kotvy Hilti M12 pro nerezové konzole (20 ks)', amount: 760 }
    ],
    totalEarnings: Math.round(9.5 * 775 + (85 * 11 + 1.5 * 350 + 166) + 760),
    status: 'invoiced',
    isPdp: true,
    notes: 'Montáž a ukotvení podpěrných třmenů potrubí. Tlaková zkouška úseku 1 splněna.',
    activityTags: ['Příprava', 'Montáž ve výškách', 'Kotvení'],
    workActionTags: ['Příprava', 'Montáž ve výškách', 'Kotvení'],
    consumableSlip: {
      overheadMarkupPercent: 0,
      fixedOverheadFee: 0,
      totalMaterialCost: 760,
      totalBilledAmount: 760,
      items: [
        {
          id: 'cost-3',
          category: 'anchors',
          name: 'Kotvy Hilti M12 pro nerezové konzole (20 ks)',
          quantity: 20,
          unit: 'ks',
          unitPrice: 38,
          markupPercent: 0,
          billedPrice: 760
        }
      ]
    },
    weldingMethod: 'TIG',
    weldingPassport: {
      methodCode: '141',
      methodName: 'TIG – Obloukové svařování wolframovou elektrodou v inertním plynu',
      baseMaterialGrade: '1.4404 (AISI 316L nerez)',
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
      fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
      rootBackingGas: true,
      welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
      weldInspectionVT: 'passed_B',
    },
    invoiceNumber: 'VF-2026/028',
    invoiceDate: '2026-03-05',
    paymentDueDate: '2026-03-25',
    createdAt: '2026-03-03T17:30:00.000Z',
    updatedAt: '2026-03-05T09:15:00.000Z'
  },
  {
    id: 'entry-03',
    date: '2026-03-04',
    projectCode: 'HEB-240-DILNA',
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
      dietAllowance: 166,
      dietType: 'band_1'
    },
    extraCosts: [
      { id: 'cost-4', description: 'Směsný plyn CORGON 18 (podíl)', amount: 450 },
      { id: 'cost-5', description: 'Drát SG2 1.2mm cívka 15kg', amount: 1100 }
    ],
    totalEarnings: Math.round(8.0 * 480 + (22 * 11 + 0.5 * 350 + 166) + 1550),
    status: 'paid',
    notes: 'Svařování kotevních desek a výztuh na HEB 240. Vícevrstvé koutové sváry a=8mm. Připraveno na tryskání.',
    activityTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    workActionTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    weldingMethod: 'MIG_MAG',
    weldingPassport: {
      methodCode: '135',
      methodName: 'MAG – Obloukové svařování tavící se elektrodou v aktivním plynu',
      baseMaterialGrade: 'S355J2+N',
      materialThickness: '12.0 mm',
      shieldingGas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
      fillerBatch: 'ESAB OK Autrod 12.51, Ø 1.2 mm, šarže #E94120',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-135-P-FW-FM1-S-t12-PB-ml',
      weldInspectionVT: 'passed_B',
    },
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
    projectCode: 'SERVIS-LIS-01',
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
      dietAllowance: 166,
      dietType: 'band_1'
    },
    extraCosts: [
      { id: 'cost-6', description: 'Speciální elektrody na litinu UTP 86 FN (1 balení)', amount: 1850 },
      { id: 'cost-7', description: 'Drážkovací uhlíky Gouging + předehřev hořákem', amount: 620 }
    ],
    totalEarnings: Math.round(7.0 * 1530 + (36 * 11 + 1.0 * 450 + 166) + 2470),
    status: 'submitted',
    notes: 'Vyřezání a vybroušení únavové praskliny v litinovém loži lisu. Postupný předehřev na 250°C a vykovávání každé vrstvy sváru. Provoz obnoven.',
    activityTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    workActionTags: ['Příprava', 'Svařování', 'Broušení/začištění'],
    weldingMethod: 'MMA',
    weldingPassport: {
      methodCode: '111',
      methodName: 'MMA – Ruční obloukové svařování obalenou elektrodou',
      baseMaterialGrade: 'HARDOX 450',
      materialThickness: '20.0 mm',
      shieldingGas: 'Bez ochranného plynu (tavidlo obalu elektrody)',
      fillerBatch: 'Böhler FOX EV 50, Ø 3.2 mm, šarže #H58201',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-111-P-BW-FM2-B-t20',
      weldInspectionVT: 'passed_C',
    },
    createdAt: '2026-03-05T05:00:00.000Z',
    updatedAt: '2026-03-05T05:00:00.000Z'
  },
  {
    id: 'entry-05',
    date: '2026-03-06',
    projectCode: 'LAVKA-14M',
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
      dietAllowance: 166,
      dietType: 'band_1'
    },
    extraCosts: [
      { id: 'cost-8', description: 'Spojovací materiál pevnostní 8.8 pozink M16x60 (50 ks)', amount: 890 }
    ],
    totalEarnings: Math.round(8.0 * 775 + (85 * 11 + 1.5 * 350 + 166) + 890),
    status: 'draft',
    isPdp: true,
    notes: 'Usazení dílů lávky jeřábem, svrtání patek a zavaření styčníkových plechů. Počasí: silný vítr, nutno jistit vazačským lanem.',
    activityTags: ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'],
    workActionTags: ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'],
    weldingMethod: 'COMBINED',
    weldingPassport: {
      methodCode: '141_135',
      methodName: 'Kombinovaný proces: TIG kořen (141) + MAG výplň a krycí vrstva (135)',
      baseMaterialGrade: 'S355J2',
      materialThickness: '10.0 mm',
      shieldingGas: 'Argon 4.6 + CORGON 18',
      fillerBatch: 'Böhler EMK 6 (TIG) / OK Autrod 12.51 (MAG)',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-141/135-T-BW',
      weldInspectionVT: 'passed_B',
    },
    createdAt: '2026-03-06T16:30:00.000Z',
    updatedAt: '2026-03-06T16:30:00.000Z'
  }
];
