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

## CORS (browser clients)

Set `ALLOWED_ORIGINS` to a comma-separated list of frontend origins (see `.env.example`).  
`http://localhost:*` and `http://127.0.0.1:*` are always allowed for local dev.

Rejected browser origins are logged as `[cors] rejected origin: …` (disable with `CORS_LOG_REJECTED=0`).

## Endpoints

- `GET /health` — lightweight keep-alive (Render prewarm; no Plexo)
- `GET /api/payments/health` — public `{ ok: true }` only
- `GET /api/payments/health/detail` — admin JWT; full Plexo/config diagnostic (former `/health` body)
- `POST /api/payments/resolve`
- `POST /api/payments/webhook`
- `POST /api/agencies/inquiry` — solicitud tarifas B2B (`agencies.html`); envía email vía Resend

### Agencies inquiry payload

```json
{
  "name": "Jane Doe",
  "company": "Example Travel",
  "country": "Argentina",
  "city": "Buenos Aires",
  "email": "jane@example.com",
  "phone": "+54 11 1234 5678",
  "website": "https://example.com",
  "companyType": "travel_agency",
  "interests": ["tours", "transfers"],
  "passengerTypes": ["groups"],
  "message": "Optional message",
  "language": "es",
  "privacyAccepted": true
}
```

Requires `RESEND_API_KEY`. Optional `AGENCIES_INQUIRY_EMAIL` (defaults to `NOTIFICATION_EMAIL` or `contacto@sacraadventures.com`).

## Post-deploy checklist — Área de Agencias (`agencies.html`)

Usar este checklist después de cada deploy del backend que incluya `POST /api/agencies/inquiry`.

### 1. Variables en Render

Confirmar en el servicio de backend (mismo que pagos) que existen:

- `RESEND_API_KEY`
- `RESEND_FROM`
- `AGENCIES_INQUIRY_EMAIL=contacto@sacraadventures.com`

### 2. Remitente Resend

Verificar que `RESEND_FROM` use un dominio/remitente **verificado** en el panel de Resend (no solo `onboarding@resend.dev` salvo pruebas puntuales).

### 3. Deploy y disponibilidad del endpoint

- Confirmar que el deploy en Render terminó sin errores.
- Confirmar que el endpoint responde:

  `POST /api/agencies/inquiry`

  (URL pública típica: `https://sacramento-payments-test.onrender.com/api/agencies/inquiry`)

### 4. Smoke test (curl)

Ejecutar con datos ficticios (ajustar la URL base si usás otro entorno):

```bash
curl -sS -w "\nHTTP %{http_code}\n" -X POST \
  "https://sacramento-payments-test.onrender.com/api/agencies/inquiry" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "Smoke Test",
    "company": "Agencia Ficticia QA",
    "country": "Uruguay",
    "city": "Colonia",
    "email": "qa-agency@example.com",
    "phone": "+598 99 000 000",
    "website": "https://example.com",
    "companyType": "travel_agency",
    "interests": ["tours", "transfers"],
    "passengerTypes": ["groups"],
    "message": "Prueba post-deploy — ignorar",
    "language": "es",
    "privacyAccepted": true
  }'
```

### 5. Respuesta esperada del smoke test

- **HTTP 200**
- Cuerpo JSON: `{ "ok": true }`

Si falta `RESEND_API_KEY` o Resend rechaza el envío, el endpoint puede responder **503** / **502** (no considerar el deploy listo para producción).

### 6. Bandeja de entrada

Confirmar que el correo llegó a **contacto@sacraadventures.com** con asunto del tipo:

`Nueva solicitud de tarifas B2B — Agencia Ficticia QA`

Revisar también spam/cuarentena si no aparece de inmediato.

### 7. Reply-To

Abrir el email recibido y verificar que **Reply-To** (responder) sea **qa-agency@example.com** (el email del payload de prueba), para poder contestar directamente al interesado.

### 8. Prueba end-to-end en producción (`agencies.html`)

Desde el sitio publicado (p. ej. `https://sacraadventures.com/Home/agencies.html`):

- [ ] Al enviar, el botón muestra el estado **“Enviando…”** / **“Sending…”** (según idioma) mientras dura el POST.
- [ ] Llega un email real a **contacto@sacraadventures.com** con los datos del formulario.
- [ ] El mensaje **“¡Gracias por contactarnos! / Recibimos tu solicitud…”** aparece **solo después** de un **200** del servidor.
- [ ] Tras el éxito, el formulario se **resetea** y se muestra el panel de confirmación.

### 9. Fallo controlado (frontend)

Simular fallo del backend (p. ej. quitar temporalmente `RESEND_API_KEY` en un entorno de staging, o detener el servicio) y enviar el formulario:

- [ ] **No** debe mostrarse el mensaje de éxito “Recibimos tu solicitud”.
- [ ] Los datos ingresados **permanecen** en el formulario.
- [ ] Debe mostrarse el aviso de error y el botón **“Contactar por WhatsApp”** (fallback con los datos ya cargados).

Restaurar la configuración correcta después de la prueba.

### 10. Honeypot y rate limit

Sin cambiar código:

- **Honeypot:** un POST con `"hp_field": "bot"` (u otro valor no vacío) debe responder **200** `{ "ok": true }` **sin** enviar email (comprobar que no llega correo).
- **Rate limit:** más de **8** solicitudes válidas desde la misma IP en **15 minutos** debe responder **429** (`Too many requests`).

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
- `PLEXO_COMMERCE_ID=<CommerceId>` — id de comercio en Plexo para operaciones tipo **issuers** (`/Commerce/Issuer`, etc.). Con Handy suele ser el de negocio (ej. **65264**).
- `PLEXO_OPTIONAL_COMMERCE_ID=<id>` — **solo** para **ExpressCheckout**: va en `AuthorizationData.OptionalCommerceId` y `PaymentData.OptionalCommerceId`. Si no lo definís, se reutiliza `PLEXO_COMMERCE_ID`. Con Handy/Handy+Plexo a veces es distinto (ej. **66059** mientras `PLEXO_COMMERCE_ID` es **65264**).
- `PLEXO_REDIRECT_URL=<frontend redirect URL>`
- `PLEXO_PFX_PATH=/etc/secrets/SacramentoAdventurestest.pfx` (Render Secret File) **or** `PLEXO_PFX_BASE64=<base64>`

Optional:

- `PLEXO_CERT_FINGERPRINT=<thumbprint>` if you need to force a fingerprint manually.
- `PLEXO_EXPRESS_MAX_INSTALLMENTS=6` — `PaymentData.Installments` en ExpressCheckout (default **6**; `1` = solo contado). La UI de cuotas también depende del comercio / moneda (USD) en Handy.

### Render recommendation for certificate

1. Go to your service settings.
2. Add a secret file with the `.pfx`.
3. Set `PLEXO_PFX_PATH` to the mounted file path.
4. Redeploy.

### Notes

- Never commit the `.pfx` file or credentials.
- `POST /api/payments/resolve` will use Plexo `Auth + Uri` flow in this mode.
- `POST /api/payments/webhook` accepts both generic webhooks and signed Plexo callbacks.

### 3DS / “No fue posible validar el medio de pago con 3DSecure”

Para **Visa vía Totalnet**, la guía de Plexo exige el **device fingerprint** de CyberSource: el navegador debe cargar `https://h.online-metrix.net/fp/tags.js` con un `session_id` único, y el **mismo** valor debe ir en `PaymentData.CybersourceDeviceFingerprint` al crear el Express Checkout.

Este backend ya:

- expone `GET /api/payments/plexo-client-hints` con `cybersourceOrgId` (por defecto de pruebas `45ssiuz3`) y `cybersourceSessionPrefix`;
- acepta en `POST /api/payments/resolve` el campo opcional `cybersourceDeviceFingerprint`;
- el frontend (`Home/orders.js`) pide esos hints, genera el `session_id` y lo envía en el resolve **si** `PLEXO_CYBERSOURCE_SESSION_PREFIX` está definido en el servidor.

**Importante:** pedí a Plexo el **prefijo IdComercio** para tu comercio en testing (ejemplos en su doc: cadena tipo `visanetuy_px_…` o `oca_plexo` según procesador) y configurá en Render (o `.env` local):

```env
PLEXO_CYBERSOURCE_SESSION_PREFIX=tu_prefijo_que_indica_plexo
```

Sin ese prefijo, la tarjeta de prueba correcta puede seguir fallando en 3DS.

