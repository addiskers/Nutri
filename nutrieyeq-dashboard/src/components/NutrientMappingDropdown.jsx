import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Plus, AlertCircle, Check } from 'lucide-react'

const NutrientMappingDropdown = ({ value, standardizedNames, onSelect, onCreateNew }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const isMapped = value && standardizedNames.includes(value)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
        setShowCreateInput(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  const filtered = standardizedNames.filter(n =>
    n.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (name) => {
    onSelect(name)
    setIsOpen(false)
    setSearch('')
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    try {
      await onCreateNew(newName.trim())
      setShowCreateInput(false)
      setNewName('')
      setIsOpen(false)
      setSearch('')
    } catch (_) {}
    setIsCreating(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-w-[160px] h-10 px-3 flex items-center justify-between gap-1 rounded-md border text-sm font-ibm-plex transition-colors ${
          isMapped
            ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
            : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
        }`}
      >
        <span className="truncate flex items-center gap-1.5">
          {isMapped ? (
            <>
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              {value}
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {value || 'No mapping'}
            </>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-[#e1e7ef] rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#e1e7ef]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#65758b]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search standardized nutrients..."
                className="w-full h-8 pl-8 pr-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-xs font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-1 focus:ring-[#b455a0]"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs font-ibm-plex text-[#65758b]">
                No matching nutrients found
              </div>
            ) : (
              filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(name)}
                  className={`w-full px-3 py-2 text-left text-xs font-ibm-plex hover:bg-[#f9fafb] transition-colors flex items-center gap-2 ${
                    name === value ? 'bg-[#b455a0]/10 text-[#b455a0] font-medium' : 'text-[#0f1729]'
                  }`}
                >
                  {name === value && <Check className="w-3 h-3" />}
                  <span className={name === value ? '' : 'ml-5'}>{name}</span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#e1e7ef] p-2">
            {showCreateInput ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New nutrient name"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="flex-1 h-8 px-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-xs font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-1 focus:ring-[#b455a0]"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                  className="h-8 px-3 bg-[#b455a0] text-white text-xs font-ibm-plex font-medium rounded-md hover:bg-[#a04890] disabled:opacity-50 transition-colors"
                >
                  {isCreating ? '...' : 'Add'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateInput(true)}
                className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-ibm-plex font-medium text-[#b455a0] hover:bg-[#b455a0]/10 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create new nutrient
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NutrientMappingDropdown
