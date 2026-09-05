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
    bg: 'bg-blue-500/15',
    icon: 'text-blue-400',
    ring: 'ring-blue-500/20',
    trend: 'text-blue-400',
  },
  green: {
    bg: 'bg-emerald-500/15',
    icon: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    trend: 'text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-500/15',
    icon: 'text-amber-400',
    ring: 'ring-amber-500/20',
    trend: 'text-amber-400',
  },
  red: {
    bg: 'bg-red-500/15',
    icon: 'text-red-400',
    ring: 'ring-red-500/20',
    trend: 'text-red-400',
  },
  purple: {
    bg: 'bg-purple-500/15',
    icon: 'text-purple-400',
    ring: 'ring-purple-500/20',
    trend: 'text-purple-400',
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
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3.5 sm:p-5 hover:border-gray-700 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider truncate">{title}</p>
          <p className={cn('mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-white stat-value truncate')}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-gray-500 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn('mt-1.5 sm:mt-2 flex items-center gap-1 text-[11px] sm:text-xs font-medium truncate', c.trend)}>
              <span>{trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-gray-500">{trend.label}</span>
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
