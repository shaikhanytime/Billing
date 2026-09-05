import { useState, useEffect } from 'react'
import { Plus, Search, Phone, Mail, FileText } from 'lucide-react'
import { partiesApi, Party } from '../services/parties.api'
import { CreatePartyDrawer } from '../components/CreatePartyDrawer'
import { PartyStatementModal } from '../components/PartyStatementModal'
import { formatPaise } from '@/lib/utils'

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)
  const [isStatementOpen, setIsStatementOpen] = useState(false)

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const data = await partiesApi.getParties({ type: 'SUPPLIER', search: search || undefined })
      setSuppliers(data)
    } catch (err) {
      console.error('Failed to fetch suppliers', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [search])

  const totalToPay = suppliers.reduce((sum, s) => (s.currentBalance < 0 ? sum + Math.abs(s.currentBalance) : sum), 0)
  const totalAdvancePaid = suppliers.reduce((sum, s) => (s.currentBalance > 0 ? sum + s.currentBalance : sum), 0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suppliers & Vendors</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track purchase payables, supplier credit periods, and vendor ledger statements
          </p>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Add Supplier
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Suppliers</span>
          <div className="text-2xl font-bold text-slate-900 mt-1.5">{suppliers.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total To Pay (Payable)</span>
          <div className="text-2xl font-bold text-red-600 mt-1.5">{formatPaise(totalToPay)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier Advances (Dr)</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1.5">{formatPaise(totalAdvancePaid)}</div>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by supplier name, phone, or GSTIN..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Suppliers Table */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading suppliers...</div>
        ) : suppliers.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No suppliers found. Click &quot;Add Supplier&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Supplier Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">GSTIN / City</th>
                  <th className="py-3 px-4">Credit Period</th>
                  <th className="py-3 px-5 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" /> {s.phone}
                      </div>
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-400" /> {s.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {s.gstin ? (
                        <span className="font-mono text-slate-700 font-medium">{s.gstin}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unregistered</span>
                      )}
                      <div className="text-[11px] text-slate-400">{s.billingAddress?.city || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {s.creditPeriodDays ? `${s.creditPeriodDays} Days` : 'Immediate'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div
                        className={`font-bold ${
                          s.currentBalance < 0
                            ? 'text-red-600'
                            : s.currentBalance > 0
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatPaise(Math.abs(s.currentBalance))}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.currentBalance < 0 ? 'To Pay' : s.currentBalance > 0 ? 'Advance Given' : 'Settled'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedParty(s)
                          setIsStatementOpen(true)
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" /> Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers & Modals */}
      <CreatePartyDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        defaultType="SUPPLIER"
        onSuccess={() => fetchSuppliers()}
      />

      <PartyStatementModal
        party={selectedParty}
        isOpen={isStatementOpen}
        onClose={() => {
          setIsStatementOpen(false)
          setSelectedParty(null)
        }}
      />
    </div>
  )
}
