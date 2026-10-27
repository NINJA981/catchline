// Bank and credit vocabulary (SPEC §4.1): intro period, go-to APR or range, balance transfer fee %,
// minimum spend and window, direct deposit, credit approval, annual fee after year 1.

import { MONEY, parseMoney } from '../money';
import { rule, type Rule } from '../rule';

const PCT = String.raw`\d{1,2}(?:\.\d{1,3})?%`;

export const BANK_RULES: Rule[] = [
  rule({
    id: 'bank.intro-apr',
    kind: 'rate',
    family: 'bank',
    priority: 3,
    re: new RegExp(
      String.raw`(${PCT})\s+(?:intro(?:ductory)?|promotional|promo)\s+(?:APR|rate)\b`,
      'gi',
    ),
    build: (m) => ({ label: `${m[1] ?? ''} intro APR`, value: parseFloat(m[1] ?? '0'), unit: '%' }),
  }),
  rule({
    id: 'bank.apr-range',
    kind: 'rate',
    family: 'bank',
    priority: 3,
    re: new RegExp(
      String.raw`(${PCT})\s*(?:-|–|—|to)\s*(${PCT})(?:\s+(variable|fixed))?(?:\s+(APR|APY))?`,
      'gi',
    ),
    build: (m) => {
      if (!m[3] && !m[4]) return null; // a bare range is not a rate term
      const kind = m[3] ? `${m[3].toLowerCase()} ` : '';
      const what = (m[4] ?? 'APR').toUpperCase();
      return {
        label: `${m[1] ?? ''}-${m[2] ?? ''} ${kind}${what}`,
        value: parseFloat(m[1] ?? '0'),
        unit: '%',
      };
    },
  }),
  rule({
    id: 'bank.single-apr',
    kind: 'rate',
    family: 'bank',
    priority: 2,
    re: new RegExp(String.raw`(${PCT})\s+(?:(variable|fixed)\s+)?(APR|APY|interest)\b`, 'gi'),
    build: (m) => {
      const raw = (m[3] ?? 'APR').toUpperCase();
      const what = raw === 'INTEREST' ? 'interest' : raw;
      const kind = m[2] ? `${m[2].toLowerCase()} ` : '';
      return { label: `${m[1] ?? ''} ${kind}${what}`, value: parseFloat(m[1] ?? '0'), unit: '%' };
    },
  }),
  rule({
    id: 'bank.apr-of',
    kind: 'rate',
    family: 'bank',
    priority: 1,
    re: new RegExp(
      String.raw`\b(APR|APY|variable rate)(?:\s+(?:of|is|will be)|:)?\s+(${PCT})(?:\s*(?:-|–|to)\s*(${PCT}))?`,
      'gi',
    ),
    build: (m) => {
      const what = /apy/i.test(m[1] ?? '') ? 'APY' : 'APR';
      return {
        label: m[3] ? `${m[2] ?? ''}-${m[3]} ${what}` : `${m[2] ?? ''} ${what}`,
        value: parseFloat(m[2] ?? '0'),
        unit: '%',
      };
    },
  }),
  rule({
    id: 'bank.transfer-fee-pct',
    kind: 'rate',
    family: 'bank',
    priority: 4,
    re: new RegExp(
      String.raw`(${PCT})\s+(?:intro(?:ductory)?\s+)?(balance transfer|cash advance|foreign transaction|transfer)\s+fee\b|\b(balance transfer|cash advance|foreign transaction)\s+fee\s+(?:of\s+)?(?:either\s+)?(${PCT})`,
      'gi',
    ),
    build: (m) => {
      const pct = m[1] ?? m[4] ?? '';
      const what = (m[2] ?? m[3] ?? 'balance transfer').toLowerCase();
      return { label: `${pct} ${what} fee`, value: parseFloat(pct), unit: '%' };
    },
  }),
  rule({
    id: 'bank.min-spend',
    kind: 'requirement',
    family: 'bank',
    priority: 3,
    re: new RegExp(
      String.raw`\b(?:spend|spending|make|after you spend)\s+(?:at least\s+)?(${MONEY})\s+(?:or more\s+)?(?:on|in)?\s*(?:eligible\s+|qualifying\s+)?(?:net\s+)?(?:purchases\s+)?(?:with(?:in)?|in)\s+(?:the\s+|your\s+)?(?:first\s+)?(\d{1,3})\s+(months?|days?)`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const n = Number(m[2]);
      const unit = (m[3] ?? 'months').toLowerCase().replace(/s$/, '');
      return { label: `Spend ${money.text} in ${String(n)} ${unit}${n === 1 ? '' : 's'}` };
    },
  }),
  rule({
    id: 'bank.direct-deposit-amount',
    kind: 'requirement',
    family: 'bank',
    priority: 3,
    re: new RegExp(
      String.raw`\b(?:qualifying\s+|eligible\s+)?direct deposits?\s+(?:totaling|totalling|of|that total|adding up to)\s+(?:at least\s+)?(${MONEY})(?:\s+or more)?`,
      'gi',
    ),
    build: (m) => ({ label: `Direct deposits of ${parseMoney(m[1] ?? '')?.text ?? ''}+` }),
  }),
  rule({
    id: 'bank.direct-deposit',
    kind: 'requirement',
    family: 'bank',
    re: /\b(?:qualifying\s+|eligible\s+)?direct deposits?\b/gi,
    build: () => ({ label: 'Direct deposit required' }),
  }),
  rule({
    id: 'bank.min-balance',
    kind: 'requirement',
    family: 'bank',
    priority: 2,
    re: new RegExp(
      String.raw`\b(?:minimum|average)\s+(?:daily\s+|monthly\s+)?balance\s+(?:of\s+)?(?:at least\s+)?(${MONEY})|\bmaintain\s+(?:a\s+)?(?:balance of\s+)?(?:at least\s+)?(${MONEY})|(${MONEY})\s+(?:minimum|average)\s+(?:daily\s+|monthly\s+)?balance`,
      'gi',
    ),
    build: (m) => ({
      label: `Keep a ${parseMoney(m[1] ?? m[2] ?? m[3] ?? '')?.text ?? ''} balance`,
    }),
  }),
  rule({
    id: 'bank.annual-fee-after',
    kind: 'money',
    family: 'bank',
    priority: 4,
    re: new RegExp(
      String.raw`(${MONEY})\s+annual fee\s+(?:applies\s+)?(?:after|starting)\s+(?:the\s+)?(?:first|1st)\s+year|annual fee\s+(?:of\s+)?(${MONEY})\s+(?:applies\s+)?(?:after|starting)\s+(?:the\s+)?(?:first|1st)\s+year|\$0\s+(?:intro(?:ductory)?\s+)?annual fee\s+(?:for\s+)?(?:the\s+)?first year,?\s+then\s+(${MONEY})|annual fee:?\s+\$0\s+(?:for\s+)?(?:the\s+)?first\s+(?:year|12 months),?\s+then\s+(${MONEY})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
      if (!money) return null;
      return {
        label: `${money.text} annual fee after year 1`,
        value: money.value,
        unit: `${money.currency}/yr`,
      };
    },
  }),
  rule({
    id: 'bank.deferred-interest',
    kind: 'exclusion',
    family: 'bank',
    re: /\bdeferred interest\b|\binterest (?:will be|is) charged[^.]{0,40}from the (?:purchase|transaction) date\b/gi,
    build: () => ({ label: 'Deferred interest' }),
  }),
  rule({
    id: 'bank.transfer-window',
    kind: 'time',
    family: 'bank',
    priority: 3,
    re: /\b(?:transfers?|balance transfers?)\s+(?:must be\s+)?(?:made|completed|posted|requested)\s+within\s+(\d{1,3})\s+(days|months)\b/gi,
    build: (m) => {
      const n = Number(m[1]);
      const unit = (m[2] ?? 'days').toLowerCase();
      return {
        label: `Transfer within ${String(n)} ${unit}`,
        value: unit.startsWith('d') ? Math.round((n / 30) * 100) / 100 : n,
        unit: 'months',
      };
    },
  }),
  rule({
    id: 'bank.reward-cap',
    kind: 'exclusion',
    family: 'bank',
    priority: 2,
    re: new RegExp(
      String.raw`b(?:on\s+)?up to\s+(${MONEY})\s+(?:in\s+)?(?:combined\s+)?(?:eligible\s+)?(?:purchases\s+|spend\s+)?(?:per|each|a|every)\s+(quarter|month|year|calendar year|billing cycle)b`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const period = (m[2] ?? 'quarter').toLowerCase().replace('calendar ', '');
      return { label: `Capped at ${money.text} per ${period}` };
    },
  }),
  rule({
    id: 'bank.keep-open',
    kind: 'requirement',
    family: 'bank',
    re: /\b(?:keep|maintain)\s+(?:the\s+|your\s+)?account\s+open\s+(?:for\s+)?(?:at least\s+)?(\d{1,3})\s+(days|months)\b/gi,
    build: (m) => ({
      label: `Keep account open ${String(Number(m[1]))} ${(m[2] ?? 'days').toLowerCase()}`,
    }),
  }),
];
