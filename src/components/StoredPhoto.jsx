import { useEffect, useState } from 'react'
import { resolvePhotoSrc, isStoredPhotoRef } from '../lib/db/storage'

/**
 * <img> for any visit-photo source: private reference (signed on demand),
 * older public URL, or a local blob preview. Shows a neutral box while a
 * signed link is fetched and a short message if it cannot be shown.
 */
export default function StoredPhoto({ src, alt = 'Visit photo', className = '' }) {
  const [url,    setUrl]    = useState(isStoredPhotoRef(src) ? null : src)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setFailed(false)
    if (!isStoredPhotoRef(src)) { setUrl(src); return }
    setUrl(null)
    resolvePhotoSrc(src)
      .then(u => { if (alive) setUrl(u) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [src])

  if (failed) {
    return (
      <div role="img" aria-label="Photo load nahi hui" className={`${className} flex items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 text-center px-2`}>
        Photo load nahi hui
      </div>
    )
  }
  if (!url) {
    return <div aria-busy="true" className={`${className} bg-slate-200 animate-pulse`} />
  }
  return <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />
}
