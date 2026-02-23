import Layout from '../components/Layout/Layout'
import ComingSoon from '../components/ComingSoon'
import { FolderKanban } from 'lucide-react'

const Categories = () => {
  return (
    <Layout>
      <ComingSoon
        title="Categories"
        description="Manage product categories and classifications. Create, edit, and organize categories to help structure your product database."
        icon={FolderKanban}
      />
    </Layout>
  )
}

export default Categories








