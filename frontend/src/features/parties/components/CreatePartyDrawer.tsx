import { useState } from 'react'
import { X, Building2, User, Phone, Mail, FileText, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import { partiesApi, Party } from '../services/parties.api'

interface CreatePartyDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (party: Party) => void
  defaultType?: 'CUSTOMER' | 'SUPPLIER'
}

export function CreatePartyDrawer({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'CUSTOMER',
}: CreatePartyDrawerProps) {
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'SUPPLIER' | 'BOTH'>(defaultType)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [category, setCategory] = useState('Retail')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('Maharashtra')
  const [stateCode, setStateCode] = useState('27')
  const [pincode, setPincode] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [balanceType, setBalanceType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE')
  const [creditPeriodDays, setCreditPeriodDays] = useState('30')
  const [creditLimit, setCreditLimit] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Auto extract State Code & PAN from GSTIN if 15 chars provided
  const handleGstinChange = (val: string) => {
    const uppercaseVal = val.toUpperCase().trim()
    setGstin(uppercaseVal)
    if (uppercaseVal.length >= 2) {
      const code = uppercaseVal.substring(0, 2)
      if (/^\d{2}$/.test(code)) {
        setStateCode(code)
      }
    }
    if (uppercaseVal.length >= 12) {
      const panSubstring = uppercaseVal.substring(2, 12)
      setPan(panSubstring)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const rawBalPaise = Math.round(Number(openingBalance || 0) * 100)
      const signedBalPaise = balanceType === 'RECEIVABLE' ? rawBalPaise : -rawBalPaise
      const creditLimitPaise = Math.round(Number(creditLimit || 0) * 100)

      const created = await partiesApi.createParty({
        name,
        type: partyType,
        category,
        phone,
        email: email || undefined,
        gstin: gstin || undefined,
        pan: pan || undefined,
        billingAddress: {
          street,
          city,
          state,
          pincode,
          stateCode: stateCode || '27',
        },
        openingBalance: signedBalPaise,
        creditPeriodDays: Number(creditPeriodDays || 0),
        creditLimit: creditLimitPaise,
      })

      onSuccess(created)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create party.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Create New {partyType === 'CUSTOMER' ? 'Customer' : partyType === 'SUPPLIER' ? 'Supplier' : 'Party'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Add business party with ledger and GST details</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Party Type Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Party Relationship
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['CUSTOMER', 'SUPPLIER', 'BOTH'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPartyType(t)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-center ${
                      partyType === t
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'CUSTOMER' ? 'Customer' : t === 'SUPPLIER' ? 'Supplier' : 'Both (Dr/Cr)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" /> Basic Details
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Party / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Enterprises Pvt Ltd"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="accounts@acme.com"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* GST & Tax Compliance */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-600" /> GST & Tax Details
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full h-10 px-3 text-sm font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className="w-full h-10 px-3 text-sm font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-600" /> Billing Address
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Street / Building Address</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Plot 42, MIDC Industrial Area"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">State Code</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    placeholder="27"
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="400001"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Opening Balance & Credit Limits */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Opening Balance & Terms</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Opening Balance (₹)</label>
                  <div className="flex">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 text-sm border border-r-0 border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <select
                      value={balanceType}
                      onChange={(e) => setBalanceType(e.target.value as any)}
                      className="h-10 px-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-r-lg text-slate-700 focus:outline-none"
                    >
                      <option value="RECEIVABLE">Dr (To Collect)</option>
                      <option value="PAYABLE">Cr (To Pay)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Credit Period (Days)</label>
                  <input
                    type="number"
                    value={creditPeriodDays}
                    onChange={(e) => setCreditPeriodDays(e.target.value)}
                    placeholder="30"
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Party'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
