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
    SUPER_ADMIN: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    ADMIN: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    MANAGER: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    SALES: 'bg-green-500/15 text-green-400 border border-green-500/30',
    PURCHASE: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    WAREHOUSE: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', colors[role] ?? 'bg-gray-500/15 text-gray-400')}>
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
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system users and their roles"
        actions={
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add User
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((u) => (
                <tr key={u.uid} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-gray-500">{formatDateTime(u.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleStatus.mutate({ uid: u.uid, status: u.status })}
                      disabled={toggleStatus.isPending}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ml-auto',
                        u.status === 'ACTIVE'
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-green-400 hover:bg-green-500/10'
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
        )}
      </div>
    </div>
  )
}
