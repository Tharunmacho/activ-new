export type ExploreCardTone = {
  background: string;
  border: string;
  iconBackground: string;
  accent: string;
  title: string;
  body: string;
};

// Full card surfaces share one palette across the home directory and regions.
// Dark text keeps the colour useful without making small labels hard to read.
const tones: Record<string, ExploreCardTone> = {
  blue: { background: '#E7EFFF', border: '#CCDDFC', iconBackground: '#F8FAFF', accent: '#245DC0', title: '#14336D', body: '#425979' },
  teal: { background: '#DFF4EF', border: '#BCE4D9', iconBackground: '#F4FFFB', accent: '#127261', title: '#164D43', body: '#3B655C' },
  amber: { background: '#FFF1D6', border: '#F2DDAF', iconBackground: '#FFFBF0', accent: '#99600B', title: '#694515', body: '#755E3C' },
  rose: { background: '#FFE7EE', border: '#F4CDD9', iconBackground: '#FFF7FA', accent: '#B52A59', title: '#742741', body: '#795162' },
  sky: { background: '#E0F2FF', border: '#BFDEEF', iconBackground: '#F5FCFF', accent: '#146C97', title: '#194B67', body: '#416278' },
  green: { background: '#E6F3DF', border: '#CDE3BF', iconBackground: '#F8FFF4', accent: '#47752B', title: '#355025', body: '#526748' },
  orange: { background: '#FFEBDC', border: '#F2D0B9', iconBackground: '#FFF8F2', accent: '#AB511F', title: '#753B1C', body: '#7B5943' },
  violet: { background: '#EEE8FF', border: '#D8CCF4', iconBackground: '#FAF7FF', accent: '#7050AE', title: '#4C3477', body: '#64537F' },
};

const pageTones: Record<string, string> = {
  '/': 'blue', '/about': 'teal', '/membership': 'amber', '/events': 'rose',
  '/news': 'sky', '/schemes': 'green', '/gallery': 'orange', '/contact': 'violet',
  '/donate': 'rose', '/regions': 'blue', '/states': 'teal', '/zones': 'blue', zones: 'blue',
};
const regionTones: Record<string, string> = {
  south: 'teal', north: 'sky', east: 'amber', west: 'rose', 'north-east': 'violet', northeast: 'violet',
};
const regionOrder = ['teal', 'sky', 'amber', 'rose', 'violet'];

export function exploreToneForPage(path?: string | null): ExploreCardTone {
  const key = String(path || '/').split(/[?#]/)[0];
  const base = '/' + (key.split('/')[1] || '');
  return tones[pageTones[key] || pageTones[base] || 'blue'];
}

export function exploreToneForZone(slug?: string | null, index = 0): ExploreCardTone {
  const key = String(slug || '').toLowerCase().replace(/[_\s]+/g, '-').replace(/^(?:region|zone)-|-region$|-zone$/g, '');
  return tones[regionTones[key] || regionOrder[Math.abs(Math.trunc(index) || 0) % regionOrder.length]];
}
