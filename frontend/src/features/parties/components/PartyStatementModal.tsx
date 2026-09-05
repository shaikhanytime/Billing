import { useState, useEffect } from 'react'
import { X, ArrowDownLeft, ArrowUpRight, Calendar, Download, Printer, FileSpreadsheet } from 'lucide-react'
import { partiesApi, Party, PartyLedgerEntry } from '../services/parties.api'
import { formatPaise, formatDate } from '@/lib/utils'

interface PartyStatementModalProps {
  party: Party | null
  isOpen: boolean
  onClose: () => void
}

export function PartyStatementModal({ party, isOpen, onClose }: PartyStatementModalProps) {
  const [ledgerEntries, setLedgerEntries] = useState<PartyLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (party && isOpen) {
      setLoading(true)
      partiesApi
        .getPartyLedger(party.id)
        .then((data) => setLedgerEntries(data))
        .catch((err) => console.error('Failed to load ledger', err))
        .finally(() => setLoading(false))
    }
  }, [party, isOpen])

  if (!isOpen || !party) return null

  const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{party.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {party.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Phone: {party.phone} • GSTIN: {party.gstin || 'Unregistered'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              title="Print Statement"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Summary Card Banner */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50/40 border-b border-slate-100">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales / Debits</span>
            <div className="text-lg font-bold text-slate-900 mt-1">{formatPaise(totalDebit)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received / Credits</span>
            <div className="text-lg font-bold text-emerald-600 mt-1">{formatPaise(totalCredit)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</span>
            <div
              className={`text-lg font-bold mt-1 ${
                party.currentBalance > 0
                  ? 'text-amber-600'
                  : party.currentBalance < 0
                  ? 'text-emerald-600'
                  : 'text-slate-800'
              }`}
            >
              {formatPaise(Math.abs(party.currentBalance))} {party.currentBalance > 0 ? '(Receivable)' : party.currentBalance < 0 ? '(Payable)' : '(Settled)'}
            </div>
          </div>
        </div>

        {/* Statement Ledger Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Authoritative Transaction Ledger
          </h3>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading ledger entries...</div>
          ) : ledgerEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No transactions recorded yet for this party.</div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Doc #</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-4 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{e.documentType}</td>
                      <td className="py-3 px-4 font-mono text-blue-600">{e.documentNumber}</td>
                      <td className="py-3 px-4 text-slate-600">{e.description}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        {e.debit > 0 ? formatPaise(e.debit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">
                        {e.credit > 0 ? formatPaise(e.credit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatPaise(e.balanceSnapshot)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  )
}
