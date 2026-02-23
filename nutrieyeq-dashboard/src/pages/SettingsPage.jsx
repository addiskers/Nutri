import Layout from '../components/Layout/Layout'
import ComingSoon from '../components/ComingSoon'
import { Settings } from 'lucide-react'

const SettingsPage = () => {
  return (
    <Layout>
      <ComingSoon
        title="Settings"
        description="Configure platform preferences, manage your account, notification settings, and customize your NutriEyeQ dashboard experience."
        icon={Settings}
      />
    </Layout>
  )
}

export default SettingsPage








