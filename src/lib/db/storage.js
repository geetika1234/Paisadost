import { supabase } from '../supabase'

/**
 * Visit photos live in the PRIVATE "visit-photos" bucket (migration 012) under
 * <customerId>/<file>. A visit stores a reference, not a URL:
 *
 *   sb:visit-photos/<customerId>/<file>   new photos (private, signed on display)
 *   https://.../public/photos/...         older photos (public bucket, shown as-is)
 *   blob:...                              just-picked photo, not uploaded yet
 *
 * resolvePhotoSrc() turns any of these into something an <img> can show.
 */

const BUCKET     = 'visit-photos'
const REF_PREFIX = `sb:${BUCKET}/`
const SIGNED_TTL_SECONDS = 60 * 60
// Re-sign a few minutes before expiry so an open screen never shows a dead link.
const REFRESH_MARGIN_MS  = 5 * 60 * 1000

export function isStoredPhotoRef(src) {
  return typeof src === 'string' && src.startsWith(REF_PREFIX)
}

export async function uploadPhoto(file, customerId) {
  const ext  = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (error) throw error

  return `${REF_PREFIX}${path}`
}

const signedCache = new Map()   // ref → { url, expiresAt }

export async function resolvePhotoSrc(src) {
  if (!isStoredPhotoRef(src)) return src

  const cached = signedCache.get(src)
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url

  const path = src.slice(REF_PREFIX.length)
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS)
  if (error) throw error

  signedCache.set(src, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 })
  return data.signedUrl
}
