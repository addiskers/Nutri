import { useState, useEffect } from 'react'

import Layout from '../components/Layout/Layout'

import { Plus, Trash2, Loader2, Search, AlertCircle, Beaker, Download, X, ChevronDown } from 'lucide-react'

import { coaService, formulationService } from '../services/api'

import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'



const Formulation = () => {

  // COA list for ingredient selection

  const [coaList, setCOAList] = useState([])

  const [isLoadingCOAs, setIsLoadingCOAs] = useState(true)

  

  // Formulation ingredients

  const [ingredients, setIngredients] = useState([])

  const [nextId, setNextId] = useState(1)

  

  // Per-cell value type selection: { 'ingredientId-nutrientName': 'actual'|'min'|'max'|'average'|'custom' }
  const [nutrientSelections, setNutrientSelections] = useState({})
  // Custom values entered by user: { 'ingredientId-nutrientName': number }
  const [customValues, setCustomValues] = useState({})
  // Which dropdown is currently open: 'ingredientId-nutrientName' or null
  const [openDropdown, setOpenDropdown] = useState(null)

  // Search state

  const [searchTerm, setSearchTerm] = useState('')

  

  // RDA Export Modal

  const [showRDAModal, setShowRDAModal] = useState(false)

  const [selectedRDACategories, setSelectedRDACategories] = useState([])
  const [serveSize, setServeSize] = useState(55)
  const [serveSizeUnit, setServeSizeUnit] = useState('g')

  // Save Formulation Modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [formulationName, setFormulationName] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Tab management
  const [activeTab, setActiveTab] = useState('formula') // 'formula' | 'saved'
  const [savedFormulations, setSavedFormulations] = useState([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  

  // RDA Categories available

  const rdaCategories = [

    'Infant [0-6 Mo.]',

    'Infant [7-12 Mo.]',

    'Children [1-3 Yrs.]',

    'Children [4-6 Yrs.]',

    'Children [7-9 Yrs.]',

    '10-12 Yrs. [Boys]',

    '10-12 Yrs. [Girls]',

    '13-15 Yrs. [Boys]',

    '13-15 Yrs. [Girls]',

    '16-18 Yrs. [Boys]',

    '16-18 Yrs. [Girls]',

    'Male [Sedentary]',

    'Female [Sedentary]',

    'Female [Pregnant]',

    'Female [Lactating]'

  ]

  

  // RDA 2020 - ICMR NIN (full table)
  const rdaData = {
    'Energy': {
      'Children [1-3 Yrs.]': 2000, 'Children [4-6 Yrs.]': 2000, 'Children [7-9 Yrs.]': 2000,
      '10-12 Yrs. [Boys]': 2000, '10-12 Yrs. [Girls]': 2000, '13-15 Yrs. [Boys]': 2000, '13-15 Yrs. [Girls]': 2000,
      '16-18 Yrs. [Boys]': 2000, '16-18 Yrs. [Girls]': 2000, 'Male [Sedentary]': 2000, 'Female [Sedentary]': 2000,
      'Female [Pregnant]': 2000, 'Female [Lactating]': 2000,
    },
    'Protein': {
      'Infant [0-6 Mo.]': 8, 'Infant [7-12 Mo.]': 10.5, 'Children [1-3 Yrs.]': 12.5, 'Children [4-6 Yrs.]': 16,
      'Children [7-9 Yrs.]': 23, '10-12 Yrs. [Boys]': 32, '10-12 Yrs. [Girls]': 33,
      '13-15 Yrs. [Boys]': 45, '13-15 Yrs. [Girls]': 43, '16-18 Yrs. [Boys]': 55, '16-18 Yrs. [Girls]': 46,
      'Male [Sedentary]': 54, 'Female [Sedentary]': 46, 'Female [Pregnant]': 55, 'Female [Lactating]': 63,
    },
    'Added sugars': {
      'Children [1-3 Yrs.]': 50, 'Children [4-6 Yrs.]': 50, 'Children [7-9 Yrs.]': 50,
      '10-12 Yrs. [Boys]': 50, '10-12 Yrs. [Girls]': 50, '13-15 Yrs. [Boys]': 50, '13-15 Yrs. [Girls]': 50,
      '16-18 Yrs. [Boys]': 50, '16-18 Yrs. [Girls]': 50, 'Male [Sedentary]': 50, 'Female [Sedentary]': 50,
    },
    'Dietary Fiber': {
      'Children [1-3 Yrs.]': 15, 'Children [4-6 Yrs.]': 20, 'Children [7-9 Yrs.]': 26,
      '10-12 Yrs. [Boys]': 33, '10-12 Yrs. [Girls]': 30, '13-15 Yrs. [Boys]': 43, '13-15 Yrs. [Girls]': 36,
      '16-18 Yrs. [Boys]': 50, '16-18 Yrs. [Girls]': 38, 'Male [Sedentary]': 30, 'Female [Sedentary]': 25,
    },
    'Total fat': {
      'Children [1-3 Yrs.]': 67, 'Children [4-6 Yrs.]': 67, 'Children [7-9 Yrs.]': 67,
      '10-12 Yrs. [Boys]': 67, '10-12 Yrs. [Girls]': 67, '13-15 Yrs. [Boys]': 67, '13-15 Yrs. [Girls]': 67,
      '16-18 Yrs. [Boys]': 67, '16-18 Yrs. [Girls]': 67, 'Male [Sedentary]': 67, 'Female [Sedentary]': 67,
    },
    'Total Fat': {
      'Children [1-3 Yrs.]': 67, 'Children [4-6 Yrs.]': 67, 'Children [7-9 Yrs.]': 67,
      '10-12 Yrs. [Boys]': 67, '10-12 Yrs. [Girls]': 67, '13-15 Yrs. [Boys]': 67, '13-15 Yrs. [Girls]': 67,
      '16-18 Yrs. [Boys]': 67, '16-18 Yrs. [Girls]': 67, 'Male [Sedentary]': 67, 'Female [Sedentary]': 67,
    },
    'Saturated Fat': {
      'Children [1-3 Yrs.]': 22, 'Children [4-6 Yrs.]': 22, 'Children [7-9 Yrs.]': 22,
      '10-12 Yrs. [Boys]': 22, '10-12 Yrs. [Girls]': 22, '13-15 Yrs. [Boys]': 22, '13-15 Yrs. [Girls]': 22,
      '16-18 Yrs. [Boys]': 22, '16-18 Yrs. [Girls]': 22, 'Male [Sedentary]': 22, 'Female [Sedentary]': 22,
    },
    'Trans Fat': {
      'Children [1-3 Yrs.]': 2, 'Children [4-6 Yrs.]': 2, 'Children [7-9 Yrs.]': 2,
      '10-12 Yrs. [Boys]': 2, '10-12 Yrs. [Girls]': 2, '13-15 Yrs. [Boys]': 2, '13-15 Yrs. [Girls]': 2,
      '16-18 Yrs. [Boys]': 2, '16-18 Yrs. [Girls]': 2, 'Male [Sedentary]': 2, 'Female [Sedentary]': 2,
    },
    'Trans Fa': {
      'Children [1-3 Yrs.]': 2, 'Children [4-6 Yrs.]': 2, 'Children [7-9 Yrs.]': 2,
      '10-12 Yrs. [Boys]': 2, '10-12 Yrs. [Girls]': 2, '13-15 Yrs. [Boys]': 2, '13-15 Yrs. [Girls]': 2,
      '16-18 Yrs. [Boys]': 2, '16-18 Yrs. [Girls]': 2, 'Male [Sedentary]': 2, 'Female [Sedentary]': 2,
    },
    'Vitamin A': {
      'Infant [0-6 Mo.]': 350, 'Infant [7-12 Mo.]': 350, 'Children [1-3 Yrs.]': 390, 'Children [4-6 Yrs.]': 510,
      'Children [7-9 Yrs.]': 630, '10-12 Yrs. [Boys]': 770, '10-12 Yrs. [Girls]': 790,
      '13-15 Yrs. [Boys]': 930, '13-15 Yrs. [Girls]': 890, '16-18 Yrs. [Boys]': 1000, '16-18 Yrs. [Girls]': 860,
      'Male [Sedentary]': 1000, 'Female [Sedentary]': 840, 'Female [Pregnant]': 900, 'Female [Lactating]': 950,
    },
    'Vitamin D2': {
      'Infant [0-6 Mo.]': 10, 'Infant [7-12 Mo.]': 10, 'Children [1-3 Yrs.]': 15, 'Children [4-6 Yrs.]': 15,
      'Children [7-9 Yrs.]': 15, '10-12 Yrs. [Boys]': 15, '10-12 Yrs. [Girls]': 15,
      '13-15 Yrs. [Boys]': 15, '13-15 Yrs. [Girls]': 15, '16-18 Yrs. [Boys]': 15, '16-18 Yrs. [Girls]': 15,
      'Male [Sedentary]': 15, 'Female [Sedentary]': 15, 'Female [Pregnant]': 15, 'Female [Lactating]': 15,
    },
    'Vitamin E': {
      'Infant [0-6 Mo.]': 7.5, 'Infant [7-12 Mo.]': 7.5, 'Children [1-3 Yrs.]': 7.5, 'Children [4-6 Yrs.]': 7.5,
      'Children [7-9 Yrs.]': 7.5, '10-12 Yrs. [Boys]': 7.5, '10-12 Yrs. [Girls]': 7.5,
      '13-15 Yrs. [Boys]': 7.5, '13-15 Yrs. [Girls]': 7.5, '16-18 Yrs. [Boys]': 7.5, '16-18 Yrs. [Girls]': 7.5,
      'Male [Sedentary]': 7.5, 'Female [Sedentary]': 7.5, 'Female [Pregnant]': 7.5, 'Female [Lactating]': 7.5,
    },
    'Vitamin C': {
      'Infant [0-6 Mo.]': 20, 'Infant [7-12 Mo.]': 30, 'Children [1-3 Yrs.]': 30, 'Children [4-6 Yrs.]': 35,
      'Children [7-9 Yrs.]': 45, '10-12 Yrs. [Boys]': 55, '10-12 Yrs. [Girls]': 50,
      '13-15 Yrs. [Boys]': 70, '13-15 Yrs. [Girls]': 65, '16-18 Yrs. [Boys]': 85, '16-18 Yrs. [Girls]': 70,
      'Male [Sedentary]': 80, 'Female [Sedentary]': 65, 'Female [Pregnant]': 80, 'Female [Lactating]': 115,
    },
    'Vitamin K': {
      'Infant [0-6 Mo.]': 55, 'Infant [7-12 Mo.]': 55, 'Children [1-3 Yrs.]': 55, 'Children [4-6 Yrs.]': 55,
      'Children [7-9 Yrs.]': 55, '10-12 Yrs. [Boys]': 55, '10-12 Yrs. [Girls]': 55,
      '13-15 Yrs. [Boys]': 55, '13-15 Yrs. [Girls]': 55, '16-18 Yrs. [Boys]': 55, '16-18 Yrs. [Girls]': 55,
      'Male [Sedentary]': 55, 'Female [Sedentary]': 55, 'Female [Pregnant]': 55, 'Female [Lactating]': 55,
    },
    'Vitamin B1': {
      'Infant [0-6 Mo.]': 0.2, 'Infant [7-12 Mo.]': 0.4, 'Children [1-3 Yrs.]': 0.7, 'Children [4-6 Yrs.]': 0.9,
      'Children [7-9 Yrs.]': 1.1, '10-12 Yrs. [Boys]': 1.5, '10-12 Yrs. [Girls]': 1.4,
      '13-15 Yrs. [Boys]': 1.9, '13-15 Yrs. [Girls]': 1.6, '16-18 Yrs. [Boys]': 2.2, '16-18 Yrs. [Girls]': 1.7,
      'Male [Sedentary]': 1.4, 'Female [Sedentary]': 1.4, 'Female [Pregnant]': 2, 'Female [Lactating]': 2.1,
    },
    'Thiamine': {
      'Infant [0-6 Mo.]': 0.2, 'Infant [7-12 Mo.]': 0.4, 'Children [1-3 Yrs.]': 0.7, 'Children [4-6 Yrs.]': 0.9,
      'Children [7-9 Yrs.]': 1.1, '10-12 Yrs. [Boys]': 1.5, '10-12 Yrs. [Girls]': 1.4,
      '13-15 Yrs. [Boys]': 1.9, '13-15 Yrs. [Girls]': 1.6, '16-18 Yrs. [Boys]': 2.2, '16-18 Yrs. [Girls]': 1.7,
      'Male [Sedentary]': 1.4, 'Female [Sedentary]': 1.4, 'Female [Pregnant]': 2, 'Female [Lactating]': 2.1,
    },
    'Vitamin B2': {
      'Infant [0-6 Mo.]': 0.4, 'Infant [7-12 Mo.]': 0.6, 'Children [1-3 Yrs.]': 1.1, 'Children [4-6 Yrs.]': 1.3,
      'Children [7-9 Yrs.]': 1.6, '10-12 Yrs. [Boys]': 2.1, '10-12 Yrs. [Girls]': 1.9,
      '13-15 Yrs. [Boys]': 2.7, '13-15 Yrs. [Girls]': 2.2, '16-18 Yrs. [Boys]': 3.1, '16-18 Yrs. [Girls]': 2.3,
      'Male [Sedentary]': 2, 'Female [Sedentary]': 1.9, 'Female [Pregnant]': 2.7, 'Female [Lactating]': 3,
    },
    'Riboflavin': {
      'Infant [0-6 Mo.]': 0.4, 'Infant [7-12 Mo.]': 0.6, 'Children [1-3 Yrs.]': 1.1, 'Children [4-6 Yrs.]': 1.3,
      'Children [7-9 Yrs.]': 1.6, '10-12 Yrs. [Boys]': 2.1, '10-12 Yrs. [Girls]': 1.9,
      '13-15 Yrs. [Boys]': 2.7, '13-15 Yrs. [Girls]': 2.2, '16-18 Yrs. [Boys]': 3.1, '16-18 Yrs. [Girls]': 2.3,
      'Male [Sedentary]': 2, 'Female [Sedentary]': 1.9, 'Female [Pregnant]': 2.7, 'Female [Lactating]': 3,
    },
    'Vitamin B3': {
      'Infant [0-6 Mo.]': 2, 'Infant [7-12 Mo.]': 5, 'Children [1-3 Yrs.]': 7, 'Children [4-6 Yrs.]': 9,
      'Children [7-9 Yrs.]': 11, '10-12 Yrs. [Boys]': 15, '10-12 Yrs. [Girls]': 14,
      '13-15 Yrs. [Boys]': 19, '13-15 Yrs. [Girls]': 16, '16-18 Yrs. [Boys]': 22, '16-18 Yrs. [Girls]': 17,
      'Male [Sedentary]': 14, 'Female [Sedentary]': 11, 'Female [Pregnant]': 13, 'Female [Lactating]': 16,
    },
    'Niacin': {
      'Infant [0-6 Mo.]': 2, 'Infant [7-12 Mo.]': 5, 'Children [1-3 Yrs.]': 7, 'Children [4-6 Yrs.]': 9,
      'Children [7-9 Yrs.]': 11, '10-12 Yrs. [Boys]': 15, '10-12 Yrs. [Girls]': 14,
      '13-15 Yrs. [Boys]': 19, '13-15 Yrs. [Girls]': 16, '16-18 Yrs. [Boys]': 22, '16-18 Yrs. [Girls]': 17,
      'Male [Sedentary]': 14, 'Female [Sedentary]': 11, 'Female [Pregnant]': 13, 'Female [Lactating]': 16,
    },
    'Vitamin B5': {
      'Children [1-3 Yrs.]': 4, 'Children [4-6 Yrs.]': 4, 'Children [7-9 Yrs.]': 4,
      '10-12 Yrs. [Boys]': 5, '10-12 Yrs. [Girls]': 5, '13-15 Yrs. [Boys]': 5, '13-15 Yrs. [Girls]': 5,
      '16-18 Yrs. [Boys]': 5, '16-18 Yrs. [Girls]': 5, 'Male [Sedentary]': 5, 'Female [Sedentary]': 5,
      'Female [Pregnant]': 5, 'Female [Lactating]': 7,
    },
    'Calcium Pantothenate': {
      'Children [1-3 Yrs.]': 4, 'Children [4-6 Yrs.]': 4, 'Children [7-9 Yrs.]': 4,
      '10-12 Yrs. [Boys]': 5, '10-12 Yrs. [Girls]': 5, '13-15 Yrs. [Boys]': 5, '13-15 Yrs. [Girls]': 5,
      '16-18 Yrs. [Boys]': 5, '16-18 Yrs. [Girls]': 5, 'Male [Sedentary]': 5, 'Female [Sedentary]': 5,
      'Female [Pregnant]': 5, 'Female [Lactating]': 7,
    },
    'Vitamin B6': {
      'Infant [0-6 Mo.]': 0.1, 'Infant [7-12 Mo.]': 0.6, 'Children [1-3 Yrs.]': 0.9, 'Children [4-6 Yrs.]': 1.2,
      'Children [7-9 Yrs.]': 1.5, '10-12 Yrs. [Boys]': 2, '10-12 Yrs. [Girls]': 1.9,
      '13-15 Yrs. [Boys]': 2.6, '13-15 Yrs. [Girls]': 2.2, '16-18 Yrs. [Boys]': 3, '16-18 Yrs. [Girls]': 2.3,
      'Male [Sedentary]': 1.9, 'Female [Sedentary]': 1.9, 'Female [Pregnant]': 2.3, 'Female [Lactating]': 2.16,
    },
    'Pyridoxine': {
      'Infant [0-6 Mo.]': 0.1, 'Infant [7-12 Mo.]': 0.6, 'Children [1-3 Yrs.]': 0.9, 'Children [4-6 Yrs.]': 1.2,
      'Children [7-9 Yrs.]': 1.5, '10-12 Yrs. [Boys]': 2, '10-12 Yrs. [Girls]': 1.9,
      '13-15 Yrs. [Boys]': 2.6, '13-15 Yrs. [Girls]': 2.2, '16-18 Yrs. [Boys]': 3, '16-18 Yrs. [Girls]': 2.3,
      'Male [Sedentary]': 1.9, 'Female [Sedentary]': 1.9, 'Female [Pregnant]': 2.3, 'Female [Lactating]': 2.16,
    },
    'Vitamin B9': {
      'Infant [0-6 Mo.]': 14.7, 'Infant [7-12 Mo.]': 50, 'Children [1-3 Yrs.]': 70.6, 'Children [4-6 Yrs.]': 79.4,
      'Children [7-9 Yrs.]': 100, '10-12 Yrs. [Boys]': 129.4, '10-12 Yrs. [Girls]': 132.4,
      '13-15 Yrs. [Boys]': 167.6, '13-15 Yrs. [Girls]': 144.1, '16-18 Yrs. [Boys]': 200, '16-18 Yrs. [Girls]': 158.8,
      'Male [Sedentary]': 176.5, 'Female [Sedentary]': 129.4, 'Female [Pregnant]': 335.3, 'Female [Lactating]': 194.1,
    },
    'Folic Acid': {
      'Infant [0-6 Mo.]': 14.7, 'Infant [7-12 Mo.]': 50, 'Children [1-3 Yrs.]': 70.6, 'Children [4-6 Yrs.]': 79.4,
      'Children [7-9 Yrs.]': 100, '10-12 Yrs. [Boys]': 129.4, '10-12 Yrs. [Girls]': 132.4,
      '13-15 Yrs. [Boys]': 167.6, '13-15 Yrs. [Girls]': 144.1, '16-18 Yrs. [Boys]': 200, '16-18 Yrs. [Girls]': 158.8,
      'Male [Sedentary]': 176.5, 'Female [Sedentary]': 129.4, 'Female [Pregnant]': 335.3, 'Female [Lactating]': 194.1,
    },
    'Folate': {
      'Infant [0-6 Mo.]': 14.7, 'Infant [7-12 Mo.]': 50, 'Children [1-3 Yrs.]': 70.6, 'Children [4-6 Yrs.]': 79.4,
      'Children [7-9 Yrs.]': 100, '10-12 Yrs. [Boys]': 129.4, '10-12 Yrs. [Girls]': 132.4,
      '13-15 Yrs. [Boys]': 167.6, '13-15 Yrs. [Girls]': 144.1, '16-18 Yrs. [Boys]': 200, '16-18 Yrs. [Girls]': 158.8,
      'Male [Sedentary]': 176.5, 'Female [Sedentary]': 129.4, 'Female [Pregnant]': 335.3, 'Female [Lactating]': 194.1,
    },
    'Vitamin B7': {
      'Children [1-3 Yrs.]': 20, 'Children [4-6 Yrs.]': 25, 'Children [7-9 Yrs.]': 25,
      '10-12 Yrs. [Boys]': 35, '10-12 Yrs. [Girls]': 35, '13-15 Yrs. [Boys]': 35, '13-15 Yrs. [Girls]': 35,
      '16-18 Yrs. [Boys]': 35, '16-18 Yrs. [Girls]': 35, 'Male [Sedentary]': 40, 'Female [Sedentary]': 40,
      'Female [Pregnant]': 40, 'Female [Lactating]': 45,
    },
    'Biotin': {
      'Children [1-3 Yrs.]': 20, 'Children [4-6 Yrs.]': 25, 'Children [7-9 Yrs.]': 25,
      '10-12 Yrs. [Boys]': 35, '10-12 Yrs. [Girls]': 35, '13-15 Yrs. [Boys]': 35, '13-15 Yrs. [Girls]': 35,
      '16-18 Yrs. [Boys]': 35, '16-18 Yrs. [Girls]': 35, 'Male [Sedentary]': 40, 'Female [Sedentary]': 40,
      'Female [Pregnant]': 40, 'Female [Lactating]': 45,
    },
    'Vitamin B12': {
      'Children [1-3 Yrs.]': 1.2, 'Children [4-6 Yrs.]': 2.2, 'Children [7-9 Yrs.]': 2.2,
      '10-12 Yrs. [Boys]': 2.2, '10-12 Yrs. [Girls]': 2.2, '13-15 Yrs. [Boys]': 2.2, '13-15 Yrs. [Girls]': 2.2,
      '16-18 Yrs. [Boys]': 2.2, '16-18 Yrs. [Girls]': 2.2, 'Male [Sedentary]': 2.2, 'Female [Sedentary]': 2.2,
      'Female [Pregnant]': 2.45, 'Female [Lactating]': 3.2,
    },
    'Cobalamin': {
      'Children [1-3 Yrs.]': 1.2, 'Children [4-6 Yrs.]': 2.2, 'Children [7-9 Yrs.]': 2.2,
      '10-12 Yrs. [Boys]': 2.2, '10-12 Yrs. [Girls]': 2.2, '13-15 Yrs. [Boys]': 2.2, '13-15 Yrs. [Girls]': 2.2,
      '16-18 Yrs. [Boys]': 2.2, '16-18 Yrs. [Girls]': 2.2, 'Male [Sedentary]': 2.2, 'Female [Sedentary]': 2.2,
      'Female [Pregnant]': 2.45, 'Female [Lactating]': 3.2,
    },
    'Calcium': {
      'Infant [0-6 Mo.]': 300, 'Infant [7-12 Mo.]': 300, 'Children [1-3 Yrs.]': 500, 'Children [4-6 Yrs.]': 550,
      'Children [7-9 Yrs.]': 650, '10-12 Yrs. [Boys]': 850, '10-12 Yrs. [Girls]': 850,
      '13-15 Yrs. [Boys]': 1000, '13-15 Yrs. [Girls]': 1000, '16-18 Yrs. [Boys]': 1050, '16-18 Yrs. [Girls]': 1050,
      'Male [Sedentary]': 1000, 'Female [Sedentary]': 1000, 'Female [Pregnant]': 1000, 'Female [Lactating]': 1200,
    },
    'Phosphorus': {
      'Infant [0-6 Mo.]': 1000, 'Infant [7-12 Mo.]': 1000, 'Children [1-3 Yrs.]': 1000, 'Children [4-6 Yrs.]': 1000,
      'Children [7-9 Yrs.]': 1000, '10-12 Yrs. [Boys]': 1000, '10-12 Yrs. [Girls]': 1000,
      '13-15 Yrs. [Boys]': 1000, '13-15 Yrs. [Girls]': 1000, '16-18 Yrs. [Boys]': 1000, '16-18 Yrs. [Girls]': 1000,
      'Male [Sedentary]': 1000, 'Female [Sedentary]': 1000, 'Female [Pregnant]': 1000, 'Female [Lactating]': 1000,
    },
    'Magnesium': {
      'Infant [0-6 Mo.]': 30, 'Infant [7-12 Mo.]': 75, 'Children [1-3 Yrs.]': 90, 'Children [4-6 Yrs.]': 125,
      'Children [7-9 Yrs.]': 175, '10-12 Yrs. [Boys]': 240, '10-12 Yrs. [Girls]': 250,
      '13-15 Yrs. [Boys]': 345, '13-15 Yrs. [Girls]': 340, '16-18 Yrs. [Boys]': 440, '16-18 Yrs. [Girls]': 380,
      'Male [Sedentary]': 440, 'Female [Sedentary]': 370, 'Female [Pregnant]': 440, 'Female [Lactating]': 400,
    },
    'Manganese': {
      'Infant [0-6 Mo.]': 4, 'Infant [7-12 Mo.]': 4, 'Children [1-3 Yrs.]': 4, 'Children [4-6 Yrs.]': 4,
      'Children [7-9 Yrs.]': 4, '10-12 Yrs. [Boys]': 4, '10-12 Yrs. [Girls]': 4,
      '13-15 Yrs. [Boys]': 4, '13-15 Yrs. [Girls]': 4, '16-18 Yrs. [Boys]': 4, '16-18 Yrs. [Girls]': 4,
      'Male [Sedentary]': 4, 'Female [Sedentary]': 4, 'Female [Pregnant]': 4, 'Female [Lactating]': 4,
    },
    'Iron': {
      'Infant [7-12 Mo.]': 3, 'Children [1-3 Yrs.]': 8, 'Children [4-6 Yrs.]': 11,
      'Children [7-9 Yrs.]': 15, '10-12 Yrs. [Boys]': 16, '10-12 Yrs. [Girls]': 28,
      '13-15 Yrs. [Boys]': 22, '13-15 Yrs. [Girls]': 30, '16-18 Yrs. [Boys]': 26, '16-18 Yrs. [Girls]': 32,
      'Male [Sedentary]': 19, 'Female [Sedentary]': 29, 'Female [Pregnant]': 27, 'Female [Lactating]': 23,
    },
    'Iodine': {
      'Infant [0-6 Mo.]': 100, 'Infant [7-12 Mo.]': 130, 'Children [1-3 Yrs.]': 90, 'Children [4-6 Yrs.]': 90,
      'Children [7-9 Yrs.]': 90, '10-12 Yrs. [Boys]': 100, '10-12 Yrs. [Girls]': 100,
      '13-15 Yrs. [Boys]': 140, '13-15 Yrs. [Girls]': 140, '16-18 Yrs. [Boys]': 140, '16-18 Yrs. [Girls]': 140,
      'Male [Sedentary]': 140, 'Female [Sedentary]': 140, 'Female [Pregnant]': 220, 'Female [Lactating]': 280,
    },
    'Zinc': {
      'Infant [7-12 Mo.]': 2.5, 'Children [1-3 Yrs.]': 3.3, 'Children [4-6 Yrs.]': 4.5,
      'Children [7-9 Yrs.]': 5.9, '10-12 Yrs. [Boys]': 8.5, '10-12 Yrs. [Girls]': 8.5,
      '13-15 Yrs. [Boys]': 14.3, '13-15 Yrs. [Girls]': 12.8, '16-18 Yrs. [Boys]': 17.6, '16-18 Yrs. [Girls]': 14.2,
      'Male [Sedentary]': 17, 'Female [Sedentary]': 13.2, 'Female [Pregnant]': 14.5, 'Female [Lactating]': 14.1,
    },
    'Potassium': {
      'Infant [0-6 Mo.]': 3500, 'Infant [7-12 Mo.]': 3500, 'Children [1-3 Yrs.]': 3500, 'Children [4-6 Yrs.]': 3500,
      'Children [7-9 Yrs.]': 3500, '10-12 Yrs. [Boys]': 3500, '10-12 Yrs. [Girls]': 3500,
      '13-15 Yrs. [Boys]': 3500, '13-15 Yrs. [Girls]': 3500, '16-18 Yrs. [Boys]': 3500, '16-18 Yrs. [Girls]': 3500,
      'Male [Sedentary]': 3500, 'Female [Sedentary]': 3500, 'Female [Pregnant]': 3500, 'Female [Lactating]': 3500,
    },
    'Sodium': {
      'Infant [0-6 Mo.]': 2000, 'Infant [7-12 Mo.]': 2000, 'Children [1-3 Yrs.]': 2000, 'Children [4-6 Yrs.]': 2000,
      'Children [7-9 Yrs.]': 2000, '10-12 Yrs. [Boys]': 2000, '10-12 Yrs. [Girls]': 2000,
      '13-15 Yrs. [Boys]': 2000, '13-15 Yrs. [Girls]': 2000, '16-18 Yrs. [Boys]': 2000, '16-18 Yrs. [Girls]': 2000,
      'Male [Sedentary]': 2000, 'Female [Sedentary]': 2000, 'Female [Pregnant]': 2000, 'Female [Lactating]': 2000,
    },
    'Chloride': {
      'Children [1-3 Yrs.]': 1500, 'Children [4-6 Yrs.]': 1900, 'Children [7-9 Yrs.]': 1900,
      '10-12 Yrs. [Boys]': 1800, '10-12 Yrs. [Girls]': 1800, '13-15 Yrs. [Boys]': 1800, '13-15 Yrs. [Girls]': 1800,
      '16-18 Yrs. [Boys]': 1800, '16-18 Yrs. [Girls]': 1800, 'Male [Sedentary]': 1800, 'Female [Sedentary]': 1800,
      'Female [Pregnant]': 2300, 'Female [Lactating]': 2300,
    },
    'Selenium': {
      'Infant [0-6 Mo.]': 40, 'Infant [7-12 Mo.]': 40, 'Children [1-3 Yrs.]': 40, 'Children [4-6 Yrs.]': 40,
      'Children [7-9 Yrs.]': 40, '10-12 Yrs. [Boys]': 40, '10-12 Yrs. [Girls]': 40,
      '13-15 Yrs. [Boys]': 40, '13-15 Yrs. [Girls]': 40, '16-18 Yrs. [Boys]': 40, '16-18 Yrs. [Girls]': 40,
      'Male [Sedentary]': 40, 'Female [Sedentary]': 40, 'Female [Pregnant]': 40, 'Female [Lactating]': 40,
    },
    'Chromium': {
      'Infant [0-6 Mo.]': 50, 'Infant [7-12 Mo.]': 50, 'Children [1-3 Yrs.]': 50, 'Children [4-6 Yrs.]': 50,
      'Children [7-9 Yrs.]': 50, '10-12 Yrs. [Boys]': 50, '10-12 Yrs. [Girls]': 50,
      '13-15 Yrs. [Boys]': 50, '13-15 Yrs. [Girls]': 50, '16-18 Yrs. [Boys]': 50, '16-18 Yrs. [Girls]': 50,
      'Male [Sedentary]': 50, 'Female [Sedentary]': 50, 'Female [Pregnant]': 50, 'Female [Lactating]': 50,
    },
    'Molybdenum': {
      'Infant [0-6 Mo.]': 45, 'Infant [7-12 Mo.]': 45, 'Children [1-3 Yrs.]': 45, 'Children [4-6 Yrs.]': 45,
      'Children [7-9 Yrs.]': 45, '10-12 Yrs. [Boys]': 45, '10-12 Yrs. [Girls]': 45,
      '13-15 Yrs. [Boys]': 45, '13-15 Yrs. [Girls]': 45, '16-18 Yrs. [Boys]': 45, '16-18 Yrs. [Girls]': 45,
      'Male [Sedentary]': 45, 'Female [Sedentary]': 45, 'Female [Pregnant]': 45, 'Female [Lactating]': 45,
    },
    'Copper': {
      'Infant [0-6 Mo.]': 1700, 'Infant [7-12 Mo.]': 1700, 'Children [1-3 Yrs.]': 1700, 'Children [4-6 Yrs.]': 1700,
      'Children [7-9 Yrs.]': 1700, '10-12 Yrs. [Boys]': 1700, '10-12 Yrs. [Girls]': 1700,
      '13-15 Yrs. [Boys]': 1700, '13-15 Yrs. [Girls]': 1700, '16-18 Yrs. [Boys]': 1700, '16-18 Yrs. [Girls]': 1700,
      'Male [Sedentary]': 1700, 'Female [Sedentary]': 1700, 'Female [Pregnant]': 1700, 'Female [Lactating]': 1700,
    },
  }

  

  // Load COAs on mount

  useEffect(() => {

    loadCOAs()

  }, [])

  // Load saved formulations when Saved tab is active
  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedFormulations()
    }
  }, [activeTab])

  

  const loadCOAs = async () => {

    setIsLoadingCOAs(true)

    try {

      const result = await coaService.getCOAs({ limit: 500 })

      setCOAList(result.coas || [])

    } catch (error) {

      console.error('Failed to load COAs:', error)

    } finally {

      setIsLoadingCOAs(false)

    }

  }

  

  // Add ingredient row
  const addIngredient = () => {
    const newId = nextId
    setIngredients(prev => [
      ...prev,
      {
        id: newId,
        coa_id: null,
        coa_name: '',
        percentage: 0,
        nutritional_data: {}
      }
    ])
    setNextId(newId + 1)
  }

  

  // Remove ingredient
  const removeIngredient = (id) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id))
  }

  

  // Update ingredient percentage
  const updatePercentage = (id, value) => {
    const numValue = parseFloat(value) || 0
    setIngredients(prev => prev.map(ing =>
      ing.id === id ? { ...ing, percentage: numValue } : ing
    ))
  }

  

  // Select COA for ingredient
  const selectCOA = async (id, coaId) => {
    if (!coaId) return
    // Immediately mark the coa_id so re-renders don't lose it
    setIngredients(prev => prev.map(ing =>
      ing.id === id ? { ...ing, coa_id: coaId } : ing
    ))
    try {
      const coa = await coaService.getCOA(coaId)
      if (coa) {
        // Store all 4 value types per nutrient
        const nutritionalDataObj = {}
        if (coa.nutritional_data) {
          coa.nutritional_data.forEach(nutrient => {
            const key = nutrient.nutrient_name || nutrient.nutrient_name_raw
            nutritionalDataObj[key] = {
              actual: nutrient.actual_value ?? null,
              min: nutrient.min_value ?? null,
              max: nutrient.max_value ?? null,
              average: nutrient.average_value ?? null,
            }
          })
        }
        setIngredients(prev => prev.map(ing =>
          ing.id === id ? {
            ...ing,
            coa_id: coaId,
            coa_name: coa.ingredient_name,
            nutritional_data: nutritionalDataObj
          } : ing
        ))
      }
    } catch (error) {
      console.error('Failed to load COA details:', error)
    }
  }

  // Get the selected value for a specific ingredient-nutrient cell
  const getNutrientValue = (ingredientId, nutrientName, nutritionalData) => {
    const cellData = nutritionalData[nutrientName]
    if (!cellData) return 0
    if (typeof cellData === 'number') return cellData
    const selectionKey = `${ingredientId}-${nutrientName}`
    const selectedType = nutrientSelections[selectionKey] || 'actual'
    if (selectedType === 'custom') {
      return customValues[selectionKey] ?? 0
    }
    return cellData[selectedType] ?? cellData.actual ?? cellData.average ?? 0
  }

  // Get the raw value for a specific type (for display in dropdown)
  const getRawValue = (nutritionalData, nutrientName, valueType) => {
    const cellData = nutritionalData[nutrientName]
    if (!cellData || typeof cellData === 'number') {
      return valueType === 'actual' ? (cellData || 0) : null
    }
    return cellData[valueType] ?? null
  }

  // Update the value type selection for a specific cell
  const updateNutrientSelection = (ingredientId, nutrientName, valueType) => {
    setNutrientSelections(prev => ({
      ...prev,
      [`${ingredientId}-${nutrientName}`]: valueType
    }))
    setOpenDropdown(null)
  }

  // Update custom value for a cell
  const updateCustomValue = (ingredientId, nutrientName, value) => {
    setCustomValues(prev => ({
      ...prev,
      [`${ingredientId}-${nutrientName}`]: parseFloat(value) || 0
    }))
  }

  

  // Priority order for nutrient columns (matches regulatory/export order)
  const NUTRIENT_PRIORITY_ORDER = [
    'Energy',
    'Protein',
    'Carbohydrate', 'Total Carbohydrates',
    'Total Sugars', 'Total sugars',
    'Added Sugars', 'Added sugars',
    'Dietary Fiber', 'Dietary Fibre',
    'Soluble Fiber', 'Soluble Fibre',
    'Insoluble Fiber', 'Insoluble Fibre',
    'Total Fat', 'Total fat',
    'Saturated Fat', 'Safa', 'SFA',
    'MUFA', 'Monounsaturated Fat',
    'PUFA', 'Polyunsaturated Fat',
    'Linoleic Acid', 'LA',
    'Alpha-Linolenic Acid', 'ALA',
    'Trans Fat', 'Trans Fa',
    'Cholesterol',
    'Vitamin A',
    'Vitamin D2',
    'Vitamin E',
    'Vitamin K',
    'Vitamin C',
    'Vitamin B1', 'Thiamine',
    'Vitamin B2', 'Riboflavin',
    'Vitamin B3', 'Niacin',
    'Vitamin B5', 'Calcium Pantothenate', 'Pantothenic Acid',
    'Vitamin B6', 'Pyridoxine',
    'Vitamin B7', 'Biotin',
    'Vitamin B9', 'Folic Acid', 'Folate',
    'Vitamin B12', 'Cobalamin',
    'Calcium',
    'Potassium',
    'Magnesium',
    'Zinc',
    'Chromium',
    'Molybdenum',
    'Iron',
    'Sodium',
    'Phosphorus',
    'Manganese',
    'Iodine',
    'Selenium',
    'Choline',
    'Copper',
    'Chloride',
  ]

  // Get all unique nutrient names from all selected ingredients, sorted by priority
  const getAllNutrientNames = () => {
    const nutrientSet = new Set()
    ingredients.forEach(ing => {
      Object.keys(ing.nutritional_data).forEach(nutrient => {
        // Only include if at least one ingredient has real data for this nutrient
        const cellData = ing.nutritional_data[nutrient]
        if (cellData !== undefined && cellData !== null) {
          nutrientSet.add(nutrient)
        }
      })
    })
    const allNutrients = Array.from(nutrientSet)

    // Sort by priority order
    const getPriorityIndex = (name) => {
      const lower = name.toLowerCase().trim()
      for (let i = 0; i < NUTRIENT_PRIORITY_ORDER.length; i++) {
        const key = NUTRIENT_PRIORITY_ORDER[i].toLowerCase()
        if (lower === key || lower.startsWith(key + ' ') || lower.startsWith(key + '(') || lower.startsWith(key + ',')) {
          return i
        }
      }
      return -1
    }

    const prioritized = []
    const remaining = []
    allNutrients.forEach(n => {
      const idx = getPriorityIndex(n)
      if (idx !== -1) {
        prioritized.push({ name: n, idx })
      } else {
        remaining.push(n)
      }
    })
    prioritized.sort((a, b) => a.idx - b.idx)
    remaining.sort((a, b) => a.localeCompare(b))
    return [...prioritized.map(p => p.name), ...remaining]
  }

  

  // Calculate total for a nutrient (weighted by percentage)
  const calculateTotal = (nutrientName) => {
    return ingredients.reduce((sum, ing) => {
      const value = getNutrientValue(ing.id, nutrientName, ing.nutritional_data)
      return sum + (value * ing.percentage / 100)
    }, 0)
  }

  

  // Calculate energy for a nutrient

  const calculateEnergy = (nutrientName, total) => {

    const energyMultipliers = {

      'Proteins': 4,

      'Protein': 4,

      'A. Carbohydrates': 4,

      'Carbohydrates': 4,

      'Total Carbohydrates': 4,

      'Dietary Fiber': 2,

      'Dietary Fibre': 2,

      'Fiber': 2,

      'Fibre': 2,

      'Fats': 9,

      'Total Fat': 9,

      'Fat': 9,

      'LA': 9,

      'Linoleic Acid': 9,

      'SFA': 9,

      'MUFA': 9,

      'PUFA': 9

    }

    

    return (energyMultipliers[nutrientName] || 0) * total

  }

  

  // Get total percentage

  const getTotalPercentage = () => {

    return ingredients.reduce((sum, ing) => sum + ing.percentage, 0)

  }

  

  // Get all nutrient names and their totals

  const nutrientNames = getAllNutrientNames()

  const nutrientTotals = {}

  const nutrientEnergies = {}

  

  nutrientNames.forEach(nutrient => {

    const total = calculateTotal(nutrient)

    nutrientTotals[nutrient] = total

    nutrientEnergies[nutrient] = calculateEnergy(nutrient, total)

  })

  

  // Calculate total energy

  const totalEnergy = Object.values(nutrientEnergies).reduce((sum, energy) => sum + energy, 0)

  

  // Calculate percentage energy

  const nutrientPercentageEnergies = {}

  nutrientNames.forEach(nutrient => {

    nutrientPercentageEnergies[nutrient] = totalEnergy > 0 

      ? (nutrientEnergies[nutrient] / totalEnergy) * 100 

      : 0

  })

  

  // Filter COAs based on search

  const filteredCOAs = coaList.filter(coa => 

    coa.ingredient_name?.toLowerCase().includes(searchTerm.toLowerCase())

  )

  

  // Toggle RDA category selection

  const toggleRDACategory = (category) => {

    if (selectedRDACategories.includes(category)) {

      setSelectedRDACategories(selectedRDACategories.filter(c => c !== category))

    } else {

      setSelectedRDACategories([...selectedRDACategories, category])

    }

  }

  // Load saved formulations
  const loadSavedFormulations = async () => {
    setIsLoadingSaved(true)
    try {
      const result = await formulationService.getFormulations({ limit: 100 })
      setSavedFormulations(result.formulations || [])
    } catch (error) {
      console.error('Failed to load saved formulations:', error)
    } finally {
      setIsLoadingSaved(false)
    }
  }

  // Save current formulation
  const handleSaveFormulation = async () => {
    setSaveError('')
    const name = formulationName.trim()
    
    if (!name) {
      setSaveError('Please enter a formulation name')
      return
    }

    if (ingredients.length === 0) {
      setSaveError('Please add at least one ingredient')
      return
    }

    setIsSaving(true)
    try {
      const result = await formulationService.saveFormulation({
        name: name,
        ingredients: ingredients.map(ing => ({
          coa_id: ing.coa_id,
          coa_name: ing.coa_name,
          percentage: ing.percentage,
          nutritional_data: ing.nutritional_data
        })),
        nutrient_selections: nutrientSelections,
        custom_values: customValues,
        serve_size: serveSize,
        created_by: localStorage.getItem('user_email') || 'admin'
      })

      if (result.success) {
        alert(`Formulation "${name}" saved successfully!`)
        setFormulationName('')
        setShowSaveModal(false)
        // Refresh saved list if on that tab
        if (activeTab === 'saved') {
          loadSavedFormulations()
        }
      } else {
        setSaveError(result.error || 'Failed to save formulation')
      }
    } catch (error) {
      setSaveError(error.message || 'Failed to save formulation')
    } finally {
      setIsSaving(false)
    }
  }

  // Open/Load a saved formulation
  const handleOpenFormulation = async (formulationId) => {
    try {
      const formulation = await formulationService.getFormulation(formulationId)
      if (!formulation) {
        alert('Failed to load formulation')
        return
      }

      // Load ingredients with IDs
      const loadedIngredients = formulation.ingredients.map((ing, index) => ({
        id: index + 1,
        coa_id: ing.coa_id,
        coa_name: ing.coa_name,
        percentage: ing.percentage,
        nutritional_data: ing.nutritional_data || {}
      }))

      setIngredients(loadedIngredients)
      setNextId(loadedIngredients.length + 1)
      setNutrientSelections(formulation.nutrient_selections || {})
      setCustomValues(formulation.custom_values || {})
      setServeSize(formulation.serve_size || 55)
      
      // Switch to formula tab
      setActiveTab('formula')
      alert(`Loaded formulation: ${formulation.name}`)
    } catch (error) {
      console.error('Failed to open formulation:', error)
      alert('Failed to open formulation')
    }
  }

  // Delete a saved formulation
  const handleDeleteFormulation = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }

    try {
      const result = await formulationService.deleteFormulation(id)
      if (result.success) {
        alert('Formulation deleted successfully')
        loadSavedFormulations()
      } else {
        alert(result.error || 'Failed to delete formulation')
      }
    } catch (error) {
      alert('Failed to delete formulation')
    }
  }

  

  // Full nutrient list in regulatory order with indentation info
  // indent: 0 = bold parent, 1 = indented child, 2 = double-indented
  // section: used to add section headers like "Vitamins", "Minerals"
  const NUTRIENT_EXPORT_ORDER = [
    { name: 'Energy', unit: 'kcal', indent: 0 },
    { name: 'Protein', unit: 'g', indent: 0 },
    { name: 'Carbohydrate', unit: 'g', indent: 0, aliases: ['Total Carbohydrates'] },
    { name: 'Total sugars', unit: 'g', indent: 1, aliases: ['Total Sugars'] },
    { name: 'Added sugars', unit: 'g', indent: 2, aliases: ['Added Sugars'] },
    { name: 'Dietary Fiber', unit: 'g', indent: 1, aliases: ['Dietary Fibre'] },
    { name: 'Soluble Fiber', unit: 'g', indent: 1, aliases: ['Soluble Fibre'] },
    { name: 'Insoluble Fiber', unit: 'g', indent: 1, aliases: ['Insoluble Fibre'] },
    { name: 'Total fat', unit: 'g', indent: 0, aliases: ['Total Fat'] },
    { name: 'Saturated Fat', unit: 'g', indent: 1, aliases: ['Safa', 'SFA'] },
    { name: 'MUFA', unit: 'g', indent: 1, aliases: ['Monounsaturated Fat'] },
    { name: 'PUFA', unit: 'g', indent: 1, aliases: ['Polyunsaturated Fat'] },
    { name: 'Linoleic Acid', unit: 'g', indent: 2, aliases: ['LA'] },
    { name: 'Alpha-Linolenic Acid (ALA)', unit: 'mg', indent: 2, aliases: ['Alpha-Linolenic Acid', 'ALA'] },
    { name: 'Trans Fat', unit: 'g', indent: 1, aliases: ['Trans Fa'] },
    { name: 'Cholesterol', unit: 'mg', indent: 1 },
    { name: 'Vitamin A (palmitate)', unit: 'mcg (RE)', indent: 0, aliases: ['Vitamin A'], section: 'Vitamins' },
    { name: 'Vitamin D2', unit: 'mcg', indent: 0 },
    { name: 'Vitamin E', unit: 'mg (TE)', indent: 0 },
    { name: 'Vitamin K', unit: 'mcg', indent: 0 },
    { name: 'Vitamin C', unit: 'mg', indent: 0 },
    { name: 'Vitamin B1 - Thiamine', unit: 'mg', indent: 0, aliases: ['Vitamin B1', 'Thiamine'] },
    { name: 'Vitamin B2 - Riboflavin', unit: 'mg', indent: 0, aliases: ['Vitamin B2', 'Riboflavin'] },
    { name: 'Vitamin B3 - Niacin', unit: 'mg', indent: 0, aliases: ['Vitamin B3', 'Niacin'] },
    { name: 'Vitamin B5 - Calcium Pantothenate', unit: 'mg', indent: 0, aliases: ['Vitamin B5', 'Calcium Pantothenate', 'Pantothenic Acid'] },
    { name: 'Vitamin B6 - Pyridoxine', unit: 'mg', indent: 0, aliases: ['Vitamin B6', 'Pyridoxine'] },
    { name: 'Vitamin B7 - Biotin', unit: 'mcg', indent: 0, aliases: ['Vitamin B7', 'Biotin'] },
    { name: 'Vitamin B9 - Folic acid', unit: 'mcg', indent: 0, aliases: ['Vitamin B9', 'Folic Acid', 'Folate'] },
    { name: 'Vitamin B12 - Cobalamin', unit: 'mcg', indent: 0, aliases: ['Vitamin B12', 'Cobalamin'] },
    { name: 'Calcium', unit: 'mg', indent: 0, section: 'Minerals' },
    { name: 'Potassium', unit: 'mg', indent: 0 },
    { name: 'Magnesium', unit: 'mg', indent: 0 },
    { name: 'Zinc', unit: 'mg', indent: 0 },
    { name: 'Chromium', unit: 'mcg', indent: 0 },
    { name: 'Molybdenum', unit: 'mcg', indent: 0 },
    { name: 'Iron', unit: 'mg', indent: 0 },
    { name: 'Sodium', unit: 'mg', indent: 0 },
    { name: 'Phosphorus', unit: 'mg', indent: 0 },
    { name: 'Manganese', unit: 'mg', indent: 0 },
    { name: 'Iodine', unit: 'mcg', indent: 0 },
    { name: 'Selenium', unit: 'mcg', indent: 0 },
    { name: 'Choline', unit: 'mg', indent: 0 },
    { name: 'Copper', unit: 'mg', indent: 0 },
    { name: 'chloride', unit: 'mg', indent: 0, aliases: ['Chloride'] },
  ]

  // Export to Excel (vertical format) using ExcelJS
  const exportToExcel = async () => {
    if (ingredients.length === 0) {
      alert('Please add ingredients before exporting')
      return
    }

    const sv = serveSize || 55

    // Helper: find the matching nutrient key in our totals for a given export entry
    const findNutrientKey = (entry) => {
      const candidates = [entry.name, ...(entry.aliases || [])]
      for (const candidate of candidates) {
        if (nutrientTotals[candidate] !== undefined) return candidate
      }
      // Try case-insensitive match
      const allKeys = Object.keys(nutrientTotals)
      for (const candidate of candidates) {
        const lower = candidate.toLowerCase()
        const found = allKeys.find(k => k.toLowerCase() === lower)
        if (found) return found
      }
      return null
    }

    // Helper: get RDA value for a nutrient
    const findRDAValue = (entry, category) => {
      const candidates = [entry.name, ...(entry.aliases || [])]
      for (const candidate of candidates) {
        if (rdaData[candidate]?.[category]) return rdaData[candidate][category]
      }
      return null
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Formulation')

    let currentRow = 1

    // Add main title row
    const titleRow = worksheet.getRow(currentRow)
    titleRow.getCell(1).value = 'NUTRITIONAL INFORMATION'
    titleRow.getCell(1).font = { bold: true, size: 14 }
    currentRow++

    // Add serve size row
    const serveSizeRow = worksheet.getRow(currentRow)
    serveSizeRow.getCell(1).value = `Serve Size: ${sv} ${serveSizeUnit}`
    serveSizeRow.getCell(1).font = { bold: true }
    currentRow++

    // Build header row
    const headerRow = worksheet.getRow(currentRow)
    let colIndex = 1
    headerRow.getCell(colIndex++).value = 'Approximate Composition Per 100 g or 100 ml'
    headerRow.getCell(colIndex++).value = '% RDA (Per 100 g)'
    headerRow.getCell(colIndex++).value = '% RDA (Per Serve)'
    
    selectedRDACategories.forEach(cat => {
      headerRow.getCell(colIndex++).value = `RDA (${cat})`
      headerRow.getCell(colIndex++).value = `%RDA ${cat} (per 100g)`
      headerRow.getCell(colIndex++).value = `%RDA ${cat} (per serve)`
    })
    
    // Make header row bold
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
      }
    })
    currentRow++

    // Build nutrient rows for standard nutrients
    let lastSection = null
    NUTRIENT_EXPORT_ORDER.forEach(entry => {
      // Add section header if this is a new section
      if (entry.section && entry.section !== lastSection) {
        const sectionRow = worksheet.getRow(currentRow)
        sectionRow.getCell(1).value = entry.section
        sectionRow.getCell(1).font = { bold: true }
        currentRow++
        lastSection = entry.section
      }

      const indentPrefix = entry.indent === 2 ? '        ' : entry.indent === 1 ? '    ' : ''
      const displayName = `${indentPrefix}${entry.name}`

      const nutrientKey = findNutrientKey(entry)
      const per100g = nutrientKey ? (nutrientTotals[nutrientKey] || 0) : 0
      const perServe = per100g * sv / 100

      const row = worksheet.getRow(currentRow)
      colIndex = 1
      row.getCell(colIndex++).value = displayName
      row.getCell(colIndex++).value = isNaN(per100g) ? 0 : parseFloat(per100g.toFixed(2))
      row.getCell(colIndex++).value = isNaN(perServe) ? 0 : parseFloat(perServe.toFixed(2))

      // For each RDA category, add: RDA value, %RDA per 100g, %RDA per serve
      selectedRDACategories.forEach(cat => {
        const rdaVal = findRDAValue(entry, cat)
        row.getCell(colIndex++).value = rdaVal || 0
        
        // %RDA per 100g
        if (rdaVal && rdaVal > 0) {
          row.getCell(colIndex++).value = parseFloat(((per100g / rdaVal) * 100).toFixed(2))
        } else {
          row.getCell(colIndex++).value = 0
        }
        
        // %RDA per serve
        if (rdaVal && rdaVal > 0) {
          row.getCell(colIndex++).value = parseFloat(((perServe / rdaVal) * 100).toFixed(2))
        } else {
          row.getCell(colIndex++).value = 0
        }
      })
      currentRow++
    })

    // Collect nutrients not in the standard list for "Others" section
    const coveredNames = new Set()
    NUTRIENT_EXPORT_ORDER.forEach(entry => {
      coveredNames.add(entry.name.toLowerCase())
      ;(entry.aliases || []).forEach(a => coveredNames.add(a.toLowerCase()))
    })
    
    const otherNutrients = []
    nutrientNames.forEach(nutrient => {
      if (!coveredNames.has(nutrient.toLowerCase())) {
        otherNutrients.push(nutrient)
      }
    })
    
    // Add "Others" section if there are any remaining nutrients
    if (otherNutrients.length > 0) {
      // Add "Others" header row
      const othersHeaderRow = worksheet.getRow(currentRow)
      othersHeaderRow.getCell(1).value = 'Others'
      othersHeaderRow.getCell(1).font = { bold: true }
      currentRow++
      
      // Sort other nutrients alphabetically
      otherNutrients.sort((a, b) => a.localeCompare(b))
      
      // Add each other nutrient
      otherNutrients.forEach(nutrient => {
        const per100g = nutrientTotals[nutrient] || 0
        const perServe = per100g * sv / 100
        const row = worksheet.getRow(currentRow)
        colIndex = 1
        row.getCell(colIndex++).value = nutrient
        row.getCell(colIndex++).value = isNaN(per100g) ? 0 : parseFloat(per100g.toFixed(2))
        row.getCell(colIndex++).value = isNaN(perServe) ? 0 : parseFloat(perServe.toFixed(2))
        
        // Add empty cells for RDA columns
        selectedRDACategories.forEach(() => {
          row.getCell(colIndex++).value = 0
          row.getCell(colIndex++).value = 0
          row.getCell(colIndex++).value = 0
        })
        currentRow++
      })
    }

    // Set column widths
    worksheet.getColumn(1).width = 50
    worksheet.getColumn(2).width = 18
    worksheet.getColumn(3).width = 18
    let col = 4
    selectedRDACategories.forEach(() => {
      worksheet.getColumn(col++).width = 20
      worksheet.getColumn(col++).width = 22
      worksheet.getColumn(col++).width = 24
    })

    // Generate file and download
    const buffer = await workbook.xlsx.writeBuffer()
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `Formulation_${timestamp}.xlsx`
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, filename)

    setShowRDAModal(false)
  }

  

  return (

    <Layout>

      <div className="p-4 md:p-6 h-full flex flex-col overflow-y-auto">

        {/* Header */}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">

          <div className="flex-1">

            <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1 flex items-center gap-2">

              <Beaker className="w-6 h-6" />

              Formulation Calculator

            </h1>

          </div>

          <div className="flex gap-3">

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={ingredients.length === 0}
              className={`flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm transition-colors whitespace-nowrap ${
                ingredients.length === 0
                  ? 'bg-[#f5f5f5] text-[#9e9e9e] cursor-not-allowed'
                  : 'bg-[#e91e63] text-white hover:bg-[#c2185b]'
              }`}
            >
              <Download className="w-4 h-4" />
              Save
            </button>

            <button
              onClick={() => setShowRDAModal(true)}
              disabled={ingredients.length === 0}
              className={`flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm transition-colors whitespace-nowrap ${
                ingredients.length === 0
                  ? 'bg-[#e1e7ef] text-[#65758b] cursor-not-allowed'
                  : 'bg-[#009da5] border border-[#5bc4bf] text-white hover:bg-[#008891]'
              }`}
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>

            <button

              onClick={addIngredient}

              className="bg-[#009da5] border border-[#5bc4bf] flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors whitespace-nowrap"

            >

              <Plus className="w-4 h-4" />

              Add Ingredient

            </button>

          </div>

        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-[#e1e7ef] mb-6">
          <button
            onClick={() => setActiveTab('formula')}
            className={`px-4 py-2 font-ibm-plex font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'formula'
                ? 'border-[#009da5] text-[#009da5]'
                : 'border-transparent text-[#65758b] hover:text-[#0f1729]'
            }`}
          >
            Formula
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-ibm-plex font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'saved'
                ? 'border-[#009da5] text-[#009da5]'
                : 'border-transparent text-[#65758b] hover:text-[#0f1729]'
            }`}
          >
            Saved Formulations
          </button>
        </div>

        {/* Formula Tab Content */}
        {activeTab === 'formula' && (
        <>

        {/* Total Percentage Warning */}

        {ingredients.length > 0 && (

          <div className={`mb-4 p-3 rounded-lg border ${

            getTotalPercentage() === 100 

              ? 'bg-green-50 border-green-200' 

              : getTotalPercentage() > 100

                ? 'bg-red-50 border-red-200'

                : 'bg-yellow-50 border-yellow-200'

          }`}>

            <div className="flex items-center gap-2">

              <AlertCircle className={`w-5 h-5 ${

                getTotalPercentage() === 100 

                  ? 'text-green-600' 

                  : getTotalPercentage() > 100

                    ? 'text-red-600'

                    : 'text-yellow-600'

              }`} />

              <span className={`text-sm font-ibm-plex font-medium ${

                getTotalPercentage() === 100 

                  ? 'text-green-800' 

                  : getTotalPercentage() > 100

                    ? 'text-red-800'

                    : 'text-yellow-800'

              }`}>

                Total Percentage: {getTotalPercentage().toFixed(2)}%

                {getTotalPercentage() === 100 && ' ✓'}

                {getTotalPercentage() > 100 && ' (Exceeds 100%)'}

                {getTotalPercentage() < 100 && getTotalPercentage() > 0 && ` (${(100 - getTotalPercentage()).toFixed(2)}% remaining)`}

              </span>

            </div>

          </div>

        )}

        

        {/* Formulation Table */}

        <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm mb-6">

          <div className="p-4 border-b border-[#e1e7ef]">

            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">

              Formulation Table {ingredients.length > 0 && `(${ingredients.length} ingredients)`}

            </h2>

          </div>

          

          {isLoadingCOAs ? (

            <div className="p-8 flex items-center justify-center">

              <Loader2 className="w-6 h-6 animate-spin text-[#009da5]" />

              <span className="ml-2 text-sm font-ibm-plex text-[#65758b]">Loading ingredients...</span>

            </div>

          ) : ingredients.length === 0 ? (

            <div className="p-8 text-center">

              <Beaker className="w-12 h-12 text-[#e1e7ef] mx-auto mb-3" />

              <p className="text-sm font-ibm-plex text-[#65758b] mb-4">

                No ingredients added yet. Click "Add Ingredient" to start creating your formulation.

              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full table-auto border-collapse">

                <thead>

                  <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">

                    <th className="px-3 py-3 text-left sticky left-0 bg-[#f1f5f9] z-10 min-w-[200px] w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">

                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">

                        Ingredient Name

                      </span>

                    </th>

                    <th className="px-3 py-3 text-center min-w-[80px] w-[80px]">

                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">

                        %

                      </span>

                    </th>

                    {nutrientNames.map(nutrient => (

                      <th key={nutrient} className="px-3 py-3 text-right min-w-[100px] w-[100px]">

                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">

                          {nutrient}

                        </span>

                      </th>

                    ))}

                    <th className="px-3 py-3 text-center min-w-[80px] w-[80px] sticky right-0 bg-[#f1f5f9] z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">

                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">

                        Action

                      </span>

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {/* Ingredient Rows */}

                  {ingredients.map((ingredient, index) => (

                    <tr key={ingredient.id} className="border-b border-[#e1e7ef] hover:bg-[#f9fafb]">

                      <td className="px-3 py-3 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">

                        <select

                          value={ingredient.coa_id || ''}

                          onChange={(e) => selectCOA(ingredient.id, e.target.value)}

                          className="w-full px-2 py-1 text-sm font-ibm-plex text-[#0f1729] bg-[#f9fafb] border border-[#e1e7ef] rounded focus:outline-none focus:ring-2 focus:ring-[#009da5]"

                        >

                          <option value="">Select ingredient...</option>

                          {coaList.map(coa => (

                            <option key={coa.id} value={coa.id}>

                              {coa.ingredient_name}

                            </option>

                          ))}

                        </select>

                      </td>

                      <td className="px-3 py-3">

                        <input

                          type="number"

                          min="0"

                          max="100"

                          step="0.01"

                          value={ingredient.percentage}

                          onChange={(e) => updatePercentage(ingredient.id, e.target.value)}

                          className="w-full px-2 py-1 text-sm font-ibm-plex text-[#0f1729] text-center bg-[#f9fafb] border border-[#e1e7ef] rounded focus:outline-none focus:ring-2 focus:ring-[#009da5]"

                        />

                      </td>

                      {nutrientNames.map(nutrient => {
                        const value = getNutrientValue(ingredient.id, nutrient, ingredient.nutritional_data)
                        const weighted = (value * ingredient.percentage / 100)
                        const selectionKey = `${ingredient.id}-${nutrient}`
                        const currentType = nutrientSelections[selectionKey] || 'actual'
                        const isOpen = openDropdown === selectionKey
                        const hasCOA = !!ingredient.coa_id
                        const cellData = ingredient.nutritional_data[nutrient]
                        const hasData = cellData && typeof cellData === 'object'
                        return (
                          <td key={nutrient} className="px-3 py-2 text-right">
                            {hasCOA && hasData ? (
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDropdown(isOpen ? null : selectionKey)
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#f1f5f9] transition-colors group"
                                >
                                  <span className="text-sm font-ibm-plex text-[#0f1729]">
                                    {weighted.toFixed(3)}
                                  </span>
                                  <ChevronDown className="w-3.5 h-3.5 text-[#65758b] group-hover:text-[#b455a0] transition-colors" />
                                </button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-20" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-lg shadow-lg border border-[#e1e7ef] py-1 min-w-[160px]">
                                      {['actual', 'min', 'max', 'average'].map(type => {
                                        const rawVal = getRawValue(ingredient.nutritional_data, nutrient, type)
                                        const isSelected = currentType === type
                                        return (
                                          <button
                                            key={type}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              updateNutrientSelection(ingredient.id, nutrient, type)
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm font-ibm-plex flex items-center justify-between transition-colors ${
                                              isSelected
                                                ? 'bg-[#b455a0] text-white'
                                                : rawVal !== null
                                                  ? 'text-[#0f1729] hover:bg-[#f1f5f9]'
                                                  : 'text-[#b0b8c4] hover:bg-[#f9fafb]'
                                            }`}
                                          >
                                            <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                                            {rawVal !== null && (
                                              <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-[#65758b]'}`}>
                                                {rawVal}
                                              </span>
                                            )}
                                          </button>
                                        )
                                      })}
                                      <div className="border-t border-[#e1e7ef] mt-1 pt-1">
                                        <div className={`px-3 py-2 text-sm font-ibm-plex ${currentType === 'custom' ? 'bg-[#b455a0]/10' : ''}`}>
                                          <span className={`text-xs font-medium ${currentType === 'custom' ? 'text-[#b455a0]' : 'text-[#65758b]'}`}>Custom</span>
                                          <input
                                            type="number"
                                            step="any"
                                            value={customValues[selectionKey] ?? ''}
                                            placeholder="Enter value..."
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                              updateCustomValue(ingredient.id, nutrient, e.target.value)
                                              updateNutrientSelection(ingredient.id, nutrient, 'custom')
                                              setOpenDropdown(selectionKey)
                                            }}
                                            className="w-full mt-1 px-2 py-1 text-sm font-ibm-plex text-[#0f1729] bg-[#f9fafb] border border-[#e1e7ef] rounded focus:outline-none focus:ring-1 focus:ring-[#b455a0]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm font-ibm-plex text-[#c0c7d1]">
                                {hasCOA && !hasData ? '—' : weighted.toFixed(3)}
                              </span>
                            )}
                          </td>
                        )
                      })}

                      <td className="px-3 py-3 text-center sticky right-0 bg-white">

                        <button

                          onClick={() => removeIngredient(ingredient.id)}

                          className="text-red-500 hover:text-red-700 transition-colors"

                          title="Remove ingredient"

                        >

                          <Trash2 className="w-4 h-4" />

                        </button>

                      </td>

                    </tr>

                  ))}

                  

                  {/* Total Row */}

                  <tr className="bg-[#f1f5f9] border-b-2 border-[#0f1729] font-semibold">

                    <td className="px-3 py-3 sticky left-0 bg-[#f1f5f9]">

                      <span className="text-sm font-ibm-plex font-bold text-[#0f1729]">Total</span>

                    </td>

                    <td className="px-3 py-3 text-center">

                      <span className="text-sm font-ibm-plex font-bold text-[#0f1729]">

                        {getTotalPercentage().toFixed(2)}

                      </span>

                    </td>

                    {nutrientNames.map(nutrient => (

                      <td key={nutrient} className="px-3 py-3 text-right">

                        <span className="text-sm font-ibm-plex font-bold text-[#0f1729]">

                          {nutrientTotals[nutrient].toFixed(3)}

                        </span>

                      </td>

                    ))}

                    <td className="px-3 py-3 sticky right-0 bg-[#f1f5f9]"></td>

                  </tr>

                  

                  {/* Energy (kcal/g) Row */}

                  <tr className="bg-[#e1f4f5] border-b border-[#e1e7ef]">

                    <td className="px-3 py-3 sticky left-0 bg-[#e1f4f5]">

                      <span className="text-sm font-ibm-plex font-semibold text-[#0f1729]">Energy (kcal/g)</span>

                    </td>

                    <td className="px-3 py-3"></td>

                    {nutrientNames.map(nutrient => (

                      <td key={nutrient} className="px-3 py-3 text-right">

                        <span className="text-sm font-ibm-plex text-[#0f1729]">

                          {nutrientEnergies[nutrient] > 0 ? nutrientEnergies[nutrient].toFixed(2) : '—'}

                        </span>

                      </td>

                    ))}

                    <td className="px-3 py-3 sticky right-0 bg-[#e1f4f5]"></td>

                  </tr>

                  

                  {/* Percentage Energy Row */}

                  <tr className="bg-[#f9fafb] border-b border-[#e1e7ef]">

                    <td className="px-3 py-3 sticky left-0 bg-[#f9fafb]">

                      <span className="text-sm font-ibm-plex font-semibold text-[#0f1729]">Percentage Energy</span>

                    </td>

                    <td className="px-3 py-3"></td>

                    {nutrientNames.map(nutrient => (

                      <td key={nutrient} className="px-3 py-3 text-right">

                        <span className="text-sm font-ibm-plex text-[#0f1729]">

                          {nutrientPercentageEnergies[nutrient] > 0 

                            ? `${nutrientPercentageEnergies[nutrient].toFixed(2)}%` 

                            : '—'}

                        </span>

                      </td>

                    ))}

                    <td className="px-3 py-3 sticky right-0 bg-[#f9fafb]"></td>

                  </tr>

                  

                  {/* Total Energy Row */}

                  <tr className="bg-[#009da5] text-white">

                    <td className="px-3 py-3 sticky left-0 bg-[#009da5]">

                      <span className="text-sm font-ibm-plex font-bold">Total Energy</span>

                    </td>

                    <td className="px-3 py-3 text-center">

                      <span className="text-sm font-ibm-plex font-bold">

                        {totalEnergy.toFixed(2)} kcal/100g

                      </span>

                    </td>

                    <td colSpan={nutrientNames.length} className="px-3 py-3"></td>

                    <td className="px-3 py-3 sticky right-0 bg-[#009da5]"></td>

                  </tr>

                </tbody>

              </table>

            </div>

          )}

        </div>

        

        {/* Legend */}

        {ingredients.length > 0 && (

          <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm p-4">

            <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-3">

              Energy Conversion Factors

            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-ibm-plex text-[#65758b]">

              <div>• Proteins: 4 kcal/g</div>

              <div>• Carbohydrates: 4 kcal/g</div>

              <div>• Dietary Fiber: 2 kcal/g</div>

              <div>• Fats: 9 kcal/g</div>

              <div>• LA (Linoleic Acid): 9 kcal/g</div>

              <div>• SFA/MUFA/PUFA: 9 kcal/g</div>

            </div>
          </div>
        )}
        </>
        )}

        {/* Saved Formulations Tab Content */}
        {activeTab === 'saved' && (
          <div className="bg-white rounded-lg border border-[#e1e7ef] overflow-hidden">
            {isLoadingSaved ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#009da5]" />
              </div>
            ) : savedFormulations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#65758b] font-ibm-plex">No saved formulations yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f9fafb] border-b border-[#e1e7ef]">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-ibm-plex font-semibold text-[#0f1729]">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-ibm-plex font-semibold text-[#0f1729]">Ingredients</th>
                      <th className="px-4 py-3 text-left text-sm font-ibm-plex font-semibold text-[#0f1729]">Serve Size</th>
                      <th className="px-4 py-3 text-left text-sm font-ibm-plex font-semibold text-[#0f1729]">Created</th>
                      <th className="px-4 py-3 text-left text-sm font-ibm-plex font-semibold text-[#0f1729]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedFormulations.map((formulation, idx) => (
                      <tr key={formulation.id} className={idx !== savedFormulations.length - 1 ? 'border-b border-[#e1e7ef]' : ''}>
                        <td className="px-4 py-3 text-sm font-ibm-plex font-medium text-[#0f1729]">{formulation.name}</td>
                        <td className="px-4 py-3 text-sm font-ibm-plex text-[#65758b]">{formulation.ingredients_count} ingredients</td>
                        <td className="px-4 py-3 text-sm font-ibm-plex text-[#65758b]">{formulation.serve_size}g</td>
                        <td className="px-4 py-3 text-sm font-ibm-plex text-[#65758b]">
                          {formulation.created_at ? new Date(formulation.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenFormulation(formulation.id)}
                              className="px-3 py-1 bg-[#009da5] text-white rounded text-sm font-ibm-plex font-medium hover:bg-[#008891] transition-colors"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleDeleteFormulation(formulation.id, formulation.name)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm font-ibm-plex font-medium hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Save Formulation Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-[#e1e7ef]">
                <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729]">Save Formulation</h2>
              </div>
              <div className="p-6">
                <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                  Formulation Name *
                </label>
                <input
                  type="text"
                  value={formulationName}
                  onChange={(e) => setFormulationName(e.target.value)}
                  placeholder="e.g., Protein Bar v1"
                  className="w-full px-3 py-2 border border-[#e1e7ef] rounded-md font-ibm-plex text-sm focus:outline-none focus:ring-2 focus:ring-[#009da5]"
                />
                {saveError && (
                  <p className="mt-2 text-sm text-red-600 font-ibm-plex">{saveError}</p>
                )}
              </div>
              <div className="p-6 border-t border-[#e1e7ef] flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false)
                    setFormulationName('')
                    setSaveError('')
                  }}
                  className="px-4 py-2 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFormulation}
                  disabled={isSaving}
                  className="bg-[#e91e63] flex items-center justify-center gap-2 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#c2185b] transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RDA Selection Modal */}
        {showRDAModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">

              {/* Modal Header */}

              <div className="p-6 border-b border-[#e1e7ef] flex items-center justify-between">

                <div>

                  <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729]">

                    Export to Excel

                  </h2>

                  <p className="text-sm font-ibm-plex text-[#65758b] mt-1">

                    Configure serve size and select RDA categories for the export

                  </p>

                </div>

                <button

                  onClick={() => setShowRDAModal(false)}

                  className="text-[#65758b] hover:text-[#0f1729] transition-colors"

                >

                  <X className="w-5 h-5" />

                </button>

              </div>

              

              {/* Modal Body */}

              <div className="p-6 overflow-y-auto flex-1">

                <div className="mb-4">
                  <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-3">
                    Serve Size
                  </h3>
                  <div className="flex gap-3 items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={serveSize}
                      onChange={(e) => setServeSize(parseFloat(e.target.value) || 55)}
                      className="w-32 px-3 py-2 text-sm font-ibm-plex text-[#0f1729] bg-[#f9fafb] border border-[#e1e7ef] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009da5]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setServeSizeUnit('g')}
                        className={`px-4 py-2 text-sm font-ibm-plex rounded-md transition-colors ${
                          serveSizeUnit === 'g'
                            ? 'bg-[#009da5] text-white'
                            : 'bg-[#f9fafb] text-[#65758b] border border-[#e1e7ef] hover:bg-[#e1e7ef]'
                        }`}
                      >
                        g
                      </button>
                      <button
                        onClick={() => setServeSizeUnit('ml')}
                        className={`px-4 py-2 text-sm font-ibm-plex rounded-md transition-colors ${
                          serveSizeUnit === 'ml'
                            ? 'bg-[#009da5] text-white'
                            : 'bg-[#f9fafb] text-[#65758b] border border-[#e1e7ef] hover:bg-[#e1e7ef]'
                        }`}
                      >
                        ml
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-4">

                  <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-3">

                    Select RDA Categories ({selectedRDACategories.length} selected)

                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                    {rdaCategories.map(category => (

                      <label

                        key={category}

                        className="flex items-center gap-2 p-3 border border-[#e1e7ef] rounded-md hover:bg-[#f9fafb] cursor-pointer transition-colors"

                      >

                        <input

                          type="checkbox"

                          checked={selectedRDACategories.includes(category)}

                          onChange={() => toggleRDACategory(category)}

                          className="w-4 h-4 text-[#009da5] border-[#e1e7ef] rounded focus:ring-[#009da5]"

                        />

                        <span className="text-sm font-ibm-plex text-[#0f1729]">

                          {category}

                        </span>

                      </label>

                    ))}

                  </div>

                </div>

                

                {selectedRDACategories.length > 0 && (

                  <div className="bg-[#e1f4f5] border border-[#009da5] rounded-lg p-4 mt-4">

                    <p className="text-sm font-ibm-plex text-[#0f1729]">

                      <strong>Note:</strong> RDA values and % RDA met will be included for the selected categories.

                    </p>

                  </div>

                )}

              </div>

              

              {/* Modal Footer */}

              <div className="p-6 border-t border-[#e1e7ef] flex justify-end gap-3">

                <button

                  onClick={() => {

                    setSelectedRDACategories([])

                    setShowRDAModal(false)

                  }}

                  className="px-4 py-2 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] transition-colors"

                >

                  Cancel

                </button>

                <button

                  onClick={exportToExcel}

                  className="bg-[#009da5] border border-[#5bc4bf] flex items-center justify-center gap-2 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors"

                >

                  <Download className="w-4 h-4" />

                  Export

                </button>

              </div>

            </div>

          </div>

        )}

      </div>

    </Layout>

  )

}



export default Formulation

