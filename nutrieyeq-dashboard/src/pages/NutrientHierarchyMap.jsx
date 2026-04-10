import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout/Layout'
import {
  Search, ChevronDown, ChevronRight, Plus, Edit2, Trash2,
  Loader, Download, X, GitBranch, Tag, AlertTriangle
} from 'lucide-react'
import { nutrientHierarchyService, coaNomenclatureService } from '../services/api'

const RULE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'gte_sum', label: 'Parent >= Sum of children' },
  { value: 'collapse_variants', label: 'Collapse variants into one' },
]

const RULE_LABELS = {
  gte_sum: 'Sum',
  collapse_variants: 'Variants',
}

// ── Inline Modals ──────────────────────────────────────────────────────────

const NodeModal = ({ isOpen, onClose, onSave, initialData, parentName, allNodes, nomenclatureNames }) => {
  const [name, setName] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const [parent, setParent] = useState('')
  const [rule, setRule] = useState('')
  const [isAdditive, setIsAdditive] = useState(true)
  const [order, setOrder] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const initial = initialData?.nutrient_name || ''
      setName(initial)
      setNameSearch(initial)
      setParent(initialData?.parent_nutrient || parentName || '')
      setRule(initialData?.rule || '')
      setIsAdditive(initialData?.is_additive ?? true)
      setOrder(initialData?.display_order ?? 0)
      setShowNameDropdown(false)
    }
  }, [isOpen, initialData, parentName])

  if (!isOpen) return null

  const isEdit = !!initialData?.id
  const title = isEdit ? 'Edit Hierarchy Node' : 'Add Hierarchy Node'

  const filteredNames = (nomenclatureNames || []).filter(n =>
    n.toLowerCase().includes(nameSearch.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      nutrient_name: name.trim(),
      parent_nutrient: parent || null,
      rule: rule || null,
      is_additive: isAdditive,
      display_order: order,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#e1e7ef]">
          <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
            <X className="w-4 h-4 text-[#65758b]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="relative">
            <label className="block text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider mb-1">
              Nutrient Name * <span className="normal-case font-normal">(from COA Nomenclature)</span>
            </label>
            <input
              type="text"
              value={nameSearch}
              onChange={e => { setNameSearch(e.target.value); setName(e.target.value); setShowNameDropdown(true) }}
              onFocus={() => setShowNameDropdown(true)}
              placeholder="Search or type nutrient name..."
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              required
            />
            {showNameDropdown && filteredNames.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#e1e7ef] rounded-md shadow-lg">
                {filteredNames.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setName(n); setNameSearch(n); setShowNameDropdown(false) }}
                    className={`w-full text-left px-3 py-2 text-sm font-ibm-plex hover:bg-[#f1f5f9] transition-colors ${
                      n === name ? 'bg-[#e1f4f5] text-[#009da5] font-medium' : 'text-[#0f1729]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {showNameDropdown && nameSearch && filteredNames.length === 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#e1e7ef] rounded-md shadow-lg p-3">
                <p className="text-xs font-ibm-plex text-[#65758b] mb-1">No match in COA Nomenclature</p>
                <p className="text-xs font-ibm-plex text-[#009da5]">"{nameSearch}" will be used as a custom name</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider mb-1">
              Parent Nutrient
            </label>
            <select
              value={parent}
              onChange={e => setParent(e.target.value)}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
            >
              <option value="">None (root level)</option>
              {allNodes.filter(n => n.nutrient_name !== initialData?.nutrient_name).map(n => (
                <option key={n.id} value={n.nutrient_name}>{n.nutrient_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider mb-1">
              Rule
            </label>
            <select
              value={rule}
              onChange={e => setRule(e.target.value)}
              className="w-full h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
            >
              {RULE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdditive}
                onChange={e => setIsAdditive(e.target.checked)}
                className="w-4 h-4 rounded border-[#e1e7ef] text-[#009da5] focus:ring-[#009da5]"
              />
              <span className="text-sm font-ibm-plex text-[#0f1729]">Additive to parent sum</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">Order</label>
              <input
                type="number"
                value={order}
                onChange={e => setOrder(parseInt(e.target.value) || 0)}
                className="w-16 h-8 px-2 text-center bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              />
            </div>
          </div>
          {!isAdditive && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-ibm-plex text-amber-700">
                Non-additive means this nutrient is a subset of its parent (e.g. Added Sugars within Total Sugars) and won't be summed into the parent total.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-10 px-4 rounded-md border border-[#e1e7ef] text-sm font-ibm-plex font-medium text-[#65758b] hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="h-10 px-4 rounded-md bg-[#009da5] text-white text-sm font-ibm-plex font-medium hover:bg-[#008891] disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const VariantsModal = ({ isOpen, onClose, node, onSave, nomenclatureNames }) => {
  const [variants, setVariants] = useState([])
  const [newVariant, setNewVariant] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && node) {
      setVariants([...(node.variants || [])])
      setNewVariant('')
      setShowSuggestions(false)
    }
  }, [isOpen, node])

  if (!isOpen || !node) return null

  const filteredSuggestions = (nomenclatureNames || []).filter(n =>
    n.toLowerCase().includes(newVariant.toLowerCase()) &&
    !variants.includes(n) &&
    n !== node.nutrient_name
  )

  const handleAdd = () => {
    const v = newVariant.trim()
    if (v && !variants.includes(v)) {
      setVariants(prev => [...prev, v])
      setNewVariant('')
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (name) => {
    if (!variants.includes(name)) {
      setVariants(prev => [...prev, name])
    }
    setNewVariant('')
    setShowSuggestions(false)
  }

  const handleRemove = (idx) => {
    setVariants(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(node.id, variants)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#e1e7ef]">
          <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
            Manage Variants — {node.nutrient_name}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
            <X className="w-4 h-4 text-[#65758b]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-ibm-plex text-[#65758b]">
            These alternate names will be collapsed into "{node.nutrient_name}" during formulation calculations.
          </p>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={newVariant}
                onChange={e => { setNewVariant(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                placeholder="Search COA nomenclature or type name..."
                className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              />
              <button onClick={handleAdd} disabled={!newVariant.trim()}
                className="h-10 px-3 rounded-md bg-[#009da5] text-white text-sm font-ibm-plex font-medium hover:bg-[#008891] disabled:opacity-50">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {showSuggestions && newVariant && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-12 mt-1 max-h-36 overflow-y-auto bg-white border border-[#e1e7ef] rounded-md shadow-lg">
                {filteredSuggestions.slice(0, 10).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSelectSuggestion(n)}
                    className="w-full text-left px-3 py-2 text-sm font-ibm-plex text-[#0f1729] hover:bg-[#f1f5f9] transition-colors"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {variants.length === 0 ? (
              <p className="text-sm font-ibm-plex text-[#65758b] text-center py-4">No variants added yet</p>
            ) : (
              variants.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#f9fafb] border border-[#e1e7ef] rounded-md px-3 py-2">
                  <span className="text-sm font-ibm-plex text-[#0f1729]">{v}</span>
                  <button onClick={() => handleRemove(idx)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50">
                    <X className="w-3 h-3 text-[#ef4343]" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose}
              className="h-10 px-4 rounded-md border border-[#e1e7ef] text-sm font-ibm-plex font-medium text-[#65758b] hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="h-10 px-4 rounded-md bg-[#009da5] text-white text-sm font-ibm-plex font-medium hover:bg-[#008891] disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              Save Variants
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const DeleteModal = ({ isOpen, onClose, onConfirm, node, hasChildren }) => {
  const [cascade, setCascade] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (isOpen) setCascade(false) }, [isOpen])

  if (!isOpen || !node) return null

  const handleConfirm = async () => {
    setDeleting(true)
    await onConfirm(node.id, cascade)
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729] mb-2">Delete Node</h3>
          <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
            Are you sure you want to delete <strong>{node.nutrient_name}</strong>?
          </p>
          {hasChildren && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <p className="text-xs font-ibm-plex text-amber-700 mb-2">
                This node has children. Choose what happens to them:
              </p>
              <label className="flex items-center gap-2 mb-1 cursor-pointer">
                <input type="radio" checked={!cascade} onChange={() => setCascade(false)} className="text-[#009da5]" />
                <span className="text-xs font-ibm-plex text-[#0f1729]">Re-parent children to this node's parent</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={cascade} onChange={() => setCascade(true)} className="text-[#009da5]" />
                <span className="text-xs font-ibm-plex text-[#ef4343]">Delete all children (cascade)</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="h-9 px-4 rounded-md border border-[#e1e7ef] text-sm font-ibm-plex font-medium text-[#65758b] hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={deleting}
              className="h-9 px-4 rounded-md bg-[#ef4343] text-white text-sm font-ibm-plex font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-2">
              {deleting && <Loader className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tree Node Component ────────────────────────────────────────────────────

const TreeNode = ({ node, depth, expanded, onToggle, onEdit, onDelete, onAddChild, onManageVariants, searchQuery }) => {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expanded[node.id]
  const isMatch = searchQuery && node.nutrient_name.toLowerCase().includes(searchQuery.toLowerCase())

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2.5 px-3 hover:bg-[#f9fafb] transition-colors border-b border-[#e1e7ef] ${isMatch ? 'bg-teal-50/50' : ''}`}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        <button
          onClick={() => onToggle(node.id)}
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-[#65758b]" /> : <ChevronRight className="w-4 h-4 text-[#65758b]" />
          ) : (
            <span className="w-4 h-4 block border-l border-b border-[#e1e7ef] ml-1 mb-1" />
          )}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm font-ibm-plex ${hasChildren || depth === 0 ? 'font-semibold' : 'font-medium'} text-[#0f1729] truncate`}>
            {node.nutrient_name}
          </span>

          {node.rule && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-ibm-plex font-medium uppercase tracking-wider ${
              node.rule === 'gte_sum'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'bg-purple-50 text-purple-600 border border-purple-200'
            }`}>
              {node.rule === 'gte_sum' ? <GitBranch className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
              {RULE_LABELS[node.rule] || node.rule}
            </span>
          )}

          {!node.is_additive && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-ibm-plex font-medium uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
              Subset
            </span>
          )}

          {node.rule === 'collapse_variants' && node.variants?.length > 0 && (
            <span className="text-xs font-ibm-plex text-[#65758b] truncate max-w-[200px]">
              ({node.variants.length} variant{node.variants.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {node.rule === 'collapse_variants' && (
            <button
              onClick={() => onManageVariants(node)}
              className="h-7 px-2 flex items-center gap-1 rounded-md text-xs font-ibm-plex font-medium text-purple-600 hover:bg-purple-50 transition-colors border border-purple-200"
              title="Manage variants"
            >
              <Tag className="w-3 h-3" />
              Variants
            </button>
          )}
          <button
            onClick={() => onAddChild(node.nutrient_name)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
            title="Add child"
          >
            <Plus className="w-3.5 h-3.5 text-[#009da5]" />
          </button>
          <button
            onClick={() => onEdit(node)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
            title="Edit node"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#65758b]" />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#ef4343]" />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && node.children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onManageVariants={onManageVariants}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

const NutrientHierarchyMap = () => {
  const [tree, setTree] = useState([])
  const [flatNodes, setFlatNodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState({})

  const [showNodeModal, setShowNodeModal] = useState(false)
  const [editingNode, setEditingNode] = useState(null)
  const [addChildParent, setAddChildParent] = useState(null)

  const [showVariantsModal, setShowVariantsModal] = useState(false)
  const [variantsNode, setVariantsNode] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteNode, setDeleteNode] = useState(null)

  const [nomenclatureNames, setNomenclatureNames] = useState([])

  const fetchHierarchy = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [treeRes, flatRes] = await Promise.all([
        nutrientHierarchyService.getTree(),
        nutrientHierarchyService.getAll(),
      ])
      setTree(treeRes.tree || [])
      setFlatNodes(flatRes.nodes || [])
    } catch (e) {
      console.error('Failed to fetch hierarchy:', e)
      setError('Failed to load nutrient hierarchy')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHierarchy()
    coaNomenclatureService.getAll({ limit: 500 })
      .then(res => {
        const names = (res.mappings || []).map(m => m.standardized_name).sort()
        setNomenclatureNames(names)
      })
      .catch(err => console.error('Failed to load COA nomenclature names:', err))
  }, [fetchHierarchy])

  // Auto-expand all on search
  useEffect(() => {
    if (searchQuery) {
      const allIds = {}
      flatNodes.forEach(n => { allIds[n.id] = true })
      setExpanded(allIds)
    }
  }, [searchQuery, flatNodes])

  const handleToggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => {
    const allIds = {}
    flatNodes.forEach(n => { allIds[n.id] = true })
    setExpanded(allIds)
  }

  const collapseAll = () => setExpanded({})

  // ── CRUD handlers ──

  const handleSeed = async () => {
    setIsSeeding(true)
    try {
      const result = await nutrientHierarchyService.seed()
      if (result.success !== false) {
        alert(result.message || 'Seed complete')
        await fetchHierarchy()
        expandAll()
      } else {
        alert(result.error || 'Failed to seed hierarchy')
      }
    } catch {
      alert('Failed to seed hierarchy')
    }
    setIsSeeding(false)
  }

  const handleAddRoot = () => {
    setEditingNode(null)
    setAddChildParent(null)
    setShowNodeModal(true)
  }

  const handleAddChild = (parentName) => {
    setEditingNode(null)
    setAddChildParent(parentName)
    setShowNodeModal(true)
  }

  const handleEdit = (node) => {
    setEditingNode(node)
    setAddChildParent(null)
    setShowNodeModal(true)
  }

  const handleNodeSave = async (data) => {
    if (editingNode?.id) {
      const result = await nutrientHierarchyService.update(editingNode.id, data)
      if (result.success === false) {
        alert(result.error || 'Failed to update node')
        return
      }
    } else {
      const result = await nutrientHierarchyService.create(data)
      if (result.success === false) {
        alert(result.error || 'Failed to create node')
        return
      }
    }
    setShowNodeModal(false)
    setEditingNode(null)
    setAddChildParent(null)
    await fetchHierarchy()
  }

  const handleDeleteClick = (node) => {
    setDeleteNode(node)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async (nodeId, cascade) => {
    const result = await nutrientHierarchyService.remove(nodeId, cascade)
    if (result.success === false) {
      alert(result.error || 'Failed to delete node')
      return
    }
    setShowDeleteModal(false)
    setDeleteNode(null)
    await fetchHierarchy()
  }

  const handleManageVariants = (node) => {
    setVariantsNode(node)
    setShowVariantsModal(true)
  }

  const handleVariantsSave = async (nodeId, variants) => {
    const result = await nutrientHierarchyService.update(nodeId, { variants })
    if (result.success === false) {
      alert(result.error || 'Failed to update variants')
      return
    }
    setShowVariantsModal(false)
    setVariantsNode(null)
    await fetchHierarchy()
  }

  // ── Filter tree by search ──

  const filterTree = (nodes, query) => {
    if (!query) return nodes
    const lq = query.toLowerCase()
    return nodes.reduce((acc, node) => {
      const nameMatch = node.nutrient_name.toLowerCase().includes(lq)
      const variantMatch = (node.variants || []).some(v => v.toLowerCase().includes(lq))
      const filteredChildren = filterTree(node.children || [], query)
      if (nameMatch || variantMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children })
      }
      return acc
    }, [])
  }

  const displayTree = filterTree(tree, searchQuery)
  const deleteNodeHasChildren = deleteNode ? flatNodes.some(n => n.parent_nutrient === deleteNode.nutrient_name) : false

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col overflow-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
            Nutrient Hierarchy
          </h1>
          <p className="text-base font-ibm-plex text-[#65758b]">
            Define parent-child relationships between nutrients for formulation roll-up calculations
          </p>
        </div>

        <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search nutrients..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={expandAll}
                className="h-10 px-3 rounded-md border border-[#e1e7ef] text-xs font-ibm-plex font-medium text-[#65758b] hover:bg-gray-50 whitespace-nowrap">
                Expand All
              </button>
              <button onClick={collapseAll}
                className="h-10 px-3 rounded-md border border-[#e1e7ef] text-xs font-ibm-plex font-medium text-[#65758b] hover:bg-gray-50 whitespace-nowrap">
                Collapse All
              </button>
            </div>
            <button onClick={handleSeed} disabled={isSeeding}
              className="bg-[#f9fafb] border border-[#e1e7ef] flex items-center justify-center gap-2 h-10 px-4 rounded-md font-ibm-plex font-medium text-sm text-[#0f1729] hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50">
              {isSeeding ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Seed Defaults
            </button>
            <button onClick={handleAddRoot}
              className="bg-[#009da5] flex items-center justify-center gap-2 h-10 px-4 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Add Root Nutrient
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden h-full overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader className="w-6 h-6 text-[#009da5] animate-spin mx-auto mb-2" />
                <p className="text-sm font-ibm-plex text-[#65758b]">Loading hierarchy...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-sm font-ibm-plex text-[#ef4343]">{error}</p>
              </div>
            ) : displayTree.length === 0 ? (
              <div className="p-8 text-center">
                <GitBranch className="w-10 h-10 text-[#e1e7ef] mx-auto mb-3" />
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  {searchQuery
                    ? `No nutrients found matching "${searchQuery}"`
                    : 'No hierarchy defined yet. Click "Seed Defaults" to populate the standard nutrient hierarchy, or "Add Root Nutrient" to start from scratch.'}
                </p>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#f1f5f9] border-b border-[#e1e7ef]">
                  <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                    Nutrient
                  </span>
                  <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                    Actions
                  </span>
                </div>
                {displayTree.map(node => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onAddChild={handleAddChild}
                    onManageVariants={handleManageVariants}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NodeModal
        isOpen={showNodeModal}
        onClose={() => { setShowNodeModal(false); setEditingNode(null); setAddChildParent(null) }}
        onSave={handleNodeSave}
        initialData={editingNode}
        parentName={addChildParent}
        allNodes={flatNodes}
        nomenclatureNames={nomenclatureNames}
      />

      <VariantsModal
        isOpen={showVariantsModal}
        onClose={() => { setShowVariantsModal(false); setVariantsNode(null) }}
        node={variantsNode}
        onSave={handleVariantsSave}
        nomenclatureNames={nomenclatureNames}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteNode(null) }}
        onConfirm={handleDeleteConfirm}
        node={deleteNode}
        hasChildren={deleteNodeHasChildren}
      />
    </Layout>
  )
}

export default NutrientHierarchyMap
