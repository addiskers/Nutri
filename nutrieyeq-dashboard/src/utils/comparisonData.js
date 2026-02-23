// Mock comparison data for products
export const comparisonProducts = [
  {
    id: "1",
    productName: "NutriBoost Protein Powder",
    brand: "NutriBoost",
    variant: "Chocolate",
    packSize: "1kg",
    category: "Snacks",
    mrp: "₹2499",
    claimsOnPack: "High Protein, 24g Protein per Serve, No Added Sugar, Fortified with Vitamins",
    serveSize: "30g",
    variantDetails: "Rich chocolate flavor with real cocoa",
    vegNonVeg: "veg",
    nutrition: {
      "Energy (kcal)": { per100g: "350", perServe: "115", rda: "6%" },
      "Protein (g)": { per100g: "80", perServe: "24", rda: "48%" },
      "Carbohydrates (g)": { per100g: "8", perServe: "3.4", rda: "1%" },
      "Sugar (g)": { per100g: "2", perServe: "0.6", rda: "1%" },
      "Fat (g)": { per100g: "3", perServe: "0.9", rda: "1%" },
      "Saturated Fat (g)": { per100g: "1.5", perServe: "0.45", rda: "2%" },
      "Fiber (g)": { per100g: "2", perServe: "0.6", rda: "2%" },
      "Sodium (mg)": { per100g: "200", perServe: "60", rda: "3%" },
      "Calcium (mg)": { per100g: null, perServe: null, rda: null },
      "Iron (mg)": { per100g: null, perServe: null, rda: null }
    },
    ingredients: ["Whey Protein Concentrate", "Cocoa Powder", "Maltodextrin", "Natural Flavors", "Sucralose", "Vitamin Premix"],
    allergens: ["Milk", "Soy"],
    shelfLife: "18 months from manufacture",
    storageCondition: "Store in cool, dry place. Keep lid tightly closed.",
    brandOwner: "NutriBoost India Pvt Ltd",
    marketedBy: "NutriBoost India Pvt Ltd",
    manufacturedBy: "XYZ Manufacturing Unit, Hyderabad",
    packedBy: "XYZ Manufacturing Unit, Hyderabad"
  },
  {
    id: "2",
    productName: "FreshMilk Pro Dairy Drink",
    brand: "FreshMilk",
    variant: "Vanilla",
    packSize: "500ml",
    category: "Dairy",
    mrp: "₹89",
    claimsOnPack: "Rich in Calcium, Added Vitamin D & No Preservatives",
    serveSize: "200ml",
    variantDetails: "Smooth vanilla flavored milk",
    vegNonVeg: "veg",
    nutrition: {
      "Energy (kcal)": { per100g: "63", perServe: "130", rda: "7%" },
      "Protein (g)": { per100g: "3.5", perServe: "7", rda: "14%" },
      "Carbohydrates (g)": { per100g: "5", perServe: "10", rda: "3%" },
      "Sugar (g)": { per100g: "4.5", perServe: "9", rda: "10%" },
      "Fat (g)": { per100g: "3.5", perServe: "7", rda: "11%" },
      "Saturated Fat (g)": { per100g: "2.1", perServe: "4.6", rda: "23%" },
      "Fiber (g)": { per100g: null, perServe: null, rda: null },
      "Sodium (mg)": { per100g: null, perServe: null, rda: null },
      "Calcium (mg)": { per100g: "120", perServe: "240", rda: "24%" },
      "Iron (mg)": { per100g: null, perServe: null, rda: null }
    },
    ingredients: ["Toned Milk", "Sugar", "Natural Vanilla Extract", "Vitamin D3"],
    allergens: ["Milk"],
    shelfLife: "7 days from packaging",
    storageCondition: "Refrigerate at 4°C or below",
    brandOwner: "FreshMilk Dairy Ltd",
    marketedBy: "FreshMilk Dairy Ltd",
    manufacturedBy: "FreshMilk Processing Plant, Anand",
    packedBy: "FreshMilk Processing Plant, Anand"
  }
]

export const highlightLogic = {
  findBestValue: (field, products) => {
    // Logic to find best value for highlighting
    // Returns product IDs with best values
    const values = products.map(p => {
      const val = parseFloat(p[field]?.replace(/[^0-9.-]/g, ''))
      return { id: p.id, value: isNaN(val) ? null : val }
    }).filter(v => v.value !== null)

    if (values.length === 0) return []

    // For price, lower is better
    if (field === 'mrp') {
      const minValue = Math.min(...values.map(v => v.value))
      return values.filter(v => v.value === minValue).map(v => v.id)
    }

    // For protein, higher is better (example logic)
    const maxValue = Math.max(...values.map(v => v.value))
    return values.filter(v => v.value === maxValue).map(v => v.id)
  },

  getHighlightClass: (value, allValues, field) => {
    if (!value || value === 'Not specified') {
      return 'bg-gray-100 text-gray-500' // Not specified
    }

    // Check if this is the best value
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (isNaN(numericValue)) return ''

    const allNumeric = allValues
      .map(v => parseFloat(v?.replace(/[^0-9.-]/g, '')))
      .filter(v => !isNaN(v))

    if (allNumeric.length < 2) return ''

    const max = Math.max(...allNumeric)
    const min = Math.min(...allNumeric)

    // Best value highlighting
    if (field === 'mrp' && numericValue === min) {
      return 'bg-green-50 text-green-700' // Best price (lowest)
    }
    if (numericValue === max && field !== 'mrp') {
      return 'bg-green-50 text-green-700' // Best value (highest for nutrients)
    }

    // Check if different from others
    const allSame = allNumeric.every(v => v === allNumeric[0])
    if (!allSame && allNumeric.includes(numericValue)) {
      return 'bg-yellow-50 text-yellow-700' // Different from others
    }

    return ''
  }
}









