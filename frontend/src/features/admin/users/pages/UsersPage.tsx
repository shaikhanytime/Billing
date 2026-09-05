import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/common/PageHeader'
import { cn, getInitials, formatDateTime } from '@/lib/utils'
import { Users, Search, UserCheck, UserX, Plus, Loader2 } from 'lucide-react'
import type { AppUser } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'badge-active',
    INACTIVE: 'badge-inactive',
    SUSPENDED: 'badge-suspended',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', map[status] ?? 'badge-inactive')}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-50 text-purple-700 border border-purple-200',
    ADMIN: 'bg-blue-50 text-blue-700 border border-blue-200',
    MANAGER: 'bg-amber-50 text-amber-700 border border-amber-200',
    SALES: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PURCHASE: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    WAREHOUSE: 'bg-orange-50 text-orange-700 border border-orange-200',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', colors[role] ?? 'bg-slate-100 text-slate-700 border border-slate-200')}>
      {role.replace('_', ' ')}
    </span>
  )
}

export function UsersPage() {
  const { orgId } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'organizations', orgId!, 'users'))
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as AppUser[]
    },
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ uid, status }: { uid: string; status: string }) => {
      const newStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await updateDoc(doc(db, 'organizations', orgId!, 'users', uid), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', orgId] }),
  })

  const filtered = users.filter(
    (u) =>
      u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        subtitle="Manage system users and their roles"
        actions={
          <button className="flex items-center justify-center gap-2 rounded-lg bg-[#0070F2] px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#0058C9] transition-colors w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add User
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2.5 sm:py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]/30 shadow-xs transition-all"
        />
      </div>

      {/* Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#0070F2]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="h-10 w-10 mb-3 opacity-40 text-slate-300" />
            <p className="text-sm font-medium">No users found</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (Viewports < md) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((u) => (
                <div key={u.uid} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-[#0070F2] text-xs font-bold text-white">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <RoleBadge role={u.role} />
                    <button
                      onClick={() => toggleStatus.mutate({ uid: u.uid, status: u.status })}
                      disabled={toggleStatus.isPending}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        u.status === 'ACTIVE'
                          ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                      )}
                    >
                      {u.status === 'ACTIVE' ? (
                        <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                      ) : (
                        <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (Viewports >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-[#0070F2] text-xs font-bold text-white">
                            {getInitials(u.firstName, u.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-xs text-slate-500">{formatDateTime(u.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleStatus.mutate({ uid: u.uid, status: u.status })}
                          disabled={toggleStatus.isPending}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ml-auto',
                            u.status === 'ACTIVE'
                              ? 'text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200'
                              : 'text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                          )}
                        >
                          {u.status === 'ACTIVE' ? (
                            <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                          ) : (
                            <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
