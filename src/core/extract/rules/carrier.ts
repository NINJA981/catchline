// Carrier and broadband vocabulary (SPEC §4.1): term length, activation and setup fees, autopay or
// paperless conditions, new line, trade-in, credits over N months, deprioritization, price after N.

import { rule, type Rule } from '../rule';

export const CARRIER_RULES: Rule[] = [
  rule({
    id: 'carrier.autopay',
    kind: 'requirement',
    family: 'carrier',
    re: /\b(?:auto[- ]?pay|automatic payments?)\b(?:\s+(?:and|&|\+)\s+paperless(?:\s+billing)?)?/gi,
    build: (m) =>
      /paperless/i.test(m[0])
        ? { label: 'Autopay and paperless billing required' }
        : { label: 'Autopay required' },
  }),
  rule({
    id: 'carrier.paperless',
    kind: 'requirement',
    family: 'carrier',
    re: /\bpaperless\s+(?:billing|statements?|bill)\b/gi,
    build: () => ({ label: 'Paperless billing required' }),
  }),
  rule({
    id: 'carrier.new-line',
    kind: 'requirement',
    family: 'carrier',
    re: /\b(?:new|additional)\s+lines?\b|\badd(?:ing)?\s+an?\s+(?:new\s+)?line\b|\bactivation of a new line\b/gi,
    build: () => ({ label: 'New line required' }),
  }),
  rule({
    id: 'carrier.port-in',
    kind: 'requirement',
    family: 'carrier',
    re: /\bport[- ]?in\b|\bport(?:ing)?\s+(?:your|a|an)\s+(?:existing\s+)?(?:number|phone number)\b|\bswitch(?:ing)? from (?:an)?other carrier\b/gi,
    build: () => ({ label: 'Port-in required' }),
  }),
  rule({
    id: 'carrier.trade-in',
    kind: 'requirement',
    family: 'carrier',
    re: /\b(?:eligible\s+|qualifying\s+)?trade[- ]?in\b/gi,
    build: () => ({ label: 'Trade-in required' }),
  }),
  rule({
    id: 'carrier.bill-credits',
    kind: 'time',
    family: 'carrier',
    priority: 3,
    re: /\b(?:monthly\s+)?(?:bill\s+|promotional\s+|promo\s+)?credits?\s+(?:applied\s+|issued\s+|given\s+)?over\s+(\d{1,3})\s+months\b|\b(?:via|as|in|with)\s+(\d{1,3})\s+monthly\s+(?:bill\s+)?credits\b/gi,
    build: (m) => {
      const n = Number(m[1] ?? m[2]);
      return { label: `Credits over ${String(n)} months`, value: n, unit: 'months' };
    },
  }),
  rule({
    id: 'carrier.deprioritized',
    kind: 'exclusion',
    family: 'carrier',
    priority: 3,
    re: /\b(?:(?:may|might|will|could)\s+)?(?:notice\s+|experience\s+|see\s+)?(?:slower|reduced|lower)\s+speeds?\s+(?:than other customers\s+)?(?:after|above|beyond|once you use|over)\s+(\d{1,4}(?:\.\d)?)\s*(GB|TB)\b|\b(?:deprioritiz\w+|deprioritis\w+)\s+(?:after|above|beyond|over)\s+(\d{1,4}(?:\.\d)?)\s*(GB|TB)\b|\bafter\s+(\d{1,4}(?:\.\d)?)\s*(GB|TB)(?:\/mo| per month| of (?:premium |high-speed )?data)?,?\s+(?:customers\s+|you\s+)?(?:may\s+)?(?:be\s+)?(?:notice\s+)?(?:slow|reduced|lower|deprioritiz)\w*|\bspeeds?\s+(?:may|might|will|could)\s+be\s+(?:reduced|slowed|lowered|deprioritized)\s+(?:after|above|beyond|over)\s+(\d{1,4}(?:\.\d)?)\s*(GB|TB)\b/gi,
    build: (m) => {
      const n = Number(m[1] ?? m[3] ?? m[5] ?? m[7]);
      const unit = (m[2] ?? m[4] ?? m[6] ?? m[8] ?? 'GB').toUpperCase();
      return { label: `Slower after ${String(n)} ${unit}`, value: n, unit };
    },
  }),
  rule({
    id: 'carrier.hotspot-cap',
    kind: 'exclusion',
    family: 'carrier',
    re: /\b(\d{1,3})\s*GB\s+(?:of\s+)?(?:high[- ]speed\s+|5G\s+|premium\s+)?(?:mobile\s+)?hotspot\b|\bhotspot\s+(?:data\s+)?(?:limited to|capped at|up to)\s+(\d{1,3})\s*GB\b/gi,
    build: (m) => ({ label: `Hotspot capped at ${String(Number(m[1] ?? m[2]))} GB` }),
  }),
  rule({
    id: 'carrier.video-quality',
    kind: 'exclusion',
    family: 'carrier',
    re: /\bvideo\s+(?:typically\s+)?(?:streams?\s+)?(?:at|in|limited to)\s+(480p|720p|1080p|SD|standard definition|DVD quality)/gi,
    build: (m) => ({ label: `Video at ${m[1] === 'standard definition' ? 'SD' : (m[1] ?? '')}` }),
  }),
  rule({
    id: 'carrier.financing-required',
    kind: 'requirement',
    family: 'carrier',
    re: /\b(?:device\s+)?(?:installment|financing)\s+(?:agreement|plan)\s+required\b|\bon\s+(?:a\s+)?device\s+(?:payment|installment)\s+plan\b/gi,
    build: () => ({ label: 'Device financing required' }),
  }),
  rule({
    id: 'carrier.lose-credits',
    kind: 'exclusion',
    family: 'carrier',
    re: /\b(?:if you cancel|cancel(?:ling)? service|leave early)[^.]{0,60}?(?:credits? (?:stop|end|will stop)|remaining balance (?:is )?due|owe the remaining)/gi,
    build: () => ({ label: 'Credits stop if you cancel' }),
  }),
];
