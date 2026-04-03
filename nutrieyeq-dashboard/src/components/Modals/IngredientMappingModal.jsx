import { useState, useMemo } from 'react'
import { X, Search, Check, Minus } from 'lucide-react'

const IngredientMappingModal = ({ isOpen, onClose, coaName, nutrients, onConfirm }) => {
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!nutrients) return []
    if (!search.trim()) return nutrients
    const q = search.toLowerCase()
    return nutrients.filter(n =>
      (n.nutrient_name_raw || '').toLowerCase().includes(q) ||
      (n.nutrient_name || '').toLowerCase().includes(q)
    )
  }, [nutrients, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selected.has(n))
  const someFilteredSelected = filtered.some(n => selected.has(n))

  const toggleOne = (nutrient) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(nutrient)) next.delete(nutrient)
      else next.add(nutrient)
      return next
    })
  }

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.delete(n))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.add(n))
        return next
      })
    }
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected))
  }

  const handleClose = () => {
    setSelected(new Set())
    setSearch('')
    onClose()
  }

  const fmt = (val) => {
    if (val === null || val === undefined) return '—'
    return Number(val).toFixed(4).replace(/\.?0+$/, '')
  }

  if (!isOpen || !nutrients) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
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
                <th className="px-4 py-3 text-left text-xs font-medium text-[#65758b] uppercase tracking-wider">Mapped Name</th>
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
                filtered.map((nutrient, idx) => {
                  const isChecked = selected.has(nutrient)
                  return (
                    <tr
                      key={idx}
                      onClick={() => toggleOne(nutrient)}
                      className={`border-b border-[#e1e7ef] cursor-pointer transition-colors ${
                        isChecked ? 'bg-[#e1f4f5]' : 'hover:bg-[#f9fafb]'
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <div className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                          isChecked ? 'bg-[#009da5] border-[#009da5]' : 'border-[#cbd5e1] bg-white'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#0f1729] font-medium">{nutrient.nutrient_name_raw || '—'}</td>
                      <td className="px-4 py-3 text-[#65758b]">{nutrient.nutrient_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums">{fmt(nutrient.min_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums">{fmt(nutrient.max_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums font-medium">{fmt(nutrient.actual_value)}</td>
                      <td className="px-4 py-3 text-right text-[#0f1729] tabular-nums">{fmt(nutrient.average_value)}</td>
                      <td className="px-4 py-3 text-[#65758b]">{nutrient.unit_raw || '—'}</td>
                      <td className="px-4 py-3 text-[#65758b]">{nutrient.unit || '—'}</td>
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
