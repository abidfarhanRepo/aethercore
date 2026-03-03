import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ChartData {
  [key: string]: any
}

interface ReportChartProps {
  type: 'line' | 'bar' | 'pie'
  data: ChartData[]
  dataKey: string | string[]
  xAxisKey?: string
  title?: string
  height?: number
  colors?: string[]
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function ReportChart({
  type,
  data,
  dataKey,
  xAxisKey = 'date',
  title,
  height = 300,
  colors = COLORS,
}: ReportChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
        No data available
      </div>
    )
  }

  const commonProps = {
    margin: { top: 5, right: 30, left: 0, bottom: 5 },
  }

  if (type === 'line') {
    const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey]
    return (
      <div className="w-full bg-white p-4 rounded-lg border border-slate-200">
        {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'bar') {
    const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey]
    return (
      <div className="w-full bg-white p-4 rounded-lg border border-slate-200">
        {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, idx) => (
              <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'pie') {
    const key = Array.isArray(dataKey) ? dataKey[0] : dataKey
    const nameKey = Object.keys(data[0]).find((k) => k !== key && typeof data[0][k] === 'string') || 'name'

    return (
      <div className="w-full bg-white p-4 rounded-lg border border-slate-200">
        {title && <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>}
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey={key} nameKey={nameKey} cx="50%" cy="50%" outerRadius={100} label>
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
}
