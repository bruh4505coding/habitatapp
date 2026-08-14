export type HabitatPaletteKey =
  | 'forest'
  | 'sage'
  | 'desert'
  | 'ocean'
  | 'wildflower'
  | 'slate';

export type HabitatPalette = {
  key: HabitatPaletteKey;
  label: string;
  background: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
};

export const HABITAT_PALETTES: HabitatPalette[] = [
  {
    key: 'forest',
    label: 'Forest',
    background: '#f0f5ef',
    surface: '#ffffff',
    accent: '#388e3c',
    text: '#1a2e1a',
    muted: '#667266',
    border: '#cbd8ca',
  },
  {
    key: 'sage',
    label: 'Sage',
    background: '#f3f3e8',
    surface: '#fffef7',
    accent: '#6f8053',
    text: '#303827',
    muted: '#747967',
    border: '#d7d9c5',
  },
  {
    key: 'desert',
    label: 'Desert',
    background: '#fbf1e3',
    surface: '#fffaf3',
    accent: '#b85f32',
    text: '#493124',
    muted: '#806d61',
    border: '#e5cdb7',
  },
  {
    key: 'ocean',
    label: 'Ocean',
    background: '#eaf5f7',
    surface: '#f9fdfe',
    accent: '#147d8f',
    text: '#173b42',
    muted: '#607980',
    border: '#bfd9de',
  },
  {
    key: 'wildflower',
    label: 'Wildflower',
    background: '#f8eff7',
    surface: '#fffaff',
    accent: '#9b4f91',
    text: '#442d42',
    muted: '#806d7e',
    border: '#dec9dc',
  },
  {
    key: 'slate',
    label: 'Slate',
    background: '#eef2f4',
    surface: '#fbfcfd',
    accent: '#526b7a',
    text: '#263740',
    muted: '#697981',
    border: '#ccd6db',
  },
];

export const DEFAULT_HABITAT_PALETTE = HABITAT_PALETTES[0];

export function isHabitatPaletteKey(value: unknown): value is HabitatPaletteKey {
  return HABITAT_PALETTES.some((palette) => palette.key === value);
}

export function getHabitatPalette(value: unknown): HabitatPalette {
  if (!isHabitatPaletteKey(value)) return DEFAULT_HABITAT_PALETTE;
  return HABITAT_PALETTES.find((palette) => palette.key === value)
    ?? DEFAULT_HABITAT_PALETTE;
}
