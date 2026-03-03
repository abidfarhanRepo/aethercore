import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  changePercent?: number
  isPositive?: boolean
  sparkline?: number[]
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export default function MetricCard({
  title,
  value,
  unit = '',
  changePercent,
  isPositive = true,
  sparkline,
  variant = 'default',
}: MetricCardProps) {
  const bgColor = {
    default: 'bg-slate-50',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
    danger: 'bg-red-50',
  }[variant]

  const textColor = {
    default: 'text-slate-900',
    success: 'text-green-900',
    warning: 'text-yellow-900',
    danger: 'text-red-900',
  }[variant]

  return (
    <div className={`${bgColor} rounded-lg p-6 border border-slate-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className={`text-3xl font-bold ${textColor} mt-2`}>
            {value}
            {unit && <span className="text-lg ml-1">{unit}</span>}
          </p>
          {changePercent !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                {isPositive ? '+' : '-'}
                {Math.abs(changePercent)}% from last period
              </span>
            </div>
          )}
        </div>
        {sparkline && (
          <div className="flex items-baseline gap-1">
            {sparkline.map((val, i) => (
              <div
                key={i}
                className="w-1 bg-slate-300 rounded"
                style={{
                  height: `${Math.max(4, (val / Math.max(...sparkline)) * 32)}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
