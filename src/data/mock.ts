// Deterministic mock data.
// The last 28 days reproduce every reference number in section 4 exactly.
// Older records (30 to 300 days ago) make Year and All Time differ from 4 Weeks.
// Seeded PRNG only, no unseeded Math.random.

import { addDays, toISODate } from '../lib/timeRange'
import type { CallReport, CallType, DMClose, LeadSource, SalesData } from './types'

export const MOCK_SEED = 20260902

/** Small seeded PRNG (mulberry32). Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST_NAMES = [
  'Sarah', 'Emma', 'Chloe', 'Aoife', 'Niamh', 'Grace', 'Hannah', 'Lucy', 'Megan', 'Rachel',
  'Laura', 'Katie', 'Ciara', 'Amy', 'Sophie', 'Jessica', 'Rebecca', 'Orla', 'Claire', 'Eimear',
  'Leanne', 'Michelle', 'Danielle', 'Nicola', 'Siobhan', 'Karen', 'Louise', 'Joanne', 'Fiona', 'Roisin',
]
const LAST_INITIALS = ['K', 'M', 'B', 'D', 'O', 'W', 'R', 'H', 'C', 'F', 'G', 'L', 'N', 'P', 'S', 'T']

const NEXT_STEPS = [
  'Call back Friday',
  'Sent payment plan',
  'Waiting on partner',
  'Follow up next week',
  'Send testimonials',
  'Book second call',
  'Text on Monday',
  'Waiting on payday',
  'Sent programme overview',
  'Chase by voice note',
]

const NOTES = [
  'Wants to start after holidays.',
  'Keen but nervous about the price.',
  'Has tried two coaches before.',
  'Needs to speak to husband first.',
  'Very engaged on the call.',
  'Asked about the group option.',
]

/** Spec table, oldest bucket first: index 0 = 21..27 days ago, 3 = 0..6 days ago. */
interface GroupPlan {
  scheduled: number
  shown: number
  qualified: number
  pitchedUnqualified: number // pitched but not qualified
  closes: Array<{ revenue: number; cash: number }>
}

const ORGANIC_FIRST: GroupPlan[] = [
  { scheduled: 14, shown: 9, qualified: 7, pitchedUnqualified: 1, closes: [{ revenue: 4000, cash: 2000 }] },
  { scheduled: 7, shown: 5, qualified: 3, pitchedUnqualified: 0, closes: [] },
  { scheduled: 13, shown: 9, qualified: 7, pitchedUnqualified: 0, closes: [{ revenue: 4000, cash: 2000 }, { revenue: 4000, cash: 1000 }] },
  { scheduled: 5, shown: 3, qualified: 2, pitchedUnqualified: 0, closes: [] },
]

const PAID_FIRST: GroupPlan[] = [
  { scheduled: 6, shown: 3, qualified: 1, pitchedUnqualified: 1, closes: [] },
  { scheduled: 3, shown: 2, qualified: 1, pitchedUnqualified: 0, closes: [{ revenue: 2000, cash: 2000 }] },
  { scheduled: 5, shown: 1, qualified: 1, pitchedUnqualified: 0, closes: [] },
  { scheduled: 2, shown: 1, qualified: 0, pitchedUnqualified: 0, closes: [] },
]

/** Organic follow-ups: all shown, qualified, pitched and closed for $4,000 with full cash. */
const ORGANIC_FOLLOW_UPS = [2, 1, 0, 0]

/** Objection pools, consumed in order across the 28-day window. */
const ORGANIC_OBJECTIONS = [
  'Timing', 'Shopping Around', 'Timing', 'Shopping Around', 'Need Partner Approval', 'Timing',
  'Shopping Around', 'Money', 'Timing', 'Shopping Around', 'Timing', 'Shopping Around',
  'Need Partner Approval', 'Timing', 'Shopping Around', 'Money', 'Timing', 'Shopping Around',
  'Need Partner Approval', 'Timing', 'Shopping Around', 'Timing', 'Shopping Around',
] // Timing 9, Shopping Around 9, Need Partner Approval 3, Money 2 = 23

const PAID_OBJECTIONS = ['Timing', 'Need to Think', 'Timing', 'Money', 'Shopping Around', 'Timing'] // 6

const OLDER_OBJECTIONS = ['Timing', 'Shopping Around', 'Money', 'Need Partner Approval', 'Need to Think']
const OLDER_SOURCES = ['Instagram', 'Instagram', 'Instagram', 'Referral', 'VSL', 'Free Guide', 'YouTube']

function bucketToDaysAgo(bucketOldestFirst: number): number {
  // bucket 0 (oldest) = 21..27 days ago, bucket 3 (newest) = 0..6 days ago
  return (3 - bucketOldestFirst) * 7
}

interface Ctx {
  now: Date
  seq: number
  nameIndex: number
  stepIndex: number
  calls: CallReport[]
  dmCloses: DMClose[]
}

function nextName(ctx: Ctx): string {
  const first = FIRST_NAMES[ctx.nameIndex % FIRST_NAMES.length]
  const initial = LAST_INITIALS[Math.floor(ctx.nameIndex / FIRST_NAMES.length + ctx.nameIndex * 7) % LAST_INITIALS.length]
  ctx.nameIndex += 1
  return `${first} ${initial}.`
}

function nextStep(ctx: Ctx): string {
  const step = NEXT_STEPS[ctx.stepIndex % NEXT_STEPS.length]
  ctx.stepIndex += 1
  return step
}

function dateDaysAgo(now: Date, daysAgo: number): string {
  return toISODate(addDays(now, -daysAgo))
}

function phoneFor(seq: number): string {
  const tail = (100000 + ((seq * 7919) % 900000)).toString()
  return `+44 7${tail.slice(0, 3)} ${tail.slice(3)}${(seq % 10).toString()}${((seq * 3) % 10).toString()}${((seq * 7) % 10).toString()}`
}

function emailFor(name: string, seq: number): string {
  const handle = name.toLowerCase().replace(/[^a-z]/g, '')
  return `${handle}${seq}@example.com`
}

function makeGroup(
  ctx: Ctx,
  bucket: number,
  plan: GroupPlan,
  leadSource: LeadSource,
  rawSources: (i: number) => string,
  objections: string[],
  objectionCursor: { i: number },
  depositSlots: { remaining: number; bucket: number },
): void {
  const base = bucketToDaysAgo(bucket)
  const closes = plan.closes.length
  const qualifiedOpen = plan.qualified - closes
  const shownUnqualifiedUnpitched = plan.shown - plan.qualified - plan.pitchedUnqualified
  for (let i = 0; i < plan.scheduled; i++) {
    const daysAgo = base + (i % 7)
    const name = nextName(ctx)
    const seq = ctx.seq++
    const record: CallReport = {
      id: `mock-call-${seq}`,
      date: dateDaysAgo(ctx.now, daysAgo),
      closer: 'Sam Rivera',
      leadSource,
      callType: '1st Call',
      showed: false,
      qualified: false,
      pitched: false,
      closed: false,
      revenue: 0,
      contractValue: 0,
      cashCollected: 0,
      objection: null,
      prospect: name,
      leadSourceRaw: rawSources(seq),
      callStatus: 'No Show',
      callOutcome: 'Not closed',
      notes: NOTES[seq % NOTES.length],
      phone: phoneFor(seq),
      email: emailFor(name, seq),
    }
    if (i < closes) {
      const c = plan.closes[i]
      Object.assign(record, {
        showed: true, qualified: true, pitched: true, closed: true,
        revenue: c.revenue, contractValue: c.revenue, cashCollected: c.cash, callStatus: 'Showed', callOutcome: 'Closed',
        nextSteps: 'Onboarding call booked',
      })
    } else if (i < closes + qualifiedOpen) {
      Object.assign(record, {
        showed: true, qualified: true, pitched: true, callStatus: 'Showed', callOutcome: 'Follow-up booked',
        objection: objections[objectionCursor.i++], nextSteps: nextStep(ctx),
      })
      if (depositSlots.remaining > 0 && bucket === depositSlots.bucket) {
        record.callOutcome = 'Deposit'
        record.nextSteps = 'Deposit paid, balance due Friday'
        // a deposit is part paid: the full price stays on the row, revenue stays zero
        record.contractValue = 4000
        depositSlots.remaining -= 1
      }
    } else if (i < closes + qualifiedOpen + plan.pitchedUnqualified) {
      Object.assign(record, {
        showed: true, qualified: false, pitched: true, callStatus: 'Showed', callOutcome: 'Not closed',
        objection: objections[objectionCursor.i++], nextSteps: nextStep(ctx),
      })
    } else if (i < closes + qualifiedOpen + plan.pitchedUnqualified + shownUnqualifiedUnpitched) {
      Object.assign(record, {
        showed: true, qualified: false, pitched: false, callStatus: 'Showed', callOutcome: 'Not closed',
        objection: objections[objectionCursor.i++], nextSteps: nextStep(ctx),
      })
    } else {
      // no show, alternate raw status so the Rescheduled pill is exercised
      record.callStatus = seq % 3 === 0 ? 'Rescheduled' : 'No Show'
      record.callOutcome = ''
    }
    ctx.calls.push(record)
  }
}

function makeRecent(ctx: Ctx): void {
  const organicRaw = (seq: number) => (seq % 5 === 4 ? 'Referral' : 'Instagram')
  const paidRaw = (seq: number) => (seq % 2 === 0 ? 'VSL' : 'Free Guide')
  const organicCursor = { i: 0 }
  const paidCursor = { i: 0 }
  // Two organic open follow-ups in the 7..13 days ago bucket carry a Deposit outcome.
  const organicDeposits = { remaining: 2, bucket: 2 }
  const paidDeposits = { remaining: 0, bucket: -1 }

  for (let bucket = 0; bucket < 4; bucket++) {
    makeGroup(ctx, bucket, ORGANIC_FIRST[bucket], 'Organic', organicRaw, ORGANIC_OBJECTIONS, organicCursor, organicDeposits)
    makeGroup(ctx, bucket, PAID_FIRST[bucket], 'Paid Ads', paidRaw, PAID_OBJECTIONS, paidCursor, paidDeposits)

    const base = bucketToDaysAgo(bucket)
    for (let i = 0; i < ORGANIC_FOLLOW_UPS[bucket]; i++) {
      const name = nextName(ctx)
      const seq = ctx.seq++
      ctx.calls.push({
        id: `mock-call-${seq}`,
        date: dateDaysAgo(ctx.now, base + 2 + i),
        closer: 'Sam Rivera',
        leadSource: 'Organic',
        callType: 'Follow-up',
        showed: true,
        qualified: true,
        pitched: true,
        closed: true,
        revenue: 4000,
        contractValue: 4000,
        cashCollected: 4000,
        objection: null,
        prospect: name,
        leadSourceRaw: 'Instagram',
        callStatus: 'Showed',
        callOutcome: 'Closed',
        nextSteps: 'Onboarding call booked',
        notes: 'Closed on the follow-up.',
        phone: phoneFor(seq),
        email: emailFor(name, seq),
      })
    }
  }

  // DM closes: organic 2 in the oldest bucket, paid 1 in the 14..20 days bucket.
  for (let i = 0; i < 2; i++) {
    const seq = ctx.seq++
    ctx.dmCloses.push({
      id: `mock-dm-${seq}`,
      date: dateDaysAgo(ctx.now, bucketToDaysAgo(0) + 1 + i * 3),
      closer: 'Sam Rivera',
      leadSource: 'Organic',
      revenue: 5000,
      cashCollected: 5000,
      prospect: nextName(ctx),
      leadSourceRaw: 'Instagram',
    })
  }
  {
    const seq = ctx.seq++
    ctx.dmCloses.push({
      id: `mock-dm-${seq}`,
      date: dateDaysAgo(ctx.now, bucketToDaysAgo(1) + 4),
      closer: 'Sam Rivera',
      leadSource: 'Paid Ads',
      revenue: 4000,
      cashCollected: 1000,
      prospect: nextName(ctx),
      leadSourceRaw: 'VSL',
    })
  }
}

function makeOlder(ctx: Ctx, rng: () => number): void {
  const pick = <T,>(list: T[]): T => list[Math.floor(rng() * list.length)]
  for (let i = 0; i < 120; i++) {
    const daysAgo = 30 + Math.floor(rng() * 271) // 30..300
    const raw = pick(OLDER_SOURCES)
    const leadSource: LeadSource = raw === 'VSL' || raw === 'Free Guide' ? 'Paid Ads' : 'Organic'
    const callType: CallType = rng() < 0.15 ? 'Follow-up' : '1st Call'
    const showed = rng() < 0.62
    const qualified = showed && rng() < 0.7
    const pitched = qualified ? true : showed && rng() < 0.05
    const closed = pitched && rng() < 0.3
    const revenue = closed ? pick([2000, 4000, 4000, 6000]) : 0
    const cash = closed ? Math.round(revenue * pick([0.25, 0.5, 1])) : 0
    const name = nextName(ctx)
    const seq = ctx.seq++
    const openOutcome = rng() < 0.15 ? 'Deposit' : rng() < 0.5 ? 'Follow-up booked' : 'Not closed'
    ctx.calls.push({
      id: `mock-call-${seq}`,
      date: dateDaysAgo(ctx.now, daysAgo),
      closer: rng() < 0.55 ? 'Sam Rivera' : 'Dani Okafor',
      leadSource,
      callType,
      showed,
      qualified,
      pitched,
      closed,
      revenue,
      contractValue: revenue,
      cashCollected: cash,
      objection: showed && !closed ? pick(OLDER_OBJECTIONS) : null,
      prospect: name,
      leadSourceRaw: raw,
      callStatus: showed ? 'Showed' : rng() < 0.3 ? 'Rescheduled' : 'No Show',
      callOutcome: closed ? 'Closed' : showed ? openOutcome : '',
      nextSteps: showed && !closed ? nextStep(ctx) : closed ? 'Onboarding call booked' : undefined,
      notes: pick(NOTES),
      phone: phoneFor(seq),
      email: emailFor(name, seq),
    })
  }
  for (let i = 0; i < 6; i++) {
    const daysAgo = 30 + Math.floor(rng() * 271)
    const raw = pick(['Instagram', 'Instagram', 'Referral', 'VSL'])
    const revenue = pick([3000, 4000, 5000])
    const seq = ctx.seq++
    ctx.dmCloses.push({
      id: `mock-dm-${seq}`,
      date: dateDaysAgo(ctx.now, daysAgo),
      closer: rng() < 0.5 ? 'Sam Rivera' : 'Dani Okafor',
      leadSource: raw === 'VSL' ? 'Paid Ads' : 'Organic',
      revenue,
      cashCollected: Math.round(revenue * pick([0.5, 1])),
      prospect: nextName(ctx),
      leadSourceRaw: raw,
    })
  }
}

/**
 * Build the sample dataset relative to `now`. Same `now` and seed always give the same records.
 * The last 28 days match the specunder the 4 Weeks filter.
 */
export function generateMockData(now: Date, seed: number = MOCK_SEED): SalesData {
  const ctx: Ctx = { now, seq: 1, nameIndex: 0, stepIndex: 0, calls: [], dmCloses: [] }
  makeRecent(ctx)
  makeOlder(ctx, mulberry32(seed))
  const byDateDesc = <T extends { date: string; id: string }>(a: T, b: T) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  return {
    calls: ctx.calls.sort(byDateDesc),
    dmCloses: ctx.dmCloses.sort(byDateDesc),
  }
}
