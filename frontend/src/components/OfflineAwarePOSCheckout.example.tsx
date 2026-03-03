/**
 * Example: Offline-aware POSCheckout Component
 * This demonstrates how to integrate offline capabilities into the checkout flow
 */

import React, { useState, useEffect } from 'react'
import { useNetworkStatus, usePendingSales } from '../lib/hooks/useOffline'
import { syncEngine } from '../lib/offline/sync'
import { offlineDB } from '../lib/offline/db'
import { api } from '../lib/api'

interface CheckoutItem {
  productId: string
  name: string
  quantity: number
  priceCents: number
  discountCents?: number
}

export function OfflineAwarePOSCheckout() {
  const networkStatus = useNetworkStatus()
  const { sales: pendingSales, saveSale, deleteSale } = usePendingSales()

  const [items, setItems] = useState<CheckoutItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPendingSales, setShowPendingSales] = useState(false)

  const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0)
  const taxCents = Math.round(subtotalCents * 0.1) // 10% tax
  const totalCents = subtotalCents + taxCents

  const handleCompleteCheckout = async () => {
    if (items.length === 0) {
      alert('Add items to cart first')
      return
    }

    setIsProcessing(true)

    try {
      const saleData = {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          priceCents: item.priceCents,
          discountCents: item.discountCents || 0,
        })),
        subtotalCents,
        taxCents,
        totalCents,
        paymentMethod,
        paymentStatus: networkStatus.isOnline ? 'completed' : 'pending',
        notes: '',
      }

      if (!networkStatus.isOnline) {
        // Offline: save locally
        const pendingSale = await saveSale(saleData)
        alert(`Sale saved offline (ID: ${pendingSale.id}). It will sync when online.`)

        // Deduct from local inventory
        for (const item of items) {
          const inventory = await offlineDB.getInventoryLevel(item.productId)
          if (inventory) {
            await offlineDB.saveInventoryLevel({
              ...inventory,
              qty: Math.max(0, inventory.qty - item.quantity),
            })
          }
        }
      } else {
        // Online: send to server directly
        const response = await api.post('/api/sales', saleData)

        if (response.status === 200 || response.status === 201) {
          alert('Sale completed successfully')
          setItems([])
        } else if (response.data?.offline) {
          // Request was queued
          alert(`Sale queued for sync (Queue ID: ${response.data.queueId})`)
        }
      }

      setItems([])
    } catch (error) {
      console.error('Checkout failed:', error)

      // If error while online, try to queue
      if (networkStatus.isOnline) {
        const queueId = await syncEngine.queueOperation(
          'POST',
          '/api/sales',
          {
            items,
            subtotalCents,
            taxCents,
            totalCents,
            paymentMethod,
            paymentStatus: 'pending',
          },
          10 // High priority for payments
        )
        alert(`Sale queued for later sync (Queue ID: ${queueId})`)
        setItems([])
      } else {
        alert('Offline and unable to save. Please try again.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetryPendingSale = async (saleId: string) => {
    try {
      const sale = await offlineDB.getPendingSale(saleId)
      if (!sale) return

      // Queue for sync
      await syncEngine.queueOperation('POST', '/api/sales', sale, 10)
      await deleteSale(saleId)
      alert('Sale requeued for sync')
    } catch (error) {
      console.error('Failed to retry sale:', error)
      alert('Failed to retry sale')
    }
  }

  return (
    <div className="flex gap-4">
      {/* Main checkout area */}
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-4">
          Checkout {!networkStatus.isOnline && '(Offline Mode)'}
        </h2>

        {/* Items list */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-2">Cart Items</h3>
          {items.length === 0 ? (
            <p className="text-gray-500">No items in cart</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      ${(item.priceCents / 100).toFixed(2)} x {item.quantity}
                    </p>
                  </div>
                  <button
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${(subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax (10%):</span>
            <span>${(taxCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-2">Payment Method</h3>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={isProcessing}
            className="w-full p-2 border rounded"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="check">Check</option>
            {networkStatus.isOnline && <option value="online">Online Payment</option>}
          </select>
        </div>

        {/* Checkout button */}
        <button
          onClick={handleCompleteCheckout}
          disabled={isProcessing || items.length === 0}
          className={`w-full py-3 rounded-lg font-semibold text-white ${
            isProcessing || items.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Complete Sale'}
        </button>

        {/* Offline notice */}
        {!networkStatus.isOnline && (
          <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
            <p className="font-semibold">Offline Mode</p>
            <p className="text-sm mt-1">
              You are currently offline. Sales will be saved locally and synced when you're back online.
            </p>
          </div>
        )}
      </div>

      {/* Pending Sales Panel */}
      {pendingSales.length > 0 && (
        <div className="w-80 bg-white rounded-lg p-4 border">
          <h3 className="font-semibold mb-2">
            Pending Sales ({pendingSales.length})
          </h3>
          <button
            onClick={() => setShowPendingSales(!showPendingSales)}
            className="text-blue-600 hover:text-blue-800 text-sm mb-2"
          >
            {showPendingSales ? 'Hide' : 'Show'} Details
          </button>

          {showPendingSales && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-2 border rounded bg-yellow-50"
                >
                  <p className="text-sm font-medium">
                    ${(sale.totalCents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(sale.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-gray-600">
                    {sale.items.length} item(s)
                  </p>
                  {networkStatus.isOnline && (
                    <button
                      onClick={() => handleRetryPendingSale(sale.id)}
                      className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Sync Now
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OfflineAwarePOSCheckout
