// Mock data structure for NutriEyeQ Dashboard

export const mockRecentProducts = [
  {
    id: "1",
    productName: "NutriBoost Protein Powder",
    category: "Health Supplements",
    mrp: "₹2499",
    uploadDate: "5th February 2026",
    packSize: "1kg",
    uploadedBy: "Aavya"
  },
  {
    id: "2",
    productName: "FreshMilk Pro Dairy Drink",
    category: "Dairy",
    mrp: "₹89",
    uploadDate: "5th February 2026",
    packSize: "500ml",
    uploadedBy: "Bhavika"
  },
  {
    id: "3",
    productName: "PowerBar Energy Bar",
    category: "Snacks",
    mrp: "₹75",
    uploadDate: "5th February 2026",
    packSize: "45g",
    uploadedBy: "Aditya"
  },
  {
    id: "4",
    productName: "KidVita Growth Drink",
    category: "Health Supplements",
    mrp: "₹450",
    uploadDate: "5th February 2026",
    packSize: "400g",
    uploadedBy: "Dev"
  },
  {
    id: "5",
    productName: "OrganicLife Muesli",
    category: "Cereals",
    mrp: "₹399",
    uploadDate: "5th February 2026",
    packSize: "500g",
    uploadedBy: "Atharv"
  },
  {
    id: "6",
    productName: "Dettol Instant Hand Sanitizer",
    category: "Personal Care",
    mrp: "₹200",
    uploadDate: "5th February 2026",
    packSize: "200ml",
    uploadedBy: "Vanya"
  },
  {
    id: "7",
    productName: "Dettol Original Germ Defence Instant ...",
    category: "Personal Care",
    mrp: "₹0",
    uploadDate: "5th February 2026",
    packSize: "Not specified",
    uploadedBy: "Nisha"
  }
]

// Extended product list for Products page (more rows for scrolling)
export const mockAllProducts = [
  ...mockRecentProducts,
  {
    id: "8",
    productName: "PowerBar Energy Bar",
    category: "Snacks",
    mrp: "₹75",
    uploadDate: "5th February 2026",
    packSize: "45g",
    uploadedBy: "Aditya"
  },
  {
    id: "9",
    productName: "KidVita Growth Drink",
    category: "Health Supplements",
    mrp: "₹450",
    uploadDate: "5th February 2026",
    packSize: "400g",
    uploadedBy: "Dev"
  },
  {
    id: "10",
    productName: "OrganicLife Muesli",
    category: "Cereals",
    mrp: "₹399",
    uploadDate: "5th February 2026",
    packSize: "500g",
    uploadedBy: "Atharv"
  },
  {
    id: "11",
    productName: "Dettol Instant Hand Sanitizer",
    category: "Personal Care",
    mrp: "₹200",
    uploadDate: "5th February 2026",
    packSize: "200ml",
    uploadedBy: "Vanya"
  }
]

export const mockDashboardStats = {
  totalProducts: 156,
  totalProductsChange: "+12% from last week",
  totalCategories: 12,
  comparisonsRun: 48,
  comparisonsChange: "+25% from last week",
  recentlyAdded: 8,
  recentlyAddedChange: "+8% from last week"
}

export const mockCategoryData = [
  { name: "Health Supplements", value: 35, color: "#2563eb" },
  { name: "Dairy", value: 15, color: "#10b981" },
  { name: "Snacks", value: 25, color: "#f59e0b" },
  { name: "Cereals", value: 20, color: "#ef4444" },
  { name: "Beverages", value: 18, color: "#8b5cf6" },
  { name: "Other", value: 43, color: "#6b7280" }
]

export const mockCategories = [
  "All Categories",
  "Health Supplements",
  "Dairy",
  "Snacks",
  "Cereals",
  "Beverages",
  "Personal Care",
  "Protein Powder",
  "Energy Drinks"
]

export const mockBrands = [
  "RiteBite",
  "MuscleBlaze",
  "Amul",
  "Nestle",
  "Patanjali",
  "Dettol",
  "Organic India"
]
