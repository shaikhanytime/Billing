import { Outlet } from 'react-router-dom'
import { Package } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-gray-900 to-gray-950 border-r border-gray-800 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">BizOps</p>
            <p className="text-xs text-gray-500">Business Operations Platform</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Manage your business
              <span className="block gradient-text">smarter, faster.</span>
            </h1>
            <p className="mt-4 text-gray-400 text-lg leading-relaxed">
              Complete billing, inventory, and party management for retailers, wholesalers, and manufacturers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'GST Billing', desc: 'Auto CGST/SGST/IGST' },
              { label: 'Barcode System', desc: 'Generate & scan barcodes' },
              { label: 'Party Ledger', desc: 'Track every rupee' },
              { label: 'Reports', desc: 'Daily, weekly, monthly' },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-sm font-semibold text-gray-200">{f.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-600">© 2024 BizOps. All rights reserved.</p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
              <Package className="h-4.5 w-4.5 text-white" />
            </div>
            <p className="text-lg font-bold text-white">BizOps</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
