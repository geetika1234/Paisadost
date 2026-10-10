/**
 * Customer responses as recorded by the workspace dropdown
 * (customer_response events). Only 'interested' moves the stage (migration
 * 015); 'not_interested' moves an active lead to Nurture (009); 'thinking'
 * changes neither, so the latest response is the only place it shows.
 */
export const RESPONSES = [
  { key: 'interested',     label: 'Interested', cls: 'bg-green-100 text-green-700' },
  { key: 'thinking',       label: 'Soch Raha',  cls: 'bg-amber-100 text-amber-700' },
  { key: 'not_interested', label: 'Nahi',       cls: 'bg-red-100 text-red-700'     },
]

const BY_KEY = Object.fromEntries(RESPONSES.map(r => [r.key, r]))

/** Response presentation, or null for no/unknown response. */
export function getResponse(key) {
  return BY_KEY[key] || null
}
