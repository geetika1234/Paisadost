import { describe, it, expect, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({ uploads: [], signs: 0 }))

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: bucket => ({
        upload: async (path, file, opts) => { mock.uploads.push({ bucket, path, opts }); return { error: null } },
        createSignedUrl: async (path, ttl) => { mock.signs++; return { data: { signedUrl: `https://signed/${path}?ttl=${ttl}` }, error: null } },
      }),
    },
  },
}))

import { uploadPhoto, resolvePhotoSrc, isStoredPhotoRef } from './storage'

beforeEach(() => { mock.uploads = []; mock.signs = 0 })

describe('visit photo storage', () => {
  it('uploads to the private bucket under the lead id and returns a reference, not a URL', async () => {
    const ref = await uploadPhoto({ name: 'shop.JPG', type: 'image/jpeg' }, 'cust-1')

    expect(mock.uploads[0].bucket).toBe('visit-photos')
    expect(mock.uploads[0].path).toMatch(/^cust-1\/\d+_[a-z0-9]+\.jpg$/)
    expect(ref).toBe(`sb:visit-photos/${mock.uploads[0].path}`)
    expect(isStoredPhotoRef(ref)).toBe(true)
  })

  it('shows older public URLs and local previews as they are', async () => {
    expect(await resolvePhotoSrc('https://x.supabase.co/storage/v1/object/public/photos/a.jpg'))
      .toBe('https://x.supabase.co/storage/v1/object/public/photos/a.jpg')
    expect(await resolvePhotoSrc('blob:abc')).toBe('blob:abc')
    expect(mock.signs).toBe(0)
  })

  it('signs a stored reference once and reuses it while valid', async () => {
    const ref = 'sb:visit-photos/cust-1/a.jpg'
    const first  = await resolvePhotoSrc(ref)
    const second = await resolvePhotoSrc(ref)
    expect(first).toBe('https://signed/cust-1/a.jpg?ttl=3600')
    expect(second).toBe(first)
    expect(mock.signs).toBe(1)
  })
})
