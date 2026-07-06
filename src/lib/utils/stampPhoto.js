// Requests GPS coordinates with a 10-second timeout.
// Resolves to { lat, lng, accuracy } or null if denied/unavailable.
export function getGeoLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
      }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: true }
    )
  })
}

function formatCoord(val, posDir, negDir) {
  const dir = val >= 0 ? posDir : negDir
  return `${Math.abs(val).toFixed(5)}° ${dir}`
}

function formatDateTime(date) {
  return date.toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Draws geo + timestamp stamp onto a photo File.
// Returns a new File (JPEG) with the stamp baked in.
export function stampPhoto(file, geo) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')

      // Draw original photo
      ctx.drawImage(img, 0, 0)

      // ── Stamp dimensions ───────────────────────────────────────
      const W          = canvas.width
      const H          = canvas.height
      const barH       = Math.max(56, Math.round(H * 0.09))  // ~9% of height
      const pad        = Math.round(barH * 0.18)
      const fontSize   = Math.max(14, Math.round(barH * 0.28))
      const lineH      = fontSize + Math.round(barH * 0.12)

      // Semi-transparent dark bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
      ctx.fillRect(0, H - barH, W, barH)

      // White text
      ctx.fillStyle    = '#FFFFFF'
      ctx.font         = `bold ${fontSize}px Arial, sans-serif`
      ctx.textBaseline = 'top'

      const geoLine = geo
        ? `\u{1F4CD} ${formatCoord(geo.lat, 'N', 'S')}  ${formatCoord(geo.lng, 'E', 'W')}  ±${geo.accuracy}m`
        : '\u{1F4CD} Location N/A'

      const timeLine = `\u{1F550} ${formatDateTime(new Date())}   AR Financier's`

      ctx.fillText(geoLine,  pad, H - barH + pad)
      ctx.fillText(timeLine, pad, H - barH + pad + lineH)

      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Canvas export failed')); return }
          const stamped = new File([blob], file.name.replace(/\.[^.]+$/, '_stamped.jpg'), { type: 'image/jpeg' })
          resolve(stamped)
        },
        'image/jpeg',
        0.92
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
