import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { PROBLEMS } from '../logic/problems'
import { addEvent } from '../lib/db/events'
import { getCurrentUser } from '../lib/db/dashboard'

// ── Sub-problem questions ────────────────────────────────────────────────────

const SUB_QUESTIONS = {
  CASH_SUPPLIER: [
    'Supplier payment normally kitne din late ho jata hai — 15, 30, ya 45 din?',
    'Late payment ki wajah se supplier discount ya trust impact hua hai? Kitna ₹?',
    'Kitna amount supplier ko urgent dena hota hai normally? ₹____',
    'Payment delay ki wajah se kitni baar naya maal nahi uth paate?',
    'Agar payment time pe ho jaye toh supply smooth ho jayegi?',
  ],
  CASH_STOCK: [
    'Kitni baar aisa hota hai ki demand hone ke baad bhi stock nahi le paate?',
    'Daily kitni sale miss ho jati hai is wajah se? ₹____',
    'Kaunse fast-moving items sabse zyada miss ho rahe hain?',
    'Agar stock available ho toh sale kitni badh sakti hai?',
  ],
  CASH_CUSTOMER: [
    'Normally kitna paisa market me atka rehta hai? ₹____',
    'Customer kitne din me payment return karte hain — 15, 30, ya zyada?',
    'Is wajah se supplier payment ya stock refill delay hota hai?',
    'Cash rotation slow hone se daily operations pe impact pad raha hai?',
    'Agar working capital buffer mile toh pressure kam ho jayega?',
  ],
  STOCK_FAST: [
    'Kaunse items sabse zyada miss hote hain?',
    'Kitni baar customer demand hoti hai par maal available nahi hota?',
    'Daily kitni sale miss ho jati hai? ₹____',
    'Customer dusri shop shift ho jata hai kya?',
    'Agar stock available ho toh sale kitni badhegi?',
  ],
  STOCK_VARIETY: [
    'Customer kaunsi variety demand karta hai jo abhi nahi hai?',
    'Kitni baar customer bina purchase kiye chala jata hai?',
    'Variety badhne se sale kitni improve hogi?',
  ],
  STOCK_BULK: [
    'Bulk me lene pe kitna discount milta hai?',
    'Kitna extra stock lene ka plan hai? ₹____',
    'Bulk purchase se Season mein kitna extra profit generate ho sakta hai?',
  ],
  EXP_SPACE: [
    'Space ya setup ki wajah se kitne customer bina kharide chale jaate hain?',
    'Kitni jagah aur add karne ki need hai?',
    'Space badhne se kitna extra stock rakh sakte ho?',
    'Agar shop improve ho jaye toh daily sale kitni badh sakti hai? ₹____',
  ],
  EXP_DISPLAY: [
    'Display ya setup ki wajah se kitne customer bina kharide chale jaate hain?',
    'Proper display hone se conversion improve hoga?',
    'Display limitation ki wajah se kitni sale miss hoti hai?',
  ],
  EXP_LOOK: [
    'Shop upgrade se customer attraction badhega?',
    'Agar shop improve ho jaye toh daily sale kitni badh sakti hai? ₹____',
    'Competition se better position milegi?',
  ],
  FOOT_COMP: [
    'Kitne regular customer ab dusri shop se lene lage hain?',
    'Competition ki wajah se daily kitni sale kam ho gayi hai? ₹____',
    'Competitor me aisa kya hai jo customers ko attract kar raha hai?',
    'Agar continue raha toh long-term business pe kya impact padega?',
  ],
  FOOT_LOCATION: [
    'Is wajah se daily sale kitni kam ho gayi hai? ₹____',
    'Nearby shops zyada convenient ya visible hain kya?',
    'Aapko lagta hai ye issue permanent hai ya temporary?',
  ],
  FOOT_DISPLAY: [
    'Customer shop me aake bina purchase kiye chale jaate hain kya?',
    'Agar shop upgrade ho jaye toh footfall kitna badh sakta hai?',
    'Display improve hone se daily kitni extra sale ho sakti hai? ₹____',
  ],
  FOOT_VARIETY: [
    'Customer kaunsi variety demand karte hain jo abhi available nahi hai?',
    'Is wajah se daily kitni sale miss ho rahi hai? ₹____',
    'Variety badhne se customer retention improve hoga?',
  ],
  SLOW_DEMAND: [
    'Pehle ke comparison me daily sale kitni kam ho gayi hai? ₹____',
    'Demand kam hone ki main wajah kya lagti hai?',
    'Ye slowdown temporary lagta hai ya permanent change hai?',
  ],
  SLOW_WRONG: [
    'Wrong stock ki wajah se kitna paisa atka hua hai?',
    'Kaunse items shelf pe zyada time se pade hain?',
    'Agar right stock ho toh daily sale kitni badh sakti hai?',
  ],
  SLOW_ROTATION: [
    'Cash rotation normally kitne din ka hota tha aur ab kitna ho gaya hai?',
    'Kitna paisa stock me atka hua hai? ₹____',
    'Working capital mile toh rotation smooth ho jayega?',
  ],
  COMP_VARIETY: [
    'Competitor ke paas kaunsi variety hai jo aapke paas nahi hai?',
    'Kitne customer variety ki wajah se shift ho gaye?',
    'Variety gap ki wajah se daily kitna loss ho raha hai? ₹____',
  ],
  COMP_PRICE: [
    'Competitor kitna price difference de raha hai? ₹____',
    'Customer price compare karke waha shift kar rahe hain kya?',
    'Price gap ki wajah se monthly kitna loss ho raha hai?',
  ],
  COMP_AVAILABILITY: [
    'Competitor ke paas stock availability better rehti hai kya?',
    'Daily kitni sale availability issue ki wajah se miss hoti hai? ₹____',
    'Agar full availability ho toh sale kitni improve hogi?',
  ],
  COMP_DISPLAY: [
    'Competitor ka display zyada attractive lagta hai kya?',
    'Agar display improve ho toh footfall kitna badh sakta hai?',
    'Display improvement se daily kitni extra sale ho sakti hai? ₹____',
  ],
}

const REPAIR_QUESTIONS = [
  'Emergency repair kis cheez ka hai — machine, ya shop structure?',
  'Kaunsi machine ya equipment repair/replace karna hai?',
  'Uske kharab hone se daily kitna loss ho raha hai? ₹____',
  'Kitne din se ye problem chal rahi hai?',
  'Repair hone ke baad sale normal ho jayegi?',
]

// ── 8-question conversation guide ────────────────────────────────────────────

const QUESTIONS = [
  {
    num: 1,
    title: 'Business Ka Sabse Bada Challenge',
    main:  'Sabse pehle ye batayein — aapke business me is waqt sabse bada challenge kya chal raha hai?',
    alt:   '"Sir, ek baat batayein — abhi business mein koi aisi cheez hai jo aapko lagta hai: agar ye theek ho jaye toh meri life easy ho jaye?"',
    hint:  '(Pause & Listen deeply)',
  },
  {
    num: 2,
    title: 'Problem Kab Se Hai',
    main:  'Ye problem aapko kab se face karni pad rahi hai?',
    alt:   '"Aapko kab mehsus hua ki is pareshani ne aapko gher rakha hai?"',
  },
  {
    num: 3,
    title: 'Nuksaan Kahan Ho Raha Hai',
    main:  'Is problem ki wajah se aapko sabse zyada nuksaan kis cheez me ho raha hai — sales me, stock me, ya customer chhod ke ja rahe hain?',
    hint:  '(Let them choose one — select below)',
    type:  'category',
  },
  {
    num: 4,
    title: 'Future Impact',
    main:  'Agar ye problem agle 3–6 mahine me solve nahi hoti, toh kya ho sakta hai?',
    alt:   '"Aapke hisaab se business pe kya asar padega?"',
  },
  {
    num: 5,
    title: 'Priority Check',
    main:  'Main samajhna chahta hoon ji — abhi aapke liye sabse important kya hai: problem solve karna ya aur wait karna thoda time?',
  },
  {
    num: 6,
    title: 'Emotional Connect',
    main:  'Is situation se aapko zaroor thodi bahut tension hoti hogi — chahe wo business chalane ki ho, personal stress ho, ya parivar ki zimmedaariyon ki… thoda bata paoge iske baare mein?',
    hint:  '(Listen and acknowledge)',
    note:  '"Bilkul samajh sakta hoon — har business owner is phase se kabhi na kabhi guzarta hai."',
  },
  {
    num: 7,
    title: 'Capital Zaroorat',
    main:  'Aapne jo problem batayi hai — aapke hisaab se, kya ye dikkat bina extra capital laaye solve ho sakti hai, ya thoda financial support lena zaroori lagta hai?',
    alt:   '"Jo problem aapne batai, kya wo sirf mehnat se solve ho sakti hai, ya usme paisa bhi lagana padega?"',
  },
  {
    num: 8,
    title: 'Growth Vision',
    main:  'Agar ye paisa agle 5–7 din me mil jaye, toh aapka business agle 30 din me kitna badh sakta hai?',
    alt:   '"Aap kya karoge sabse pehle — stock badhaoge, customer offer doge ya expansion loge?"',
  },
]

// ── Main screen ──────────────────────────────────────────────────────────────

export default function S_PainDiscovery() {
  const { closePainDiscovery, toggleProblem, toggleSubProblem, update, inputs, customerId, activeCustomer, openQuickCreate, updateActiveCustomer } = useApp()

  // Pre-fill from previously saved pain data (stored in activeCustomer after each save)
  const _pain = activeCustomer?.painData || {}

  const [checked, setChecked]         = useState(new Set())
  const [expandedTag, setExpandedTag] = useState(null)
  const [q1Other,      setQ1Other]      = useState(_pain.q1Other      || '')
  const [notesByQ,     setNotesByQ]     = useState(_pain.notesByQ     || {})
  const [problemYears, setProblemYears] = useState(_pain.problemYears || '')
  const [problemMonths,setProblemMonths]= useState(_pain.problemMonths|| '')
  const [priority,     setPriority]     = useState(_pain.priority     || '')
  const [capitalNeeded,setCapitalNeeded]= useState(_pain.capitalNeeded|| '')
  const [dailyLoss,    setDailyLoss]    = useState(_pain.dailyLoss    ? String(_pain.dailyLoss)    : '')
  const [monthlyLoss,  setMonthlyLoss]  = useState(_pain.monthlyLoss  ? String(_pain.monthlyLoss)  : '')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)
  const [saved,        setSaved]        = useState(false)

  // Restore Q1 (problems) and Q3 (subProblems) from saved painData into global inputs
  useEffect(() => {
    if (_pain.primaryProblem) {
      update('problems', [_pain.primaryProblem])
    }
    if (Array.isArray(_pain.subProblems) && _pain.subProblems.length > 0) {
      update('subProblems', _pain.subProblems)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setNote(num, val) {
    setNotesByQ(prev => ({ ...prev, [num]: val }))
  }

  function toggleChecked(num) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  function handleCategory(p) {
    toggleProblem(p.tag)
    setExpandedTag(prev => prev === p.tag ? null : p.tag)
  }

  async function savePainData() {
    if (!customerId) return
    setSaving(true)
    setSaveError(null)
    try {
      await addEvent(customerId, 'pain_identified', {
        primaryProblem:  inputs.problems[0] || null,
        primaryOther:    q1Other || null,
        subProblems:     inputs.subProblems,
        problemDuration: { years: problemYears, months: problemMonths },
        priority,
        capitalNeeded,
        dailyLoss:       dailyLoss   ? Number(dailyLoss)   : null,
        monthlyLoss:     monthlyLoss ? Number(monthlyLoss) : null,
        notesByQuestion: notesByQ,
      }, getCurrentUser())
      // Persist answers in activeCustomer — never downgrade stage if already higher
      const STAGE_ORDER = ['visited', 'pain_identified', 'roi_shown', 'login_started', 'approved', 'disbursed']
      const currentRank = STAGE_ORDER.indexOf(activeCustomer?.stage || 'visited')
      const preservedStage = currentRank > STAGE_ORDER.indexOf('pain_identified')
        ? activeCustomer.stage
        : 'pain_identified'

      updateActiveCustomer({
        stage:     preservedStage,
        painFilled: true,
        painData: {
          primaryProblem: inputs.problems[0]  || null,
          subProblems:    inputs.subProblems  || [],
          q1Other, notesByQ,
          problemYears, problemMonths,
          priority, capitalNeeded,
          dailyLoss:   dailyLoss   ? Number(dailyLoss)   : null,
          monthlyLoss: monthlyLoss ? Number(monthlyLoss) : null,
        },
      })
      setSaved(true)
      setTimeout(() => closePainDiscovery(), 1500)
    } catch (err) {
      setSaveError(err.message || 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const totalDone = checked.size + (inputs.problems.length > 0 ? 1 : 0)

  if (!customerId) {
    return (
      <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>
        <div className="bg-indigo-700 text-white pt-12 pb-5 px-5 flex-shrink-0 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-indigo-300 uppercase tracking-widest">PaisaDost</p>
            <h1 className="text-lg font-extrabold leading-tight">🔍 Pain Discovery</h1>
          </div>
          <button onClick={closePainDiscovery} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">×</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 gap-4">
          <span className="text-5xl">🏪</span>
          <h2 className="text-lg font-extrabold text-slate-800 text-center">Pehle Customer Select Karein</h2>
          <p className="text-sm text-slate-500 text-center leading-relaxed">Pain Discovery karne se pehle ek active customer hona zaroori hai</p>
          <button
            onClick={() => { closePainDiscovery(); openQuickCreate() }}
            className="w-full max-w-xs py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all"
          >
            🏪 Customer Banao →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-3 px-5 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-indigo-300 uppercase tracking-widest">PaisaDost</p>
          <h1 className="text-lg font-extrabold leading-tight">🔍 Pain Discovery</h1>
          <p className="text-xs text-indigo-200 font-semibold truncate mt-0.5">🏪 {activeCustomer?.shopName || ''}</p>
          <p className="text-xs text-indigo-300 mt-0.5">{totalDone} / {QUESTIONS.length} questions done</p>
        </div>
        <button
          onClick={closePainDiscovery}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-indigo-900/30 flex-shrink-0">
        <div
          className="h-full bg-white transition-all duration-500"
          style={{ width: `${(totalDone / QUESTIONS.length) * 100}%` }}
        />
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-3">
        {QUESTIONS.map(q => {
          const isDone = q.type === 'category'
            ? inputs.problems.length > 0
            : checked.has(q.num)

          return (
            <div
              key={q.num}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isDone ? 'border-indigo-200' : 'border-slate-100'}`}
            >
              {/* Question header */}
              <div className={`px-4 py-3 flex items-start gap-3 ${isDone ? 'bg-indigo-50' : ''}`}>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center mt-0.5
                  ${isDone ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {isDone ? '✓' : q.num}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">{q.title}</p>
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.main}</p>
                  {q.alt && (
                    <p className="text-xs text-slate-500 italic mt-1.5 leading-relaxed">{q.alt}</p>
                  )}
                  {q.hint && (
                    <p className="text-xs font-bold text-amber-600 mt-1.5">{q.hint}</p>
                  )}
                  {q.note && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-green-700 font-semibold italic leading-relaxed">{q.note}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Q1 — dropdown with 7 problems + Other */}
              {q.num === 1 && (
                <div className="px-4 pb-3 border-t border-slate-100 pt-3 space-y-2">
                  <select
                    value={inputs.problems[0] || ''}
                    onChange={e => update('problems', e.target.value ? [e.target.value] : [])}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="">— Problem chunein —</option>
                    {PROBLEMS.map(p => (
                      <option key={p.tag} value={p.tag}>{p.emoji} {p.title}</option>
                    ))}
                    <option value="__OTHER__">✏️ Other</option>
                  </select>
                  {inputs.problems.includes('__OTHER__') && (
                    <input
                      type="text"
                      value={q1Other}
                      onChange={e => setQ1Other(e.target.value)}
                      placeholder="Problem likho..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  )}
                </div>
              )}

              {/* Q3 — Category selector with sub-problems */}
              {q.type === 'category' && (
                <div className="px-4 pb-3 border-t border-slate-100 pt-3 space-y-2">
                  {PROBLEMS.map(p => {
                    const selected  = inputs.problems.includes(p.tag)
                    const expanded  = expandedTag === p.tag
                    return (
                      <div key={p.tag} className={`rounded-xl border-2 overflow-hidden transition-all ${selected ? 'border-indigo-400' : 'border-slate-200'}`}>
                        {/* Category row */}
                        <button
                          onClick={() => handleCategory(p)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-all active:scale-[0.98]
                            ${selected ? 'bg-indigo-50' : 'bg-white'}`}
                        >
                          <span className="text-lg">{p.emoji}</span>
                          <div className="flex-1">
                            <p className={`text-xs font-bold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>{p.title}</p>
                            <p className="text-xs text-slate-400">{p.sub}</p>
                          </div>
                          <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
                        </button>

                        {/* Sub-problems + questions */}
                        {expanded && p.subProblems.length > 0 && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 space-y-2">
                            {p.subProblems.map(sp => {
                              const subSelected = inputs.subProblems.includes(sp.tag)
                              const qs = SUB_QUESTIONS[sp.tag] || []
                              return (
                                <div key={sp.tag} className={`rounded-xl border overflow-hidden transition-all ${subSelected ? 'border-indigo-300' : 'border-slate-200'}`}>
                                  {/* Sub-problem toggle */}
                                  <button
                                    onClick={() => toggleSubProblem(p.tag, sp.tag)}
                                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-all active:scale-[0.98]
                                      ${subSelected ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600'}`}
                                  >
                                    <span className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center text-xs
                                      ${subSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>
                                      {subSelected && '✓'}
                                    </span>
                                    <span className="text-xs font-semibold flex-1">{sp.label}</span>
                                  </button>

                                  {/* Questions shown when sub-problem selected */}
                                  {subSelected && qs.length > 0 && (
                                    <div className="bg-indigo-50 border-t border-indigo-100 px-3 py-2 space-y-1.5">
                                      {qs.map((q, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                          <p className="text-xs text-indigo-800 leading-relaxed">{q}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Repair — no sub-problems, show questions directly when selected */}
                        {expanded && p.subProblems.length === 0 && (
                          <div className="border-t border-slate-100 bg-indigo-50 px-3 py-2 space-y-1.5">
                            {REPAIR_QUESTIONS.map((q, i) => (
                              <div key={i} className="flex gap-2 items-start">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                <p className="text-xs text-indigo-800 leading-relaxed">{q}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Q2 — Problem duration dropdowns */}
              {q.num === 2 && (
                <div className="px-4 pb-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 mb-2">Kitne time se? (Approximate)</p>
                  <div className="flex gap-2">
                    <select
                      value={problemYears}
                      onChange={e => setProblemYears(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 bg-white"
                    >
                      <option value="">— Saal —</option>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>{n === 0 ? 'Is saal' : `${n} saal`}</option>
                      ))}
                    </select>
                    <select
                      value={problemMonths}
                      onChange={e => setProblemMonths(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 bg-white"
                    >
                      <option value="">— Mahine —</option>
                      {[1,2,3,4,5,6,7,8,9,10,11].map(n => (
                        <option key={n} value={n}>{n} mahine</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Q5 — Priority choice */}
              {q.num === 5 && (
                <div className="px-4 pb-3 border-t border-slate-100 pt-3 flex gap-2">
                  {[
                    { val: 'abhi',     label: '⚡ Abhi Solve Karna Hai' },
                    { val: 'baad',     label: '🕐 Thoda Wait Karunga' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setPriority(opt.val)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95
                        ${priority === opt.val ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Q7 — Capital needed choice */}
              {q.num === 7 && (
                <div className="px-4 pb-3 border-t border-slate-100 pt-3 flex gap-2">
                  {[
                    { val: 'haan', label: '✅ Haan, Capital Chahiye' },
                    { val: 'nahi', label: '❌ Nahi, Abhi Nahi' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setCapitalNeeded(opt.val)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95
                        ${capitalNeeded === opt.val ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Done toggle for non-category questions */}
              {q.type !== 'category' && (
                <button
                  onClick={() => toggleChecked(q.num)}
                  className={`w-full py-2.5 text-xs font-bold border-t transition-all
                    ${isDone ? 'border-indigo-100 text-indigo-600 bg-indigo-50' : 'border-slate-100 text-slate-400 bg-slate-50'}`}
                >
                  {isDone ? '✓ Done — Next Question' : 'Tap when answered →'}
                </button>
              )}

              {/* Notes space after every question */}
              <div className="px-4 pb-3 pt-2 border-t border-slate-100">
                <textarea
                  rows={2}
                  value={notesByQ[q.num] || ''}
                  onChange={e => setNote(q.num, e.target.value)}
                  placeholder="Notes / Jo customer ne kaha..."
                  className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 resize-none placeholder:text-slate-300 bg-white"
                />
              </div>
            </div>
          )
        })}

        {/* Pain metrics + save */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">📊 Nuksaan ka Hisaab</p>

          {!customerId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
              <p className="text-xs text-amber-700 font-semibold">⚠️ Pehle Engagement Form bharo — customer link nahi hua hai</p>
            </div>
          )}

          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Roz ka Nuksaan (₹ per day)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="जैसे: 2000"
            value={dailyLoss}
            onChange={e => setDailyLoss(e.target.value)}
            className="w-full mt-1 mb-3 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
          />

          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mahine ka Nuksaan (₹ per month)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="जैसे: 50000"
            value={monthlyLoss}
            onChange={e => setMonthlyLoss(e.target.value)}
            className="w-full mt-1 mb-3 text-base font-semibold text-slate-800 outline-none placeholder:text-slate-300 border-b border-slate-100 pb-1"
          />

          {saveError && (
            <p className="text-xs text-red-500 font-semibold mt-2">{saveError}</p>
          )}

          {saved ? (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <p className="text-xs text-green-700 font-bold">✅ Pain data save ho gaya!</p>
            </div>
          ) : (
            <button
              onClick={savePainData}
              disabled={!customerId || saving}
              className="mt-3 w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
            >
              {saving ? 'Saving...' : 'Pain Data Save Karo →'}
            </button>
          )}
        </div>

        {/* Final CTA */}
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-green-700">✅ Saare jawab mile? Ab COD / ROI tool use karo →</p>
          <p className="text-xs text-green-600 mt-0.5">Customer ka loss number pata hai — ab loan se faida dikhao</p>
        </div>
      </div>

    </div>
  )
}
