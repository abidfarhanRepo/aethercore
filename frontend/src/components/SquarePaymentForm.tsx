import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface SquarePaymentFormProps {
  amount: number // in cents
  saleId: string
  customerId?: string
  onSuccess: (paymentId: string, transactionId: string) => void
  onError: (error: string) => void
  onCancel: () => void
}

declare global {
  interface Window {
    Square: any
  }
}

/**
 * Square Payment Form Component
 * Handles Square Web Payments SDK integration for card and digital wallet payments
 */
export function SquarePaymentForm({
  amount,
  saleId,
  customerId,
  onSuccess,
  onError,
  onCancel,
}: SquarePaymentFormProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [web, setWeb] = useState<any>(null)

  const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APP_ID!
  const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID!

  useEffect(() => {
    const loadSquareSDK = async () => {
      // Load Square Web Payments SDK script
      const script = document.createElement('script')
      script.src = 'https://web.squarecdn.com/v1/square.js'
      script.async = true
      script.onload = async () => {
        try {
          const webInstance = await (window.Square as any).Web.payments(
            SQUARE_APP_ID
          )
          setWeb(webInstance)
          setIsLoaded(true)
        } catch (error) {
          console.error('Failed to initialize Square Payments:', error)
          setStatusMessage({
            type: 'error',
            message: 'Failed to load payment processor',
          })
        }
      }
      script.onerror = () => {
        setStatusMessage({
          type: 'error',
          message: 'Failed to load Square SDK',
        })
      }
      document.body.appendChild(script)
    }

    loadSquareSDK()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!web) {
      setStatusMessage({
        type: 'error',
        message: 'Payment processor not ready',
      })
      return
    }

    setIsProcessing(true)
    setStatusMessage({ type: 'info', message: 'Processing payment...' })

    try {
      // Request tokenized card from Square
      const result = await web.requestCardNonce()

      if (result.status === 'SUCCESS') {
        const nonce = result.token

        // Call backend to process payment
        const response = await fetch('/api/v1/payments/square', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({
            saleId,
            sourceId: nonce,
            amount,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.details || error.error)
        }

        const paymentResult = await response.json()

        setStatusMessage({
          type: 'success',
          message: 'Payment successful!',
        })

        setTimeout(() => {
          onSuccess(paymentResult.paymentId, paymentResult.transactionId)
        }, 1000)
      } else {
        throw new Error(result.errors?.[0]?.message || 'Card validation failed')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Payment processing failed'
      setStatusMessage({
        type: 'error',
        message,
      })
      onError(message)
      setIsProcessing(false)
    }
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading Square Payments...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Square Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status Messages */}
          {statusMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : statusMessage.type === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Loader className="h-5 w-5 animate-spin" />
              )}
              <span className="text-sm">{statusMessage.message}</span>
            </div>
          )}

          {/* Square Web Payments SDK Container */}
          <div ref={containerRef} id="sq-web-payments-sdk" />

          {/* Amount Display */}
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-xl font-bold">
              ${(amount / 100).toFixed(2)}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${(amount / 100).toFixed(2)}`
              )}
            </Button>
          </div>

          {/* Note about PCI compliance */}
          <p className="text-xs text-gray-500">
            Your payment information is securely processed by Square and PCI compliant.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
