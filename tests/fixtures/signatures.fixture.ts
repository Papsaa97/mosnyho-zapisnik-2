export interface SignaturePoint {
  x: number;
  y: number;
  time?: number;
  pressure?: number;
}

export interface SignatureStroke {
  points: SignaturePoint[];
  color?: string;
  lineWidth?: number;
}

export interface ProtocolSignature {
  dataUrl: string;
  signerName: string;
  signedAt: string;
  role: 'contractor' | 'client';
}

// 1x1 transparent PNG data URL fallback
export const EMPTY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Realistic sample PNG data URL for contractor signature
export const CONTRACTOR_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAADDhn8LAAAACXBIWXMAAAsTAAALEwEAmpwYAAABTmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQ/Pg==';

// Realistic sample PNG data URL for client signature
export const CLIENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAADDhn8LAAAACXBIWXMAAAsTAAALEwEAmpwYAAABTmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQ/Pg==';

/** Vector stroke points representing contractor signature ("Novák") */
export const CONTRACTOR_STROKES_FIXTURE: SignatureStroke[] = [
  {
    points: [
      { x: 20, y: 50, time: 1000, pressure: 0.5 },
      { x: 25, y: 20, time: 1050, pressure: 0.6 },
      { x: 30, y: 55, time: 1100, pressure: 0.7 },
      { x: 38, y: 25, time: 1150, pressure: 0.6 },
      { x: 45, y: 50, time: 1200, pressure: 0.5 },
    ],
  },
  {
    points: [
      { x: 50, y: 40, time: 1300, pressure: 0.5 },
      { x: 60, y: 35, time: 1350, pressure: 0.5 },
      { x: 70, y: 42, time: 1400, pressure: 0.6 },
      { x: 80, y: 30, time: 1450, pressure: 0.4 },
      { x: 110, y: 65, time: 1550, pressure: 0.8 },
    ],
  },
];

/** Vector stroke points representing client signature ("Dvořák") */
export const CLIENT_STROKES_FIXTURE: SignatureStroke[] = [
  {
    points: [
      { x: 30, y: 30, time: 2000, pressure: 0.6 },
      { x: 32, y: 60, time: 2050, pressure: 0.7 },
      { x: 55, y: 45, time: 2120, pressure: 0.6 },
      { x: 32, y: 32, time: 2180, pressure: 0.5 },
    ],
  },
  {
    points: [
      { x: 60, y: 50, time: 2300, pressure: 0.5 },
      { x: 75, y: 40, time: 2350, pressure: 0.5 },
      { x: 90, y: 55, time: 2400, pressure: 0.6 },
      { x: 120, y: 35, time: 2500, pressure: 0.7 },
    ],
  },
];

/** Single-dot tap boundary stroke */
export const SINGLE_POINT_STROKE_FIXTURE: SignatureStroke[] = [
  {
    points: [{ x: 50, y: 50, time: 500, pressure: 0.5 }],
  },
];

/** Full contractor protocol signature fixture */
export const CONTRACTOR_SIGNATURE_FIXTURE: ProtocolSignature = {
  dataUrl: CONTRACTOR_PNG_DATA_URL,
  signerName: 'Jan Novák (Zhotovitel)',
  signedAt: '2026-03-02T16:45:00.000Z',
  role: 'contractor',
};

/** Full client protocol signature fixture */
export const CLIENT_SIGNATURE_FIXTURE: ProtocolSignature = {
  dataUrl: CLIENT_PNG_DATA_URL,
  signerName: 'Ing. Karel Dvořák (Objednatel / TDI)',
  signedAt: '2026-03-02T16:50:00.000Z',
  role: 'client',
};
