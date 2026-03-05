import { api } from './api'

export const expiryAPI = {
  createLot: (payload: {
    productId: string
    warehouseId: string
    batchNumber: string
    expiryDate: string
    qtyAvailable: number
    costPerUnit?: number
    notes?: string
  }) => api.post('/api/inventory/lots', payload),
  listLots: (productId: string) => api.get(`/api/inventory/lots/${productId}`),
  alerts: (thresholdDays = 30) => api.get('/api/inventory/expiry-alerts', { params: { thresholdDays } }),
  transferLot: (payload: {
    productId: string
    fromLotBatchId: string
    toLotBatchId?: string
    qty: number
    notes?: string
  }) => api.post('/api/inventory/transfer-lot', payload),
}

export const restaurantAPI = {
  listTables: () => api.get('/api/restaurant/tables'),
  updateTable: (id: string, payload: { status?: string; notes?: string }) =>
    api.patch(`/api/restaurant/tables/${id}`, payload),
}

export const kitchenAPI = {
  listTickets: () => api.get('/api/kitchen/tickets'),
  updateTicketStatus: (id: string, status: string) =>
    api.patch(`/api/kitchen/tickets/${id}/status`, { status }),
}

export const pharmacyAPI = {
  getPrescription: (rxNumber: string) => api.get(`/api/pharmacy/prescriptions/${rxNumber}`),
  listInteractions: () => api.get('/api/pharmacy/interactions'),
  fillPrescription: (id: string) => api.post(`/api/pharmacy/prescriptions/${id}/fill`),
  createOverride: (payload: {
    prescriptionId: string
    pharmacistId: string
    action: string
    reason: string
  }) => api.post('/api/pharmacy/overrides', payload),
}

export const receivingAPI = {
  startSession: (purchaseOrderId: string, startedBy?: string) =>
    api.post(`/api/purchases/${purchaseOrderId}/start-receiving`, { startedBy }),
  createDiscrepancy: (
    purchaseOrderId: string,
    payload: {
      sessionId: string
      purchaseOrderItemId: string
      qtyExpected: number
      qtyReceived: number
      discrepancyReason: string
      notes?: string
    }
  ) => api.post(`/api/purchases/${purchaseOrderId}/receiving/discrepancy`, payload),
  completeSession: (purchaseOrderId: string, sessionId: string, completedBy?: string) =>
    api.post(`/api/purchases/${purchaseOrderId}/receiving/complete`, { sessionId, completedBy }),
  listDiscrepancies: () => api.get('/api/purchases/discrepancies'),
}
