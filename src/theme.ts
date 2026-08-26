/**
 * Night City palette — lifted from the design canvas (design/*.dc.html).
 * Blue carries progress, pink is reserved for "next up", violet means finished.
 */
export const colors = {
  bg: '#0a0d18',
  bgTabBar: '#0d1120',
  surface: '#151a2e',
  surfaceRaised: '#171c30',
  surfaceSoft: '#141930',
  surfaceButton: '#1f2540',
  border: '#242b47',
  borderSoft: '#1c2238',
  borderControl: '#2c3457',
  track: '#242b47',
  trackSmall: '#212843',

  text: '#e9ecfa',
  textStrong: '#ffffff',
  textSecondary: '#c3c9e6',
  textMuted: '#98a0c4',
  textFaint: '#858db3',
  textLabel: '#7b83aa',
  textDim: '#5f668c',
  textDone: '#6b7398',
  chevron: '#3f4770',

  accent: '#5ad1ff',
  onAccent: '#05121c',
  next: '#ff5c9d',
  onNext: '#21060f',
  done: '#7d6cf0',
  warn: '#f5c451',
} as const;

/** Soft city light-pollution wash behind the top of every screen. */
export const glow = {
  blue: 'rgba(90,209,255,0.10)',
  pink: 'rgba(255,92,157,0.085)',
  clear: 'rgba(10,13,24,0)',
} as const;

export const space = {
  screenX: 20,
  gutter: 12,
} as const;

export const radius = {
  sm: 8,
  md: 11,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * The canvas uses Archivo Black / Archivo / IBM Plex Mono. Those are not bundled
 * (no custom fonts yet), so we map to platform faces with the closest weight and
 * a monospace for the episode codes.
 */
export const type = {
  display: { fontWeight: '800' as const, letterSpacing: -0.4 },
  mono: { fontFamily: 'monospace' as const },
} as const;

/** Poster placeholder tints, in the same neon-lit night hues as the mockups. */
const posterTints = ['#2f5ea8', '#a83a6b', '#2b7d84', '#a2762e', '#6a4aa8'];

export function tintFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return posterTints[h % posterTints.length];
}
