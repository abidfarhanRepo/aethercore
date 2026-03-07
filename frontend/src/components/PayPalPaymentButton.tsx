import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface PayPalPaymentButtonProps {
  amount: number // in cents
  saleId: string
  customerId?: string
  onSuccess: (paymentId: string, transactionId: string) => void
  onError: (error: string) => void
  onCancel: () => void
}

declare global {
  interface Window {
    paypal: any
  }
}

/**
 * PayPal Payment Button Component
 * Handles PayPal button integration for express checkout
 */
export function PayPalPaymentButton({
  amount,
  saleId,
  customerId,
  onSuccess,
  onError,
  onCancel,
}: PayPalPaymentButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID!

  useEffect(() => {
    const loadPayPalSDK = async () => {
      // Load PayPal SDK script
      const script = document.createElement('script')
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}`
      script.async = true
      script.onload = () => {
        try {
          if (containerRef.current && window.paypal) {
            // Clear previous buttons
            containerRef.current.innerHTML = ''

            // Render PayPal button
            window.paypal
              .Buttons({
                createOrder: async () => {
                  try {
                    // Create PayPal order on backend
                    const response = await fetch('/api/v1/payments/paypal/orders', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem(
                          'auth_token'
                        )}`,
                      },
                      body: JSON.stringify({
                        saleId,
                        amount: amount / 100,
                        customerId,
                      }),
                    })

                    if (!response.ok) {
                      const error = await response.json()
                      throw new Error(
                        error.details || error.error || 'Failed to create order'
                      )
                    }

                    const { orderId } = await response.json()
                    setStatusMessage({
                      type: 'info',
                      message: 'Order created, redirecting to PayPal...',
                    })
                    return orderId
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : 'Failed to create PayPal order'
                    setStatusMessage({
                      type: 'error',
                      message,
                    })
                    onError(message)
                    throw error
                  }
                },
                onApprove: async (data: any) => {
                  try {
                    setStatusMessage({
                      type: 'info',
                      message: 'Capturing payment...',
                    })

                    // Capture PayPal order on backend
                    const response = await fetch(
                      '/api/v1/payments/paypal',
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem(
                            'auth_token'
                          )}`,
                        },
                        body: JSON.stringify({
                          saleId,
                          orderId: data.orderID,
                        }),
                      }
                    )

                    if (!response.ok) {
                      const error = await response.json()
                      throw new Error(
                        error.details || error.error || 'Payment capture failed'
                      )
                    }

                    const result = await response.json()

                    setStatusMessage({
                      type: 'success',
                      message: 'Payment successful!',
                    })

                    setTimeout(() => {
                      onSuccess(result.paymentId, result.transactionId)
                    }, 1000)
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : 'Payment processing failed'
                    setStatusMessage({
                      type: 'error',
                      message,
                    })
                    onError(message)
                  }
                },
                onError: (error: any) => {
                  const message =
                    error?.message || 'PayPal payment processing failed'
                  setStatusMessage({
                    type: 'error',
                    message,
                  })
                  onError(message)
                },
                onCancel: () => {
                  setStatusMessage({
                    type: 'info',
                    message: 'Payment cancelled',
                  })
                  onCancel()
                },
              })
              .render(containerRef.current)
          }
          setIsLoaded(true)
        } catch (error) {
          console.error('Failed to initialize PayPal:', error)
          setStatusMessage({
            type: 'error',
            message: 'Failed to load payment processor',
          })
        }
      }
      script.onerror = () => {
        setStatusMessage({
          type: 'error',
          message: 'Failed to load PayPal SDK',
        })
      }
      document.body.appendChild(script)
    }

    loadPayPalSDK()
  }, [amount, saleId])

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading PayPal...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PayPal Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Amount Display */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-xl font-bold">
            ${(amount / 100).toFixed(2)}
          </div>
        </div>

        {/* PayPal Button Container */}
        <div ref={containerRef} id="paypal-button-container" />

        {/* Cancel Button */}
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full"
        >
          Cancel
        </Button>

        {/* Note about PayPal */}
        <p className="text-xs text-gray-500">
          You will be redirected to PayPal to complete your purchase securely.
        </p>
      </CardContent>
    </Card>
  )
}
