import type { TaskSnapshot } from './types'

const now = new Date()
const minuteAgo = new Date(now.getTime() - 60_000).toISOString()
const twoMinutesAgo = new Date(now.getTime() - 120_000).toISOString()

export const demoSnapshot: TaskSnapshot = {
  taskId: 'demo-flat-tire',
  stage: 'offers_ready',
  problem: 'Flat tire — need a mobile tire change',
  location: 'Palo Alto, CA',
  vehicle: '2021 Honda Civic',
  maxArrivalMinutes: 45,
  createdAt: twoMinutesAgo,
  businesses: [
    {
      businessId: 'demo-business-1',
      name: 'Peninsula Mobile Auto',
      phoneE164: '+15550101001',
      address: 'Palo Alto, CA',
      sourceUrls: [],
      openingStatus: 'open',
      relevance: 'Mobile tire service in the requested area',
    },
    {
      businessId: 'demo-business-2',
      name: 'RoadReady Mechanics',
      phoneE164: '+15550101002',
      address: 'Mountain View, CA',
      sourceUrls: [],
      openingStatus: 'open',
      relevance: 'Offers roadside tire changes nearby',
    },
    {
      businessId: 'demo-business-3',
      name: 'Valley Tire Rescue',
      phoneE164: '+15550101003',
      address: 'Menlo Park, CA',
      sourceUrls: [],
      openingStatus: 'unknown',
      relevance: 'Mobile tire assistance; hours not confirmed',
    },
  ],
  calls: [
    {
      callId: 'demo-call-1',
      businessId: 'demo-business-1',
      purpose: 'quote',
      status: 'completed',
      reason: null,
      transcript: [
        { segmentId: 'demo-1a', sequence: 1, speaker: 'agent', text: 'Hi, I’m calling about a mobile tire change in Palo Alto for a 2021 Honda Civic. Are you available?', at: twoMinutesAgo },
        { segmentId: 'demo-1b', sequence: 2, speaker: 'business', text: 'Yes. We can have someone there in about 35 minutes.', at: twoMinutesAgo },
        { segmentId: 'demo-1c', sequence: 3, speaker: 'agent', text: 'What is the total price, including any travel or service fees?', at: minuteAgo },
        { segmentId: 'demo-1d', sequence: 4, speaker: 'business', text: 'The tire change is an $85 estimate. A new tire would be extra if needed.', at: minuteAgo },
      ],
    },
    {
      callId: 'demo-call-2',
      businessId: 'demo-business-2',
      purpose: 'quote',
      status: 'completed',
      reason: null,
      transcript: [
        { segmentId: 'demo-2a', sequence: 1, speaker: 'agent', text: 'Do you have mobile tire-change availability in Palo Alto?', at: minuteAgo },
        { segmentId: 'demo-2b', sequence: 2, speaker: 'business', text: 'We can be there in about 50 minutes. The service call starts at $72.', at: minuteAgo },
      ],
    },
    {
      callId: 'demo-call-3',
      businessId: 'demo-business-3',
      purpose: 'quote',
      status: 'failed',
      reason: 'No answer before the demo timeout',
      transcript: [],
    },
  ],
  offers: [
    {
      offerId: 'demo-offer-1',
      businessId: 'demo-business-1',
      availableNow: true,
      etaMinutes: 35,
      amountMinor: 8500,
      currency: 'USD',
      quoteType: 'estimate',
      extraFees: 'Replacement tire, if needed, costs extra.',
      conditions: 'Estimate for labor; tire cost not included.',
      capturedAt: minuteAgo,
    },
    {
      offerId: 'demo-offer-2',
      businessId: 'demo-business-2',
      availableNow: true,
      etaMinutes: 50,
      amountMinor: 7200,
      currency: 'USD',
      quoteType: 'estimate',
      extraFees: null,
      conditions: 'Service call starting price; final total not confirmed.',
      capturedAt: minuteAgo,
    },
  ],
  selectedOfferId: null,
  booking: { status: 'not_started', accepted: null, summary: null },
  activity: [
    { id: 'activity-1', label: 'Request details confirmed', at: twoMinutesAgo, state: 'done' },
    { id: 'activity-2', label: 'Three nearby businesses found', at: twoMinutesAgo, state: 'done' },
    { id: 'activity-3', label: 'Quote calls completed', at: minuteAgo, state: 'done' },
    { id: 'activity-4', label: 'Compare offers and choose one', at: now.toISOString(), state: 'active' },
    { id: 'activity-5', label: 'Ask the business to confirm dispatch', at: now.toISOString(), state: 'pending' },
  ],
  warnings: ['Demo information only. No business was contacted and no booking exists.'],
}

export function createDemoTask(problem: string, location: string, vehicle: string, maxArrivalMinutes: number): TaskSnapshot {
  const fresh = structuredClone(demoSnapshot)
  const id = `demo-${crypto.randomUUID()}`
  fresh.taskId = id
  fresh.problem = problem
  fresh.location = location
  fresh.vehicle = vehicle || 'Vehicle details not provided'
  fresh.maxArrivalMinutes = maxArrivalMinutes
  fresh.stage = 'finding'
  fresh.offers = []
  fresh.selectedOfferId = null
  fresh.booking = { status: 'not_started', accepted: null, summary: null }
  fresh.activity = [
    { id: `${id}-1`, label: 'Request details received', at: new Date().toISOString(), state: 'done' },
    { id: `${id}-2`, label: 'Finding nearby mobile mechanics', at: new Date().toISOString(), state: 'active' },
    { id: `${id}-3`, label: 'Collecting availability and quotes', at: new Date().toISOString(), state: 'pending' },
    { id: `${id}-4`, label: 'Compare offers and choose one', at: new Date().toISOString(), state: 'pending' },
    { id: `${id}-5`, label: 'Ask the business to confirm dispatch', at: new Date().toISOString(), state: 'pending' },
  ]
  fresh.calls = fresh.calls.map((call) => ({ ...call, status: 'queued', transcript: [], reason: null }))
  return fresh
}
