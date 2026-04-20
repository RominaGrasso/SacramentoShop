# Payments Backend (Handy resolver)

Small backend to create/reuse payment links by order fingerprint.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

By default it runs in `mock` mode and returns deterministic Handy-like URLs.

## Endpoints

- `GET /api/payments/health`
- `POST /api/payments/resolve`
- `POST /api/payments/webhook`

### Resolve payload

```json
{
  "experience": "bruma",
  "amount": 110,
  "currency": "USD",
  "people": 2,
  "orderPayload": {
    "orders": []
  }
}
```

### Resolve response

```json
{
  "reused": true,
  "paymentUrl": "https://pago.handy.uy/details/?sessionId=...",
  "sessionId": "...",
  "fingerprint": "..."
}
```

## Handy production mode

Set in `.env`:

- `PAYMENT_MODE=handy`
- `HANDY_CREATE_URL=<handy create payment endpoint>`
- `HANDY_TOKEN=<api token>`

The request body sent to Handy includes: amount, currency, description, metadata.

