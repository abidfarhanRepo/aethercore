import React, { useState, useEffect } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface StripePaymentFormProps {
  amount: number // in cents
  saleId: string
  customerId?: string
  onSuccess: (paymentId: string, transactionId: string) => void
  onError: (error: string) => void
  onCancel: () => void
}

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY!

/**
 * Stripe Payment Form Component
 * Handles Stripe card tokenization and payment processing securely
 */
function StripePaymentFormContent({
  amount,
  saleId,
  customerId,
  onSuccess,
  onError,
  onCancel,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [cardholderName, setCardholderName] = useState('')
  const [email, setEmail] = useState('')
  const [saveCard, setSaveCard] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setStatusMessage({
        type: 'error',
        message: 'Stripe is not loaded',
      })
      return
    }

    if (!cardholderName) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter cardholder name',
      })
      return
    }

    setIsProcessing(true)
    setStatusMessage({ type: 'info', message: 'Processing payment...' })

    try {
      // Create payment method from card element
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
        billing_details: {
          name: cardholderName,
          email,
        },
      })

      if (error) {
        setStatusMessage({
          type: 'error',
          message: error.message || 'Failed to create payment method',
        })
        setIsProcessing(false)
        return
      }

      // Call backend to process payment
      const response = await fetch('/api/v1/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          saleId,
          processor: 'STRIPE',
          amount,
          paymentMethodId: paymentMethod?.id,
          cardholderName,
          saveCard,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error)
      }

      const result = await response.json()

      if (result.requiresAction && result.clientSecret) {
        // Handle 3D Secure challenge
        const confirmResult = await stripe.confirmCardPayment(result.clientSecret)

        if (confirmResult.error) {
          throw new Error(confirmResult.error.message)
        }
      }

      setStatusMessage({
        type: 'success',
        message: 'Payment successful!',
      })

      setTimeout(() => {
        onSuccess(result.paymentId, result.transactionId)
      }, 1000)
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

  return (
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

      {/* Cardholder Name */}
      <div>
        <label className="text-sm font-medium">Cardholder Name</label>
        <Input
          type="text"
          placeholder="John Doe"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          disabled={isProcessing}
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          placeholder="customer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {/* Card Element */}
      <div>
        <label className="text-sm font-medium">Card Details</label>
        <div className="p-3 border rounded bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Save Card Checkbox */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={saveCard}
          onChange={(e) => setSaveCard(e.target.checked)}
          disabled={isProcessing}
          className="rounded"
        />
        <span className="text-sm">Save card for future use</span>
      </label>

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
          disabled={!stripe || !cardholderName || isProcessing}
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
    </form>
  )
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const checkStripe = async () => {
      const stripe = await loadStripe(STRIPE_KEY)
      if (stripe) {
        setIsLoaded(true)
      }
    }
    checkStripe()
  }, [])

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading Stripe...</span>
        </CardContent>
      </Card>
    )
  }

  const stripePromise = loadStripe(STRIPE_KEY)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise}>
          <StripePaymentFormContent {...props} />
        </Elements>
      </CardContent>
    </Card>
  )
}
