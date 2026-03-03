import React, { useState } from 'react'
import { Download, FileText, Loader } from 'lucide-react'
import { reportsAPI } from '../lib/api'

interface ExportButtonsProps {
  reportType: string
  dateFrom?: Date
  dateTo?: Date
}

export default function ExportButtons({ reportType, dateFrom, dateTo }: ExportButtonsProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleExportCSV = async () => {
    setIsLoading(true)
    try {
      const response = await reportsAPI.exportCSV(reportType, {
        dateFrom: dateFrom?.toISOString().split('T')[0],
        dateTo: dateTo?.toISOString().split('T')[0],
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${reportType}-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export CSV')
    }
    setIsLoading(false)
  }

  const handleExportPDF = async () => {
    setIsLoading(true)
    try {
      const response = await reportsAPI.exportCSV(reportType, {
        dateFrom: dateFrom?.toISOString().split('T')[0],
        dateTo: dateTo?.toISOString().split('T')[0],
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export PDF')
    }
    setIsLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportCSV}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
      >
        {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        CSV
      </button>
      <button
        onClick={handleExportPDF}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 text-sm font-medium"
      >
        {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        PDF
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        Print
      </button>
    </div>
  )
}
