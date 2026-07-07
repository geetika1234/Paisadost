function fromPos(p) {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }
}

// Reverse geocode lat/lng → "Suburb, City" using OpenStreetMap Nominatim
// (free, no API key, CORS-safe, much better India coverage than BigDataCloud)
async function reverseGeocode(lat, lng) {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res   = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { signal: ctrl.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const json  = await res.json()
    const addr  = json.address || {}

    // suburb = mohalla / area (e.g. "Sodala")
    // neighbourhood = colony (e.g. "Hasanpura-C") — used only if no suburb
    const subArea = addr.suburb || addr.neighbourhood || addr.quarter || null
    const city    = addr.city   || addr.town          || addr.village || null

    if (!subArea && !city) return null
    if (!subArea || subArea === city) return city
    return `${subArea}, ${city}`
  } catch {
    return null
  }
}

// Returns { geo: {lat,lng,accuracy,area}|null, errorCode: null|1|2|3|-1 }
// errorCode: null=ok  1=permission_denied  2=unavailable  3=timeout  -1=not_supported
export function getGeoLocationWithStatus() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ geo: null, errorCode: -1 }); return }
    navigator.geolocation.getCurrentPosition(
      async p => {
        const lat      = p.coords.latitude
        const lng      = p.coords.longitude
        const accuracy = Math.round(p.coords.accuracy)
        const area     = await reverseGeocode(lat, lng)
        resolve({ geo: { lat, lng, accuracy, area }, errorCode: null })
      },
      err => resolve({ geo: null, errorCode: err.code }),
      { timeout: 15000, enableHighAccuracy: false, maximumAge: 60000 }
    )
  })
}

// Simple wrapper — returns geo or null
export function getGeoLocation() {
  return getGeoLocationWithStatus().then(r => r.geo)
}

function formatCoord(val, pos, neg) {
  return `${Math.abs(val).toFixed(5)}${val >= 0 ? pos : neg}`
}

function formatDateTime(date) {
  const day = date.toLocaleDateString('en-IN', { weekday: 'short' })
  const d   = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const t   = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day}, ${d}  ${t}`
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

      // 3 lines when area name is available, 2 lines otherwise
      const hasArea  = !!(geo?.area)
      const barH     = hasArea
        ? Math.max(120, Math.round(H * 0.18))
        : Math.max(90,  Math.round(H * 0.15))
      const fontSize = Math.max(20, Math.round(barH * 0.20))
      const lineGap  = Math.round(fontSize * 1.15)
      const pad      = Math.round(barH * 0.08)
      const accentH  = Math.max(5, Math.round(barH * 0.05))

      // Dark background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
      ctx.fillRect(0, H - barH, W, barH)

      // Green accent line at top of bar
      ctx.fillStyle = '#2E5835'
      ctx.fillRect(0, H - barH, W, accentH)

      ctx.font         = `bold ${fontSize}px Arial, Helvetica, sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textBaseline = 'top'

      const geoText  = geo
        ? `LAT: ${formatCoord(geo.lat, 'N', 'S')}  LNG: ${formatCoord(geo.lng, 'E', 'W')}  (+-${geo.accuracy}m)`
        : 'GPS: Location unavailable'
      const timeText = `${formatDateTime(new Date())}   AR Financiers`

      let y = H - barH + accentH + pad
      if (hasArea) {
        ctx.fillText(geo.area, pad, y)
        y += lineGap
      }
      ctx.fillText(geoText, pad, y)
      y += lineGap
      ctx.fillText(timeText, pad, y)

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
