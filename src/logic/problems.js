// Shared problem categories — used in S2_Problems and S_PainDiscovery

export const PROBLEMS = [
  {
    tag:      'CASH_FLOW',
    emoji:    '💸',
    title:    'Cash Flow Problem',
    sub:      'Supplier payment delay, stock nahi uth pa rahe, customer ka paisa atka',
    painKey:  'cashFlowMenu',
    subProblems: [
      { tag: 'CASH_SUPPLIER', label: 'Supplier payment delay ho raha hai',  painKey: 'cashSupplier' },
      { tag: 'CASH_STOCK',    label: 'Naya stock nahi uth pa rahe',         painKey: 'cashStock'    },
      { tag: 'CASH_CUSTOMER', label: 'Customer ka paisa atka hua hai',      painKey: 'cashCustomer' },
    ],
  },
  {
    tag:      'STOCK',
    emoji:    '📦',
    title:    'Stock Refill / Bulk Stock',
    sub:      'Fast-moving maal khatam, variety kam, bulk ke liye capital nahi',
    painKey:  'stockMenu',
    subProblems: [
      { tag: 'STOCK_FAST',    label: 'Fast-moving maal khatam ho jata hai', painKey: 'stockFast'    },
      { tag: 'STOCK_VARIETY', label: 'Variety kam hai',                      painKey: 'stockVariety' },
      { tag: 'STOCK_BULK',    label: 'Bulk ke liye capital nahi',            painKey: 'stockBulk'   },
    ],
  },
  {
    tag:      'EXPANSION',
    emoji:    '🏪',
    title:    'Shop Improvement / Expansion',
    sub:      'Space increase, display improve, look & feel upgrade',
    painKey:  'expansionMenu',
    subProblems: [
      { tag: 'EXP_SPACE',   label: 'Space increase chahiye',    painKey: 'space'   },
      { tag: 'EXP_DISPLAY', label: 'Display improve karna hai', painKey: 'display' },
      { tag: 'EXP_LOOK',    label: 'Look & feel upgrade',       painKey: 'look'    },
    ],
  },
  {
    tag:      'FOOTFALL',
    emoji:    '🚶',
    title:    'Footfall Problem',
    sub:      'Competition, location issue, shop setup, variety kam',
    painKey:  'footfallMenu',
    subProblems: [
      { tag: 'FOOT_COMP',     label: 'Competition ki wajah se',      painKey: 'footfallCompetition' },
      { tag: 'FOOT_LOCATION', label: 'Location issue hai',            painKey: 'footfallLocation'   },
      { tag: 'FOOT_DISPLAY',  label: 'Shop setup / display problem',  painKey: 'footfallDisplay'    },
      { tag: 'FOOT_VARIETY',  label: 'Stock variety kam hai',         painKey: 'footfallVariety'    },
    ],
  },
  {
    tag:      'SLOW_SALES',
    emoji:    '📉',
    title:    'Slow Sales / Stock Stuck',
    sub:      'Demand kam, wrong stock, cash rotation slow',
    painKey:  'slowMenu',
    subProblems: [
      { tag: 'SLOW_DEMAND',   label: 'Demand kam hai',          painKey: 'demand'     },
      { tag: 'SLOW_WRONG',    label: 'Wrong stock hai',          painKey: 'wrongStock' },
      { tag: 'SLOW_ROTATION', label: 'Cash rotation slow hai',   painKey: 'rotation'  },
    ],
  },
  {
    tag:      'COMPETITION',
    emoji:    '🏃',
    title:    'Competition Pressure',
    sub:      'Competitor ke paas zyada variety, better price ya display',
    painKey:  'competitionMenu',
    subProblems: [
      { tag: 'COMP_VARIETY',      label: 'Competitor ke paas zyada variety',   painKey: 'compVariety'      },
      { tag: 'COMP_PRICE',        label: 'Competitor better price deta hai',   painKey: 'compPrice'        },
      { tag: 'COMP_AVAILABILITY', label: 'Competitor ka stock better rehta hai', painKey: 'compAvailability' },
      { tag: 'COMP_DISPLAY',      label: 'Competitor ka display better hai',   painKey: 'compDisplay'      },
    ],
  },
  {
    tag:      'REPAIR',
    emoji:    '🔧',
    title:    'Emergency Repair',
    sub:      'Machine, equipment ya shop structure repair/replace karna hai',
    painKey:  'repairMenu',
    subProblems: [],
  },
]

// Flat map: painKey → { parentTag, subTag }
export const PAIN_KEY_MAP = {}
PROBLEMS.forEach(p => {
  PAIN_KEY_MAP[p.painKey] = { parentTag: p.tag, subTag: null }
  p.subProblems.forEach(sp => {
    PAIN_KEY_MAP[sp.painKey] = { parentTag: p.tag, subTag: sp.tag }
  })
})
