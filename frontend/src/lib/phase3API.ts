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
  }) => api.post('/api/v1/inventory/lots', payload),
  listLots: (productId: string) => api.get(`/api/v1/inventory/lots/${productId}`),
  alerts: (thresholdDays = 30) => api.get('/api/v1/inventory/expiry-alerts', { params: { thresholdDays } }),
  transferLot: (payload: {
    productId: string
    fromLotBatchId: string
    toLotBatchId?: string
    qty: number
    notes?: string
  }) => api.post('/api/v1/inventory/transfer-lot', payload),
}

export const restaurantAPI = {
  listTables: () => api.get('/api/v1/restaurant/tables'),
  updateTable: (id: string, payload: { status?: string; notes?: string }) =>
    api.patch(`/api/v1/restaurant/tables/${id}`, payload),
}

export const kitchenAPI = {
  listTickets: () => api.get('/api/v1/kitchen/tickets'),
  updateTicketStatus: (id: string, status: string) =>
    api.patch(`/api/v1/kitchen/tickets/${id}/status`, { status }),
}

export const pharmacyAPI = {
  getPrescription: (rxNumber: string) => api.get(`/api/v1/pharmacy/prescriptions/${rxNumber}`),
  listInteractions: () => api.get('/api/v1/pharmacy/interactions'),
  fillPrescription: (id: string) => api.post(`/api/v1/pharmacy/prescriptions/${id}/fill`),
  createOverride: (payload: {
    prescriptionId: string
    pharmacistId: string
    action: string
    reason: string
  }) => api.post('/api/v1/pharmacy/overrides', payload),
}

export const receivingAPI = {
  startSession: (purchaseOrderId: string, startedBy?: string) =>
    api.post(`/api/v1/purchases/${purchaseOrderId}/start-receiving`, { startedBy }),
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
  ) => api.post(`/api/v1/purchases/${purchaseOrderId}/receiving/discrepancy`, payload),
  completeSession: (purchaseOrderId: string, sessionId: string, completedBy?: string) =>
    api.post(`/api/v1/purchases/${purchaseOrderId}/receiving/complete`, { sessionId, completedBy }),
  listDiscrepancies: () => api.get('/api/v1/purchases/discrepancies'),
}
