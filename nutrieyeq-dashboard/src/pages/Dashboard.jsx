import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import ProductPreviewModal from '../components/Modals/ProductPreviewModal'
import ProductDetailModal from '../components/Modals/ProductDetailModal'
import DeleteConfirmModal from '../components/Modals/DeleteConfirmModal'
import { Package, FolderKanban, Clock, Eye, Edit2, Trash2, Loader, ImageIcon } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { productService, categoryService, userService } from '../services/api'

// Apply background-color via Element.style API (CSP-safe — script-set styles
// are not blocked by `style-src` directives that omit 'unsafe-inline').
const ColorSwatch = ({ color }) => {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color
  }, [color])
  return <div ref={ref} className="w-3.5 h-3.5 rounded-sm" />
}

const formatMrp = (mrp) => {
  if (!mrp || mrp === '0' || mrp === '0.0' || mrp === 0 || mrp === 0.0) return '—'
  const str = String(mrp)
  if (str.includes('₹') || str.includes('Rs')) {
    const match = str.match(/[\d,]+\.?\d*/)
    if (match) return `₹${match[0]}`
    return str
  }
  const num = parseFloat(str)
  if (!isNaN(num) && num > 0) return `₹${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`
  return '—'
}

const Dashboard = () => {
  const navigate = useNavigate()
  const [previewProduct, setPreviewProduct] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)
  const [deleteProduct, setDeleteProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [userMap, setUserMap] = useState({})
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    recentlyAdded: 0
  })
  const [categoryChartData, setCategoryChartData] = useState([])
  const [recentProducts, setRecentProducts] = useState([])

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsResult, categoriesResult, usersResult] = await Promise.all([
        productService.getDashboardStats(),
        categoryService.getCategories({ limit: 100 }),
        userService.getUsers({ page_size: 100 }).catch(() => ({ users: [] }))
      ])

      const allCategories = categoriesResult.categories || []
      const allUsers = usersResult.users || []

      setCategories(allCategories)
      setUsers(allUsers)

      const userIdMap = {}
      allUsers.forEach(user => { userIdMap[user.id] = user.name })
      setUserMap(userIdMap)

      setRecentProducts(statsResult.recent_products || [])

      // Percentage changes
      const recentCount  = statsResult.products_last_7_days
      const prevCount    = statsResult.products_prev_7_days
      const olderCount   = statsResult.total_products - recentCount
      const recentlyAddedPercentage   = prevCount > 0 ? Math.round(((recentCount - prevCount) / prevCount) * 100) : (recentCount > 0 ? 100 : 0)
      const totalProductsPercentage   = olderCount > 0 ? Math.round((recentCount / olderCount) * 100) : (recentCount > 0 ? 100 : 0)

      const last7DaysCategories = allCategories.filter(c => new Date(c.created_at) >= new Date(Date.now() - 7 * 86400000))
      const categoriesFrom7DaysAgo = allCategories.length - last7DaysCategories.length
      const totalCategoriesPercentage = categoriesFrom7DaysAgo > 0 ? Math.round((last7DaysCategories.length / categoriesFrom7DaysAgo) * 100) : (last7DaysCategories.length > 0 ? 100 : 0)

      setStats({
        totalProducts:          statsResult.total_products,
        totalProductsChange:    totalProductsPercentage > 0 ? `${totalProductsPercentage}%` : null,
        totalCategories:        allCategories.length,
        totalCategoriesChange:  totalCategoriesPercentage > 0 ? `${totalCategoriesPercentage}%` : null,
        recentlyAdded:          recentCount,
        recentlyAddedChange:    recentlyAddedPercentage > 0 ? `${recentlyAddedPercentage}%` : null,
      })

      // Pie chart from server-side category breakdown
      const categoryColors = ['#2463eb', '#16a249', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
      const breakdown = statsResult.category_breakdown || {}
      const chartData = Object.entries(breakdown)
        .filter(([, count]) => count > 0)
        .map(([name, count], index) => ({
          name,
          value: count,
          color: categoryColors[index % categoryColors.length],
        }))
      setCategoryChartData(chartData)

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return

    try {
      const result = await productService.deleteProduct(deleteProduct.id)
      
      if (result.success) {
        const productName = deleteProduct.product_name || 'Product'
        alert(`Product "${productName}" deleted successfully!`)
        setDeleteProduct(null)
        // Refresh dashboard data
        await fetchDashboardData()
      } else {
        alert(`Failed to delete product: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product. Please try again.')
    }
  }

  const handlePreviewProduct = async (product) => {
    try {
      const fullProductData = await productService.getProduct(product.id)
      if (fullProductData) {
        setPreviewProduct({
          productName: product.product_name,
          rawData: fullProductData,
          images: fullProductData.images || []
        })
      } else {
        setPreviewProduct({ productName: product.product_name, rawData: product, images: [] })
      }
    } catch (error) {
      console.error('Failed to fetch product details:', error)
      setPreviewProduct({ productName: product.product_name, rawData: product, images: [] })
    }
  }

  const handleDetailProduct = async (product) => {
    try {
      const fullProductData = await productService.getProduct(product.id)
      setDetailProduct({
        productName: product.product_name,
        rawData: fullProductData,
      })
    } catch (error) {
      console.error('Failed to fetch product details:', error)
      setDetailProduct({ productName: product.product_name, rawData: product })
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const statsCards = [
    {
      icon: Package,
      label: 'Total Products',
      value: stats.totalProducts,
      change: stats.totalProductsChange,
      color: 'bg-blue-100',
      iconColor: 'text-[#2463eb]'
    },
    {
      icon: FolderKanban,
      label: 'Total Categories',
      value: stats.totalCategories,
      change: stats.totalCategoriesChange,
      color: 'bg-green-100',
      iconColor: 'text-[#16a249]'
    },
    {
      icon: Clock,
      label: 'Recently Added',
      value: stats.recentlyAdded,
      subtitle: '(Last 7 days)',
      change: stats.recentlyAddedChange,
      color: 'bg-orange-100',
      iconColor: 'text-[#f59e0b]'
    }
  ]

  const COLORS = categoryChartData.map(cat => cat.color)

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 25 // Position outside the circle
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="#0f1729"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-bold font-ibm-plex"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-4">
        {payload.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <ColorSwatch color={entry.color} />
            <span className="text-sm font-ibm-plex text-[#0f1729]">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
            Dashboard
          </h1>
          <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
            Overview of your product NutriEyeQ activities
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {loading ? (
            // Loading skeleton
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#e1e7ef] rounded-lg p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))
          ) : (
            statsCards.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div
                  key={index}
                  className="bg-white border border-[#e1e7ef] rounded-lg p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-ibm-plex font-medium text-[#65758b] mb-2">
                        {stat.label} {stat.subtitle && <span className="text-xs">{stat.subtitle}</span>}
                      </p>
                      <p className="text-3xl font-ibm-plex font-bold text-[#0f1729] mb-2">
                        {stat.value}
                      </p>
                      {stat.change && (
                        <p className="text-sm font-ibm-plex font-medium text-[#16a249]">
                          ↑ {stat.change}
                        </p>
                      )}
                    </div>
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Products Table */}
          <div className="lg:col-span-2 bg-white border border-[#e1e7ef] rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e1e7ef]">
              <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">Recent Products</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#f8fafc]">
                  <tr className="border-b border-[#e1e7ef]">
                    <th className="px-5 py-3 text-left">
                      <span className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">
                        Product
                      </span>
                    </th>
                    <th className="px-3 py-3 text-right w-24">
                      <span className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">
                        MRP
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center hidden md:table-cell w-28">
                      <span className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">
                        Pack Size
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center hidden lg:table-cell w-28">
                      <span className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">
                        Expiry
                      </span>
                    </th>
                    <th className="px-3 py-3 text-right w-32">
                      <span className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="border-b border-[#f1f5f9]">
                        <td className="px-5 py-3.5" colSpan="5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : recentProducts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-10 text-center">
                        <p className="text-sm font-ibm-plex text-[#65758b]">
                          No products available
                        </p>
                      </td>
                    </tr>
                  ) : (
                    recentProducts.map((product, index) => (
                      <tr
                        key={product.id}
                        className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-ibm-plex font-semibold text-[#0f1729] truncate max-w-[220px]" title={product.product_name}>
                            {product.product_name || 'Unnamed Product'}
                          </p>
                          <p className="text-xs font-ibm-plex text-[#65758b] mt-0.5">
                            {product.parent_brand || ''}{product.category ? ` · ${product.category}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729] whitespace-nowrap">
                            {formatMrp(product.mrp)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center hidden md:table-cell">
                          <span className="text-xs font-ibm-plex text-[#65758b] truncate block max-w-[110px] mx-auto" title={product.pack_size || product.net_weight || ''}>
                            {product.pack_size || product.net_weight || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center hidden lg:table-cell">
                          <span className={`text-xs font-ibm-plex whitespace-nowrap ${
                            product.expiry_date && product.expiry_date !== 'Not Specified'
                              ? 'text-[#65758b]'
                              : 'text-[#c0c7d1]'
                          }`}>
                            {product.expiry_date && product.expiry_date !== 'Not Specified' ? product.expiry_date : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handlePreviewProduct(product)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e1e7ef] transition-colors"
                              title="View Images"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => handleDetailProduct(product)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e1e7ef] transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#2463eb]" />
                            </button>
                            <button
                              onClick={() => navigate(`/edit-product/${product.id}`)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e1e7ef] transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => setDeleteProduct(product)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Products by Category Chart */}
          <div className="bg-white border border-[#e1e7ef] rounded-lg p-6 shadow-sm flex flex-col">
            <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4">
              Products by Category
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center flex-1 py-12">
                <Loader className="w-8 h-8 text-[#b455a0] animate-spin" />
              </div>
            ) : categoryChartData.length === 0 ? (
              <div className="flex items-center justify-center flex-1 py-12">
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  No product data available
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="45%"
                      labelLine={{
                        stroke: '#d1d5db',
                        strokeWidth: 1
                      }}
                      label={renderCustomizedLabel}
                      outerRadius={90}
                      innerRadius={55}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Custom Legend */}
                <div className="mt-4">
                  <CustomLegend payload={categoryChartData.map((entry) => ({
                    value: `${entry.name} (${entry.value})`,
                    color: entry.color
                  }))} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductPreviewModal
        product={previewProduct}
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
      />

      <ProductDetailModal
        product={detailProduct}
        isOpen={!!detailProduct}
        onClose={() => setDetailProduct(null)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDeleteProduct}
        itemName={deleteProduct?.product_name || 'this product'}
        itemType="product"
      />
    </Layout>
  )
}

export default Dashboard
