import { Outlet } from 'react-router-dom'
import { Package } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-white border-r border-slate-200 p-12 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0070F2] shadow-md shadow-blue-500/20">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tracking-tight">BillingAnytime</p>
            <p className="text-xs text-slate-500 font-medium">Enterprise Billing & Inventory Operations</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
              Manage your business
              <span className="block text-[#0070F2]">smarter, faster.</span>
            </h1>
            <p className="mt-4 text-slate-600 text-lg leading-relaxed">
              Complete billing, inventory, and party management for retailers, wholesalers, and distributors.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'GST Billing', desc: 'Auto CGST/SGST/IGST' },
              { label: 'Barcode System', desc: 'Generate & scan barcodes' },
              { label: 'Party Ledger', desc: 'Track every rupee' },
              { label: 'Reports', desc: 'Daily, weekly, monthly' },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:border-slate-300 transition-colors">
                <p className="text-sm font-bold text-slate-800">{f.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">© 2024 BillingAnytime. All rights reserved.</p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0070F2] shadow-sm">
              <Package className="h-4.5 w-4.5 text-white" />
            </div>
            <p className="text-lg font-bold text-slate-900">BillingAnytime</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
