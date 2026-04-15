import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ScreenShell from '../components/ScreenShell'
import RangeSlider from '../components/RangeSlider'
import LoanCustomizeCard from '../components/LoanCustomizeCard'
import { fmtINR, fmtINRFull } from '../logic/calculations'

// Same options as engagement form किस चीज़ का व्यापार है?
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

const AGE_OPTIONS = [
  { value: '<1',  label: '< 1 saal' },
  { value: '1-2', label: '1–2 saal' },
  { value: '2-3', label: '2–3 saal' },
  { value: '3-5', label: '3–5 saal' },
  { value: '5+',  label: '5+ saal' },
]

function Section({ icon, title, open, onToggle, children, badge, done }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm mb-3 overflow-hidden ${done ? 'border-indigo-200' : 'border-slate-100'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className={`text-sm font-bold ${done ? 'text-indigo-700' : 'text-slate-700'}`}>{title}</span>
          {badge && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{badge}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {done && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold leading-none">✓</span>
          )}
          <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-50">{children}</div>}
    </div>
  )
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="flex justify-between items-center py-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-14 h-7 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-8' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function NumberInput({ label, value, onChange, suffix = '' }) {
  const [raw, setRaw] = useState(value === 0 ? '0' : (value || ''))
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-brand">
        <span className="px-3 py-2.5 bg-slate-50 text-slate-500 font-bold text-sm border-r border-slate-200">₹</span>
        <input
          type="number"
          inputMode="numeric"
          value={raw}
          min={0}
          onChange={e => {
            const n = Number(e.target.value)
            const clamped = isNaN(n) ? 0 : Math.max(0, n)
            setRaw(e.target.value === '' ? '' : String(clamped))
            onChange(clamped)
          }}
          className="flex-1 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none bg-white"
        />
        {suffix && <span className="px-3 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold border-l border-slate-200">{suffix}</span>}
      </div>
    </div>
  )
}

export default function S1_BusinessDetails() {
  const { inputs, update, next, screen, reset, saveCurrentCustomer, saving, openSavedCustomers } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    try {
      await saveCurrentCustomer()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // error is already in AppContext.saveError — nothing extra needed here
    }
  }
  const INITIAL_OPEN = { business: true, sales: true, stock: true, season: false, competition: false, udhari: false, expenses: false, inflation: false, loan: false }
  const [open, setOpen] = useState(INITIAL_OPEN)
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  const monthlyProfit = inputs.monthlySales * inputs.profitMargin / 100
  const totalDiscount = inputs.bulkDiscount + inputs.schemeDiscount + inputs.cashDiscount

  // Section completion indicators — all key fields must be filled
  const done = {
    business:    (!!inputs.businessType && inputs.businessType !== '__other__' || !!inputs.bizTypeOther) && AGE_OPTIONS.some(a => a.value === inputs.businessAge),
    sales:       inputs.monthlySales > 0 && inputs.profitMargin > 0,
    stock:       inputs.monthlyStockPurchase > 0 && inputs.stockRotationDays > 0 && inputs.stockPriceIncreasePct > 0,
    season:      inputs.seasonUplift > 0 && inputs.seasonMonths > 0,
    competition: inputs.dailyWalkins > 0 && inputs.avgBillValue > 0,
    udhari:      inputs.creditDaysGiven > 0 && inputs.actualUdhari > 0,
    expenses:    inputs.rent > 0 && inputs.salaries > 0,
    inflation:   inputs.inflationRate > 0,
    loan:        inputs.existingLoan !== null && inputs.existingLoan !== undefined,
  }

  return (
    <ScreenShell
      title="Customer Ki Details"
      subtitle="Sab sections bharo — accurate result aayega"
      step={screen}
      total={7}
      cta="Nuksaan Dekhte Hain →"
      onCta={next}
    >

      {/* ── Customer identity + actions ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-3 px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 mb-1">👤 Customer Ka Naam</p>
            <input
              type="text"
              value={inputs.customerName}
              onChange={e => update('customerName', e.target.value.replace(/[0-9]/g, ''))}
              placeholder="Naam likho..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div className="w-36">
            <p className="text-xs font-semibold text-slate-500 mb-1">📞 Mobile</p>
            <input
              type="tel"
              value={inputs.customerMobile}
              onChange={e => update('customerMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digit"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white text-center active:scale-95 transition-all disabled:opacity-60 ${saved ? 'bg-green-500' : 'bg-indigo-600'}`}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : '💾 Save Karen'}
          </button>
          <button
            onClick={openSavedCustomers}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-indigo-200 text-indigo-600 text-center active:scale-95 transition-all"
          >
            📂 Saved Customers
          </button>
        </div>
      </div>

      {/* ── Reset banner ── */}
      {!confirmReset ? (
        <button
          onClick={() => setConfirmReset(true)}
          className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-xs font-semibold active:scale-95 transition-all"
        >
          🔄 Naya Customer — Saari Details Reset Karein
        </button>
      ) : (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-green-700">Pakka reset karna hai? Saara data clear ho jayega.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { reset(); setOpen(INITIAL_OPEN); setConfirmReset(false) }}
              className="flex-1 py-2 bg-green-500 text-white text-xs font-bold rounded-lg active:scale-95 transition-all"
            >
              Haan, Reset Karo
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg active:scale-95 transition-all"
            >
              Nahi, Ruk Jao
            </button>
          </div>
        </div>
      )}

      {/* ── 1. Business Info ── */}
      <Section icon="🏪" title="Business Ki Jaankari" open={open.business} onToggle={() => toggle('business')} done={done.business}>
        <div className="grid grid-cols-2 gap-2 mb-3 mt-2">
          {BIZ_TYPES.map(bt => (
            <button
              key={bt.label}
              onClick={() => { update('businessType', bt.label); update('bizTypes', [bt.label]) }}
              className={`py-2.5 px-2 rounded-xl text-xs font-semibold text-left border-2 transition-all
                ${inputs.businessType === bt.label
                  ? 'border-brand bg-indigo-50 text-brand'
                  : 'border-slate-200 text-slate-700'}`}
            >
              {bt.emoji} {bt.label}
            </button>
          ))}
          <button
            onClick={() => { update('businessType', '__other__'); update('bizTypes', ['__other__']) }}
            className={`py-2.5 px-2 rounded-xl text-xs font-semibold text-left border-2 transition-all
              ${inputs.businessType === '__other__'
                ? 'border-brand bg-indigo-50 text-brand'
                : 'border-slate-200 text-slate-700'}`}
          >
            Other
          </button>
        </div>
        {inputs.businessType === '__other__' && (
          <input
            type="text"
            value={inputs.bizTypeOther || ''}
            onChange={e => update('bizTypeOther', e.target.value)}
            placeholder="Business type likho..."
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 mb-3"
          />
        )}

        <p className="text-xs font-semibold text-slate-500 mb-2">Dukaan Kitne Saal Se Hai?</p>
        <div className="flex gap-1.5">
          {AGE_OPTIONS.map(a => (
            <button
              key={a.value}
              onClick={() => update('businessAge', a.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold text-center border-2 transition-all
                ${inputs.businessAge === a.value
                  ? 'border-brand bg-indigo-50 text-brand'
                  : 'border-slate-200 text-slate-500'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 2. Sales & Profit ── */}
      <Section icon="💰" title="Bikri aur Faida" open={open.sales} onToggle={() => toggle('sales')} done={done.sales}>
        <div className="bg-indigo-50 rounded-xl p-3 mb-4 mt-2 flex justify-between items-center">
          <div>
            <p className="text-xs text-brand font-semibold">Monthly Profit</p>
            <p className="text-2xl font-extrabold text-brand">{fmtINR(monthlyProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-indigo-400">Roz ka</p>
            <p className="text-lg font-bold text-indigo-500">₹{Math.round(monthlyProfit / 30).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <RangeSlider
          label="Mahine Ki Bikri (Monthly Sales)"
          value={inputs.monthlySales}
          min={25000} max={5000000} step={25000}
          onChange={v => update('monthlySales', v)}
          hint="Ek mahine mein total kitni bikri hoti hai?"
        />
        <RangeSlider
          label="Profit Margin"
          value={inputs.profitMargin}
          min={5} max={40} step={1}
          onChange={v => update('profitMargin', v)}
          format="pct"
          hint="₹100 ki bikri mein kitna bacha? (gross margin)"
        />
      </Section>

      {/* ── 3. Stock & Supplier ── */}
      <Section icon="📦" title="Maal aur Supplier" open={open.stock} onToggle={() => toggle('stock')}
        badge={`${totalDiscount}% total discount`} done={done.stock}>

        <RangeSlider
          label="Mahine Mein Kitna Maal Kharidna"
          value={inputs.monthlyStockPurchase}
          min={10000} max={5000000} step={10000}
          onChange={v => update('monthlyStockPurchase', v)}
          hint="Supplier se ek mahine mein kitne ka maal mangwate ho?"
        />
        <RangeSlider
          label="Maal Kitne Din Mein Bikta Hai?"
          value={inputs.stockRotationDays}
          min={3} max={180} step={1}
          onChange={v => update('stockRotationDays', v)}
          format="days"
          hint="Ek batch maal lane se bikne tak kitne din lagte hain?"
        />

        <div className="border-t border-slate-100 pt-3 mt-1 mb-1">
          <p className="text-xs font-bold text-slate-600 mb-3">Supplier Se Discount Milta Hai?</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { key: 'bulkDiscount',   label: 'Bulk' },
              { key: 'schemeDiscount', label: 'Scheme' },
              { key: 'cashDiscount',   label: 'Cash' },
            ].map(d => (
              <div key={d.key}>
                <p className="text-xs text-slate-500 mb-1 text-center">{d.label}</p>
                <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-brand">
                  <input
                    type="number" min={0} max={20}
                    value={inputs[d.key] || ''}
                    onChange={e => update(d.key, Number(e.target.value) || 0)}
                    className="w-full px-2 py-2 text-sm font-bold text-center outline-none"
                  />
                  <span className="px-2 py-2 bg-slate-50 text-slate-500 text-xs font-bold border-l border-slate-200">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
            <span className="text-xs text-amber-700 font-semibold">Total Discount</span>
            <span className="text-base font-extrabold text-amber-800">{totalDiscount}%</span>
          </div>
        </div>

        <RangeSlider
          label="Supplier Ne Maal Kitna Mehanga Kiya? (Saal Mein)"
          value={inputs.stockPriceIncreasePct}
          min={0} max={20} step={1}
          onChange={v => update('stockPriceIncreasePct', v)}
          format="pct"
          hint="Pichle saal se maal ki keemat kitni % badhli?"
        />
      </Section>

      {/* ── 4. Season ── */}
      <Section icon="📅" title="Season / Tyohar ka Asar" open={open.season} onToggle={() => toggle('season')} done={done.season}>
        <RangeSlider
          label="Season Mein Kitni Zyada Bikri Hoti Hai?"
          value={inputs.seasonUplift}
          min={0} max={100} step={5}
          onChange={v => update('seasonUplift', v)}
          format="pct"
          hint="Diwali / Eid / harvest mein normal se kitna % zyada bikri hoti hai?"
        />
        <RangeSlider
          label="Saal Mein Kitne Mahine Season Hota Hai?"
          value={inputs.seasonMonths}
          min={1} max={6} step={1}
          onChange={v => update('seasonMonths', v)}
          format="months"
          hint="Kitne mahine peak season rehta hai?"
        />
      </Section>

      {/* ── 5. Competition ── */}
      <Section icon="🏃" title="Competition aur Customers" open={open.competition} onToggle={() => toggle('competition')} done={done.competition}>
        <RangeSlider
          label="Roz Kitne Customer Aate Hain?"
          value={inputs.dailyWalkins}
          min={5} max={500} step={5}
          onChange={v => update('dailyWalkins', v)}
          format="count"
          hint="Average roz ka footfall (total customers per day)"
        />
        <RangeSlider
          label="Kitne Log Competitor Ke Paas Jaate Hain?"
          value={inputs.lostCustomersPct ?? 50}
          min={0} max={100} step={5}
          onChange={v => update('lostCustomersPct', v)}
          format="pct"
          hint={`${inputs.dailyWalkins} customers mein se ${Math.round((inputs.dailyWalkins ?? 0) * (inputs.lostCustomersPct ?? 50) / 100)} roz competitor ke paas jaate hain`}
        />
        <RangeSlider
          label="Average Bill Kitna Hota Hai?"
          value={inputs.avgBillValue}
          min={100} max={30000} step={100}
          onChange={v => update('avgBillValue', v)}
          hint="Ek customer average kitne ka khareedta hai?"
        />
        {(inputs.lostCustomersPct ?? 0) > 0 && (
          <div className="bg-red-50 rounded-xl px-3 py-2 mt-1">
            <p className="text-xs text-red-600 font-semibold">
              Monthly competitor loss: {fmtINR(
                Math.round((inputs.dailyWalkins ?? 0) * (inputs.lostCustomersPct ?? 0) / 100)
                * inputs.avgBillValue * 30 * (inputs.profitMargin / 100) * 0.40
              )} profit
            </p>
          </div>
        )}
      </Section>

      {/* ── 6. Udhari / Credit ── */}
      <Section icon="📒" title="Udhari / Credit Outstanding" open={open.udhari} onToggle={() => toggle('udhari')} done={done.udhari}>
        <RangeSlider
          label="Kitne Din Ka Credit Dete Ho Customers Ko?"
          value={inputs.creditDaysGiven}
          min={0} max={90} step={1}
          onChange={v => update('creditDaysGiven', v)}
          format="days"
          hint="Customer ko maal dene ke baad paisa kitne din mein aata hai?"
        />
        <RangeSlider
          label="Total Udhari / Outstanding Amount"
          value={inputs.actualUdhari}
          min={0} max={2500000} step={10000}
          onChange={v => update('actualUdhari', v)}
          hint="Abhi customers se kitna paisa lena baaki hai?"
        />
        <RangeSlider
          label="Ideal Udhari Kitne Din Ki Honi Chahiye?"
          value={inputs.idealUdhariDays}
          min={1} max={30} step={1}
          onChange={v => update('idealUdhariDays', v)}
          format="days"
          hint="Aapke business ke liye normal/acceptable credit period kya hai?"
        />

        <ToggleRow
          label="Udhari Badh Rahi Hai?"
          sub="Kya outstanding amount zyada hota ja raha hai?"
          value={inputs.udhariIncreasing}
          onChange={v => update('udhariIncreasing', v)}
        />
        {inputs.udhariIncreasing && (
          <div className="bg-red-50 rounded-xl px-3 py-2 mt-2">
            <p className="text-xs text-red-600 font-semibold">⚠️ Risk: Badhti udhari cash flow problem banegi</p>
          </div>
        )}
      </Section>

      {/* ── 7. Fixed Expenses ── */}
      <Section icon="🏠" title="Fixed Expenses (Kharche)" open={open.expenses} onToggle={() => toggle('expenses')} done={done.expenses}>
        <p className="text-xs text-slate-500 mb-3 mt-1">Har mahine ke fixed kharche — sale ho ya na ho</p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <NumberInput label="Kiraya / Rent (₹/mah)" value={inputs.rent} onChange={v => update('rent', v)} />
          <NumberInput label="Bijli / Electricity (₹/mah)" value={inputs.electricity} onChange={v => update('electricity', v)} />
        </div>
        <NumberInput label="Salary / Wages (₹/mah)" value={inputs.salaries} onChange={v => update('salaries', v)} />
        <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3 flex justify-between">
          <span className="text-xs text-slate-600 font-semibold">Total Fixed Expenses</span>
          <span className="text-sm font-extrabold text-slate-800">
            {fmtINRFull(inputs.rent + inputs.electricity + inputs.salaries)}/mah
          </span>
        </div>
        <RangeSlider
          label="Har Saal Kharche Kitne % Badhte Hain?"
          value={inputs.expenseGrowthPct}
          min={0} max={30} step={1}
          onChange={v => update('expenseGrowthPct', v)}
          format="pct"
          hint="Rent, salary sab milake saal mein kitna badhta hai?"
        />
        {inputs.expenseGrowthPct > 0 && (
          <div className="bg-amber-50 rounded-xl px-3 py-2">
            <p className="text-xs text-amber-700 font-semibold">
              Iss saal extra burden: {fmtINR((inputs.rent + inputs.electricity + inputs.salaries) * inputs.expenseGrowthPct / 100)}/mah
            </p>
          </div>
        )}
      </Section>

      {/* ── 8. Inflation ── */}
      <Section icon="📈" title="Mehengai (Inflation)" open={open.inflation} onToggle={() => toggle('inflation')} done={done.inflation}>
        <RangeSlider
          label="Har Saal Mehengai Kitni Badhti Hai?"
          value={inputs.inflationRate}
          min={1} max={15} step={0.5}
          onChange={v => update('inflationRate', v)}
          format="pct"
          hint="India average ~7% — aapke area mein kitni?"
        />
        {(() => {
          const mthlyProfit = inputs.monthlySales * inputs.profitMargin / 100
          const inflLoss = mthlyProfit * inputs.inflationRate / 100
          return (
            <div className="bg-amber-50 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-700 font-semibold">
                Mehengai se profit erosion: {fmtINR(inflLoss)}/mah
              </p>
              <p className="text-xs text-amber-500 mt-0.5">
                Aapka ₹{Math.round(mthlyProfit).toLocaleString('en-IN')} profit real value mein kam ho raha hai
              </p>
            </div>
          )
        })()}
      </Section>

      {/* ── 9. Existing Loan ── */}
      <Section icon="🏦" title="Purana Loan (Agar Hai)" open={open.loan} onToggle={() => toggle('loan')} done={done.loan}>
        <p className="text-xs font-semibold text-slate-500 mb-2 mt-1">Koi Loan Abhi Chal Raha Hai?</p>
        <div className="flex gap-2 mb-3">
          {[{ label: '✅ Haan, chal raha hai', value: true }, { label: '❌ Nahi, koi loan nahi', value: false }].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => update('existingLoan', opt.value)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all
                ${inputs.existingLoan === opt.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {inputs.existingLoan === true && (
          <div className="mt-3">
            <RangeSlider
              label="Purani EMI Kitni Hai?"
              value={inputs.existingEMI}
              min={0} max={200000} step={1000}
              onChange={v => update('existingEMI', v)}
            />
            {(() => {
              const mthlyProfit = inputs.monthlySales * inputs.profitMargin / 100
              const pct = mthlyProfit > 0 ? Math.round(inputs.existingEMI / mthlyProfit * 100) : 0
              return (
                <div className={`rounded-xl px-3 py-2 ${pct > 40 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={`text-xs font-semibold ${pct > 40 ? 'text-red-600' : 'text-green-600'}`}>
                    {pct > 40
                      ? `⚠️ EMI kamaai ka ${pct}% — zyada hai`
                      : `✓ EMI kamaai ka ${pct}% — theek hai`}
                  </p>
                </div>
              )
            })()}
          </div>
        )}
      </Section>

      {/* ── 10. Loan Customize ── */}
      <LoanCustomizeCard />

    </ScreenShell>
  )
}
