// Streaming vocabulary (SPEC §4.1): price after trial or promo, auto-renewal, with ads, annual
// billing, new subscribers only, number of screens.

import { MONEY, parseMoney, periodSuffix } from '../money';
import { parseCount, rule, type Rule } from '../rule';

export const STREAMING_RULES: Rule[] = [
  rule({
    id: 'streaming.with-ads',
    kind: 'exclusion',
    family: 'streaming',
    re: /\bwith\s+(?:limited\s+)?ads\b|\bad[- ]supported\b|\bincludes?\s+(?:limited\s+)?ads\b|\bbasic with ads\b/gi,
    build: () => ({ label: 'With ads' }),
  }),
  rule({
    id: 'streaming.screens',
    kind: 'exclusion',
    family: 'streaming',
    re: /\b(\d|one|two|three|four|five|six)\s+(?:screens?|streams?|devices?)\s+at\s+(?:a|the same)\s+time\b|\bstream\s+on\s+(\d|one|two|three|four)\s+(?:screens?|devices?)\s+at\s+(?:once|a time|the same time)\b|\bup to\s+(\d|one|two|three|four)\s+(?:simultaneous|concurrent)\s+streams?\b/gi,
    build: (m) => {
      const n = parseCount(m[1] ?? m[2] ?? m[3] ?? '1');
      return { label: `${String(n)} ${n === 1 ? 'screen' : 'screens'} at a time` };
    },
  }),
  rule({
    id: 'streaming.after-trial',
    kind: 'renewal',
    family: 'streaming',
    priority: 3,
    re: new RegExp(
      String.raw`\bafter\s+(?:the\s+|your\s+)?(?:free\s+)?(?:trial|promo(?:tional)?\s+period|offer period|intro(?:ductory)?\s+period)(?:\s+ends)?,?\s+(?:the\s+)?(?:plan\s+|subscription\s+)?(?:automatically\s+)?(?:renews|continues|converts|is billed|you(?:'ll| will) be (?:charged|billed))?\s*(?:at|for)?\s*(${MONEY})\s*(?:\/|per|a)\s*(mo|month|yr|year)`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? '');
      if (!money) return null;
      const suffix = periodSuffix(m[2]);
      return {
        label: `${money.text}${suffix} after trial`,
        value: money.value,
        unit: money.currency + suffix,
      };
    },
  }),
  rule({
    id: 'streaming.annual-billing',
    kind: 'requirement',
    family: 'streaming',
    re: /\b(?:billed|charged|paid)\s+(?:annually|yearly|once a year|upfront for 12 months)\b|\bannual\s+(?:plan|subscription|billing)\s+(?:only|required)\b/gi,
    build: () => ({ label: 'Billed annually' }),
  }),
  rule({
    id: 'streaming.ads-in-some',
    kind: 'exclusion',
    family: 'streaming',
    re: /\b(?:a few|some|select)\s+(?:shows|titles|movies)\s+(?:and\s+(?:shows|movies)\s+)?(?:will\s+)?(?:play|include|contain|have)\s+(?:with\s+)?ads\b|\bnot all (?:titles|shows|movies|content)\s+(?:are\s+)?(?:available|included)\b/gi,
    build: (m) =>
      /ads/i.test(m[0])
        ? { label: 'Some titles still have ads' }
        : { label: 'Not all titles included' },
  }),
  rule({
    id: 'streaming.household',
    kind: 'requirement',
    family: 'streaming',
    re: /\b(?:one|a single|your)\s+household\b|\boutside (?:your|the) household\b/gi,
    build: () => ({ label: 'One household' }),
  }),
  rule({
    id: 'streaming.resolution',
    kind: 'exclusion',
    family: 'streaming',
    re: /\b(?:streams?\s+)?(?:in|at|up to)\s+(720p|1080p|HD|full HD|4K(?: Ultra HD)?|Ultra HD|standard definition|SD)\s+(?:only|resolution|max(?:imum)?|quality)\b/gi,
    build: (m) => ({ label: `Up to ${m[1] === 'standard definition' ? 'SD' : (m[1] ?? '')}` }),
  }),
];
