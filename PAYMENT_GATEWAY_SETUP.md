# Payment Gateway Configuration Guide

## Backend Configuration (.env)

### General Payment Settings
```
# Encryption key for sensitive payment data (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_encryption_key_here

# Payment processor selection
ACTIVE_PAYMENT_PROCESSORS=STRIPE,SQUARE,PAYPAL

# Webhook timeout (in seconds)
WEBHOOK_TIMEOUT=10

# Payment attempt retry configuration
PAYMENT_RETRY_ATTEMPTS=3
PAYMENT_RETRY_BACKOFF_MS=1000
```

### Stripe Configuration
```
# Get these from https://dashboard.stripe.com/apikeys
STRIPE_API_KEY=sk_test_xxxxx  # Secret key (required for backend)
STRIPE_PUBLIC_KEY=pk_test_xxxxx  # Public key (for frontend)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Webhook signing secret

# Stripe webhook endpoint
STRIPE_WEBHOOK_URL=https://your-domain.com/payments/webhooks/stripe
```

### Square Configuration
```
# Get these from https://developer.squareup.com/apps
SQUARE_API_KEY=sq_xxxx  # OAuth access token
SQUARE_APPLICATION_ID=sq_xxxx  # Application ID
SQUARE_LOCATION_ID=loc_xxxxx  # Location ID
SQUARE_WEBHOOK_SECRET=xxxx  # Webhook signing secret

# Square environment (sandbox or production)
SQUARE_ENVIRONMENT=sandbox

# Square webhook endpoint
SQUARE_WEBHOOK_URL=https://your-domain.com/payments/webhooks/square
```

### PayPal Configuration
```
# Get these from https://developer.paypal.com/dashboard
PAYPAL_CLIENT_ID=AZxxxxxx  # Client ID
PAYPAL_CLIENT_SECRET=EAxxxxxx  # Client Secret
PAYPAL_WEBHOOK_ID=xxxxx  # Webhook ID
PAYPAL_MODE=sandbox  # sandbox or live

# PayPal webhook endpoint
PAYPAL_WEBHOOK_URL=https://your-domain.com/payments/webhooks/paypal
```

### Frontend Configuration (.env)

```
# Stripe (public key only)
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx

# Square
VITE_SQUARE_APP_ID=sq_xxxx
VITE_SQUARE_LOCATION_ID=loc_xxxxx

# PayPal
VITE_PAYPAL_CLIENT_ID=AZxxxxxx

# API endpoint
VITE_API_URL=http://localhost:4000/api
VITE_FRONTEND_URL=http://localhost:5173
```

## Setup Instructions

### 1. Stripe Setup
- Create a Stripe account at https://stripe.com/
- Navigate to https://dashboard.stripe.com/apikeys
- Copy your Secret Key (sk_test_...) and Public Key (pk_test_...)
- Go to https://dashboard.stripe.com/webhooks
- Create a webhook endpoint pointing to `https://your-domain.com/payments/webhooks/stripe`
- Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`
- Copy the signing secret (whsec_...)
- Test with card: `4242 4242 4242 4242` (any future expiry, any CVV)

### 2. Square Setup
- Create a Square account at https://squareup.com/
- Navigate to https://developer.squareup.com/apps
- Create an application
- Generate an OAuth token for your location
- Copy Application ID and Location ID
- Create a webhook endpoint at https://developer.squareup.com/apps
- Copy the signing secret
- Test in Sandbox mode

### 3. PayPal Setup
- Create a PayPal Developer account at https://developer.paypal.com/
- Create a Sandbox business account for testing
- In your app settings, copy Client ID and Client Secret
- Navigate to Webhooks in Account Settings
- Create a webhook endpoint pointing to `https://your-domain.com/payments/webhooks/paypal`
- Select events: `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`
- Copy the Webhook ID
- Test with Sandbox buyer account

## PCI Compliance Checklist

- [ ] Never store full credit card numbers in database
- [ ] Never log full credit card numbers or CVV
- [ ] All API keys stored encrypted in database
- [ ] HTTPS enforced on all payment endpoints
- [ ] Payment processor SDKs used for card tokenization
- [ ] Webhook signatures verified before processing
- [ ] Rate limiting enabled on payment endpoints
- [ ] Regular security audits performed
- [ ] Penetration testing completed
- [ ] Payment data retention policy implemented

## Testing

### Test Card Numbers by Processor

**Stripe Test Cards:**
- Visa: 4242 4242 4242 4242
- Mastercard: 5555 5555 5555 4444
- Amex: 3782 822463 10005
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155

**Square Test Cards:**
- Visa: 4111 1111 1111 1111
- Mastercard: 5105 1051 0510 5100
- Amex: 3782 8224 6310 005
- Decline: 4000 0000 0000 0002

**PayPal Sandbox:**
- Use sandbox.paypal.com credentials
- Test with Sandbox buyer account

### Running Payment Tests

```bash
# Backend tests
npm test -- src/__tests__/payments.test.ts

# Frontend tests
npm run test -- StripePaymentForm.tsx
npm run test -- SquarePaymentForm.tsx
npm run test -- PayPalPaymentButton.tsx
```

## Webhook Verification Examples

### Stripe Webhook Verification
```typescript
// Uses Stripe SDK
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
)
```

### Square Webhook Verification
```typescript
// HMAC-SHA256 verification
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(body)
  .digest('base64')
```

### PayPal Webhook Verification
```typescript
// PayPal-specific signature format
const message = `${transmissionId}|${transmissionTime}|${webhookId}|${body}`
const hash = crypto
  .createHmac('sha256', clientSecret)
  .update(message)
  .digest('base64')
```

## Error Handling

Common payment errors and how to handle them:

### Card Declined
- Error Code: `CARD_DECLINED`
- Action: Display user-friendly message, prompt for different card

### Invalid Card
- Error Code: `INVALID_CARD`
- Action: Validate card details with Luhn algorithm, show specific issue

### Authentication Required
- Error Code: `AUTHENTICATION_REQUIRED`
- Action: Initiate 3D Secure challenge flow

### Insufficient Funds
- Error Code: `INSUFFICIENT_FUNDS`
- Action: Suggest reducing payment amount or using different card

### Expired Card
- Error Code: `EXPIRED_CARD`
- Action: Prompt user to update card expiry date

## Monitoring and Logging

Enable payment monitoring:

```typescript
// Log all payment attempts (never log full card data)
logPaymentAttempt(
  transactionId,
  processor,
  amount,
  cardLast4,
  status,
  errorMessage
)

// Monitor success rate
// Monitor failure patterns
// Monitor webhook delays
// Monitor refund requests
```

## Migration from Test to Production

1. Update all API keys to production credentials
2. Update webhook URLs to production domain
3. Change payment processor mode from `sandbox` to `production`
4. Run full payment flow testing with small amounts
5. Monitor webhook delivery and processing
6. Ensure all error handling works correctly
7. Have customer support trained on payment issues
8. Implement payment reconciliation process
9. Set up alerts for failed payments
10. Document incident response procedures

## Support

For issues with payment processors:
- Stripe: https://support.stripe.com/
- Square: https://squareup.com/help/
- PayPal: https://www.paypal.com/selfhelp/
