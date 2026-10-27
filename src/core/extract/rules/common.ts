// Rules that apply on every page family.

import { MONEY, parseMoney, periodSuffix } from '../money';
import { plural, rule, sentenceCase, toMonths, unitWord, type Rule } from '../rule';

const FEE_WORDS =
  'activation|set[- ]?up|connection|installation|early termination|termination|cancellation|upgrade|restocking|late|service|processing|booking|change|resort|administrative|admin|equipment|delivery|shipping|convenience|transaction|annual|origination|account|membership|regulatory|access|overdraft|maintenance|monthly maintenance|monthly service|returned payment|reactivation|destination|cleaning';

// Fee names that read as a label without the word "fee": "$35 activation".
const BARE_FEE = new Set([
  'activation',
  'setup',
  'set-up',
  'set up',
  'installation',
  'connection',
  'upgrade',
  'equipment',
  'delivery',
  'shipping',
]);

function feeLabel(amount: string, word: string): string {
  const w = word.toLowerCase().replace(/\s+/g, ' ');
  const norm = w === 'set up' || w === 'set-up' ? 'setup' : w;
  return BARE_FEE.has(norm) ? `${amount} ${norm}` : `${amount} ${norm} fee`;
}

/** Recurring fees ("monthly maintenance", "annual") are not one-time amounts; the rollup skips them. */
function recurrence(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('monthly')) return '/mo';
  if (w.startsWith('annual')) return '/yr';
  return '';
}

function moneyChip(raw: string, label: string, suffix = '') {
  const m = parseMoney(raw);
  if (!m) return null;
  return { label, value: m.value, unit: m.currency + suffix };
}

const PERIOD = String.raw`(?:mo|mos|month|months|monthly|yr|year|annually|wk|week)`;
const TIME_UNIT = String.raw`(?:months?|mos?\.?|years?|yrs?\.?|days?|weeks?|billing cycles?)`;
const MONTH_NAME = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const DATE = String.raw`(?:${MONTH_NAME}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)`;

export const COMMON_RULES: Rule[] = [
  // ---- money -------------------------------------------------------------------------------
  rule({
    id: 'money.fee-after-amount',
    kind: 'money',
    priority: 2,
    re: new RegExp(
      String.raw`(${MONEY})\s*(?:one[- ]time\s+|non-refundable\s+|per[- ]line\s+)?(${FEE_WORDS})\s+(?:fee|charge)s?\b`,
      'gi',
    ),
    build: (m) =>
      moneyChip(
        m[1] ?? '',
        feeLabel(parseMoney(m[1] ?? '')?.text ?? '', m[2] ?? ''),
        recurrence(m[2] ?? ''),
      ),
  }),
  rule({
    id: 'money.fee-before-amount',
    kind: 'money',
    priority: 2,
    re: new RegExp(
      String.raw`\b(${FEE_WORDS})\s+(?:fee|charge)s?\s*(?:of|:|is|are|-|–|applies:?)?\s*(?:up to\s+|just\s+|only\s+)?(${MONEY})`,
      'gi',
    ),
    build: (m) =>
      moneyChip(
        m[2] ?? '',
        feeLabel(parseMoney(m[2] ?? '')?.text ?? '', m[1] ?? ''),
        recurrence(m[1] ?? ''),
      ),
  }),
  rule({
    // "$35 activation, autopay required": the fee name stands alone without the word "fee".
    id: 'money.bare-fee-name',
    kind: 'money',
    priority: 1,
    re: new RegExp(
      String.raw`(${MONEY})\s+(activation|set[- ]?up|installation|connection|upgrade|equipment)\b(?!\s+(?:fee|charge))`,
      'gi',
    ),
    build: (m) => moneyChip(m[1] ?? '', feeLabel(parseMoney(m[1] ?? '')?.text ?? '', m[2] ?? '')),
  }),
  rule({
    id: 'money.generic-fee',
    kind: 'money',
    re: new RegExp(
      String.raw`(${MONEY})\s*(?:\/\s*(${PERIOD})\s+)?(?:fee|charge|surcharge)\b|\b(?:fee|charge|surcharge)\s+of\s+(${MONEY})`,
      'gi',
    ),
    build: (m) => {
      const raw = m[1] ?? m[3] ?? '';
      const suffix = periodSuffix(m[2]);
      const text = parseMoney(raw)?.text ?? '';
      return moneyChip(raw, `${text}${suffix} fee`, suffix);
    },
  }),
  rule({
    id: 'money.down-or-deposit',
    kind: 'money',
    re: new RegExp(
      String.raw`(${MONEY})\s+(down(?:\s+payment)?|deposit|due (?:today|at (?:sale|signing|checkout)))\b`,
      'gi',
    ),
    build: (m) => {
      const text = parseMoney(m[1] ?? '')?.text ?? '';
      const word = (m[2] ?? '').toLowerCase();
      return moneyChip(m[1] ?? '', `${text} ${word.startsWith('down') ? 'down' : word}`);
    },
  }),
  // ---- time --------------------------------------------------------------------------------
  rule({
    id: 'time.term-length',
    kind: 'time',
    priority: 2,
    re: new RegExp(
      String.raw`\b(\d{1,3})[- ](months?|mo\.?|years?|yr\.?)\s+((?:device\s+|service\s+|installment\s+|interest[- ]free\s+|price\s+|minimum\s+)?(?:contract|agreement|term|commitment|plan|lock|guarantee|financing|installment plan|price lock|price guarantee))\b`,
      'gi',
    ),
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2] ?? 'month';
      const noun = (m[3] ?? 'term').toLowerCase().replace(/\s+/g, ' ');
      return {
        label: `${String(n)}-${unitWord(unit)} ${noun}`,
        value: toMonths(n, unit),
        unit: 'months',
      };
    },
  }),
  rule({
    id: 'time.contract-of',
    kind: 'time',
    priority: 2,
    re: /\b(?:contracts?|agreements?|terms?|commitments?)\s+(?:are|is|run for|lasts?|of)\s+(\d{1,3})[- ](months?|years?)\b/gi,
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2] ?? 'months';
      return {
        label: `${String(n)}-${unitWord(unit)} contract`,
        value: toMonths(n, unit),
        unit: 'months',
      };
    },
  }),
  rule({
    id: 'time.installments',
    kind: 'time',
    priority: 1,
    re: /\b(\d{1,3})\s+(?:equal\s+)?(?:monthly\s+)?(?:installments|payments)\b/gi,
    build: (m) => {
      const n = Number(m[1]);
      return { label: `${String(n)} monthly payments`, value: n, unit: 'months' };
    },
  }),
  rule({
    id: 'time.for-period',
    kind: 'time',
    re: new RegExp(
      String.raw`\b(?:for|during|over|within|in|first)\s+(?:the\s+)?(first\s+)?(\d{1,3})\s+(${TIME_UNIT})(?![\w-])`,
      'gi',
    ),
    build: (m) => {
      const n = Number(m[2]);
      const unit = m[3] ?? 'months';
      const first = Boolean(m[1]) || /^first/i.test(m[0]);
      const words = plural(n, unitWord(unit));
      return {
        label: first ? `First ${words}` : sentenceCase(words),
        value: toMonths(n, unit),
        unit: 'months',
      };
    },
  }),
  rule({
    id: 'time.after-period',
    kind: 'time',
    re: new RegExp(
      String.raw`\bafter\s+(?:the\s+)?(?:first\s+|initial\s+)?(\d{1,3})\s+(${TIME_UNIT})(?![\w-])`,
      'gi',
    ),
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2] ?? 'months';
      return {
        label: `After ${plural(n, unitWord(unit))}`,
        value: toMonths(n, unit),
        unit: 'months',
      };
    },
  }),
  rule({
    id: 'time.first-year',
    kind: 'time',
    re: /\b(?:for|during|in)\s+(?:the\s+)?(first|1st)\s+year\b|\bafter\s+(?:the\s+)?(first|1st)\s+year\b|\byear\s+1\b/gi,
    build: (m) =>
      /^after/i.test(m[0])
        ? { label: 'After year 1', value: 12, unit: 'months' }
        : { label: 'First year', value: 12, unit: 'months' },
  }),
  rule({
    id: 'time.n-day-trial',
    kind: 'time',
    priority: 1,
    re: /\b(\d{1,3})[- ](day|week|month)\s+(?:free\s+)?trial\b/gi,
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2] ?? 'day';
      return { label: `${String(n)}-${unit} trial`, value: toMonths(n, unit), unit: 'months' };
    },
  }),
  rule({
    id: 'time.end-date',
    kind: 'time',
    re: new RegExp(
      String.raw`\b(?:(?:offer|sale|promotion|promo|deal|price)\s+)?(?:ends|expires|valid\s+(?:through|thru|until)|available\s+(?:through|thru|until)|good\s+(?:through|thru)|through|thru|until|by)\s+(${DATE})`,
      'gi',
    ),
    build: (m) => {
      const date = (m[1] ?? '').replace(/\s+/g, ' ').trim();
      // A bare "through" or "by" needs an offer word to count as an end date.
      if (/^(?:through|thru|until|by)\b/i.test(m[0])) return null;
      const verb = /expires/i.test(m[0]) ? 'Expires' : 'Ends';
      return { label: `${verb} ${date}` };
    },
  }),
  rule({
    id: 'time.offer-through',
    kind: 'time',
    re: new RegExp(
      String.raw`\b(?:offer|sale|promotion|promo|deal|pricing|price)\s+(?:is\s+)?(?:valid\s+)?(?:through|thru|until)\s+(${DATE})`,
      'gi',
    ),
    build: (m) => ({ label: `Ends ${(m[1] ?? '').replace(/\s+/g, ' ').trim()}` }),
  }),
  // ---- requirement -------------------------------------------------------------------------
  rule({
    id: 'req.credit-approval',
    kind: 'requirement',
    re: /\b(?:subject to|requires?|with|upon|on)\s+(?:approved\s+)?credit(?:\s+(?:approval|check|qualification))?\b|\bcredit approval\b|\bon approved credit\b|\bwell[- ]qualified (?:customers|buyers)\b|\bOAC\b/g,
    build: () => ({ label: 'Credit approval' }),
  }),
  rule({
    id: 'req.new-customers',
    kind: 'requirement',
    re: /\b(?:for\s+|available to\s+)?new\s+(customers|subscribers|members|accounts|cardmembers|cardholders|users|accountholders)(?:\s+only)?\b|\bfirst[- ]time\s+(customers|subscribers|users|buyers)\b/gi,
    build: (m) => {
      const who = (m[1] ?? m[2] ?? 'customers').toLowerCase();
      const norm = /card/.test(who) ? 'cardmembers' : who;
      return { label: `New ${norm} only` };
    },
  }),
  rule({
    id: 'req.promo-code',
    kind: 'requirement',
    re: /\b(?:[Pp]romo |[Cc]oupon |[Oo]ffer |[Dd]iscount )?[Cc]ode:?\s+([A-Z][A-Z0-9]{3,})\b/g,
    build: (m) => ({ label: `Code ${m[1] ?? ''}` }),
  }),
  rule({
    id: 'req.limit-per',
    kind: 'requirement',
    re: /\b(?:limit(?:ed to)?:?\s+)?(one|1|two|2|three|3)\s+per\s+(customer|household|account|order|person|cardmember|transaction)\b/gi,
    build: (m) => {
      const n = (m[1] ?? 'one').toLowerCase();
      const word = n === '1' ? 'one' : n === '2' ? 'two' : n === '3' ? 'three' : n;
      return { label: `Limit ${word} per ${(m[2] ?? 'customer').toLowerCase()}` };
    },
  }),
  rule({
    id: 'req.eligible-plan',
    kind: 'requirement',
    re: /\b(?:on|with|requires?|purchase of)\s+(?:an?\s+)?(?:eligible|qualifying|select)\s+(?:unlimited\s+|monthly\s+|annual\s+)?(plans?|service|devices?|purchases?|accounts?|subscriptions?)\b/gi,
    build: (m) => {
      const what = (m[1] ?? 'plan').toLowerCase().replace(/s$/, '');
      return { label: `Eligible ${what} required` };
    },
  }),
  // ---- exclusion ---------------------------------------------------------------------------
  rule({
    id: 'excl.not-combinable',
    kind: 'exclusion',
    priority: 1,
    re: /\b(?:cannot|can't|can not|may not|not|won't)\s+(?:be\s+)?(?:combined|combinable|valid|used|stacked)\s+with\s+(?:any\s+)?(?:other\s+)?(?:offers?|promotions?|discounts?|coupons?|promo codes?)\b/gi,
    build: () => ({ label: 'Not combinable with other offers' }),
  }),
  rule({
    id: 'excl.excludes',
    kind: 'exclusion',
    re: /\b(excludes?|excluding|not valid on|not valid for|does not apply to|doesn't apply to|not available on|not eligible:?)\s+([^.;:()]{3,60}?)(?=[.;:()]|,\s+(?:offers?|valid|limit|must|cannot|may|not|no|see|plus|subject|while|except)\b|\s(?:and|or)\s(?:is|are|may|cannot|not)\b|$)/gi,
    build: (m) => {
      const verb = (m[1] ?? '').toLowerCase();
      const obj = (m[2] ?? '').trim().replace(/\s+/g, ' ');
      if (/^(taxes|tax|fees and taxes|taxes and fees|applicable taxes)/i.test(obj)) return null;
      if (obj.split(' ').length > 8) return null;
      const lead = verb.startsWith('exclud')
        ? 'Excludes'
        : verb.startsWith('not valid')
          ? 'Not valid on'
          : verb.startsWith('not available')
            ? 'Not available on'
            : verb.startsWith('not eligible')
              ? 'Not eligible:'
              : 'Does not apply to';
      return { label: `${lead} ${obj}` };
    },
  }),
  rule({
    id: 'excl.exclusions-apply',
    kind: 'exclusion',
    re: /\b(?:some\s+|other\s+)?(exclusions|restrictions|limitations)\s+(?:may\s+)?apply\b/gi,
    build: (m) => ({ label: `${sentenceCase((m[1] ?? 'exclusions').toLowerCase())} apply` }),
  }),
  rule({
    id: 'excl.while-supplies-last',
    kind: 'exclusion',
    re: /\bwhile\s+(?:supplies|quantities|stocks?)\s+last\b/gi,
    build: () => ({ label: 'While supplies last' }),
  }),
  rule({
    id: 'excl.taxes-extra',
    kind: 'exclusion',
    priority: 1,
    re: /\b(?:plus|\+|excluding|excludes|exclusive of|does not include|do not include|not including|before)\s+(?:applicable\s+|all\s+|government\s+)?(?:taxes(?:,)?\s*(?:and|&)\s*(?:government\s+|regulatory\s+)?fees|taxes|tax|fees and taxes|taxes, fees(?: and surcharges)?)\b|\btaxes(?:,)?\s+(?:and|&)\s+fees\s+(?:are\s+)?(?:extra|additional|not included|apply)\b/gi,
    build: () => ({ label: 'Taxes and fees extra' }),
  }),
  rule({
    id: 'excl.not-available-everywhere',
    kind: 'exclusion',
    re: /\bnot available in all\s+(areas|states|markets|locations|regions|countries)\b|\bavailability (?:varies|may vary) by\s+(?:location|area|market)\b/gi,
    build: () => ({ label: 'Not available everywhere' }),
  }),
  rule({
    id: 'excl.select-areas',
    kind: 'exclusion',
    re: /\b(?:available\s+)?(?:only\s+)?in\s+select(?:ed)?\s+(areas|markets|locations|regions|cities|zip codes|states)\b/gi,
    build: (m) => ({ label: `Select ${(m[1] ?? 'areas').toLowerCase()} only` }),
  }),
  rule({
    id: 'excl.in-store-online-only',
    kind: 'exclusion',
    re: /\b(in[- ]store|online|in[- ]app|in[- ]club)\s+(?:purchases\s+)?only\b|\bnot available (online|in[- ]store)\b/gi,
    build: (m) => {
      const where = (m[1] ?? m[2] ?? '').toLowerCase().replace(/\s/g, '-');
      if (m[2]) return { label: where === 'online' ? 'In-store only' : 'Online only' };
      const label =
        where === 'online'
          ? 'Online only'
          : where === 'in-app'
            ? 'In-app only'
            : where === 'in-club'
              ? 'In-club only'
              : 'In-store only';
      return { label };
    },
  }),
  // ---- renewal -----------------------------------------------------------------------------
  rule({
    id: 'renew.renews-at',
    kind: 'renewal',
    priority: 2,
    re: new RegExp(
      String.raw`\b(?:auto(?:matically)?[- ]?)?renews?\s+(?:automatically\s+)?(?:at|for)\s+(?:the\s+)?(?:(then[- ]current|current|regular|standard)\s+(?:rate|price|fee)|(${MONEY})(?:\s*(?:\/|per)\s*(${PERIOD}))?)`,
      'gi',
    ),
    build: (m) => {
      if (m[1]) return { label: 'Renews at the regular price' };
      const money = parseMoney(m[2] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[3]);
      return {
        label: `Renews at ${money.text}${suffix}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    id: 'renew.then-price',
    kind: 'renewal',
    priority: 1,
    re: new RegExp(
      String.raw`\b(?:then|thereafter|after that|afterwards),?\s+(?:it's\s+|it is\s+|you(?:'ll| will) pay\s+|you(?:'ll| will) be charged\s+|pricing (?:is|will be)\s+|price (?:is|goes to|increases to)\s+)?(?:the\s+)?(${MONEY})\s*(?:\/|per|a|each)\s*(${PERIOD})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[2]);
      return {
        label: `Then ${money.text}${suffix}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    id: 'renew.price-after',
    kind: 'renewal',
    priority: 2,
    re: new RegExp(
      String.raw`(${MONEY})\s*(?:\/|per|a)\s*(${PERIOD})\s+(?:after|once|when)\s+(?:the\s+|your\s+)?(?:first\s+|initial\s+)?(\d{1,3}\s+(?:months?|years?|days?)|(?:free\s+)?trial(?:\s+ends)?|promo(?:tional)?\s+period|intro(?:ductory)?\s+period|first year|offer period|promotion ends)`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[2]);
      const after = (m[3] ?? '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/\s+ends$/, '');
      return {
        label: `${money.text}${suffix} after ${after}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    // "after 12 months it costs $10/mo", "after the first year, you'll pay $99/yr".
    id: 'renew.after-period-costs',
    kind: 'renewal',
    priority: 2,
    re: new RegExp(
      String.raw`\bafter\s+(?:the\s+)?(?:first\s+|initial\s+)?(\d{1,3}\s+(?:months?|years?|days?)|(?:first\s+)?year)\b,?\s+(?:it\s+|the\s+(?:price|plan|line|rate|service)\s+)?(?:costs|is|goes to|becomes|renews at|increases to|you(?:'ll| will) pay|you(?:'ll| will) be charged)\s+(${MONEY})\s*(?:\/|per|a|each)\s*(${PERIOD})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[2] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[3]);
      const after = (m[1] ?? '').replace(/\s+/g, ' ').toLowerCase();
      return {
        label: `${money.text}${suffix} after ${after}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    // "Price after the first year is $89.99", "the rate after 12 months will be $30/mo".
    id: 'renew.price-after-is',
    kind: 'renewal',
    priority: 2,
    re: new RegExp(
      String.raw`\b(?:price|rate|cost)\s+after\s+(?:the\s+)?(?:(?:first|initial)\s+)?(\d{1,3}\s+(?:months?|years?)|year|trial|promo(?:tional)?\s+period)\s+(?:is|will be|becomes)\s+(${MONEY})(?:\s*(?:\/|per|a)\s*(${PERIOD}))?`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[2] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[3]);
      const when = (m[1] ?? '').replace(/\s+/g, ' ').toLowerCase();
      const after = when === 'year' ? 'year 1' : when;
      return {
        label: `${money.text}${suffix} after ${after}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    id: 'renew.price-increases',
    kind: 'renewal',
    priority: 1,
    re: new RegExp(
      String.raw`\b(?:price|rate|pricing|bill)\s+(?:will\s+)?(?:increases?|rises?|goes up|reverts?|changes?)\s+to\s+(${MONEY})(?:\s*(?:\/|per)\s*(${PERIOD}))?`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[2]);
      return {
        label: `Rises to ${money.text}${suffix}`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    id: 'renew.regular-price-applies',
    kind: 'renewal',
    re: /\b(?:regular|standard|then[- ]current|full)\s+(?:monthly\s+)?(?:price|rate|pricing)\s+(?:\([^)]{0,20}\)\s+)?(?:applies|will apply|thereafter|resumes)\b/gi,
    build: () => ({ label: 'Regular price applies after' }),
  }),
  rule({
    id: 'renew.auto-renews',
    kind: 'renewal',
    re: /\b(?:auto(?:matically)?[- ]?renew(?:s|al|ing)?|renews automatically|recurring (?:billing|charges?|subscription|payments?)|continuous(?:ly)? (?:billed|service))\b/gi,
    build: () => ({ label: 'Auto-renews' }),
  }),
  rule({
    id: 'renew.until-canceled',
    kind: 'renewal',
    re: /\buntil (?:you )?cancel(?:l?ed)?\b|\bunless (?:you )?cancel(?:l?ed)?\b/gi,
    build: () => ({ label: 'Charges until canceled' }),
  }),
];
