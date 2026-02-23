import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import ProductPreviewModal from '../components/Modals/ProductPreviewModal'
import DeleteConfirmModal from '../components/Modals/DeleteConfirmModal'
import { Package, FolderKanban, Clock, Eye, Edit2, Trash2, Loader } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { productService, categoryService, userService } from '../services/api'

const Dashboard = () => {
  const navigate = useNavigate()
  const [previewProduct, setPreviewProduct] = useState(null)
  const [deleteProduct, setDeleteProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
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
      // Fetch products, categories, and users in parallel
      const [productsResult, categoriesResult, usersResult] = await Promise.all([
        productService.getProducts({ limit: 1000 }),
        categoryService.getCategories({ limit: 100 }),
        userService.getUsers({ page_size: 100 }).catch(() => ({ users: [] })) // Graceful fallback if no permission
      ])

      const allProducts = productsResult.products || []
      const allCategories = categoriesResult.categories || []
      const allUsers = usersResult.users || []

      setProducts(allProducts)
      setCategories(allCategories)
      setUsers(allUsers)

      // Create user ID to name mapping
      const userIdMap = {}
      allUsers.forEach(user => {
        userIdMap[user.id] = user.name
      })
      setUserMap(userIdMap)

      // Calculate date 7 days ago
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Filter products from last 7 days for stats
      const last7DaysProducts = allProducts.filter(product => {
        const createdDate = new Date(product.created_at)
        return createdDate >= sevenDaysAgo
      })

      // Get 7 latest products (regardless of date) for table
      const sortedAllProducts = [...allProducts].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at)
      })
      const latest7Products = sortedAllProducts.slice(0, 7)

      setRecentProducts(latest7Products)

      // Calculate stats
      // Previous week products for comparison
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const previousWeekProducts = allProducts.filter(product => {
        const createdDate = new Date(product.created_at)
        return createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo
      })

      // Calculate percentage change for recently added
      const recentCount = last7DaysProducts.length
      const previousCount = previousWeekProducts.length
      const recentlyAddedPercentage = previousCount > 0 
        ? Math.round(((recentCount - previousCount) / previousCount) * 100)
        : (recentCount > 0 ? 100 : 0)

      // Calculate total products percentage (comparing current total with total from 7 days ago)
      const productsFrom7DaysAgo = allProducts.filter(product => {
        const createdDate = new Date(product.created_at)
        return createdDate < sevenDaysAgo
      }).length
      const totalProductsPercentage = productsFrom7DaysAgo > 0
        ? Math.round((last7DaysProducts.length / productsFrom7DaysAgo) * 100)
        : (last7DaysProducts.length > 0 ? 100 : 0)

      // Calculate categories added in last 7 days
      const last7DaysCategories = allCategories.filter(category => {
        const createdDate = new Date(category.created_at)
        return createdDate >= sevenDaysAgo
      })
      const categoriesFrom7DaysAgo = allCategories.length - last7DaysCategories.length
      const totalCategoriesPercentage = categoriesFrom7DaysAgo > 0
        ? Math.round((last7DaysCategories.length / categoriesFrom7DaysAgo) * 100)
        : (last7DaysCategories.length > 0 ? 100 : 0)

      setStats({
        totalProducts: allProducts.length,
        totalProductsChange: totalProductsPercentage > 0 ? `${totalProductsPercentage}%` : null,
        totalCategories: allCategories.length,
        totalCategoriesChange: totalCategoriesPercentage > 0 ? `${totalCategoriesPercentage}%` : null,
        recentlyAdded: last7DaysProducts.length,
        recentlyAddedChange: recentlyAddedPercentage > 0 ? `${recentlyAddedPercentage}%` : null,
        comparisons: 0 // Placeholder for now
      })

      // Calculate products by category for pie chart
      // Use categories from backend and count products in each
      const categoryColors = [
        '#2463eb', // Blue
        '#16a249', // Green
        '#f59e0b', // Orange
        '#ef4444', // Red
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#14b8a6', // Teal
        '#f97316', // Deep Orange
      ]

      const chartData = allCategories.map((category, index) => {
        // Count products in this category
        const productCount = allProducts.filter(
          product => product.category === category.name
        ).length

        return {
          name: category.name,
          value: productCount,
          color: categoryColors[index % categoryColors.length]
        }
      }).filter(item => item.value > 0) // Only show categories with products

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
            <div
              className="w-3.5 h-3.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                  <tr>
                    <th className="px-4 py-4 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Product Name
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Category
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        MRP
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center hidden md:table-cell">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Upload Date
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center hidden lg:table-cell">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Pack Size
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center hidden xl:table-cell">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">
                        Mfg Date
                      </span>
                    </th>
                    <th className="px-4 py-4 text-center hidden xl:table-cell">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">
                        Expiry Date
                      </span>
                    </th>
                    <th className="px-4 py-4 text-right">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    // Loading rows
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="border-b border-[#e1e7ef]">
                        <td className="px-4 py-4" colSpan="7">
                          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : recentProducts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center">
                        <p className="text-sm font-ibm-plex text-[#65758b]">
                          No products available
                        </p>
                      </td>
                    </tr>
                  ) : (
                    recentProducts.map((product, index) => (
                      <tr
                        key={product.id}
                        className={`border-b border-[#e1e7ef] hover:bg-gray-50 transition-colors ${
                          index % 2 === 1 ? 'bg-[#f9fafb]' : ''
                        }`}
                      >
                        <td className="px-4 py-4">
                          <p className="text-sm font-ibm-plex font-medium text-[#0f1729] line-clamp-2">
                            {product.product_name || 'Unnamed Product'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.category || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            {product.mrp ? `₹${product.mrp}` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden md:table-cell">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {formatDate(product.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.pack_size || product.net_weight || 'Not specified'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden xl:table-cell">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.manufacturing_date || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center hidden xl:table-cell">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.expiry_date || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewProduct(product)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => navigate(`/edit-product/${product.id}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => setDeleteProduct(product)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-[#65758b]" />
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
