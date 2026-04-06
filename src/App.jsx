import { AppProvider, useApp } from './context/AppContext'
import S1_BusinessDetails from './screens/S1_BusinessDetails'
import S2_Problems        from './screens/S2_Problems'
import S3_COD             from './screens/S3_COD'
import S4_ROI             from './screens/S4_ROI'
import S5_Comparison      from './screens/S5_Comparison'
import S6_Intelligence    from './screens/S6_Intelligence'
import S7_Offer           from './screens/S7_Offer'

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
  const { screen } = useApp()
  const Screen = SCREENS[screen] ?? S7_Offer
  return <Screen key={screen} />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
