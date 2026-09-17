export const ACCENTS = [
  { id: 'cobalt', name: 'Cobalt', primary: '#3159e8', dark: '#2447c9', soft: '#edf1ff', rgb: '49, 89, 232' },
  { id: 'violet', name: 'Violet', primary: '#7c3aed', dark: '#6d28d9', soft: '#f3edff', rgb: '124, 58, 237' },
  { id: 'emerald', name: 'Emerald', primary: '#047857', dark: '#065f46', soft: '#e9f8f1', rgb: '4, 120, 87' },
  { id: 'amber', name: 'Amber', primary: '#b45309', dark: '#92400e', soft: '#fff4e5', rgb: '180, 83, 9' },
  { id: 'rose', name: 'Rose', primary: '#be123c', dark: '#9f1239', soft: '#fff0f4', rgb: '190, 18, 60' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

const STORAGE_KEY = 'trackflow-accent';

export function getAccent(): AccentId {
  if (typeof window === 'undefined') return 'cobalt';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return ACCENTS.some((accent) => accent.id === stored) ? stored as AccentId : 'cobalt';
}

export function applyAccent(id: AccentId, persist = false) {
  const accent = ACCENTS.find((option) => option.id === id) ?? ACCENTS[0];
  const root = document.documentElement;
  root.style.setProperty('--primary', accent.primary);
  root.style.setProperty('--primary-dark', accent.dark);
  root.style.setProperty('--primary-soft', accent.soft);
  root.style.setProperty('--primary-rgb', accent.rgb);
  root.dataset.accent = accent.id;
  if (persist) window.localStorage.setItem(STORAGE_KEY, accent.id);
}
