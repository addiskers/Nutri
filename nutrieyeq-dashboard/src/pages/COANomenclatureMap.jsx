import { useState, useEffect } from 'react'
import Layout from '../components/Layout/Layout'
import AddSynonymModal from '../components/Modals/AddSynonymModal'
import AddNutrientGroupModal from '../components/Modals/AddNutrientGroupModal'
import DeleteConfirmModal from '../components/Modals/DeleteConfirmModal'
import EditNutrientGroupModal from '../components/Modals/EditNutrientGroupModal'
import EditMappingModal from '../components/Modals/EditMappingModal'
import { Search, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Loader, Download } from 'lucide-react'
import { coaNomenclatureService } from '../services/api'

const COANomenclatureMap = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddSynonymModal, setShowAddSynonymModal] = useState(false)
  const [showAddNutrientGroupModal, setShowAddNutrientGroupModal] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [editGroup, setEditGroup] = useState(null)
  const [editMapping, setEditMapping] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})

  const [nutrientGroups, setNutrientGroups] = useState([])
  const [loadingNutrients, setLoadingNutrients] = useState(false)
  const [nutrientsError, setNutrientsError] = useState(null)
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    fetchNomenclature()
  }, [])

  const fetchNomenclature = async () => {
    setLoadingNutrients(true)
    setNutrientsError(null)
    try {
      const result = await coaNomenclatureService.getAll({ limit: 300 })

      const transformedGroups = (result.mappings || []).map(mapping => ({
        id: mapping.id,
        name: mapping.standardized_name,
        targetUnit: mapping.target_unit,
        category: mapping.category,
        mappedCount: mapping.raw_names.length,
        mappings: mapping.raw_names.map((rawName, index) => ({
          id: `${mapping.id}-${index}`,
          rawName,
          standardName: mapping.standardized_name
        }))
      }))

      setNutrientGroups(transformedGroups)
    } catch (error) {
      console.error('Failed to fetch COA nomenclature:', error)
      setNutrientsError('Failed to load COA nomenclature mappings')
    } finally {
      setLoadingNutrients(false)
    }
  }

  const handleSeedNomenclature = async () => {
    setIsSeeding(true)
    try {
      const result = await coaNomenclatureService.seed()
      if (result.success !== false) {
        alert(`${result.message || 'Seed complete'}`)
        fetchNomenclature()
      } else {
        alert(result.error || 'Failed to seed COA nomenclature')
      }
    } catch (e) {
      alert('Failed to seed COA nomenclature')
    }
    setIsSeeding(false)
  }

  const handleToggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleAddSynonym = (group) => {
    setSelectedGroup({ ...group, existingStandardName: group.name })
    setShowAddSynonymModal(true)
  }

  const handleAddSynonyms = async (rawNames, standardName) => {
    if (!selectedGroup) return
    try {
      const currentRawNames = selectedGroup.mappings.map(m => m.rawName)
      const updatedRawNames = [...currentRawNames, ...rawNames]

      const result = await coaNomenclatureService.update(selectedGroup.id, {
        standardized_name: standardName,
        raw_names: updatedRawNames,
      })

      if (result.success) {
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

  const handleAddNutrientGroup = async (groupName) => {
    try {
      const result = await coaNomenclatureService.create({
        standardized_name: groupName,
        raw_names: [],
      })

      if (result.success) {
        await fetchNomenclature()
        alert('COA nutrient mapping added! You can now add synonyms to it.')
      } else {
        alert(`Failed to add nutrient: ${result.error}`)
      }
    } catch (error) {
      console.error('Error adding nutrient:', error)
      alert('Failed to add nutrient. Please try again.')
    }
  }

  const handleDeleteMapping = (groupId, mappingId, mappingName) => {
    setDeleteItem({ type: 'mapping', groupId, mappingId, name: mappingName })
  }

  const confirmDeleteMapping = async () => {
    if (!deleteItem || deleteItem.type !== 'mapping') return
    try {
      const group = nutrientGroups.find(g => g.id === deleteItem.groupId)
      if (!group) return
      const mapping = group.mappings.find(m => m.id === deleteItem.mappingId)
      if (!mapping) return

      const result = await coaNomenclatureService.removeSynonym(group.id, mapping.rawName)
      if (result.success) {
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

  const handleDeleteGroup = (group) => {
    setDeleteItem({ type: 'group', id: group.id, name: group.name })
  }

  const confirmDeleteGroup = async () => {
    if (!deleteItem || deleteItem.type !== 'group') return
    try {
      const result = await coaNomenclatureService.delete(deleteItem.id)
      if (result.success) {
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

  const handleEditGroup = (group) => {
    setEditGroup(group)
  }

  const handleSaveGroupEdit = async (newName) => {
    try {
      const result = await coaNomenclatureService.update(editGroup.id, {
        standardized_name: newName,
      })
      if (result.success) {
        await fetchNomenclature()
        setEditGroup(null)
        alert('Nutrient group updated successfully!')
      } else {
        alert(`Failed to update: ${result.error}`)
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
      const group = nutrientGroups.find(g => g.id === editMapping.groupId)
      if (!group) return
      const updatedRawNames = group.mappings.map(m =>
        m.id === editMapping.mapping.id ? rawName : m.rawName
      )
      const result = await coaNomenclatureService.update(group.id, {
        standardized_name: standardName,
        raw_names: updatedRawNames,
      })
      if (result.success) {
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

  const handleConfirmDelete = () => {
    if (!deleteItem) return
    if (deleteItem.type === 'mapping') confirmDeleteMapping()
    else if (deleteItem.type === 'group') confirmDeleteGroup()
  }

  const getFilteredMappings = (group, query) => {
    if (!query) return group.mappings
    const lq = query.toLowerCase()
    if (group.name.toLowerCase().includes(lq)) return group.mappings
    return group.mappings.filter(m =>
      m.rawName.toLowerCase().includes(lq) ||
      m.standardName.toLowerCase().includes(lq)
    )
  }

  const processedNutrientGroups = nutrientGroups
    .map(group => ({
      ...group,
      filteredMappings: getFilteredMappings(group, searchQuery),
    }))
    .filter(group => {
      if (!searchQuery) return true
      const lq = searchQuery.toLowerCase()
      return group.name.toLowerCase().includes(lq) || group.filteredMappings.length > 0
    })

  useEffect(() => {
    if (searchQuery) {
      const toExpand = {}
      nutrientGroups.forEach(group => {
        const lq = searchQuery.toLowerCase()
        if (
          group.name.toLowerCase().includes(lq) ||
          group.mappings.some(m => m.rawName.toLowerCase().includes(lq) || m.standardName.toLowerCase().includes(lq))
        ) {
          toExpand[group.id] = true
        }
      })
      setExpandedGroups(prev => ({ ...prev, ...toExpand }))
    }
  }, [searchQuery, nutrientGroups])

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col overflow-hidden">

        <div className="mb-6">
          <h1 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
            COA Nomenclature Map
          </h1>
          <p className="text-base font-ibm-plex text-[#65758b]">
            Map raw COA nutrient names to standardized terms used during extraction and formulation
          </p>
        </div>

        <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search by standardized name or raw name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              />
            </div>
            <button
              onClick={handleSeedNomenclature}
              disabled={isSeeding}
              className="bg-[#f9fafb] border border-[#e1e7ef] flex items-center justify-center gap-2 h-10 px-4 rounded-md font-ibm-plex font-medium text-sm text-[#0f1729] hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {isSeeding ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Seed from COA defaults
            </button>
            <button
              onClick={() => setShowAddNutrientGroupModal(true)}
              className="bg-[#009da5] flex items-center justify-center gap-2 h-10 px-4 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Mapping
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden h-full overflow-y-auto">
            {loadingNutrients ? (
              <div className="p-8 text-center">
                <Loader className="w-6 h-6 text-[#009da5] animate-spin mx-auto mb-2" />
                <p className="text-sm font-ibm-plex text-[#65758b]">Loading COA nomenclature mappings...</p>
              </div>
            ) : nutrientsError ? (
              <div className="p-8 text-center">
                <p className="text-sm font-ibm-plex text-[#ef4343]">{nutrientsError}</p>
              </div>
            ) : processedNutrientGroups.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  {searchQuery
                    ? `No mappings found matching "${searchQuery}"`
                    : 'No COA nomenclature mappings yet. Click "Seed from COA defaults" to populate, or "Add Mapping" to create one.'}
                </p>
              </div>
            ) : (
              processedNutrientGroups.map((group) => (
                <div key={group.id} className="border-b border-[#e1e7ef] last:border-b-0">

                  <div className="flex items-center justify-between p-4 hover:bg-[#f9fafb] transition-colors">
                    <button
                      onClick={() => handleToggleGroup(group.id)}
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm font-ibm-plex font-semibold text-[#0f1729]">
                          {group.name}
                        </div>
                        <div className="text-xs font-ibm-plex font-medium text-[#65758b]">
                          {group.mappedCount} synonym{group.mappedCount !== 1 ? 's' : ''}
                          {group.targetUnit && <span className="ml-2 text-[#009da5]">({group.targetUnit})</span>}
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
                                    <span className="text-sm font-ibm-plex text-[#65758b]">{mapping.standardName}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">{mapping.rawName}</span>
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
                              ? `No synonyms found matching "${searchQuery}"`
                              : 'No synonyms yet. Click "Add synonym" to add raw name mappings.'}
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
      </div>

      <AddSynonymModal
        isOpen={showAddSynonymModal}
        onClose={() => { setShowAddSynonymModal(false); setSelectedGroup(null) }}
        onSave={handleAddSynonyms}
        groupName={selectedGroup?.name}
        existingStandardName={selectedGroup?.existingStandardName}
      />

      <AddNutrientGroupModal
        isOpen={showAddNutrientGroupModal}
        onClose={() => setShowAddNutrientGroupModal(false)}
        onSave={handleAddNutrientGroup}
      />

      <DeleteConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleConfirmDelete}
        itemName={deleteItem?.name || ''}
        itemType={deleteItem?.type === 'mapping' ? 'mapping' : 'nutrient group'}
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
    </Layout>
  )
}

export default COANomenclatureMap
