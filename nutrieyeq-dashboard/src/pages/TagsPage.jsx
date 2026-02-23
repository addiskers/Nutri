import Layout from '../components/Layout/Layout'
import ComingSoon from '../components/ComingSoon'
import { Tags } from 'lucide-react'

const TagsPage = () => {
  return (
    <Layout>
      <ComingSoon
        title="Tags"
        description="Create and manage product tags for better organization and filtering. Add custom tags like 'Organic', 'Sugar Free', 'High Protein', etc."
        icon={Tags}
      />
    </Layout>
  )
}

export default TagsPage








