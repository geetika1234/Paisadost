import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getCurrentUser, setCurrentUser } from '../lib/db/dashboard'
import { saveCustomer, updateCustomer, checkMobileDuplicate, assignCustomer } from '../lib/db/customers'
import { addEvent, updateEventData } from '../lib/db/events'
import { uploadPhoto } from '../lib/db/storage'
import { stampPhoto, getGeoLocationWithStatus } from '../lib/utils/stampPhoto'

// ── Constants ────────────────────────────────────────────────────────────────

const BIZ_TYPES = [
  { label: 'किराना / जनरल स्टोर',    emoji: '🛒' },
  { label: 'हार्डवेयर / सैनिटरी',     emoji: '🔧' },
  { label: 'इलेक्ट्रिकल',              emoji: '⚡' },
  { label: 'कपड़े / रेडीमेड',          emoji: '👔' },
  { label: 'मोबाइल / इलेक्ट्रॉनिक्स', emoji: '📱' },
  { label: 'डेयरी / दूध की दुकान',    emoji: '🥛' },
  { label: 'चिकित्सा / फार्मेसी',      emoji: '💊' },
  { label: 'जूते-चप्पल',               emoji: '👟' },
  { label: 'सेवाएं / Services',         emoji: '🛠️' },
  { label: 'ऑटो पार्ट्स',              emoji: '🔩' },
  { label: 'फैंसी स्टोर',              emoji: '✨' },
  { label: 'पेंट की दुकान',            emoji: '🎨' },
  { label: 'फर्नीचर',                  emoji: '🪑' },
]

const SEASONS = [
  'गर्मी का समय', 'बरसात का समय', 'सर्दियों का मौसम', 'साल भर',
  'दीवाली का सीजन', 'शादी का सीजन', 'फसल कटाई के बाद', 'स्कूल खुलने का समय',
]

const MONTHS = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
]

const OFF_SEASON_SALES = [
  '₹50,000 से कम', '₹50,000 - ₹1.5 लाख', '₹1.5 - ₹2.5 लाख',
  '₹2.5 - ₹3.5 लाख', '₹3.5 लाख से ऊपर',
]

const INVESTMENT_TIMING = [
  'सीजन के टाइम', 'जब स्टॉक खत्म होने लगता है',
  'जब सप्लायर प्रेशर देता है', 'जब अच्छा मौका मिलता है',
]

const PREP_TIME = ['15 दिन', '1 महीना', '1.5 महीना', '2 महीना']

const PROBLEMS = [
  'स्टॉक की कमी', 'रोज़मर्रा के खर्चे', 'ग्राहक में उधार का पैसा फंस जाना',
  'कम्पटीशन', 'सीजन डिमांड पूरी नहीं कर पाना', 'सप्लायर/सेल्समेन का दबाव',
  'सप्लायर स्कीम/डिस्काउंट का फायदा न उठा पाना', 'कम सेल्स / ग्राहक कम आना',
  'दुकान का नवीनीकरण/डिस्प्ले', 'परिवार की जिम्मेदारियां', 'कोई बड़ी समस्या नहीं',
]

const MINDSET = ['व्यापार आगे बढ़ाना', 'जैसा चल रहा है वैसे चलाना']

const STEPS = [
  { label: 'Samanya Jaankari', icon: '👤' },
  { label: 'Vyapar Jaankari',  icon: '🏪' },
  { label: 'Tasveer + GPS',    icon: '📸' },
]

const EMPTY = {
  // Step 1
  shopName:            '',
  ownerName:           '',
  city:                '',
  market:              '',
  mobile:              '',
  // Step 2
  bizTypes:            [],
  bizTypeOther:        '',
  seasons:             [],
  seasonOther:         '',
  peakMonths:          [],
  offSeasonSales:      '',
  offSeasonSalesOther: '',
  offSeasonRevenue:    '',   // exact monthly off-season revenue (number input)
  investmentTiming:    '',
  prepTime:            '',
  prepTimeOther:       '',
  investBeforeSeason:  '',   // exact days before season they prepare (number input)
  problems:            [],
  decisionDelay:       '',
  mindset:             [],
  mindsetOther:        '',
  // Step 3
  photos:              [],
  gps:                 null,
}

// ── Small reusable pieces ────────────────────────────────────────────────────

function SectionHeader({ num, title, error }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <span className={`flex-shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${error ? 'bg-red-500' : 'bg-brand-600'}`}>{num}</span>
      <p className={`text-sm font-bold leading-snug ${error ? 'text-red-500' : 'text-slate-800'}`}>{title}</p>
    </div>
  )
}

function CheckItem({ label, checked, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] mb-1.5
        ${checked ? 'bg-white border-brand-400' : 'bg-white border-slate-200'}
        ${disabled && !checked ? 'opacity-40' : ''}`}
    >
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center
        ${checked ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`}>
        {checked && <span className="text-white text-[9px] font-bold">✓</span>}
      </div>
      <span className={`text-sm flex-1 text-left ${checked ? 'font-semibold text-brand-700' : 'text-slate-700'}`}>{label}</span>
    </button>
  )
}

function RadioItem({ label, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] mb-1.5
        ${checked ? 'bg-white border-brand-400' : 'bg-white border-slate-200'}`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
        ${checked ? 'border-brand-600' : 'border-slate-300'}`}>
        {checked && <div className="w-2 h-2 rounded-full bg-brand-600" />}
      </div>
      <span className={`text-sm flex-1 text-left ${checked ? 'font-semibold text-brand-700' : 'text-slate-700'}`}>{label}</span>
    </button>
  )
}

function OtherInput({ value, onChange, placeholder = 'Other likho...' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 mt-1 mb-2"
    />
  )
}

function Card({ children }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">{children}</div>
}

// ── Login Gate ────────────────────────────────────────────────────────────────

function LoginGate({ onLogin, onClose }) {
  const [name, setName] = useState('')
  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-white pt-12 pb-5 px-5 flex-shrink-0 flex items-center justify-between border-b border-slate-100">
        <div>
          <p className="text-xs font-medium text-brand-400 uppercase tracking-widest">Customer Engagement</p>
          <h1 className="text-xl font-extrabold leading-tight mt-0.5">Salesman Login</h1>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-lg leading-none">×</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {/* Icon */}
        <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-5">
          <span className="text-4xl">👤</span>
        </div>

        <h2 className="text-xl font-extrabold text-slate-800 mb-1 text-center">Pehle Login Karein</h2>
        <p className="text-sm text-slate-400 mb-8 text-center leading-relaxed">Form bhar ne se pehle apna naam enter karein</p>

        <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aapka Naam</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.replace(/[0-9]/g, ''))}
            placeholder="Naam likho..."
            className="w-full mt-2 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
            onKeyDown={e => e.key === 'Enter' && name.trim() && onLogin(name)}
            autoFocus
          />
        </div>

        <button
          onClick={() => name.trim() && onLogin(name)}
          disabled={!name.trim()}
          className="w-full py-4 bg-accent-400 text-white font-bold rounded-2xl disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-accent-200 text-base"
        >
          Login Karein →
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

function fmtDateTime(d) {
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

// Safe array helper — always returns an array even if value from Supabase is null/undefined
const arr = v => Array.isArray(v) ? v : []

const MIN_PHOTOS = 3

export default function S_CustomerForm() {
  const { closeCustomerForm, activateCustomer, update, customerFormInitialData, activeCustomer, inputs, profile } = useApp()
  const [salesmanName, setSalesmanName] = useState(() => getCurrentUser())
  const [step, setStep]           = useState(0)
  const [data, setData]           = useState(() => {
    // Priority: edit data (full) > activeCustomer (basic step-0 only) > empty
    if (customerFormInitialData) {
      const d = customerFormInitialData
      return {
        ...EMPTY,
        capturedAt:          new Date(),
        shopName:            d.shopName            || '',
        ownerName:           d.ownerName           || '',
        city:                d.city                || '',
        market:              d.market              || '',
        mobile:              d.mobile              || '',
        bizTypes:            d.bizTypes            || [],
        bizTypeOther:        d.bizTypeOther        || '',
        seasons:             d.seasons             || [],
        seasonOther:         d.seasonOther         || '',
        peakMonths:          d.peakMonths          || [],
        offSeasonSales:      d.offSeasonSales      || '',
        offSeasonSalesOther: d.offSeasonSalesOther || '',
        investmentTiming:    d.investmentTiming    || '',
        prepTime:            d.prepTime            || '',
        prepTimeOther:       d.prepTimeOther       || '',
        problems:            d.problems            || [],
        decisionDelay:       d.decisionDelay       || '',
        mindset:             d.mindset             || [],
        mindsetOther:        d.mindsetOther        || '',
        // Show previously saved photos (Supabase URLs used directly as img src)
        photos:              Array.isArray(d.photoUrls) ? d.photoUrls : [],
      }
    }
    // No edit data but active customer exists — pre-fill identity fields
    if (activeCustomer?.id) {
      return {
        ...EMPTY,
        capturedAt: new Date(),
        shopName:   activeCustomer.shopName  || '',
        ownerName:  activeCustomer.ownerName || '',
        city:       activeCustomer.city      || '',
        market:     activeCustomer.market    || '',
        mobile:     activeCustomer.mobile    || '',
      }
    }
    return { ...EMPTY, capturedAt: new Date() }
  })
  const [submitted,      setSubmitted]      = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [submitError,    setSubmitError]    = useState(null)
  const [showErrors,     setShowErrors]     = useState(false)
  const [mobileError,    setMobileError]    = useState(null)
  const [checkingMobile, setCheckingMobile] = useState(false)
  // photoFiles holds File objects for upload; data.photos holds blob URLs for preview
  const [photoFiles,    setPhotoFiles]    = useState([])
  const [stampingCount, setStampingCount] = useState(0)
  // status: 'idle' | 'fetching' | 'success' | 'denied' | 'unavailable'
  const [geoState,      setGeoState]      = useState({ status: 'idle', geo: null, errorCode: null })
  const cameraRef      = useRef()
  const galleryRef     = useRef()
  // Stores the in-flight promise so handleFiles can wait for it
  const geoPromiseRef  = useRef(null)

  function fetchGeo() {
    setGeoState({ status: 'fetching', geo: null, errorCode: null })
    const p = getGeoLocationWithStatus().then(({ geo, errorCode }) => {
      if (geo)                  setGeoState({ status: 'success',     geo, errorCode: null })
      else if (errorCode === 1) setGeoState({ status: 'denied',      geo: null, errorCode: 1 })
      else                      setGeoState({ status: 'unavailable', geo: null, errorCode })
      return { geo, errorCode }
    })
    geoPromiseRef.current = p
    return p
  }

  // Trigger location fetch as soon as user reaches photo step
  useEffect(() => {
    if (step !== 2) return
    fetchGeo()
  }, [step])

  function handleLogin(name) {
    setCurrentUser(name)
    setSalesmanName(name.trim())
  }

  const set = (key, val) => setData(d => ({ ...d, [key]: val }))

  // Always treat the field as an array — safe even if Supabase returned null/undefined
  function toggleArr(key, val, max) {
    setData(d => {
      const arr = Array.isArray(d[key]) ? d[key] : []
      if (arr.includes(val)) return { ...d, [key]: arr.filter(v => v !== val) }
      if (max && arr.length >= max) return d
      return { ...d, [key]: [...arr, val] }
    })
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const step0Valid = !!(data.shopName.trim() && data.ownerName.trim() && data.city.trim() && data.market.trim() && data.mobile.trim().length === 10)

  const q1Valid = data.bizTypes.length > 0 || !!data.bizTypeOther.trim()
  const q2Valid = data.seasons.length > 0  || !!data.seasonOther.trim()
  const q3Valid = data.peakMonths.length > 0
  const q4Valid = !!data.offSeasonSales
  const q5Valid = !!data.investmentTiming
  const q6Valid = !!data.prepTime
  const q7Valid = data.problems.length > 0
  const q8Valid = !!data.decisionDelay
  const q9Valid = data.mindset.length > 0
  const step1Valid = q1Valid && q2Valid && q3Valid && q4Valid && q5Valid && q6Valid && q7Valid && q8Valid && q9Valid

  const allValid = step0Valid && step1Valid

  function canGoToStep(_i) { return true }

  // ── Photos ────────────────────────────────────────────────────────────────
  async function handleFiles(files) {
    if (!files.length) return
    const fileArr = Array.from(files)
    setStampingCount(fileArr.length)

    let geo = geoState.geo
    if (!geo) {
      if (geoState.status === 'fetching' && geoPromiseRef.current) {
        // Wait for the already-running request (don't fire a second one)
        const result = await geoPromiseRef.current
        geo = result?.geo ?? null
      } else if (geoState.status !== 'denied') {
        const result = await fetchGeo()
        geo = result?.geo ?? null
      }
    }

    const stamped = await Promise.all(
      fileArr.map(f => stampPhoto(f, geo).catch(err => { console.error('[stamp]', err); return f }))
    )

    const urls = stamped.map(f => URL.createObjectURL(f))
    setData(d => ({ ...d, photos: [...d.photos, ...urls] }))
    setPhotoFiles(prev => [...prev, ...stamped])
    setStampingCount(0)
  }

  function removePhoto(idx) {
    setData(d => ({ ...d, photos: d.photos.filter((_, i) => i !== idx) }))
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Next step (with mobile check on step 0) ──────────────────────────────
  async function handleNext() {
    if (step === 0) {
      setShowErrors(true)
      if (!step0Valid) return
      if (data.mobile.trim()) {
        setCheckingMobile(true)
        try {
          const existingId = customerFormInitialData?.customerId || activeCustomer?.id || null
          const dup = await checkMobileDuplicate(data.mobile.trim(), existingId)
          if (dup) {
            setMobileError('This mobile number already exists')
            setCheckingMobile(false)
            return
          }
        } catch (_) { /* allow on check failure */ }
        setCheckingMobile(false)
      }
    }
    setStep(s => s + 1)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    if (!salesmanName) return
    setShowErrors(true)
    if (!allValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Resolve customer_id: edit data > active customer > create new
      const existingCustomerId = customerFormInitialData?.customerId || activeCustomer?.id || null
      // Resolve event_id: edit data event > active customer's quick-create event > none
      const existingEventId    = customerFormInitialData?.id || activeCustomer?.visitEventId || null

      // Mobile duplicate check before any write
      if (data.mobile.trim()) {
        const dup = await checkMobileDuplicate(data.mobile.trim(), existingCustomerId)
        if (dup) {
          setMobileError('This mobile number already exists')
          setStep(0)
          return
        }
      }

      let cid
      if (existingCustomerId) {
        // Update identity fields so edits are persisted
        await updateCustomer(existingCustomerId, {
          shop_name:  data.shopName,
          owner_name: data.ownerName,
          area:       data.city,
          landmark:   data.market,
          mobile:     data.mobile || null,
        })
        cid = existingCustomerId
      } else {
        const customer = await saveCustomer({
          name:       data.ownerName || data.shopName,
          mobile:     data.mobile    || null,
          shop_name:  data.shopName,
          owner_name: data.ownerName,
          area:       data.city,
          landmark:   data.market,
          stage:      'visited',
        })
        cid = customer.customer_id
        if (profile?.id) assignCustomer(cid, profile.id).catch(() => {})
      }

      // Upload any new photos, carry over existing ones
      let photoUrls = customerFormInitialData?.photoUrls || []
      if (photoFiles.length > 0) {
        const results = await Promise.allSettled(photoFiles.map(f => uploadPhoto(f, cid)))
        const failed = results.filter(r => r.status === 'rejected')
        if (failed.length > 0) {
          console.error('[photo upload]', failed[0].reason)
          throw new Error(`Photo upload failed: ${failed[0].reason?.message || failed[0].reason}`)
        }
        photoUrls = [...photoUrls, ...results.map(r => r.value)]
      }

      const { photos: _blobs, capturedAt: _ts, ...formData } = data

      let visitEventId
      if (existingEventId) {
        // Update the existing visit_done event in-place — one event per customer
        await updateEventData(existingEventId, { ...formData, photoUrls })
        visitEventId = existingEventId
      } else {
        const event = await addEvent(cid, 'visit_done', { ...formData, photoUrls }, salesmanName)
        visitEventId = event.event_id
      }

      // Preserve stage/painFilled/painData if pain discovery was already done
      const STAGE_ORDER = ['visited', 'pain_identified', 'roi_shown', 'login_started', 'approved', 'disbursed']
      const existingStageRank = STAGE_ORDER.indexOf(activeCustomer?.stage || 'visited')
      const preservedStage = existingStageRank > 0 ? activeCustomer.stage : 'visited'

      activateCustomer({
        id:                  cid,
        visitEventId:        visitEventId,
        shopName:            data.shopName,
        ownerName:           data.ownerName,
        mobile:              data.mobile,
        city:                data.city,
        market:              data.market,
        stage:               preservedStage,
        // Store full engagement data so workspace can pre-fill on reopen
        bizTypes:            data.bizTypes,
        bizTypeOther:        data.bizTypeOther,
        seasons:             data.seasons,
        seasonOther:         data.seasonOther,
        peakMonths:          data.peakMonths,
        offSeasonSales:      data.offSeasonSales,
        offSeasonSalesOther: data.offSeasonSalesOther,
        investmentTiming:    data.investmentTiming,
        prepTime:            data.prepTime,
        prepTimeOther:       data.prepTimeOther,
        problems:            data.problems,
        decisionDelay:       data.decisionDelay,
        mindset:             data.mindset,
        mindsetOther:        data.mindsetOther,
        photoUrls:           photoUrls,
        engagementFilled:    true,
        // Preserve pain discovery data if already filled
        painFilled:          activeCustomer?.painFilled  || false,
        painData:            activeCustomer?.painData    || null,
        // Preserve ROI inputs so the form doesn't go blank after engagement form submit
        savedROIInputs:      inputs,
      })
      update('bizTypes', data.bizTypes)
      update('bizTypeOther', data.bizTypeOther)
      update('businessType', data.bizTypes.filter(v => v !== '__other__')[0] || '')

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Submit karne mein error aayi. Dobara try karein.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setData({ ...EMPTY, capturedAt: new Date() })
    setPhotoFiles([])
    setStep(0)
    setSubmitted(false)
  }

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!salesmanName) {
    return <LoginGate onLogin={handleLogin} onClose={closeCustomerForm} />
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>
        <div className="bg-green-600 text-white pt-12 pb-4 px-5 flex-shrink-0">
          <p className="text-xs font-medium text-green-200 uppercase tracking-widest">Customer Engagement</p>
          <h1 className="text-xl font-extrabold mt-0.5">Form Submit Ho Gaya! ✅</h1>
          <p className="text-xs text-green-200 mt-1">👤 {salesmanName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-32 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
            <p className="text-lg font-extrabold text-slate-800">{data.shopName}</p>
            <p className="text-sm text-slate-500">{data.ownerName} · {data.city}{data.market ? ` (${data.market})` : ''} · {data.mobile}</p>
            {data.capturedAt && (
              <p className="text-xs text-brand-500 font-semibold">🕐 {fmtDateTime(data.capturedAt)}</p>
            )}
          </div>
          {data.photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {data.photos.map((src, i) => (
                <img key={i} src={src} alt="" className="w-full aspect-[3/4] object-contain bg-slate-900 rounded-xl" />
              ))}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
            {(arr(data.bizTypes).filter(v => v !== '__other__').length > 0 || data.bizTypeOther) && (
              <p><span className="font-bold">Business:</span> {[...arr(data.bizTypes).filter(v => v !== '__other__'), data.bizTypeOther].filter(Boolean).join(', ')}</p>
            )}
            {(arr(data.seasons).length > 0 || data.seasonOther) && (
              <p><span className="font-bold">Season:</span> {[...arr(data.seasons), data.seasonOther].filter(Boolean).join(', ')}</p>
            )}
            {arr(data.peakMonths).length > 0 && (
              <p><span className="font-bold">Peak Months:</span> {arr(data.peakMonths).join(', ')}</p>
            )}
            {data.offSeasonSales && (
              <p><span className="font-bold">Off Season Sales:</span> {data.offSeasonSales}{data.offSeasonSalesOther ? ` / ${data.offSeasonSalesOther}` : ''}</p>
            )}
            {data.investmentTiming && (
              <p><span className="font-bold">Investment:</span> {data.investmentTiming}</p>
            )}
            {data.prepTime && (
              <p><span className="font-bold">Prep Time:</span> {data.prepTime}{data.prepTimeOther ? ` / ${data.prepTimeOther}` : ''}</p>
            )}
            {arr(data.problems).length > 0 && (
              <p><span className="font-bold">Problems:</span> {arr(data.problems).join(', ')}</p>
            )}
            {data.decisionDelay && (
              <p><span className="font-bold">Decision Delay:</span> {data.decisionDelay}</p>
            )}
            {arr(data.mindset).length > 0 && (
              <p><span className="font-bold">Mindset:</span> {arr(data.mindset).join(', ')}{data.mindsetOther ? `, ${data.mindsetOther}` : ''}</p>
            )}
          </div>
        </div>
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-200 p-4 flex gap-3">
          <button onClick={reset} className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600">Naya Form</button>
          <button onClick={closeCustomerForm} className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">Done</button>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-white pt-12 pb-4 px-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-medium text-brand-400 uppercase tracking-widest">Customer Engagement</p>
            <h1 className="text-xl font-extrabold leading-tight">{STEPS[step].icon} {STEPS[step].label}</h1>
            {(activeCustomer?.shopName || data.shopName) && (
              <p className="text-xs text-brand-200 font-semibold mt-0.5 truncate">
                🏪 {activeCustomer?.shopName || data.shopName}
              </p>
            )}
          </div>
          <button onClick={closeCustomerForm} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-lg">×</button>
        </div>

        {/* Salesman name badge */}
        <div className="mt-2 mb-3 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
          <span className="text-xs">👤</span>
          <span className="text-xs font-semibold text-white">{salesmanName}</span>
        </div>

        <div className="flex gap-2">
          {STEPS.map((s, i) => {
            const done =
              i === 0 ? step0Valid :
              i === 1 ? step1Valid :
              data.photos.length >= MIN_PHOTOS
            const active = i === step
            const tappable = canGoToStep(i)
            return (
              <button
                key={i}
                className="flex-1 text-left"
                disabled={!tappable}
                onClick={() => tappable && setStep(i)}
              >
                <div className={`h-1.5 rounded-full transition-all ${done ? 'bg-green-400' : active ? 'bg-white' : 'bg-white/30'}`} />
                <div className="flex items-center gap-1 mt-1">
                  {done && <span className="text-green-400 text-[10px] font-bold">✓</span>}
                  <p className={`text-[10px] font-medium truncate ${active ? 'text-white' : done ? 'text-green-300' : 'text-brand-400'}`}>{s.label}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">

        {/* ── Step 0: Basic Info ── */}
        {step === 0 && (
          <div className="space-y-3">
            {[
              { key: 'shopName',  label: '🏪 दुकान का नाम',                                    placeholder: 'Ram Kirana Store',  type: 'text', textOnly: true, required: true },
              { key: 'ownerName', label: '👤 दुकान मालिक का नाम',                              placeholder: 'Ram Lal Gupta',    type: 'text', textOnly: true, required: true },
              { key: 'city',      label: '📍 गांव/शहर का नाम (जहाँ व्यापार चलता है)',          placeholder: 'जैसे: Jaipur',     type: 'text', textOnly: true, required: true },
              { key: 'market',    label: '🏬 मार्केट का नाम',                                   placeholder: 'जैसे: Johri Bazar', type: 'text', textOnly: true, required: true },
              { key: 'mobile',    label: '📞 मोबाइल नंबर',                                     placeholder: '9876543210',        type: 'tel',  numOnly: true, maxLength: 10, required: true },
            ].map(f => {
              const isEmpty = f.required && (f.key === 'mobile' ? data.mobile.trim().length !== 10 : !data[f.key].trim())
              const hasDupError = f.key === 'mobile' && !!mobileError
              const hasError = (showErrors && isEmpty) || hasDupError
              return (
              <div key={f.key}>
                <div className={`bg-white rounded-2xl border px-4 py-3 shadow-sm ${hasError ? 'border-red-400' : 'border-slate-200'}`}>
                  <label className={`text-xs font-bold uppercase tracking-wider ${hasError ? 'text-red-500' : 'text-slate-500'}`}>{f.label}{f.required ? ' *' : ''}</label>
                  <input
                    type={f.type}
                    inputMode={f.numOnly ? 'numeric' : 'text'}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    value={data[f.key]}
                    onChange={e => {
                      let val = e.target.value
                      if (f.textOnly) val = val.replace(/[0-9]/g, '')
                      if (f.numOnly)  val = val.replace(/[^0-9]/g, '').slice(0, 10)
                      set(f.key, val)
                      if (f.key === 'mobile') setMobileError(null)
                    }}
                    className="w-full mt-1 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300"
                  />
                </div>
                {hasDupError && (
                  <p className="text-xs text-red-500 font-semibold px-1 mt-1">⚠️ {mobileError}</p>
                )}
              </div>
            )})}
            {showErrors && !step0Valid && (
              <p className="text-xs text-red-500 px-1 font-medium">* लाल फील्ड भरना ज़रूरी है</p>
            )}
          </div>
        )}

        {/* ── Step 1: Business Details ── */}
        {step === 1 && (
          <div>

            {/* Q1 Business Type */}
            <Card>
              <SectionHeader num="1" title="किस चीज़ का व्यापार है? *" error={showErrors && !step1Valid} />
              <div className="grid grid-cols-2 gap-2 mb-2">
                {BIZ_TYPES.map(bt => {
                  const checked = data.bizTypes.includes(bt.label)
                  return (
                    <button
                      key={bt.label}
                      onClick={() => toggleArr('bizTypes', bt.label)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold text-left border-2 transition-all active:scale-95
                        ${checked ? 'border-brand-400 bg-white text-brand-700' : 'border-slate-200 text-slate-700'}`}
                    >
                      {bt.emoji} {bt.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => {
                    toggleArr('bizTypes', '__other__')
                    if (data.bizTypes.includes('__other__')) set('bizTypeOther', '')
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold text-left border-2 transition-all active:scale-95
                    ${data.bizTypes.includes('__other__') ? 'border-brand-400 bg-white text-brand-700' : 'border-slate-200 text-slate-700'}`}
                >
                  ✏️ Other
                </button>
              </div>
              {data.bizTypes.includes('__other__') && (
                <OtherInput value={data.bizTypeOther} onChange={v => set('bizTypeOther', v)} />
              )}
            </Card>

            {/* Q2 Season */}
            <Card>
              <SectionHeader num="2" title="व्यापार का सीजन (सबसे ज़्यादा बिक्री का समय) *" error={showErrors && !q2Valid} />
              {SEASONS.map(opt => (
                <CheckItem key={opt} label={opt} checked={data.seasons.includes(opt)} onChange={() => toggleArr('seasons', opt)} />
              ))}
              <OtherInput value={data.seasonOther} onChange={v => set('seasonOther', v)} placeholder="Other season..." />
            </Card>

            {/* Q3 Peak Months */}
            <Card>
              <SectionHeader num="3" title="साल के किस महीने में सबसे ज़्यादा बिक्री होती है? *" error={showErrors && !q3Valid} />
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map(m => {
                  const checked = data.peakMonths.includes(m)
                  return (
                    <button
                      key={m}
                      onClick={() => toggleArr('peakMonths', m)}
                      className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95
                        ${checked ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Q4 Off Season Sales */}
            <Card>
              <SectionHeader num="4" title="ऑफ सीजन बिक्री (महीने की) *" error={showErrors && !q4Valid} />
              {OFF_SEASON_SALES.map(opt => (
                <RadioItem key={opt} label={opt} checked={data.offSeasonSales === opt} onChange={() => set('offSeasonSales', opt)} />
              ))}
              <RadioItem label="Other" checked={data.offSeasonSales === 'other'} onChange={() => set('offSeasonSales', 'other')} />
              {data.offSeasonSales === 'other' && (
                <OtherInput value={data.offSeasonSalesOther} onChange={v => set('offSeasonSalesOther', v)} placeholder="₹ amount likho..." />
              )}
            </Card>

            {/* Q5 Investment Timing */}
            <Card>
              <SectionHeader num="5" title="आप बिजनेस में नया पैसा कब लगाते हो? *" error={showErrors && !q5Valid} />
              {INVESTMENT_TIMING.map(opt => (
                <RadioItem key={opt} label={opt} checked={data.investmentTiming === opt} onChange={() => set('investmentTiming', opt)} />
              ))}
            </Card>

            {/* Q6 Prep Time */}
            <Card>
              <SectionHeader num="6" title="सीजन के कितने दिन पहले तैयारी करते हो? *" error={showErrors && !q6Valid} />
              {PREP_TIME.map(opt => (
                <RadioItem key={opt} label={opt} checked={data.prepTime === opt} onChange={() => set('prepTime', opt)} />
              ))}
              <RadioItem label="Other" checked={data.prepTime === 'other'} onChange={() => set('prepTime', 'other')} />
              {data.prepTime === 'other' && (
                <OtherInput value={data.prepTimeOther} onChange={v => set('prepTimeOther', v)} placeholder="Days / months likho..." />
              )}
            </Card>

            {/* Q7 Problems (max 2) */}
            <Card>
              <SectionHeader num="7" title="इन में से कौनसी समस्या सबसे ज़्यादा है? (कोई दो चुनें) *" error={showErrors && !q7Valid} />
              {data.problems.length >= 2 && (
                <p className="text-xs text-amber-600 font-semibold mb-2">✓ 2 problems select ho gayi — change karne ke liye pehle ek hatao</p>
              )}
              {PROBLEMS.map(opt => (
                <CheckItem
                  key={opt} label={opt}
                  checked={data.problems.includes(opt)}
                  onChange={() => toggleArr('problems', opt, 2)}
                  disabled={data.problems.length >= 2 && !data.problems.includes(opt)}
                />
              ))}
            </Card>

            {/* Q8 Decision Delay */}
            <Card>
              <SectionHeader num="8" title="क्या कभी पैसों की वजह से बिजनेस का डिसीजन टालना पड़ा है? *" error={showErrors && !q8Valid} />
              <RadioItem label="हाँ" checked={data.decisionDelay === 'हाँ'} onChange={() => set('decisionDelay', 'हाँ')} />
              <RadioItem label="नहीं" checked={data.decisionDelay === 'नहीं'} onChange={() => set('decisionDelay', 'नहीं')} />
            </Card>

            {/* Q9 Mindset */}
            <Card>
              <SectionHeader num="9" title="आप किस तरफ ज़्यादा ध्यान दे रहे हैं? *" error={showErrors && !q9Valid} />
              {MINDSET.map(opt => (
                <RadioItem key={opt} label={opt} checked={data.mindset[0] === opt} onChange={() => set('mindset', [opt])} />
              ))}
            </Card>

          </div>
        )}

        {/* ── Step 2: Photos ── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* Date/time stamp */}
            <div className="bg-white border border-brand-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-sm">🕐</span>
              <p className="text-xs font-semibold text-brand-700">{fmtDateTime(data.capturedAt)}</p>
            </div>

            {/* GPS status */}
            {(geoState.status === 'idle' || geoState.status === 'fetching') && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs font-semibold text-slate-600">Location dhoond raha hai — allow karein agar popup aaye...</p>
              </div>
            )}
            {geoState.status === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-green-700">GPS Ready — coordinates stamp honge</p>
                <p className="text-[11px] font-mono text-green-600 mt-0.5">
                  LAT: {geoState.geo.lat.toFixed(5)}  LNG: {geoState.geo.lng.toFixed(5)}  (+-{geoState.geo.accuracy}m)
                </p>
              </div>
            )}
            {geoState.status === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-red-700">Location Permission Blocked</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  <strong>Android:</strong> Chrome address bar → lock icon tap karein → Location → Allow<br/>
                  <strong>iPhone:</strong> Settings → Safari → Location → Allow
                </p>
                <p className="text-xs text-red-400 mt-1">Allow karne ke baad page reload karein</p>
              </div>
            )}
            {geoState.status === 'unavailable' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {geoState.errorCode === 2 ? (
                      <>
                        <p className="text-xs font-bold text-amber-700">Phone ka Location/GPS Band Hai</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          <strong>Android:</strong> Settings → Location → ON karein<br/>
                          <strong>iPhone:</strong> Settings → Privacy → Location Services → ON
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-amber-700">Location Timeout</p>
                        <p className="text-xs text-amber-600 mt-0.5">Network connection check karein ya Retry karein</p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={fetchGeo}
                    className="flex-shrink-0 text-xs font-bold text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 active:scale-95 mt-0.5"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-600">Photos ({data.photos.length} / {MIN_PHOTOS} required)</p>
                {data.photos.length >= MIN_PHOTOS && <span className="text-xs font-bold text-green-600">✅ Done</span>}
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: MIN_PHOTOS }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < data.photos.length ? 'bg-green-500' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>

            {/* Upload buttons */}
            {stampingCount > 0 ? (
              <div className="bg-brand-50 border border-brand-200 rounded-2xl py-6 flex flex-col items-center gap-2">
                <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-brand-700">
                  GPS aur time stamp lag raha hai... ({stampingCount} photo{stampingCount > 1 ? 'ein' : ''})
                </p>
                <p className="text-[10px] text-brand-500">Thoda wait karein</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraRef.current.click()}
                  className="bg-white border-2 border-dashed border-brand-300 rounded-2xl py-6 flex flex-col items-center gap-2 active:scale-95 transition-all"
                >
                  <span className="text-3xl">📷</span>
                  <p className="text-xs font-bold text-brand-700">Camera se lo</p>
                  <p className="text-[10px] text-brand-400">GPS auto-stamp</p>
                </button>
                <button
                  onClick={() => galleryRef.current.click()}
                  className="bg-white border-2 border-dashed border-slate-300 rounded-2xl py-6 flex flex-col items-center gap-2 active:scale-95 transition-all"
                >
                  <span className="text-3xl">🖼️</span>
                  <p className="text-xs font-bold text-slate-600">Gallery se upload</p>
                  <p className="text-[10px] text-slate-400">GPS auto-stamp</p>
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input ref={cameraRef}  type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />

            {/* Photo grid */}
            {data.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {data.photos.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden aspect-[3/4] bg-slate-900">
                    <img src={src} alt="" className="w-full h-full object-contain" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-[10px] font-bold">×</span>
                    </button>
                    {photoFiles[i]?.name?.includes('_stamped') && (
                      <div className="absolute top-1 left-1 bg-brand-600 rounded px-1 py-0.5">
                        <span className="text-white text-[8px] font-bold">GPS</span>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 bg-black/50 rounded px-1">
                      <span className="text-white text-[9px] font-bold">{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.photos.length < MIN_PHOTOS && (
              <p className="text-xs text-amber-600 font-semibold text-center">
                {MIN_PHOTOS - data.photos.length} aur photo{MIN_PHOTOS - data.photos.length > 1 ? 'ein' : ''} chahiye
              </p>
            )}

            {/* Summary */}
            {data.photos.length >= MIN_PHOTOS && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-bold text-green-700">✅ Ready to Submit</p>
                <p className="text-xs text-green-600">{data.shopName} · {data.ownerName}</p>
                <p className="text-xs text-green-600">{data.mobile} · {data.city}{data.market ? ` · ${data.market}` : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-200 px-4 py-4 z-30">
        {showErrors && !allValid && (
          <p className="text-xs text-red-500 font-semibold mb-2 text-center">
            ⚠️ {!step0Valid
              ? '"Samanya Jaankari" mein laal fields bharo'
              : '"Vyapar Jaankari" mein laal sawal (*)  bharo'}
          </p>
        )}
        {submitError && (
          <p className="text-xs text-red-500 font-semibold mb-2 text-center">⚠️ {submitError}</p>
        )}
        <div className="flex gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 active:scale-95 transition-all">
              ← Back
            </button>
          ) : (
            <button onClick={closeCustomerForm} className="flex-1 py-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-500 active:scale-95 transition-all">
              Cancel
            </button>
          )}
          {step < 2 ? (
            <button onClick={handleNext} disabled={checkingMobile} className="flex-1 py-3.5 rounded-xl bg-brand-600 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
              {checkingMobile ? 'Checking...' : 'Aage →'}
            </button>
          ) : (
            <button disabled={submitting} onClick={submit} className="flex-1 py-3.5 rounded-xl bg-green-600 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all">
              {submitting ? 'Saving...' : '✅ Submit Karen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
