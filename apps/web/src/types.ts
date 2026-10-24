export type TaskStage =
  | 'needs_input'
  | 'finding'
  | 'calling'
  | 'offers_ready'
  | 'no_matches'
  | 'booking'
  | 'confirmed'
  | 'failed'

export type CallStatus = 'queued' | 'dialing' | 'connected' | 'completed' | 'failed'

export interface TranscriptSegment {
  segmentId: string
  sequence: number
  speaker: 'agent' | 'business'
  text: string
  at: string
}

export interface BusinessCandidate {
  businessId: string
  name: string
  phoneE164: string
  address: string | null
  sourceUrls: string[]
  openingStatus: 'open' | 'closed' | 'unknown'
  relevance: string
}

export interface BusinessCall {
  callId: string
  businessId: string
  purpose: 'quote' | 'booking'
  status: CallStatus
  reason: string | null
  transcript: TranscriptSegment[]
}

export interface Offer {
  offerId: string
  businessId: string
  availableNow: boolean | null
  etaMinutes: number | null
  amountMinor: number | null
  currency: string | null
  quoteType: 'fixed' | 'estimate' | 'unknown'
  extraFees: string | null
  conditions: string | null
  capturedAt: string
}

export interface TaskSnapshot {
  taskId: string
  stage: TaskStage
  problem: string
  location: string
  vehicle: string
  maxArrivalMinutes: number
  createdAt: string
  businesses: BusinessCandidate[]
  calls: BusinessCall[]
  offers: Offer[]
  selectedOfferId: string | null
  booking: {
    status: 'not_started' | 'calling' | 'confirmed' | 'declined' | 'terms_changed' | 'unknown'
    accepted: boolean | null
    summary: string | null
  }
  activity: Array<{ id: string; label: string; at: string; state: 'done' | 'active' | 'pending' }>
  warnings: string[]
}

export interface CreateTaskInput {
  service: 'mobile_mechanic'
  problem: string
  location: { address: string; latitude: number | null; longitude: number | null }
  vehicle: { make: string | null; model: string | null; year: number | null }
  maxArrivalMinutes: number
  budgetMinor: number | null
  currency: string
}

export interface CreateTaskResponse {
  taskId?: string
  clarification?: { question: string }
}
