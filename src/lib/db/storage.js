import { supabase } from '../supabase'

/**
 * uploadPhoto(file, customerId)
 * Uploads a single image File to the "photos" Supabase Storage bucket.
 * Returns the permanent public URL.
 *
 * Bucket setup (run once in Supabase dashboard → Storage):
 *   1. Create bucket named "photos"
 *   2. Set bucket to Public
 */
export async function uploadPhoto(file, customerId) {
  const ext  = file.name?.split('.').pop() || 'jpg'
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('photos')
    .upload(path, file, { upsert: false })
  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}
