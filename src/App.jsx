import { AppProvider, useApp } from './context/AppContext'
import S1_BusinessDetails from './screens/S1_BusinessDetails'
import S2_Problems        from './screens/S2_Problems'
import S3_COD             from './screens/S3_COD'
import S4_ROI             from './screens/S4_ROI'
import S5_Comparison      from './screens/S5_Comparison'
import S6_Intelligence    from './screens/S6_Intelligence'
import S7_Offer           from './screens/S7_Offer'
import S_SalesAssistant   from './screens/S_SalesAssistant'
import S_PainDiscovery    from './screens/S_PainDiscovery'
import S_CustomerForm     from './screens/S_CustomerForm'
import S_SavedCustomers  from './screens/S_SavedCustomers'
import S_Dashboard       from './screens/S_Dashboard'

const SCREENS = [
  S1_BusinessDetails,
  S2_Problems,
  S3_COD,
  S4_ROI,
  S5_Comparison,
  S6_Intelligence,
  S7_Offer,
]

function AppInner() {
  const { screen, assistantOpen, openAssistant, painDiscoveryOpen, customerFormOpen, savedCustomersOpen, dashboardOpen, openDashboard } = useApp()
  const Screen = SCREENS[screen] ?? S7_Offer

  if (dashboardOpen)      return <S_Dashboard />
  if (savedCustomersOpen) return <S_SavedCustomers />
  if (assistantOpen)      return <S_SalesAssistant />
  if (painDiscoveryOpen)  return <S_PainDiscovery />
  if (customerFormOpen)   return <S_CustomerForm />

  return (
    <>
      <Screen key={screen} />
      <button
        onClick={openAssistant}
        className="fixed bottom-24 right-4 z-50 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-all"
        style={{ width: 52, height: 52 }}
        title="Sales Assistant"
      >
        🤖
      </button>
      <button
        onClick={openDashboard}
        className="fixed bottom-24 left-4 z-50 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-all"
        style={{ width: 52, height: 52 }}
        title="Dashboard"
      >
        📊
      </button>
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
