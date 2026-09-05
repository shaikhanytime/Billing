import { cn, formatCurrency } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
  currency?: boolean
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 text-blue-600',
    icon: 'text-blue-600',
    ring: 'ring-blue-100',
    trend: 'text-blue-600',
  },
  green: {
    bg: 'bg-emerald-50 text-emerald-600',
    icon: 'text-emerald-600',
    ring: 'ring-emerald-100',
    trend: 'text-emerald-600',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-600',
    icon: 'text-amber-600',
    ring: 'ring-amber-100',
    trend: 'text-amber-600',
  },
  red: {
    bg: 'bg-rose-50 text-rose-600',
    icon: 'text-rose-600',
    ring: 'ring-rose-100',
    trend: 'text-rose-600',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-600',
    icon: 'text-purple-600',
    ring: 'ring-purple-100',
    trend: 'text-purple-600',
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  currency = false,
}: StatCardProps) {
  const c = colorMap[color]
  const displayValue = currency && typeof value === 'number' ? formatCurrency(value) : value

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-5 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <p className={cn('mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-slate-800 stat-value truncate')}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn('mt-1.5 sm:mt-2 flex items-center gap-1 text-[11px] sm:text-xs font-semibold truncate', c.trend)}>
              <span>{trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ring-1 transition-all duration-200 group-hover:scale-105', c.bg, c.ring)}>
          <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', c.icon)} />
        </div>
      </div>
    </div>
  )
}
