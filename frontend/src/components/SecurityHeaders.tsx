/**
 * Security Status Component
 * Displays security headers and connection status
 */

import React, { useEffect, useState } from 'react'
import { validateSecurityHeaders, isSecureConnection, checkSecurityCompliance } from '../lib/security'

interface SecurityStatus {
  https: boolean
  headers: {
    has_hsts: boolean
    has_csp: boolean
    has_x_frame_options: boolean
    has_x_content_type_options: boolean
    has_x_xss_protection: boolean
  }
  compliance: {
    https: boolean
    headers: boolean
    localStorage_empty: boolean
    session_valid: boolean
  }
  timestamp: number
}

export const SecurityStatusComponent: React.FC = () => {
  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSecurity = async () => {
      try {
        const headers = await validateSecurityHeaders()
        const compliance = await checkSecurityCompliance()

        setStatus({
          https: isSecureConnection(),
          headers,
          compliance,
          timestamp: Date.now(),
        })
      } catch (error) {
        console.error('Security check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSecurity()
  }, [])

  if (loading) {
    return <div className="text-sm text-gray-500">Checking security...</div>
  }

  if (!status) {
    return null
  }

  const headerCount = Object.values(status.headers).filter(Boolean).length
  const totalHeaders = Object.keys(status.headers).length
  const headerPercentage = (headerCount / totalHeaders) * 100

  return (
    <div className="security-status p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">🔐 Security Status</h3>
        <span className="text-gray-500">
          {new Date(status.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Connection Status */}
      <div className="mb-3 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {status.https ? (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-gray-700">HTTPS Enabled</span>
            </>
          ) : (
            <>
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">Not HTTPS (Insecure)</span>
            </>
          )}
        </div>
      </div>

      {/* Security Headers */}
      <div className="mb-3 pb-3 border-b border-gray-200">
        <div className="mb-1 font-semibold text-gray-800">Security Headers</div>
        <div className="text-gray-600 mb-2">
          {headerCount}/{totalHeaders} headers present ({headerPercentage.toFixed(0)}%)
        </div>
        <div className="space-y-1 ml-2">
          <div className={status.headers.has_hsts ? 'text-green-600' : 'text-red-600'}>
            {status.headers.has_hsts ? '✓' : '✗'} HSTS
          </div>
          <div className={status.headers.has_csp ? 'text-green-600' : 'text-red-600'}>
            {status.headers.has_csp ? '✓' : '✗'} Content-Security-Policy
          </div>
          <div className={status.headers.has_x_frame_options ? 'text-green-600' : 'text-red-600'}>
            {status.headers.has_x_frame_options ? '✓' : '✗'} X-Frame-Options
          </div>
          <div
            className={status.headers.has_x_content_type_options ? 'text-green-600' : 'text-red-600'}
          >
            {status.headers.has_x_content_type_options ? '✓' : '✗'} X-Content-Type-Options
          </div>
          <div className={status.headers.has_x_xss_protection ? 'text-green-600' : 'text-red-600'}>
            {status.headers.has_x_xss_protection ? '✓' : '✗'} X-XSS-Protection
          </div>
        </div>
      </div>

      {/* Compliance Status */}
      <div>
        <div className="font-semibold text-gray-800 mb-1">Compliance</div>
        <div className="space-y-1 ml-2 text-gray-600">
          <div className={status.compliance.https ? 'text-green-600' : 'text-red-600'}>
            {status.compliance.https ? '✓' : '✗'} HTTPS
          </div>
          <div className={status.compliance.headers ? 'text-green-600' : 'text-red-600'}>
            {status.compliance.headers ? '✓' : '✗'} Security Headers
          </div>
          <div className={status.compliance.localStorage_empty ? 'text-green-600' : 'text-yellow-600'}>
            {status.compliance.localStorage_empty ? '✓' : '⚠'} LocalStorage Empty
          </div>
          <div className={status.compliance.session_valid ? 'text-green-600' : 'text-gray-600'}>
            {status.compliance.session_valid ? '✓' : '-'} Session Valid
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!status.https && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700">
          ⚠️ You are not using HTTPS. Your connection is not secure.
        </div>
      )}
      {!status.compliance.headers && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
          ⚠️ Some security headers are missing.
        </div>
      )}
    </div>
  )
}

export default SecurityStatusComponent
