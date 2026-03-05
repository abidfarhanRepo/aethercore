# Printer Testing Status

## Scope
This status note applies to:
- `POST /api/hardware/printers/:id/test-print`
- Printer payload generation from `backend/src/routes/hardware.ts`
- Printer settings editor and preview controls in `frontend/src/pages/settings/PaymentSettings.tsx`

## Current Status
- API endpoints for printer registration and test print are implemented.
- Payload generation logic is implemented and returns formatted output.
- Settings-driven receipt visibility controls are implemented.
- Physical print execution is **UNTESTED**.

## Reason For Untested State
No physical printer is connected in the current environment, so end-to-end hardware validation cannot be completed yet.

## What Is Verified
- Authenticated endpoint responses
- Payload text generation with section toggles
- Settings persistence and retrieval
- Frontend preview synchronization with saved settings

## What Is Pending
- Actual printer output on paper
- Driver/connection behavior across USB/network/serial devices
- Character width clipping and thermal printer rendering differences
- Real-world feed/cut behavior

## Recommended Validation Checklist (When Printer Is Available)
1. Register printer from Settings -> Payment -> Hardware Devices.
2. Run `Test Print` from UI and verify printed output matches payload.
3. Toggle fields in Printer Design Editor and re-run print.
4. Validate long item names, large totals, and footer wrapping.
5. Validate cash change line and payment breakdown visibility toggles.
6. Validate separator styles and paper width clipping.
