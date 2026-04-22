import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Search, Check, Minus, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { coaNomenclatureService } from '../../services/api'

const InlineMappingDropdown = ({ value, standardizedNames, onChange, onCreateNew }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
        setShowCreate(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const filtered = standardizedNames.filter(n =>
    n.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await onCreateNew(newName.trim())
      onChange(newName.trim())
      setShowCreate(false)
      setNewName('')
      setOpen(false)
      setSearch('')
    } catch (_) {}
    setCreating(false)
  }

  const isMapped = value && standardizedNames.includes(value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`w-full min-w-[140px] h-8 px-2 flex items-center justify-between gap-1 rounded border text-xs font-ibm-plex transition-colors ${
          isMapped
            ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
            : value
              ? 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
        }`}
      >
        <span className="truncate">{value || 'No mapping'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-[#e1e7ef] rounded-lg shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-2 border-b border-[#e1e7ef]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#65758b]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search nutrients..."
                className="w-full h-7 pl-8 pr-3 bg-[#f9fafb] border border-[#e1e7ef] rounded text-xs font-ibm-plex focus:outline-none focus:ring-1 focus:ring-[#009da5]"
              />
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#65758b]">No match</div>
            ) : (
              filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setSearch('') }}
                  className={`w-full px-3 py-1.5 text-left text-xs font-ibm-plex hover:bg-[#f1f5f9] flex items-center gap-2 ${
                    name === value ? 'bg-[#009da5]/10 text-[#009da5] font-medium' : 'text-[#0f1729]'
                  }`}
                >
                  {name === value && <Check className="w-3 h-3 flex-shrink-0" />}
                  <span className={name === value ? '' : 'ml-5'}>{name}</span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#e1e7ef] p-2">
            {showCreate ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New nutrient name"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="flex-1 h-7 px-2 bg-[#f9fafb] border border-[#e1e7ef] rounded text-xs font-ibm-plex focus:outline-none focus:ring-1 focus:ring-[#b455a0]"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="h-7 px-2.5 bg-[#b455a0] text-white text-xs font-ibm-plex font-medium rounded hover:bg-[#a04890] disabled:opacity-50 transition-colors"
                >
                  {creating ? '...' : 'Add'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full h-7 flex items-center justify-center gap-1.5 text-xs font-ibm-plex font-medium text-[#b455a0] hover:bg-[#b455a0]/10 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Create new
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const IngredientMappingModal = ({ isOpen, onClose, coaName, nutrients, onConfirm }) => {
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [nomenclatureMap, setNomenclatureMap] = useState({})
  const [standardizedNames, setStandardizedNames] = useState([])
  const [mappedNames, setMappedNames] = useState({})
  const [loadingMap, setLoadingMap] = useState(false)

  useEffect(() => {
    if (!isOpen || !nutrients || nutrients.length === 0) return
    let cancelled = false
    const load = async () => {
      setLoadingMap(true)
      try {
        const rawNames = nutrients.map(n =>
          (n.nutrient_name_raw || n.nutrient_name || '').trim()
        ).filter(Boolean)

        const [mapData, resolveData] = await Promise.all([
          coaNomenclatureService.getMap(),
          coaNomenclatureService.resolve(rawNames)
        ])
        if (cancelled) return

        if (mapData && mapData.map) {
          setNomenclatureMap(mapData.map)
          const names = [...new Set(Object.values(mapData.map))].sort()
          setStandardizedNames(names)
        }

        const resolved = resolveData?.resolved || {}
        const initial = {}
        nutrients.forEach((n, idx) => {
          const raw = (n.nutrient_name_raw || n.nutrient_name || '').trim()
          initial[idx] = resolved[raw] || raw
        })
        setMappedNames(initial)
      } catch (e) {
        console.error('Failed to load nomenclature:', e)
      }
      setLoadingMap(false)
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, nutrients])

  const filtered = useMemo(() => {
    if (!nutrients) return []
    if (!search.trim()) return nutrients.map((n, i) => ({ ...n, _idx: i }))
    const q = search.toLowerCase()
    return nutrients.map((n, i) => ({ ...n, _idx: i })).filter(n =>
      (n.nutrient_name_raw || '').toLowerCase().includes(q) ||
      (mappedNames[n._idx] || '').toLowerCase().includes(q)
    )
  }, [nutrients, search, mappedNames])

  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selected.has(n._idx))
  const someFilteredSelected = filtered.some(n => selected.has(n._idx))

  const toggleOne = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.delete(n._idx))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.add(n._idx))
        return next
      })
    }
  }

  const handleConfirm = () => {
    const result = nutrients
      .map((n, idx) => ({ ...n, mapped_name: mappedNames[idx] || n.nutrient_name_raw || n.nutrient_name }))
      .filter((_, idx) => selected.has(idx))
    onConfirm(result)
  }

  const handleClose = () => {
    setSelected(new Set())
    setSearch('')
    setMappedNames({})
    onClose()
  }

  const handleCreateNutrient = async (newName, rawName) => {
    const result = await coaNomenclatureService.create({
      standardized_name: newName,
      raw_names: rawName ? [rawName] : []
    })
    if (result.success !== false) {
      setStandardizedNames(prev => [...new Set([...prev, newName])].sort())
    } else {
      alert(result.error || 'Failed to create nutrient')
      throw new Error(result.error)
    }
  }

  const fmt = (val) => {
    if (val === null || val === undefined) return '—'
    return Number(val).toFixed(4).replace(/\.?0+$/, '')
  }

  if (!isOpen || !nutrients) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1e7ef] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-ibm-plex font-bold text-[#0f1729]">
              Select Nutrients — {coaName}
            </h2>
            <p className="text-sm font-ibm-plex text-[#65758b] mt-0.5">
              {selected.size} of {nutrients.length} nutrients selected
            </p>
          </div>
          <button onClick={handleClose} className="text-[#65758b] hover:text-[#0f1729] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-[#e1e7ef] flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
            <input
              type="text"
              placeholder="Search nutrients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-ibm-plex border border-[#e1e7ef] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009da5]"
            />
          </div>
          <button
            onClick={toggleAll}
            className="px-3 py-2 text-sm font-ibm-plex font-medium rounded-lg border border-[#e1e7ef] hover:bg-[#f1f5f9] transition-colors text-[#0f1729]"
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
          {loadingMap && (
            <div className="flex items-center gap-1.5 text-xs text-[#65758b]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading mappings...
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm font-ibm-plex border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                <th className="px-4 py-3 text-center w-12">
                  <button onClick={toggleAll} className="inline-flex items-center justify-center w-5 h-5 rounded border border-[#cbd5e1] bg-white hover:border-[#009da5] transition-colors">
                    {allFilteredSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#009da5]" />
                    ) : someFilteredSelected ? (
                      <Minus className="w-3.5 h-3.5 text-[#65758b]" />
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#65758b] uppercase tracking-wider">Raw Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#65758b] uppercase tracking-wider min-w-[180px]">Mapped Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#65758b] uppercase tracking-wider">Min</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#65758b] uppercase tracking-wider">Max</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#65758b] uppercase tracking-wider">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#65758b] uppercase tracking-wider">Average</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#65758b] uppercase tracking-wider">Raw Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#65758b] uppercase tracking-wider">Norm. Unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#65758b]">
                    {search ? 'No nutrients match your search' : 'No nutrients found in this COA'}
                  </td>
                </tr>
              ) : (
                filtered.map((nutrient) => {
                  const idx = nutrient._idx
                  const isChecked = selected.has(idx)
                  const rawName = nutrient.nutrient_name_raw || nutrient.nutrient_name || ''
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-[#e1e7ef] transition-colors ${
                        isChecked ? 'bg-[#e1f4f5]' : 'hover:bg-[#f9fafb]'
                      }`}
                    >
                      <td className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleOne(idx)}>
                        <div className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                          isChecked ? 'bg-[#009da5] border-[#009da5]' : 'border-[#cbd5e1] bg-white'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#0f1729] font-medium cursor-pointer" onClick={() => toggleOne(idx)}>
                        {rawName || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <InlineMappingDropdown
                          value={mappedNames[idx] || ''}
                          standardizedNames={standardizedNames}
                          onChange={(name) => setMappedNames(prev => ({ ...prev, [idx]: name }))}
                          onCreateNew={(name) => handleCreateNutrient(name, rawName)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums cursor-pointer" onClick={() => toggleOne(idx)}>{fmt(nutrient.min_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums cursor-pointer" onClick={() => toggleOne(idx)}>{fmt(nutrient.max_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums font-medium cursor-pointer" onClick={() => toggleOne(idx)}>{fmt(nutrient.actual_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums cursor-pointer" onClick={() => toggleOne(idx)}>{fmt(nutrient.average_value)}</td>
                      <td className="px-4 py-3 text-[#65758b] cursor-pointer" onClick={() => toggleOne(idx)}>{nutrient.unit_raw || '—'}</td>
                      <td className="px-4 py-3 text-[#65758b] cursor-pointer" onClick={() => toggleOne(idx)}>{nutrient.unit || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e1e7ef] flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-ibm-plex text-[#65758b]">
            {selected.size} nutrient{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className={`px-5 py-2 rounded-lg text-sm font-ibm-plex font-medium transition-colors ${
                selected.size === 0
                  ? 'bg-[#e1e7ef] text-[#9e9e9e] cursor-not-allowed'
                  : 'bg-[#009da5] text-white hover:bg-[#008891]'
              }`}
            >
              Confirm ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IngredientMappingModal
