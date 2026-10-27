// Bundled sample pages: the synthetic specimens from tests/fixtures/synthetic (read at build time,
// never edited here). Each is a fictional merchant on a reserved .example domain and the UI labels
// it "Specimen page. Not a real offer." Loaded on demand so the first paint does not carry them.

export interface SampleMeta {
  id: string;
  /** Short name on the button. */
  label: string;
  /** One line under the name: what the page is and what to look for. */
  blurb: string;
}

export const SAMPLES: readonly SampleMeta[] = [
  {
    id: 'carrier-specimen',
    label: 'Phone plan',
    blurb: '$0/mo*, Unlimited¹ and $200 off† on a carrier promo.',
  },
  {
    id: 'bank-specimen',
    label: 'Credit card',
    blurb: 'An intro APR, a bonus and an annual fee.',
  },
  {
    id: 'retail-specimen',
    label: 'Retail sale',
    blurb: 'Up to 50% off, free shipping and a code offer.',
  },
  {
    id: 'streaming-specimen',
    label: 'Streaming',
    blurb: 'A promo price, a free trial and a screen limit.',
  },
  {
    id: 'saas-specimen',
    label: 'Software pricing',
    blurb: 'Per-seat pricing, usage caps and overage.',
  },
  {
    id: 'travel-specimen',
    label: 'Airline fares',
    blurb: 'One-way fares, taxes and a resort fee.',
  },
  {
    id: 'many-to-one',
    label: 'One asterisk, fourteen claims',
    blurb: 'A single * pointing at a 612-word offer block.',
  },
  {
    id: 'not-found',
    label: 'Fine print not on the page',
    blurb: 'A claim whose terms are missing or on another page.',
  },
];

const LOADERS: Record<string, () => Promise<{ default: string }>> = {
  'carrier-specimen': () => import('../../../tests/fixtures/synthetic/carrier-specimen.html?raw'),
  'bank-specimen': () => import('../../../tests/fixtures/synthetic/bank-specimen.html?raw'),
  'retail-specimen': () => import('../../../tests/fixtures/synthetic/retail-specimen.html?raw'),
  'streaming-specimen': () =>
    import('../../../tests/fixtures/synthetic/streaming-specimen.html?raw'),
  'saas-specimen': () => import('../../../tests/fixtures/synthetic/saas-specimen.html?raw'),
  'travel-specimen': () => import('../../../tests/fixtures/synthetic/travel-specimen.html?raw'),
  'many-to-one': () => import('../../../tests/fixtures/synthetic/many-to-one.html?raw'),
  'not-found': () => import('../../../tests/fixtures/synthetic/not-found.html?raw'),
};

export function sampleById(id: string): SampleMeta | undefined {
  return SAMPLES.find((s) => s.id === id);
}

export async function loadSample(id: string): Promise<string> {
  const load = LOADERS[id];
  if (!load) throw new Error(`Unknown sample: ${id}`);
  return (await load()).default;
}
