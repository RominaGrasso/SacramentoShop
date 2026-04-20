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

## Plexo testing / production mode

Set in `.env`:

- `PAYMENT_MODE=plexo`
- `PLEXO_GATEWAY_URL=https://testing.plexo.com.uy:4043/SecurePaymentGateway.svc` (testing)
- `PLEXO_CLIENT_NAME=<ClientName>`
- `PLEXO_CERT_PASSWORD=<pfx password>`
- `PLEXO_COMMERCE_ID=<commerce id>`
- `PLEXO_REDIRECT_URL=<frontend redirect URL>`
- `PLEXO_PFX_PATH=/etc/secrets/SacramentoAdventurestest.pfx` (Render Secret File) **or** `PLEXO_PFX_BASE64=<base64>`

Optional:

- `PLEXO_CERT_FINGERPRINT=<thumbprint>` if you need to force a fingerprint manually.

### Render recommendation for certificate

1. Go to your service settings.
2. Add a secret file with the `.pfx`.
3. Set `PLEXO_PFX_PATH` to the mounted file path.
4. Redeploy.

### Notes

- Never commit the `.pfx` file or credentials.
- `POST /api/payments/resolve` will use Plexo `Auth + Uri` flow in this mode.
- `POST /api/payments/webhook` accepts both generic webhooks and signed Plexo callbacks.

