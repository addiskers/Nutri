import { useState, useEffect } from 'react'
import { X, Download, ChevronDown, ChevronRight } from 'lucide-react'

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[#e1e7ef] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[#f8fafc] hover:bg-[#f1f5f9] transition-colors"
      >
        <h3 className="text-sm font-ibm-plex font-bold text-[#0f1729]">{title}</h3>
        {open ? <ChevronDown className="w-4 h-4 text-[#65758b]" /> : <ChevronRight className="w-4 h-4 text-[#65758b]" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

const Field = ({ label, value }) => {
  if (!value && value !== 0) return null
  const display = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value)
  if (!display || display === '{}') return null
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-ibm-plex text-[#0f1729] break-words">{display || '—'}</p>
    </div>
  )
}

const ProductDetailModal = ({ product, isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen || !product) return null

  const d = product.rawData || product || {}
  const nutritionTable = d.nutrition_table || []
  const nutritionNotes = d.nutrition_notes || []
  const claims = d.claims || []
  const directionsToUse = d.usage_instructions?.directions_to_use || []
  const preparationMethod = d.usage_instructions?.preparation_method || []
  const storageInstructions = d.storage_instructions || []
  const manufacturers = d.manufacturer_information || []
  const fssaiNumbers = d.fssai_information?.license_numbers || []
  const barcodes = d.barcodes || []
  const certifications = d.certifications || []
  const regulatoryText = d.regulatory_text || []
  const otherImportantText = d.other_important_text || []
  const customerCare = d.customer_care || {}
  const batchInfo = d.batch_information || {}
  const packagingInfo = d.packaging_information || {}

  const valueKeys = [...new Set(nutritionTable.flatMap(row => Object.keys(row.values || {})))]

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

          <div className="border-b border-[#e1e7ef] rounded-t-xl px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-ibm-plex font-bold text-[#0f1729]">Product Details</h2>
              <p className="text-sm font-ibm-plex text-[#65758b] truncate">{d.product_name}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] transition-colors ml-4 flex-shrink-0"
            >
              <X className="w-5 h-5 text-[#0f1729]" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">

            <Section title="Basic Information">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <Field label="Product Name" value={d.product_name} />
                <Field label="Brand" value={d.parent_brand} />
                <Field label="Sub Brand" value={d.sub_brand} />
                <Field label="Variant" value={d.variant} />
                <Field label="Category" value={d.category} />
                <Field label="Veg / Non-Veg" value={d.veg_nonveg} />
                <Field label="MRP" value={d.mrp} />
                <Field label="USPF" value={d.uspf} />
                <Field label="Net Quantity" value={d.net_quantity || d.pack_size} />
                <Field label="Serving Size" value={d.serving_size} />
                <Field label="Servings Per Pack" value={d.servings_per_pack} />
                <Field label="Packing Format" value={d.packing_format} />
              </div>
            </Section>

            {(d.manufacturing_date || d.expiry_date || d.shelf_life) && (
              <Section title="Dates">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Manufacturing Date" value={d.manufacturing_date} />
                  <Field label="Expiry Date" value={d.expiry_date} />
                  <Field label="Shelf Life" value={d.shelf_life} />
                </div>
              </Section>
            )}

            {nutritionTable.length > 0 && (
              <Section title={`Nutritional Data (${nutritionTable.length} nutrients)`}>
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#f8fafc]">
                        <th className="px-5 py-2 text-left text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">Nutrient</th>
                        {valueKeys.map(key => (
                          <th key={key} className="px-3 py-2 text-center text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider whitespace-nowrap">{key}</th>
                        ))}
                        <th className="px-3 py-2 text-center text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {nutritionTable.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className="px-5 py-2 text-sm font-ibm-plex font-medium text-[#0f1729]">
                            {row.nutrient_name || row.original_name || '—'}
                          </td>
                          {valueKeys.map(key => (
                            <td key={key} className="px-3 py-2 text-center text-sm font-ibm-plex text-[#0f1729]">
                              {row.values?.[key] || '—'}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center text-xs font-ibm-plex text-[#65758b]">
                            {row.unit || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {nutritionNotes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                    <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Notes</p>
                    <ul className="text-xs font-ibm-plex text-[#65758b] space-y-0.5">
                      {nutritionNotes.map((note, i) => <li key={i}>• {note}</li>)}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {(d.ingredients || d.allergen_information || claims.length > 0) && (
              <Section title="Composition">
                <div className="space-y-4">
                  {d.ingredients && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Ingredients</p>
                      <p className="text-sm font-ibm-plex text-[#0f1729] leading-relaxed">{d.ingredients}</p>
                    </div>
                  )}
                  {d.allergen_information && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Allergen Information</p>
                      <p className="text-sm font-ibm-plex text-[#0f1729]">{d.allergen_information}</p>
                    </div>
                  )}
                  {claims.length > 0 && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Claims</p>
                      <div className="flex flex-wrap gap-1.5">
                        {claims.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[#f1f5f9] rounded text-xs font-ibm-plex text-[#0f1729]">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(directionsToUse.length > 0 || preparationMethod.length > 0 || storageInstructions.length > 0) && (
              <Section title="Usage & Storage">
                <div className="space-y-4">
                  {directionsToUse.length > 0 && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Directions to Use</p>
                      <ul className="text-sm font-ibm-plex text-[#0f1729] space-y-1">
                        {directionsToUse.map((d, i) => <li key={i}>• {d}</li>)}
                      </ul>
                    </div>
                  )}
                  {preparationMethod.length > 0 && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Preparation Method</p>
                      <ul className="text-sm font-ibm-plex text-[#0f1729] space-y-1">
                        {preparationMethod.map((d, i) => <li key={i}>• {d}</li>)}
                      </ul>
                    </div>
                  )}
                  {storageInstructions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-ibm-plex font-semibold text-[#65758b] uppercase tracking-wider mb-1">Storage Instructions</p>
                      <ul className="text-sm font-ibm-plex text-[#0f1729] space-y-1">
                        {storageInstructions.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(manufacturers.length > 0 || fssaiNumbers.length > 0 || d.brand_owner) && (
              <Section title="Manufacturer & FSSAI">
                <div className="space-y-4">
                  {d.brand_owner && (
                    <Field label="Brand Owner" value={d.brand_owner} />
                  )}
                  {manufacturers.map((m, i) => (
                    <div key={i} className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <Field label={m.type || 'Manufacturer'} value={m.name} />
                      <Field label="License No." value={m.license_number} />
                      {m.address && <div className="col-span-2"><Field label="Address" value={m.address} /></div>}
                    </div>
                  ))}
                  {fssaiNumbers.length > 0 && (
                    <Field label="FSSAI License Numbers" value={fssaiNumbers} />
                  )}
                </div>
              </Section>
            )}

            {(batchInfo.lot_number || batchInfo.machine_code || (batchInfo.other_codes || []).length > 0 || packagingInfo.packaging_material_manufacturer) && (
              <Section title="Batch & Packaging" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Lot Number" value={batchInfo.lot_number} />
                  <Field label="Machine Code" value={batchInfo.machine_code} />
                  <Field label="Other Codes" value={batchInfo.other_codes} />
                  <Field label="Packaging Manufacturer" value={packagingInfo.packaging_material_manufacturer} />
                  <Field label="Packaging Codes" value={packagingInfo.packaging_codes} />
                </div>
              </Section>
            )}

            {(barcodes.length > 0 || certifications.length > 0) && (
              <Section title="Identifiers & Certifications" defaultOpen={false}>
                <div className="space-y-4">
                  {barcodes.length > 0 && <Field label="Barcodes" value={barcodes} />}
                  {certifications.length > 0 && <Field label="Certifications" value={certifications} />}
                </div>
              </Section>
            )}

            {(customerCare.phone?.length > 0 || customerCare.email || customerCare.website || customerCare.address) && (
              <Section title="Customer Care" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Phone" value={customerCare.phone} />
                  <Field label="Email" value={customerCare.email} />
                  <Field label="Website" value={customerCare.website} />
                  {customerCare.address && (
                    <div className="col-span-2"><Field label="Address" value={customerCare.address} /></div>
                  )}
                </div>
              </Section>
            )}

            {regulatoryText.length > 0 && (
              <Section title="Regulatory Text" defaultOpen={false}>
                <ul className="text-sm font-ibm-plex text-[#0f1729] space-y-1">
                  {regulatoryText.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </Section>
            )}

            {otherImportantText.length > 0 && (
              <Section title="Other Important Text" defaultOpen={false}>
                <ul className="text-sm font-ibm-plex text-[#0f1729] space-y-1">
                  {otherImportantText.map((t, i) => <li key={i}>• {t}</li>)}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default ProductDetailModal
