import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react'
import {
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  GitBranch,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const cloneTree = (nodes) =>
  nodes.map((n) => ({
    ...n,
    children: n.children ? cloneTree(n.children) : [],
  }))

const stripTreeForPersist = (nodes) => {
  if (!nodes?.length) return []
  return nodes.map((n) => ({
    nutrient_name: n.nutrient_name,
    rule: n.rule ?? null,
    is_additive: n.is_additive !== false,
    variants: Array.isArray(n.variants) ? [...n.variants] : [],
    children: n.children?.length ? stripTreeForPersist(n.children) : [],
  }))
}

const collectExpandedNutrientNames = (nodes, expanded) => {
  const names = []
  const walk = (list) => {
    for (const n of list || []) {
      if (n.children?.length > 0 && expanded[n._uid]) names.push(n.nutrient_name)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return names
}

let _uid = 0
const assignIds = (nodes, parentId = null) => {
  for (const node of nodes) {
    node._uid = `node-${++_uid}`
    node._parentUid = parentId
    if (node.children?.length > 0) assignIds(node.children, node._uid)
  }
}

const flattenTree = (nodes, depth = 0, expanded) => {
  const result = []
  for (const node of nodes) {
    result.push({ ...node, _depth: depth })
    if (node.children?.length > 0 && expanded[node._uid]) {
      result.push(...flattenTree(node.children, depth + 1, expanded))
    }
  }
  return result
}

const findNode = (nodes, uid) => {
  for (const n of nodes) {
    if (n._uid === uid) return n
    if (n.children?.length > 0) {
      const found = findNode(n.children, uid)
      if (found) return found
    }
  }
  return null
}

const removeNode = (nodes, uid) => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]._uid === uid) {
      return nodes.splice(i, 1)[0]
    }
    if (nodes[i].children?.length > 0) {
      const found = removeNode(nodes[i].children, uid)
      if (found) return found
    }
  }
  return null
}

const insertAfter = (siblings, afterUid, node) => {
  const idx = siblings.findIndex((n) => n._uid === afterUid)
  if (idx === -1) {
    siblings.push(node)
  } else {
    siblings.splice(idx + 1, 0, node)
  }
}

const getParentList = (tree, uid) => {
  for (const n of tree) {
    if (n._uid === uid) return tree
    if (n.children?.length > 0) {
      const found = getParentList(n.children, uid)
      if (found) return found
    }
  }
  return null
}

const computeSums = (nodes, nutritionalData) => {
  const sums = {}

  const process = (node) => {
    const key = node.nutrient_name
    const data = nutritionalData[key]
    const directValue = data?.actual ?? data?.average ?? null

    if (node.children?.length > 0) {
      for (const child of node.children) process(child)

      if (node.rule === 'gte_sum') {
        const childSum = node.children
          .filter((c) => c.is_additive !== false)
          .reduce((sum, c) => sum + (sums[c._uid]?.value ?? 0), 0)

        const hasChildData = node.children.some(
          (c) => sums[c._uid]?.value != null && sums[c._uid]?.value > 0
        )

        if (directValue != null && directValue > 0) {
          sums[node._uid] = {
            value: directValue,
            isInferred: false,
            childSum,
          }
        } else if (hasChildData) {
          sums[node._uid] = {
            value: childSum,
            isInferred: true,
            childSum,
          }
        } else {
          sums[node._uid] = { value: null, isInferred: false, childSum: 0 }
        }
      } else {
        sums[node._uid] = {
          value: directValue,
          isInferred: false,
          childSum: 0,
        }
      }
    } else {
      sums[node._uid] = {
        value: directValue != null ? directValue : null,
        isInferred: false,
        childSum: 0,
      }
    }
  }

  for (const root of nodes) process(root)
  return sums
}

const subtreeHasValue = (node, sums) => {
  if (sums[node._uid]?.value != null) return true
  if (!node.children?.length) return false
  return node.children.some((c) => subtreeHasValue(c, sums))
}

const previewNutrientNumber = (cell) => {
  if (!cell || typeof cell !== 'object') return null
  const v = cell.actual ?? cell.average ?? cell.min ?? cell.max
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const DraggableRow = ({
  node,
  depth,
  isExpanded,
  onToggle,
  sumInfo,
  rawNameMap,
  onAddChild,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node._uid })

  const rowRef = useRef(null)
  const setRefs = useCallback((node) => {
    rowRef.current = node
    setNodeRef(node)
  }, [setNodeRef])
  const transformStr = CSS.Transform.toString(transform)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    el.style.transform = transformStr || ''
    el.style.transition = transition || ''
    el.style.opacity = isDragging ? '0.4' : '1'
  }, [transformStr, transition, isDragging])

  const handleRef = useRef(null)
  useEffect(() => {
    if (handleRef.current) handleRef.current.style.marginLeft = `${depth * 20}px`
  }, [depth])

  const hasChildren = node.children?.length > 0
  const value = sumInfo?.value
  const isInferred = sumInfo?.isInferred
  const rawName = rawNameMap[node.nutrient_name]
  const showRawName = rawName && rawName !== node.nutrient_name
  const level = depth + 1
  const depthBarColors = [
    'border-l-[#009da5]',
    'border-l-[#0d9488]',
    'border-l-[#5b8aa8]',
    'border-l-[#94a3b8]',
    'border-l-[#cbd5e1]',
    'border-l-[#e2e8f0]',
  ]
  const depthBarClass =
    depth > 0 ? `border-l-[3px] ${depthBarColors[Math.min(depth - 1, depthBarColors.length - 1)]}` : ''

  return (
    <div
      ref={setRefs}
      title={
        depth === 0
          ? 'Level 1 — top of hierarchy'
          : `Level ${level} — ${depth === 1 ? 'one step under parent' : depth === 2 ? 'two steps under root' : `${depth} steps under root`}`
      }
      className={`flex items-center gap-2 py-2.5 px-3 border-b border-[#e1e7ef] hover:bg-[#f9fafb] transition-colors ${depthBarClass} ${
        isDragging ? 'bg-blue-50' : ''
      }`}
    >

      <button
        ref={handleRef}
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-[#c0c7d1] hover:text-[#65758b] transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={() => hasChildren && onToggle(node._uid)}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#65758b]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#65758b]" />
          )
        ) : (
          <span className="w-4 h-4 block border-l border-b border-[#e1e7ef] ml-1 mb-1" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {depth > 0 && (
          <span className="flex-shrink-0 text-[10px] font-ibm-plex font-bold tabular-nums text-[#009da5] bg-[#e1f4f5] px-1.5 py-0.5 rounded">
            L{level}
          </span>
        )}
        <span
          className={`text-sm font-ibm-plex truncate min-w-0 ${
            depth === 0
              ? 'font-semibold text-[#0f1729]'
              : depth === 1
                ? 'font-semibold text-[#1e293b]'
                : depth === 2
                  ? 'font-medium text-[#475569]'
                  : 'font-normal text-[#64748b] text-[13px]'
          }`}
        >
          {node.nutrient_name}
        </span>

        {showRawName && (
          <span className="text-xs font-ibm-plex text-[#65758b] truncate">
            — {rawName}
          </span>
        )}

        {node.rule === 'gte_sum' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-ibm-plex font-medium uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
            Σ SUM
          </span>
        )}

        {node.rule === 'collapse_variants' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-ibm-plex font-medium uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-200 flex-shrink-0">
            Variants
          </span>
        )}
      </div>

      <div className="flex-shrink-0 w-24 text-right">
        {value != null ? (
          <span
            className={`text-sm font-ibm-plex tabular-nums ${
              isInferred
                ? 'text-[#009da5] font-medium'
                : 'text-[#0f1729]'
            }`}
          >
            {isInferred ? 'Σ ' : ''}
            {Number(value).toFixed(2)}
          </span>
        ) : (
          <span className="text-sm font-ibm-plex text-[#c0c7d1]">—</span>
        )}
      </div>

      <div className="flex-shrink-0 w-10 text-right">
        <span className="text-xs font-ibm-plex text-[#65758b]">g</span>
      </div>

      <div className="flex-shrink-0 flex items-center gap-0.5 pl-1">
        <button
          type="button"
          title="Add sub-nutrient under this row"
          onClick={(e) => {
            e.stopPropagation()
            onAddChild(node._uid)
          }}
          className="p-1.5 rounded-md text-[#65758b] hover:bg-[#e1f4f5] hover:text-[#009da5] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Remove this row (and any children) from this view"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node._uid)
          }}
          className="p-1.5 rounded-md text-[#65758b] hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

const DragOverlayRow = ({ node, rawNameMap }) => {
  const rawName = rawNameMap[node?.nutrient_name]
  const showRawName = rawName && rawName !== node?.nutrient_name

  if (!node) return null

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 bg-white border border-[#009da5] rounded-lg shadow-lg opacity-90">
      <GripVertical className="w-4 h-4 text-[#009da5]" />
      <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
        {node.nutrient_name}
      </span>
      {showRawName && (
        <span className="text-xs font-ibm-plex text-[#65758b]">
          — {rawName}
        </span>
      )}
    </div>
  )
}

const NutrientHierarchyViewerModal = ({
  isOpen,
  onClose,
  ingredientName,
  nutritionalData,
  hierarchyTree: globalTree,
  viewerSession,
}) => {
  const [localTree, setLocalTree] = useState([])
  const [expanded, setExpanded] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [hideWithoutValues, setHideWithoutValues] = useState(false)
  const [rootNutrientPick, setRootNutrientPick] = useState('')
  const [addChildParentUid, setAddChildParentUid] = useState(null)
  const [childNutrientPick, setChildNutrientPick] = useState('')
  const scrollAreaRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (!isOpen) return
    _uid = 0

    const tree = globalTree ? cloneTree(globalTree) : []
    assignIds(tree)

    const hierarchyNames = new Set()
    const collectNames = (nodes) => {
      for (const n of nodes) {
        hierarchyNames.add(n.nutrient_name)

        if (n.variants?.length > 0) {
          n.variants.forEach((v) => hierarchyNames.add(v))
        }
        if (n.children?.length > 0) collectNames(n.children)
      }
    }
    collectNames(tree)

    if (nutritionalData) {
      for (const key of Object.keys(nutritionalData)) {
        if (!hierarchyNames.has(key)) {
          tree.push({
            _uid: `node-${++_uid}`,
            _parentUid: null,
            nutrient_name: key,
            rule: null,
            is_additive: true,
            variants: [],
            children: [],
          })
        }
      }
    }

    setLocalTree(tree)

    const expandAll = (nodes, acc) => {
      for (const n of nodes) {
        if (n.children?.length > 0) {
          acc[n._uid] = true
          expandAll(n.children, acc)
        }
      }
    }

    if (viewerSession?.expandedNutrientNames?.length > 0) {
      const open = new Set(viewerSession.expandedNutrientNames)
      const nextExpanded = {}
      const mark = (nodes) => {
        for (const n of nodes) {
          if (n.children?.length > 0) {
            nextExpanded[n._uid] = open.has(n.nutrient_name)
            mark(n.children)
          }
        }
      }
      mark(tree)
      setExpanded(nextExpanded)
    } else {
      const allExpanded = {}
      expandAll(tree, allExpanded)
      setExpanded(allExpanded)
    }
    setHideWithoutValues(false)
    setRootNutrientPick('')
    setAddChildParentUid(null)
    setChildNutrientPick('')
  }, [isOpen, globalTree, nutritionalData, viewerSession])

  useLayoutEffect(() => {
    if (!isOpen || !scrollAreaRef.current || !localTree.length) return
    const st = viewerSession?.scrollTop
    if (typeof st === 'number' && st > 0) {
      scrollAreaRef.current.scrollTop = st
    }
  }, [isOpen, localTree, viewerSession?.scrollTop])

  const handleClose = useCallback(() => {
    onClose?.({
      tree: stripTreeForPersist(localTree),
      scrollTop: scrollAreaRef.current?.scrollTop ?? 0,
      expandedNutrientNames: collectExpandedNutrientNames(localTree, expanded),
    })
  }, [localTree, expanded, onClose])

  const rawNameMap = useMemo(() => {
    if (!nutritionalData || !localTree.length) return {}
    const map = {}
    const dataKeys = Object.keys(nutritionalData)

    const process = (nodes) => {
      for (const node of nodes) {

        if (dataKeys.includes(node.nutrient_name)) {

        }

        if (node.variants?.length > 0) {
          for (const variant of node.variants) {
            if (dataKeys.includes(variant)) {
              map[node.nutrient_name] = variant
              break
            }
          }
        }
        if (node.children?.length > 0) process(node.children)
      }
    }
    process(localTree)
    return map
  }, [localTree, nutritionalData])

  const effectiveData = useMemo(() => {
    if (!nutritionalData) return {}
    const data = { ...nutritionalData }

    const mergeVariants = (nodes) => {
      for (const node of nodes) {
        if (node.rule === 'collapse_variants' && node.variants?.length > 0) {
          const canonical = node.nutrient_name
          for (const variant of node.variants) {
            if (data[variant] && variant !== canonical) {
              if (!data[canonical]) {
                data[canonical] = { ...data[variant] }
              } else {

                const existing = data[canonical]
                const adding = data[variant]
                data[canonical] = {
                  actual:
                    (existing.actual ?? 0) + (adding.actual ?? 0) || null,
                  min: (existing.min ?? 0) + (adding.min ?? 0) || null,
                  max: (existing.max ?? 0) + (adding.max ?? 0) || null,
                  average:
                    (existing.average ?? 0) + (adding.average ?? 0) || null,
                }
              }
            }
          }
        }
        if (node.children?.length > 0) mergeVariants(node.children)
      }
    }
    mergeVariants(localTree)
    return data
  }, [nutritionalData, localTree])

  const sums = useMemo(
    () => computeSums(localTree, effectiveData),
    [localTree, effectiveData]
  )

  const flatItems = useMemo(
    () => flattenTree(localTree, 0, expanded),
    [localTree, expanded]
  )

  const displayFlatItems = useMemo(() => {
    if (!hideWithoutValues) return flatItems
    return flatItems.filter((node) => subtreeHasValue(node, sums))
  }, [flatItems, hideWithoutValues, sums])

  const parentNodeForChildAdd = addChildParentUid
    ? findNode(localTree, addChildParentUid)
    : null

  const childAddOptions = useMemo(() => {
    if (!nutritionalData || !addChildParentUid) return []
    const keys = Object.keys(nutritionalData).sort((a, b) =>
      a.localeCompare(b)
    )
    const parent = findNode(localTree, addChildParentUid)
    const taken = new Set((parent?.children || []).map((c) => c.nutrient_name))
    return keys.filter((k) => !taken.has(k))
  }, [nutritionalData, addChildParentUid, localTree])

  const rootAddOptions = useMemo(() => {
    if (!nutritionalData) return []
    const keys = Object.keys(nutritionalData).sort((a, b) =>
      a.localeCompare(b)
    )
    const rootNames = new Set(localTree.map((n) => n.nutrient_name))
    return keys.filter((k) => !rootNames.has(k))
  }, [nutritionalData, localTree])

  const handleDeleteNode = useCallback((uid) => {
    if (
      !window.confirm(
        'Remove this nutrient and any sub-nutrients from this view?'
      )
    ) {
      return
    }
    if (addChildParentUid === uid) {
      setAddChildParentUid(null)
      setChildNutrientPick('')
    }
    setLocalTree((prev) => {
      const tree = cloneTree(prev)
      removeNode(tree, uid)
      return tree
    })
    setExpanded((prev) => {
      const next = { ...prev }
      delete next[uid]
      return next
    })
  }, [addChildParentUid])

  const openAddChildPicker = useCallback((parentUid) => {
    setAddChildParentUid(parentUid)
    setChildNutrientPick('')
  }, [])

  const cancelAddChildPicker = useCallback(() => {
    setAddChildParentUid(null)
    setChildNutrientPick('')
  }, [])

  const confirmAddChild = useCallback(() => {
    if (!addChildParentUid || !childNutrientPick) return
    const parentUid = addChildParentUid
    const nutrientName = childNutrientPick
    setLocalTree((prev) => {
      const tree = cloneTree(prev)
      const parent = findNode(tree, parentUid)
      if (!parent) return prev
      if (!parent.children) parent.children = []
      const newNode = {
        nutrient_name: nutrientName,
        rule: null,
        is_additive: true,
        variants: [],
        children: [],
        _uid: `node-${++_uid}`,
        _parentUid: parentUid,
      }
      parent.children.push(newNode)
      return tree
    })
    setExpanded((prev) => ({ ...prev, [parentUid]: true }))
    setAddChildParentUid(null)
    setChildNutrientPick('')
  }, [addChildParentUid, childNutrientPick])

  const handleAddRoot = useCallback(() => {
    if (!rootNutrientPick) return
    const nutrientName = rootNutrientPick
    setLocalTree((prev) => {
      const tree = cloneTree(prev)
      tree.push({
        nutrient_name: nutrientName,
        rule: null,
        is_additive: true,
        variants: [],
        children: [],
        _uid: `node-${++_uid}`,
        _parentUid: null,
      })
      return tree
    })
    setRootNutrientPick('')
  }, [rootNutrientPick])

  const handleToggle = useCallback((uid) => {
    setExpanded((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }, [])

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    setLocalTree((prev) => {
      const treeCopy = JSON.parse(JSON.stringify(prev))

      const reassign = (orig, copy) => {
        for (let i = 0; i < orig.length; i++) {
          copy[i]._uid = orig[i]._uid
          copy[i]._parentUid = orig[i]._parentUid
          if (orig[i].children?.length > 0 && copy[i].children?.length > 0) {
            reassign(orig[i].children, copy[i].children)
          }
        }
      }
      reassign(prev, treeCopy)

      const movedNode = removeNode(treeCopy, active.id)
      if (!movedNode) return prev

      const targetList = getParentList(treeCopy, over.id)
      if (!targetList) {

        insertAfter(treeCopy, over.id, movedNode)
      } else {
        insertAfter(targetList, over.id, movedNode)
      }

      return treeCopy
    })
  }

  const handleDragCancel = () => setActiveId(null)

  const activeNode = activeId ? findNode(localTree, activeId) : null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        <div className="px-6 py-4 border-b border-[#e1e7ef] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <GitBranch className="w-5 h-5 text-[#009da5] flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-ibm-plex font-bold text-[#0f1729] truncate">
                Nutrient Hierarchy
              </h2>
              <p className="text-sm font-ibm-plex text-[#65758b] truncate">
                {ingredientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#65758b] hover:text-[#0f1729] transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[#e1e7ef] flex items-center gap-3 flex-wrap bg-white flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideWithoutValues}
              onChange={(e) => setHideWithoutValues(e.target.checked)}
              className="rounded border-[#e1e7ef] text-[#009da5] focus:ring-[#009da5]"
            />
            <span className="text-xs font-ibm-plex text-[#0f1729]">
              Hide nutrients without values
            </span>
          </label>
          <span className="text-xs font-ibm-plex text-[#65758b] hidden sm:inline">
            The full tree is the template; &quot;—&quot; means this COA has no
            number for that line.
          </span>
        </div>

        {addChildParentUid && (
          <div className="px-4 py-3 border-b border-[#e1e7ef] bg-[#e1f4f5] flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-ibm-plex text-[#0f1729] mb-1">
                Add sub-nutrient under{' '}
                <span className="font-semibold">
                  {parentNodeForChildAdd?.nutrient_name ?? '…'}
                </span>
                — choose from mapped nutrients on this ingredient (values come
                from the COA data shown in this modal):
              </p>
              {childAddOptions.length === 0 ? (
                <p className="text-xs font-ibm-plex text-amber-700">
                  {Object.keys(nutritionalData || {}).length === 0
                    ? 'No mapped nutrients on this ingredient.'
                    : 'Every mapped nutrient is already a direct child here, or none are left to add.'}
                </p>
              ) : (
                <select
                  value={childNutrientPick}
                  onChange={(e) => setChildNutrientPick(e.target.value)}
                  className="h-9 w-full max-w-md px-3 text-sm font-ibm-plex border border-[#e1e7ef] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#009da5]"
                >
                  <option value="">Select mapped nutrient…</option>
                  {childAddOptions.map((name) => {
                    const pv = previewNutrientNumber(nutritionalData[name])
                    const label =
                      pv != null
                        ? `${name} (${pv.toFixed(2)} g)`
                        : `${name} (no value)`
                    return (
                      <option key={name} value={name}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={confirmAddChild}
                disabled={!childNutrientPick || childAddOptions.length === 0}
                className="h-9 px-3 rounded-lg text-xs font-ibm-plex font-medium bg-[#009da5] text-white hover:bg-[#008891] disabled:opacity-40 disabled:pointer-events-none"
              >
                Add
              </button>
              <button
                type="button"
                onClick={cancelAddChildPicker}
                className="h-9 px-3 rounded-lg text-xs font-ibm-plex font-medium border border-[#e1e7ef] text-[#65758b] hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-3 py-2 bg-[#f1f5f9] border-b border-[#e1e7ef] flex items-center gap-2 flex-shrink-0">
          <div className="w-5" />
          <div className="w-5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
              Nutrient
            </span>
          </div>
          <div className="w-24 text-right">
            <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
              Value
            </span>
          </div>
          <div className="w-10 text-right">
            <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
              Unit
            </span>
          </div>
          <div className="w-[72px] flex-shrink-0" aria-hidden />
        </div>

        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={displayFlatItems.map((n) => n._uid)}
              strategy={verticalListSortingStrategy}
            >
              {displayFlatItems.length === 0 ? (
                <div className="py-12 text-center text-sm font-ibm-plex text-[#65758b]">
                  {hideWithoutValues && flatItems.length > 0
                    ? 'No nutrients with values in this filter.'
                    : 'No nutrients to display'}
                </div>
              ) : (
                displayFlatItems.map((node) => (
                  <DraggableRow
                    key={node._uid}
                    node={node}
                    depth={node._depth}
                    isExpanded={!!expanded[node._uid]}
                    onToggle={handleToggle}
                    sumInfo={sums[node._uid]}
                    rawNameMap={rawNameMap}
                    onAddChild={openAddChildPicker}
                    onDelete={handleDeleteNode}
                  />
                ))
              )}
            </SortableContext>

            <DragOverlay>
              {activeNode ? (
                <DragOverlayRow node={activeNode} rawNameMap={rawNameMap} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <div className="px-6 py-4 border-t border-[#e1e7ef] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <p className="text-xs font-ibm-plex text-[#65758b]">
              Drag to reorder. Use + to pick a mapped nutrient under a parent, or
              add a mapped root row below. Closing saves this layout and scroll
              position for the formulation table (this browser session). Use{' '}
              <span className="font-medium text-[#0f1729]">Nutrient Hierarchy Map</span>{' '}
              to change the server default tree.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {rootAddOptions.length === 0 ? (
                <p className="text-xs font-ibm-plex text-[#65758b]">
                  {Object.keys(nutritionalData || {}).length === 0
                    ? 'No mapped nutrients — map a COA first.'
                    : 'All mapped nutrients already appear at the top level of this view.'}
                </p>
              ) : (
                <>
                  <select
                    value={rootNutrientPick}
                    onChange={(e) => setRootNutrientPick(e.target.value)}
                    className="h-9 min-w-[12rem] flex-1 max-w-md px-3 text-sm font-ibm-plex border border-[#e1e7ef] rounded-lg bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#009da5]"
                  >
                    <option value="">Select mapped nutrient for root…</option>
                    {rootAddOptions.map((name) => {
                      const pv = previewNutrientNumber(nutritionalData[name])
                      const label =
                        pv != null
                          ? `${name} (${pv.toFixed(2)} g)`
                          : `${name} (no value)`
                      return (
                        <option key={name} value={name}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddRoot}
                    disabled={!rootNutrientPick}
                    className="h-9 px-3 rounded-lg text-xs font-ibm-plex font-medium border border-[#e1e7ef] text-[#0f1729] hover:bg-[#f1f5f9] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add root
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-lg text-sm font-ibm-plex font-medium bg-[#009da5] text-white hover:bg-[#008891] transition-colors self-end sm:self-auto flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default NutrientHierarchyViewerModal
