function fromPos(p) {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }
}

// Returns { geo: {lat,lng,accuracy}|null, errorCode: null|1|2|3|-1 }
// errorCode: null=ok  1=permission_denied  2=unavailable  3=timeout  -1=not_supported
export function getGeoLocationWithStatus() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ geo: null, errorCode: -1 }); return }

    // Step 1: try GPS (high accuracy, 6 s)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ geo: fromPos(p), errorCode: null }),
      firstErr => {
        // Permission denied — no point retrying with different accuracy
        if (firstErr.code === 1) { resolve({ geo: null, errorCode: 1 }); return }
        // Step 2: fall back to network-based location (10 s, accepts 60 s old cache)
        navigator.geolocation.getCurrentPosition(
          p => resolve({ geo: fromPos(p), errorCode: null }),
          lastErr => resolve({ geo: null, errorCode: lastErr.code }),
          { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
        )
      },
      { timeout: 6000, enableHighAccuracy: true, maximumAge: 15000 }
    )
  })
}

// Simple wrapper — returns geo or null (used inside stampPhoto)
export function getGeoLocation() {
  return getGeoLocationWithStatus().then(r => r.geo)
}

function formatCoord(val, pos, neg) {
  return `${Math.abs(val).toFixed(5)}${val >= 0 ? pos : neg}`
}

function formatDateTime(date) {
  const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const t = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${d}  ${t}`
}

export function stampPhoto(file, geo) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const W = img.naturalWidth  || img.width
      const H = img.naturalHeight || img.height

      const canvas = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      ctx.drawImage(img, 0, 0, W, H)

      // Stamp bar — 15% height, minimum 90px
      const barH    = Math.max(90, Math.round(H * 0.15))
      const fontSize = Math.max(24, Math.round(barH * 0.28))
      const pad     = Math.round(barH * 0.12)
      const lineGap = Math.round(fontSize * 1.55)

      // Dark background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
      ctx.fillRect(0, H - barH, W, barH)

      // Green accent line at top of bar
      const accentH = Math.max(5, Math.round(barH * 0.055))
      ctx.fillStyle = '#2E5835'
      ctx.fillRect(0, H - barH, W, accentH)

      ctx.font         = `bold ${fontSize}px Arial, Helvetica, sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textBaseline = 'top'

      const geoText = geo
        ? `LAT: ${formatCoord(geo.lat, 'N', 'S')}  LNG: ${formatCoord(geo.lng, 'E', 'W')}  (+-${geo.accuracy}m)`
        : 'GPS: Location unavailable'

      const timeText = `${formatDateTime(new Date())}   AR Financiers`

      ctx.fillText(geoText,  pad, H - barH + accentH + pad)
      ctx.fillText(timeText, pad, H - barH + accentH + pad + lineGap)

      // Export via toBlob (memory-efficient, no base64 round-trip)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas toBlob returned null')); return }
        const name = file.name.replace(/\.[^.]+$/, '') + '_stamped.jpg'
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.92)
    }

    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}
