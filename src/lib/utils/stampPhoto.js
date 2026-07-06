export function getGeoLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    let settled = false
    function done(val) { if (!settled) { settled = true; resolve(val) } }
    navigator.geolocation.getCurrentPosition(
      pos => done({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => done(null),
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 30000 }
    )
  })
}

function formatCoord(val, pos, neg) {
  return `${Math.abs(val).toFixed(4)}${val >= 0 ? pos : neg}`
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

      // Draw original image
      ctx.drawImage(img, 0, 0, W, H)

      // ── Stamp layout ──────────────────────────────────────────
      const barH    = Math.max(72, Math.round(H * 0.10))
      const fontSize = Math.max(18, Math.round(barH * 0.26))
      const pad     = Math.round(barH * 0.15)
      const lineGap = Math.round(fontSize * 1.45)

      // Solid dark background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.80)'
      ctx.fillRect(0, H - barH, W, barH)

      // Green accent line at top of bar
      ctx.fillStyle = '#2E5835'
      ctx.fillRect(0, H - barH, W, Math.max(4, Math.round(barH * 0.05)))

      // ── Text (no emojis — unreliable on canvas) ───────────────
      ctx.font         = `bold ${fontSize}px Arial, Helvetica, sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textBaseline = 'top'

      const geoText = geo
        ? `GPS: ${formatCoord(geo.lat, 'N', 'S')}, ${formatCoord(geo.lng, 'E', 'W')}  (+/-${geo.accuracy}m)`
        : 'GPS: Location unavailable'

      const timeText = `${formatDateTime(new Date())}   AR Financier's`

      ctx.fillText(geoText,  pad, H - barH + pad + 4)
      ctx.fillText(timeText, pad, H - barH + pad + 4 + lineGap)

      // ── Export via dataURL (more reliable than toBlob on mobile) ──
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        fetch(dataUrl)
          .then(r => r.blob())
          .then(blob => {
            const name = file.name.replace(/\.[^.]+$/, '') + '_stamped.jpg'
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          })
          .catch(reject)
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}
