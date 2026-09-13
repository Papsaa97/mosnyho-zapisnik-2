import { ClientProfile } from '../../src/types';

/** Standard commercial client with VAT (construction investor, non-PDP) */
export const CLIENT_STANDARD_VAT: ClientProfile = {
  id: 'client_metrostav',
  name: 'Metrostav DIZ s.r.o.',
  ico: '24235281',
  dic: 'CZ24235281',
  address: 'Koželužská 2450/4, 180 00 Praha 8',
  contactPerson: 'Ing. Karel Dvořák (hlavní stavbyvedoucí)',
  phone: '+420 602 114 887',
  email: 'dvorak.karel@metrostav.cz',
  defaultKm: 95,
  defaultRateOverride: 650,
  isPdpDefault: false,
  isPdp: false,
};

/** Construction general contractor in reverse charge mode (§ 92e PDP) */
export const CLIENT_PDP_REVERSE_CHARGE: ClientProfile = {
  id: 'client_technomont_pdp',
  name: 'TechnoMont Industrial s.r.o.',
  ico: '05432987',
  dic: 'CZ05432987',
  address: 'Železniční 15, 301 00 Plzeň',
  contactPerson: 'Miroslav Beran (vedoucí výroby)',
  phone: '+420 739 554 210',
  email: 'beran@technomont.cz',
  defaultKm: 25,
  defaultRateOverride: 620,
  isPdpDefault: true,
  isPdp: true,
};

/** Small engineering workshop client without preconfigured PDP */
export const CLIENT_KOVO_NOVAK: ClientProfile = {
  id: 'client_kovo_novak',
  name: 'KovoVýroba & Zámečnictví Novák s.r.o.',
  ico: '28741029',
  dic: 'CZ28741029',
  address: 'Tovární 44, 330 23 Nýřany',
  contactPerson: 'Petr Novák (jednatel)',
  phone: '+420 777 401 239',
  email: 'novak@kovo-novak.cz',
  defaultKm: 18,
  isPdpDefault: false,
  isPdp: false,
};

/** Array of all standard test clients */
export const CLIENT_FIXTURES: ClientProfile[] = [
  CLIENT_STANDARD_VAT,
  CLIENT_PDP_REVERSE_CHARGE,
  CLIENT_KOVO_NOVAK,
];
