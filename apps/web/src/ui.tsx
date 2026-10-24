import type { ReactNode } from 'react'
import type { Offer } from './types'

export const demoMode = (import.meta.env.VITE_APP_MODE ?? 'test') === 'test'

export function money(amountMinor: number | null, currency: string | null): string {
  if (amountMinor === null || !currency) return 'Price unknown'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
}

export function clock(value: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function relative(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function label(status: string): string {
  return status.replaceAll('_', ' ')
}

// Display-only mirror of the backend's eligibility rule; the backend still validates every booking.
export function ineligibleReason(offer: Offer, maxArrivalMinutes: number): string | null {
  if (offer.availableNow === false) return 'Not available now'
  if (offer.etaMinutes === null) return 'ETA unknown, so the arrival goal is not met'
  if (offer.etaMinutes > maxArrivalMinutes) return `ETA ${offer.etaMinutes} min is over the ${maxArrivalMinutes}-min goal`
  return null
}

export function rankOffers(offers: Offer[], maxArrivalMinutes: number): Offer[] {
  const eligible = (offer: Offer) => (ineligibleReason(offer, maxArrivalMinutes) ? 0 : 1)
  return [...offers].sort((a, b) =>
    eligible(b) - eligible(a)
    || (a.amountMinor ?? Infinity) - (b.amountMinor ?? Infinity)
    || (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity))
}

export function LiveDot() {
  return <span className="live-dot" aria-hidden="true" />
}

const paths: Record<string, ReactNode> = {
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  car: <><path d="m5 11 1.5-4h11L19 11l1.5 1.5V19h-2v-2h-13v2h-2v-6.5L5 11Z" /><path d="M6.5 14h.01M17.5 14h.01M5 11h14" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  board: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
