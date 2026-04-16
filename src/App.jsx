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
import S_SavedCustomers   from './screens/S_SavedCustomers'
import S_Dashboard        from './screens/S_Dashboard'
import S_QuickCreate      from './screens/S_QuickCreate'
import S_Home             from './screens/S_Home'
import S_Workspace        from './screens/S_Workspace'

const ROI_SCREENS = [
  S1_BusinessDetails,
  S2_Problems,
  S3_COD,
  S4_ROI,
  S5_Comparison,
  S6_Intelligence,
  S7_Offer,
]

function ROIFlow() {
  const { screen, setMainScreen } = useApp()
  const Screen = ROI_SCREENS[screen] ?? S7_Offer
  return <Screen key={screen} onBackToWorkspace={() => setMainScreen('workspace')} />
}

function AppInner() {
  const {
    mainScreen,
    screen, assistantOpen, openAssistant,
    painDiscoveryOpen, customerFormOpen, savedCustomersOpen,
    dashboardOpen, openDashboard,
    quickCreateOpen,
  } = useApp()

  // Modals/overlays take priority over main screen
  if (quickCreateOpen)    return <S_QuickCreate />
  if (dashboardOpen)      return <S_Dashboard />
  if (savedCustomersOpen) return <S_SavedCustomers />
  if (assistantOpen)      return <S_SalesAssistant />
  if (painDiscoveryOpen)  return <S_PainDiscovery />
  if (customerFormOpen)   return <S_CustomerForm />

  // Main screen routing
  if (mainScreen === 'roi')       return <ROIFlow />
  if (mainScreen === 'workspace') return <S_Workspace />
  return <S_Home />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
