import { useState, useEffect } from 'react'
import Layout from '../components/Layout/Layout'
import AddSynonymModal from '../components/Modals/AddSynonymModal'
import AddNutrientGroupModal from '../components/Modals/AddNutrientGroupModal'
import AddCategoryModal from '../components/Modals/AddCategoryModal'
import DeleteConfirmModal from '../components/Modals/DeleteConfirmModal'
import EditNutrientGroupModal from '../components/Modals/EditNutrientGroupModal'
import EditMappingModal from '../components/Modals/EditMappingModal'
import EditCategoryModal from '../components/Modals/EditCategoryModal'
import { Search, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Loader } from 'lucide-react'
import { categoryService, nomenclatureService } from '../services/api'

const NomenclatureMap = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddSynonymModal, setShowAddSynonymModal] = useState(false)
  const [showAddNutrientGroupModal, setShowAddNutrientGroupModal] = useState(false)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [editGroup, setEditGroup] = useState(null)
  const [editMapping, setEditMapping] = useState(null)
  const [editCategory, setEditCategory] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})

  const [nutrientGroups, setNutrientGroups] = useState([])
  const [loadingNutrients, setLoadingNutrients] = useState(false)
  const [nutrientsError, setNutrientsError] = useState(null)

  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoriesError, setCategoriesError] = useState(null)

  // Fetch nomenclature and categories from database
  useEffect(() => {
    fetchNomenclature()
    fetchCategories()
  }, [])

  const fetchNomenclature = async () => {
    setLoadingNutrients(true)
    setNutrientsError(null)
    try {
      const result = await nomenclatureService.getNomenclature({ limit: 200 })
      
      // Transform nomenclature data to match the UI structure
      const transformedGroups = (result.mappings || []).map(mapping => ({
        id: mapping.id,
        name: mapping.standardized_name,
        mappedCount: mapping.raw_names.length,
        mappings: mapping.raw_names.map((rawName, index) => ({
          id: `${mapping.id}-${index}`,
          rawName: rawName,
          standardName: mapping.standardized_name
        }))
      }))
      
      setNutrientGroups(transformedGroups)
    } catch (error) {
      console.error('Failed to fetch nomenclature:', error)
      setNutrientsError('Failed to load nomenclature mappings')
    } finally {
      setLoadingNutrients(false)
    }
  }

  const fetchCategories = async () => {
    setLoadingCategories(true)
    setCategoriesError(null)
    try {
      const result = await categoryService.getCategories({ limit: 100 })
      setCategories(result.categories || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      setCategoriesError('Failed to load categories')
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleToggleGroup = (groupId) => {
    setExpandedGroups({
      ...expandedGroups,
      [groupId]: !expandedGroups[groupId]
    })
  }

  const handleAddSynonym = (group) => {
    // Get existing standardized name if group has mappings
    const existingStandardName = group.mappings.length > 0 
      ? group.mappings[0].standardName 
      : ''
    
    setSelectedGroup({ ...group, existingStandardName })
    setShowAddSynonymModal(true)
  }

  const handleAddSynonyms = async (rawNames, standardName) => {
    if (selectedGroup) {
      try {
        // Combine existing raw_names with new ones
        const currentRawNames = selectedGroup.mappings.map(m => m.rawName)
        const updatedRawNames = [...currentRawNames, ...rawNames]
        
        // Also update the standardized name if it changed
        const updateData = {
          standardized_name: standardName,
          raw_names: updatedRawNames
        }
        
        const result = await nomenclatureService.updateNomenclature(selectedGroup.id, updateData)
        
        if (result.success) {
          // Refresh nomenclature list
          await fetchNomenclature()
          alert('Synonyms added successfully!')
        } else {
          alert(`Failed to add synonyms: ${result.error}`)
        }
      } catch (error) {
        console.error('Error adding synonyms:', error)
        alert('Failed to add synonyms. Please try again.')
      }
    }
  }

  const handleAddNutrientGroup = async (groupName) => {
    try {
      const result = await nomenclatureService.createNomenclature({
        standardized_name: groupName,
        raw_names: [] // Start with empty raw_names
      })
      
      if (result.success) {
        // Refresh nomenclature list
        await fetchNomenclature()
        alert('Nutrient added successfully! You can now add synonyms to it.')
      } else {
        alert(`Failed to add nutrient: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding nutrient:', error)
      alert('Failed to add nutrient. Please try again.')
    }
  }

  const handleDeleteMapping = (groupId, mappingId, mappingName) => {
    setDeleteItem({
      type: 'mapping',
      groupId,
      mappingId,
      name: mappingName
    })
  }

  const confirmDeleteMapping = async () => {
    if (deleteItem && deleteItem.type === 'mapping') {
      try {
        // Find the group and the raw name to delete
        const group = nutrientGroups.find(g => g.id === deleteItem.groupId)
        if (!group) return
        
        const mapping = group.mappings.find(m => m.id === deleteItem.mappingId)
        if (!mapping) return
        
        const result = await nomenclatureService.removeSynonym(group.id, mapping.rawName)
        
        if (result.success) {
          // Refresh nomenclature list
          await fetchNomenclature()
          setDeleteItem(null)
          alert('Synonym deleted successfully!')
        } else {
          alert(`Failed to delete synonym: ${result.error}`)
        }
      } catch (error) {
        console.error('Error deleting synonym:', error)
        alert('Failed to delete synonym. Please try again.')
      }
    }
  }

  const handleDeleteGroup = (group) => {
    setDeleteItem({
      type: 'group',
      id: group.id,
      name: group.name
    })
  }

  const confirmDeleteGroup = async () => {
    if (deleteItem && deleteItem.type === 'group') {
      try {
        const result = await nomenclatureService.deleteNomenclature(deleteItem.id)
        
        if (result.success) {
          // Refresh nomenclature list
          await fetchNomenclature()
          setDeleteItem(null)
          alert('Nutrient group deleted successfully!')
        } else {
          alert(`Failed to delete nutrient group: ${result.error}`)
        }
      } catch (error) {
        console.error('Error deleting nutrient group:', error)
        alert('Failed to delete nutrient group. Please try again.')
      }
    }
  }

  const handleEditGroup = (group) => {
    setEditGroup(group)
  }

  const handleSaveGroupEdit = async (newName) => {
    try {
      const result = await nomenclatureService.updateNomenclature(editGroup.id, {
        standardized_name: newName
      })
      
      if (result.success) {
        // Refresh nomenclature list
        await fetchNomenclature()
        setEditGroup(null)
        alert('Nutrient group updated successfully!')
      } else {
        alert(`Failed to update nutrient group: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating nutrient group:', error)
      alert('Failed to update nutrient group. Please try again.')
    }
  }

  const handleEditMapping = (groupId, mapping) => {
    setEditMapping({ groupId, mapping })
  }

  const handleSaveMappingEdit = async (rawName, standardName) => {
    try {
      // Find the group
      const group = nutrientGroups.find(g => g.id === editMapping.groupId)
      if (!group) return
      
      // Find the old raw name to replace
      const oldMapping = group.mappings.find(m => m.id === editMapping.mapping.id)
      if (!oldMapping) return
      
      // Update raw_names array - replace old with new
      const updatedRawNames = group.mappings.map(m => 
        m.id === editMapping.mapping.id ? rawName : m.rawName
      )
      
      const result = await nomenclatureService.updateNomenclature(group.id, {
        standardized_name: standardName,
        raw_names: updatedRawNames
      })
      
      if (result.success) {
        // Refresh nomenclature list
        await fetchNomenclature()
        setEditMapping(null)
        alert('Mapping updated successfully!')
      } else {
        alert(`Failed to update mapping: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating mapping:', error)
      alert('Failed to update mapping. Please try again.')
    }
  }

  const handleAddCategory = async (categoryName, description) => {
    try {
      const result = await categoryService.createCategory({
        name: categoryName,
        description: description || 'Used for product classification'
      })
      
      if (result.success) {
        // Refresh categories list
        await fetchCategories()
        alert('Category added successfully!')
      } else {
        alert(`Failed to add category: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding category:', error)
      alert('Failed to add category. Please try again.')
    }
  }

  const handleDeleteCategory = (category) => {
    setDeleteItem({
      type: 'category',
      id: category.id,
      name: category.name
    })
  }

  const confirmDeleteCategory = async () => {
    if (deleteItem && deleteItem.type === 'category') {
      try {
        const result = await categoryService.deleteCategory(deleteItem.id)
        
        if (result.success) {
          // Refresh categories list
          await fetchCategories()
          setDeleteItem(null)
          alert('Category deleted successfully!')
        } else {
          alert(`Failed to delete category: ${result.error}`)
        }
      } catch (error) {
        console.error('Error deleting category:', error)
        alert('Failed to delete category. Please try again.')
      }
    }
  }

  const handleEditCategory = (category) => {
    setEditCategory(category)
  }

  const handleSaveCategoryEdit = async (newName, newDescription) => {
    try {
      const result = await categoryService.updateCategory(editCategory.id, {
        name: newName,
        description: newDescription
      })
      
      if (result.success) {
        // Refresh categories list
        await fetchCategories()
        setEditCategory(null)
        alert('Category updated successfully!')
      } else {
        alert(`Failed to update category: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating category:', error)
      alert('Failed to update category. Please try again.')
    }
  }

  const handleConfirmDelete = () => {
    if (deleteItem) {
      if (deleteItem.type === 'mapping') {
        confirmDeleteMapping()
      } else if (deleteItem.type === 'group') {
        confirmDeleteGroup()
      } else if (deleteItem.type === 'category') {
        confirmDeleteCategory()
      }
    }
  }

  // Filter groups and mappings based on search query
  // Search in: 1) Group name (show all mappings if group matches), 2) Standardized names
  const getFilteredMappings = (group, query) => {
    if (!query) return group.mappings
    
    const lowerQuery = query.toLowerCase()
    
    // If group name matches, return ALL mappings in that group
    if (group.name.toLowerCase().includes(lowerQuery)) {
      return group.mappings
    }
    
    // Otherwise, filter by standardized names only
    return group.mappings.filter(mapping =>
      mapping.standardName.toLowerCase().includes(lowerQuery)
    )
  }

  // Process nutrient groups with filtered mappings
  const processedNutrientGroups = nutrientGroups
    .map(group => ({
      ...group,
      filteredMappings: getFilteredMappings(group, searchQuery),
      hasMatchingMappings: searchQuery ? getFilteredMappings(group, searchQuery).length > 0 : false
    }))
    .filter(group => {
      // If no search query, show all groups
      if (!searchQuery) return true
      
      const query = searchQuery.toLowerCase()
      
      // Show group if its name matches OR if it has matching mappings
      const groupNameMatches = group.name.toLowerCase().includes(query)
      const hasMatchingMappings = group.filteredMappings.length > 0
      
      return groupNameMatches || hasMatchingMappings
    })

  // Auto-expand groups with matching results when searching
  useEffect(() => {
    if (searchQuery) {
      const groupsToExpand = {}
      nutrientGroups.forEach(group => {
        const query = searchQuery.toLowerCase()
        
        // Expand if group name matches OR if any mapping matches
        const groupNameMatches = group.name.toLowerCase().includes(query)
        const hasMatchingMapping = group.mappings.some(mapping =>
          mapping.standardName.toLowerCase().includes(query)
        )
        
        if (groupNameMatches || hasMatchingMapping) {
          groupsToExpand[group.id] = true
        }
      })
      setExpandedGroups(prev => ({ ...prev, ...groupsToExpand }))
    }
  }, [searchQuery, nutrientGroups])

  // Categories are NOT filtered by search (always show all)
  const filteredCategories = categories

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col overflow-hidden">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
            Nomenclature Map
          </h1>
          <p className="text-base font-ibm-plex text-[#65758b]">
            Map raw source nutrients to standardized terms for consistent analytics and formulation
          </p>
        </div>

        {/* Search Bar with Add Nutrient Button */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search by standardized name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setShowAddNutrientGroupModal(true)}
              className="bg-[#b455a0] flex items-center justify-center gap-2 h-10 px-4 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Nutrient
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
          {/* Left Column - Nutrient Groups */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden flex-1 overflow-y-auto">
            {loadingNutrients ? (
              <div className="p-8 text-center">
                <Loader className="w-6 h-6 text-[#b455a0] animate-spin mx-auto mb-2" />
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  Loading nomenclature mappings...
                </p>
              </div>
            ) : nutrientsError ? (
              <div className="p-8 text-center">
                <p className="text-sm font-ibm-plex text-[#ef4343]">
                  {nutrientsError}
                </p>
              </div>
            ) : processedNutrientGroups.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  {searchQuery 
                    ? `No groups or mappings found matching "${searchQuery}"` 
                    : 'No nutrient groups available'}
                </p>
              </div>
            ) : (
              processedNutrientGroups.map((group) => (
              <div key={group.id} className="border-b border-[#e1e7ef] last:border-b-0">
                {/* Group Header */}
                <div className="flex items-center justify-between p-4 hover:bg-[#f9fafb] transition-colors">
                  <button
                    onClick={() => handleToggleGroup(group.id)}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-ibm-plex font-semibold text-[#0f1729]">
                        {group.name}
                      </div>
                      <div className="text-xs font-ibm-plex font-medium text-[#65758b]">
                        {group.mappedCount} mapped term{group.mappedCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {expandedGroups[group.id] ? (
                      <ChevronUp className="w-4 h-4 text-[#65758b]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#65758b]" />
                    )}
                  </button>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleEditGroup(group)}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                      title="Edit group name"
                    >
                      <Edit2 className="w-4 h-4 text-[#65758b]" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group)}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="w-4 h-4 text-[#ef4343]" />
                    </button>
                    <button
                      onClick={() => handleAddSynonym(group)}
                      className="bg-[#f9fafb] border border-[#e1e7ef] flex items-center gap-2 h-9 px-4 rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add synonym
                    </button>
                  </div>
                </div>

                {/* Expanded Group Table */}
                {expandedGroups[group.id] && (
                  <div className="px-4 pb-4">
                    {group.filteredMappings.length > 0 ? (
                      <div className="border border-[#e1e7ef] rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-[rgba(241,245,249,0.5)] border-b border-[#e1e7ef]">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                                  Standardized Name
                                </span>
                              </th>
                              <th className="px-4 py-3 text-left">
                                <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                                  Raw / Source Name
                                </span>
                              </th>
                              <th className="px-4 py-3 text-right w-20">
                                <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                                  Action
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.filteredMappings.map((mapping) => (
                              <tr key={mapping.id} className="border-b border-[#e1e7ef] last:border-b-0">
                                <td className="px-4 py-3">
                                  <span className="text-sm font-ibm-plex text-[#65758b]">
                                    {mapping.standardName}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                                    {mapping.rawName}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleEditMapping(group.id, mapping)}
                                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                                      title="Edit mapping"
                                    >
                                      <Edit2 className="w-4 h-4 text-[#65758b]" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMapping(group.id, mapping.id, mapping.rawName)}
                                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                                      title="Delete mapping"
                                    >
                                      <Trash2 className="w-4 h-4 text-[#ef4343]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm font-ibm-plex text-[#65758b]">
                          {searchQuery 
                            ? `No mappings found matching "${searchQuery}"` 
                            : 'No mappings yet. Click "Add synonym" to add mappings.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              ))
            )}
            </div>
          </div>

          {/* Right Column - Categories */}
          <div className="w-full lg:w-96 flex flex-col overflow-hidden min-h-0">
            <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
              {/* Categories Header */}
            <div className="p-4 border-b border-[#e1e7ef]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-1">
                    Categories
                  </h3>
                  <p className="text-xs font-ibm-plex text-[#65758b]">
                    Manage product categories used across the platform
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="w-full bg-[#b455a0] flex items-center justify-center gap-2 h-9 px-4 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingCategories ? (
                <div className="text-center py-8">
                  <Loader className="w-6 h-6 text-[#b455a0] animate-spin mx-auto mb-2" />
                  <p className="text-sm font-ibm-plex text-[#65758b]">
                    Loading categories...
                  </p>
                </div>
              ) : categoriesError ? (
                <div className="text-center py-8">
                  <p className="text-sm font-ibm-plex text-[#ef4343]">
                    {categoriesError}
                  </p>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm font-ibm-plex text-[#65758b]">
                    No categories available
                  </p>
                </div>
              ) : (
                filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-[#f9fafb] border border-[#e1e7ef] rounded-lg p-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-0.5">
                        {category.name}
                      </div>
                      <div className="text-xs font-ibm-plex text-[#65758b]">
                        {category.description || 'No description'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                        title="Edit category"
                      >
                        <Edit2 className="w-4 h-4 text-[#65758b]" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4 text-[#ef4343]" />
                      </button>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Modals */}
      <AddSynonymModal
        isOpen={showAddSynonymModal}
        onClose={() => {
          setShowAddSynonymModal(false)
          setSelectedGroup(null)
        }}
        onSave={handleAddSynonyms}
        groupName={selectedGroup?.name}
        existingStandardName={selectedGroup?.existingStandardName}
      />

      <AddNutrientGroupModal
        isOpen={showAddNutrientGroupModal}
        onClose={() => setShowAddNutrientGroupModal(false)}
        onSave={handleAddNutrientGroup}
      />

      <AddCategoryModal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onSave={handleAddCategory}
      />

      <DeleteConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleConfirmDelete}
        itemName={deleteItem?.name || ''}
        itemType={deleteItem?.type === 'mapping' ? 'mapping' : deleteItem?.type === 'group' ? 'nutrient group' : 'category'}
      />

      <EditNutrientGroupModal
        isOpen={!!editGroup}
        onClose={() => setEditGroup(null)}
        onSave={handleSaveGroupEdit}
        group={editGroup}
      />

      <EditMappingModal
        isOpen={!!editMapping}
        onClose={() => setEditMapping(null)}
        onSave={handleSaveMappingEdit}
        mapping={editMapping}
      />

      <EditCategoryModal
        isOpen={!!editCategory}
        onClose={() => setEditCategory(null)}
        onSave={handleSaveCategoryEdit}
        category={editCategory}
      />
    </Layout>
  )
}

export default NomenclatureMap

