import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'


// ── Rule-based interest classifier ─────────────────────────────────────────

const LOW_KEYWORDS    = ['nahi', 'nhi', 'busy', 'baad mein', 'baad me', 'interested nahi', 'time nahi',
                         'mat karo', 'chhod', 'no ', 'not interested', 'abhi nahi', 'abhi nhi',
                         'zaroorat nahi', 'zarurat nahi', 'nai chahiye', 'nahi chahiye']

const HIGH_KEYWORDS   = ['rate', 'byaj', 'byaaj', 'interest rate', 'kitna percent', 'emi kitna',
                         'emi kya', 'kitne mahine', 'process kya', 'document', 'kab milega',
                         'kitna milega', 'loan chahiye', 'lena hai', 'apply', 'ready', 'haan le lete',
                         'le lenge', 'kitna time']

const MEDIUM_KEYWORDS = ['soch', 'dekhenge', 'dekh', 'problem', 'tension', 'stock', 'cash', 'udhar',
                         'udhaar', 'slow', 'competition', 'bata', 'samjhao', 'kya hoga', 'kaise',
                         'zaroorat', 'paise', 'paisa', 'kami', 'nuksaan', 'loss', 'bikri', 'maal',
                         'customer nahi', 'customers nahi', 'aata nahi', 'nahi aata']

function classify(text) {
  const t = text.toLowerCase()
  const score = { low: 0, medium: 0, high: 0 }

  LOW_KEYWORDS.forEach(k    => { if (t.includes(k)) score.low    += 2 })
  HIGH_KEYWORDS.forEach(k   => { if (t.includes(k)) score.high   += 2 })
  MEDIUM_KEYWORDS.forEach(k => { if (t.includes(k)) score.medium += 1 })

  if (score.high   > 0 && score.high   >= score.low) return 'high'
  if (score.low    > 0 && score.low     > score.medium) return 'low'
  if (score.medium > 0) return 'medium'
  return null
}

// ── Guidance content ────────────────────────────────────────────────────────

const GUIDANCE = {
  low: {
    label: '🔴 Low Interest',
    labelColor: 'text-red-600 bg-red-50 border-red-200',
    tool: '📋 Customer Engagement Form',
    toolColor: 'bg-red-500',
    steps: [
      'Quickly fill basic details (name, shop, mobile)',
      'Select business type',
      'Capture GPS photo of the shop',
      'Submit form for future follow-up',
    ],
    say: [
      '"Koi baat nahi bhai, ek chhota sa form bharte hain — aapka number save rahega."',
      '"Jab zaroorat ho tab hum ready rahenge."',
    ],
    goal: 'Visit verification + future follow-up',
  },
  medium: {
    label: '🟡 Medium Interest',
    labelColor: 'text-amber-700 bg-amber-50 border-amber-200',
    tool: '🔍 Pain Discovery Tool',
    toolColor: 'bg-amber-500',
    steps: [
      'Open Pain Discovery Tool',
      'Select problem category (Cash flow / Stock / Slow sales / Competition)',
      'Ask only 3–5 focused questions',
      'Get answers in ₹ — loss / missed sale / stuck money',
    ],
    say: [
      '"Bhai, ek chhoti si baat karte hain — business mein kya dikkat aa rahi hai?"',
      '"Seedha bata do, kitna nuksaan ho raha hai mahine mein?"',
    ],
    goal: 'Understand real problem + build loan need',
  },
  high: {
    label: '🟢 High Interest',
    labelColor: 'text-green-700 bg-green-50 border-green-200',
    tool: '💚 COD / ROI Tool',
    toolColor: 'bg-green-600',
    steps: [
      'Open ROI or COD screen',
      'Show monthly gain vs loan EMI',
      'Compare: business loss vs loan cost',
      'Explain simply — "Loan se zyada kamaoge"',
    ],
    say: [
      '"Rate toh dekhte hain, pehle dekho loan se kitna extra kamaoge — phir decide karo."',
      '"EMI se zyada faida hoga toh loan lena smart decision hai."',
    ],
    goal: 'Convert customer',
  },
}

// ── Quick prompts ───────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: '📋 Customer Engagement Form', action: 'customerForm' },
  { label: '🔍 Pain Questions',           action: 'painDiscovery' },
  { label: 'Rate pooch raha 💰',          text: 'Customer rate pooch raha hai, EMI kitna hoga, kitne mahine ka loan milega' },
]

// ── Message bubble ──────────────────────────────────────────────────────────

function UserBubble({ text }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] leading-relaxed">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ guidance }) {
  const g = GUIDANCE[guidance]
  const { openPainDiscovery, openCustomerForm, closeAssistant } = useApp()

  function handleOpenTool() {
    if (guidance === 'medium') { closeAssistant(); openPainDiscovery() }
    if (guidance === 'low')    { closeAssistant(); openCustomerForm()  }
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[92%] space-y-2">

        {/* Situation badge */}
        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${g.labelColor}`}>
          {g.label}
        </div>

        {/* Tool */}
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm overflow-hidden shadow-sm">
          <div className={`px-4 py-2 ${g.toolColor}`}>
            <p className="text-xs font-bold text-white uppercase tracking-widest">Use this tool</p>
            <p className="text-base font-extrabold text-white mt-0.5">{g.tool}</p>
          </div>

          {/* Steps */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">What to do</p>
            <ol className="space-y-1.5">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className="font-bold text-slate-400 flex-shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* What to say */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">What to say</p>
            <div className="space-y-1.5">
              {g.say.map((s, i) => (
                <p key={i} className="text-xs text-slate-700 italic leading-relaxed">{s}</p>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-100">
            <span className="text-xs">🎯</span>
            <p className="text-xs font-semibold text-slate-600">Goal: {g.goal}</p>
          </div>

          {/* Open tool button */}
          {guidance === 'low' && (
            <button onClick={handleOpenTool} className="w-full px-4 py-2.5 bg-red-500 text-white text-xs font-bold text-center active:scale-95 transition-all">
              📋 Customer Engagement Form Kholein →
            </button>
          )}
          {guidance === 'medium' && (
            <button onClick={handleOpenTool} className="w-full px-4 py-2.5 bg-amber-500 text-white text-xs font-bold text-center active:scale-95 transition-all">
              🔍 Pain Discovery Tool Kholein →
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

function UnknownBubble() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
        <p className="text-sm text-slate-600">Samajh nahi aaya 🤔 — thoda aur batao ya niche se quick option choose karo.</p>
      </div>
    </div>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function S_SalesAssistant() {
  const { closeAssistant, openCustomerForm, openPainDiscovery } = useApp()

  function handleQuickPrompt(q) {
    if (q.action === 'customerForm')   { closeAssistant(); openCustomerForm()   }
    if (q.action === 'painDiscovery')  { closeAssistant(); openPainDiscovery()  }
    if (q.text)                        { handleSend(q.text) }
  }
  const [messages, setMessages] = useState([
    { type: 'assistant-intro' },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(text) {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return

    const interest = classify(trimmed)
    setMessages(prev => [
      ...prev,
      { type: 'user', text: trimmed },
      { type: interest ? 'assistant' : 'unknown', guidance: interest },
    ])
    setInput('')
  }

  return (
    <div className="phone-shell flex flex-col bg-slate-100" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <div className="bg-indigo-700 text-white pt-12 pb-3 px-5 flex-shrink-0 flex items-center justify-between">
        <div>
          <img src="https://rzktrracmsxiwhryfxrw.supabase.co/storage/v1/object/public/photos/LOGO.png" alt="PaisaDost" className="h-6 w-auto object-contain mb-1" />
          <h1 className="text-lg font-extrabold leading-tight">Sales Assistant 🤖</h1>
          <p className="text-xs text-indigo-300 mt-0.5">Customer ki situation batao — guide karunga</p>
        </div>
        <button
          onClick={closeAssistant}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">

        {/* Intro bubble */}
        <div className="flex justify-start mb-4">
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
            <p className="text-sm text-slate-700 leading-relaxed">
              Namaste! 👋 Mujhe batao — <strong>customer ka reaction kaisa hai?</strong>
            </p>
            <p className="text-xs text-slate-400 mt-1.5">Apni bhasha mein likho ya niche se choose karo.</p>
          </div>
        </div>

        {/* Messages */}
        {messages.slice(1).map((msg, i) => {
          if (msg.type === 'user')      return <UserBubble key={i} text={msg.text} />
          if (msg.type === 'assistant') return <AssistantBubble key={i} guidance={msg.guidance} />
          if (msg.type === 'unknown')   return <UnknownBubble key={i} />
          return null
        })}

        <div ref={bottomRef} />
      </div>

      {/* Bottom input area */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-white border-t border-slate-200 px-4 pt-3 pb-6 z-30 space-y-2">

        {/* Quick prompts */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_PROMPTS.map(q => (
            <button
              key={q.label}
              onClick={() => handleQuickPrompt(q)}
              className="flex-shrink-0 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1.5 active:scale-95 transition-all"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Customer ka reaction likho..."
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
          >
            ↑
          </button>
        </div>

      </div>
    </div>
  )
}
