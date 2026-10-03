/**
 * Single source of truth for how lead stages and statuses LOOK in the app.
 *
 * Which stage a lead is at is decided by the database (stage_defs +
 * events_apply_stage trigger, supabase/migrations/007). The app only records
 * events and displays the result, so keys and ranks here mirror stage_defs.
 *
 *   new → visited → pain_identified → roi_shown → login_started
 *
 * approved / disbursed are retired: nothing sets them any more, but older
 * leads may still carry them, so they keep a label and rank.
 */

export const STAGES = [
  { key: 'new',             label: 'Nayi Lead',  rank: 0,   event: 'lead_created',    bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400'   },
  { key: 'visited',         label: 'Visited',    rank: 10,  event: 'visit_done',      bg: 'bg-brand-100',   text: 'text-brand-700',   dot: 'bg-brand-500'   },
  { key: 'pain_identified', label: 'Pain Done',  rank: 20,  event: 'pain_identified', bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
  { key: 'roi_shown',       label: 'ROI Shown',  rank: 50,  event: 'roi_shown',       bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  { key: 'login_started',   label: 'Login Done', rank: 80,  event: 'login_started',   bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500'   },
]

const RETIRED_STAGES = [
  { key: 'approved',  label: 'Approved',  rank: 90,  event: null, bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'disbursed', label: 'Disbursed', rank: 100, event: null, bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500'    },
]

const BY_KEY = Object.fromEntries([...STAGES, ...RETIRED_STAGES].map(s => [s.key, s]))

/** Stage presentation for a key. Unknown or missing keys fall back to 'new'. */
export function getStage(key) {
  return BY_KEY[key] || BY_KEY.new
}

/** Tailwind classes for a stage chip. */
export function stageChipClass(key) {
  const s = getStage(key)
  return `${s.bg} ${s.text}`
}

/** True once the lead has reached ROI Shown or beyond. */
export function hasReachedStage(stageKey, targetKey) {
  return getStage(stageKey).rank >= getStage(targetKey).rank
}

/**
 * Statuses (customers_status_check, migration 007). The database changes them
 * from events (migration 009): "Nahi" → nurture, "Interested" → back to
 * active, and status_changed events with a reason.
 */
export const STATUSES = [
  { key: 'active',        label: 'Active',        cls: 'bg-slate-100 text-slate-600', closed: false },
  { key: 'nurture',       label: 'Nurture',       cls: 'bg-amber-100 text-amber-700', closed: false },
  { key: 'not_qualified', label: 'Not Qualified', cls: 'bg-slate-200 text-slate-700', closed: true  },
  { key: 'lost',          label: 'Lost',          cls: 'bg-red-100 text-red-700',     closed: true  },
  { key: 'rejected',      label: 'Rejected',      cls: 'bg-red-100 text-red-700',     closed: true  },
  { key: 'dormant',       label: 'Dormant',       cls: 'bg-slate-200 text-slate-500', closed: true  },
]

const STATUS_BY_KEY = Object.fromEntries(STATUSES.map(s => [s.key, s]))

/** Status presentation. Missing status means the lead predates statuses: active. */
export function getStatus(key) {
  return STATUS_BY_KEY[key] || STATUS_BY_KEY.active
}

/** Closed leads leave the working list and do not advance until reactivated. */
export function isClosedStatus(key) {
  return getStatus(key).closed
}

/** Lead-list views: 'open' = active + nurture (default), 'nurture', 'closed'. */
export function matchStatusView(statusKey, view) {
  if (view === 'nurture') return getStatus(statusKey).key === 'nurture'
  if (view === 'closed')  return isClosedStatus(statusKey)
  return !isClosedStatus(statusKey)
}

/** Statuses an agent may close their own lead with, and the reasons offered. */
export const AGENT_CLOSE_REASONS = {
  lost: [
    'Doosre lender se loan le liya',
    'Dukaan band ho gayi',
    'Customer ne mana kar diya',
    'Contact nahi ho pa raha',
  ],
  not_qualified: [
    'Business bahut chhota hai',
    'Purana loan default hai',
    'Documents nahi hain',
    'Area serviceable nahi hai',
  ],
}
