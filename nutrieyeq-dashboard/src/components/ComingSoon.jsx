import { Construction } from 'lucide-react'

const ComingSoon = ({ title, description, icon: Icon }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-20 h-20 bg-[#b455a0]/10 rounded-full flex items-center justify-center mb-6">
        {Icon ? (
          <Icon className="w-10 h-10 text-[#b455a0]" />
        ) : (
          <Construction className="w-10 h-10 text-[#b455a0]" />
        )}
      </div>
      
      <h1 className="text-3xl font-ibm-plex font-bold text-[#0f1729] mb-3">
        {title}
      </h1>
      
      <p className="text-base font-ibm-plex text-[#65758b] max-w-md mb-6">
        {description}
      </p>

      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md">
        <div className="w-2 h-2 bg-[#b455a0] rounded-full animate-pulse" />
        <span className="text-sm font-ibm-plex font-medium text-[#65758b]">
          Coming Soon
        </span>
      </div>

      <div className="mt-8 text-xs font-ibm-plex text-[#65758b]">
        This feature is currently under development and will be available in a future update.
      </div>
    </div>
  )
}

export default ComingSoon








