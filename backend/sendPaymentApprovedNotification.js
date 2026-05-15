/**
 * Resend notification when a payment becomes approved (first time only).
 * Failures are logged; never throw to callers.
 */

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function line(label, value) {
  const v = value == null || value === "" ? "—" : String(value);
  return `${label}: ${v}`;
}

function formatPaymentMethod(attempt) {
  if (!attempt || typeof attempt !== "object") return "—";
  const parts = [];
  const brand = attempt.card?.brand || attempt.raw?.cardType;
  const issuer = attempt.issuer?.name || attempt.raw?.cardIssuer;
  const masked = attempt.card?.maskedNumber || attempt.card?.last4;
  if (brand) parts.push(String(brand));
  if (issuer) parts.push(`issuer: ${issuer}`);
  if (masked) parts.push(String(masked));
  else if (attempt.card?.last4) parts.push(`****${attempt.card.last4}`);
  return parts.length ? parts.join(" · ") : "—";
}

function buildEmailBodies(payment, attempt) {
  const experience = payment?.experience || "—";
  const people = payment?.people != null ? String(payment.people) : "—";
  const amount = payment?.amount != null ? String(payment.amount) : "—";
  const currency = payment?.currency || "—";
  const payerName = attempt?.payer?.name || "—";
  const payerEmail = attempt?.payer?.email || "—";
  const paymentMethod = formatPaymentMethod(attempt);
  const ref = payment?.fingerprint || payment?.sessionId || "—";
  const sessionId = payment?.sessionId || "—";
  const date = payment?.updatedAt || payment?.createdAt || new Date().toISOString();

  const text = [
    "Pago aprobado — Sacramento Adventures",
    "",
    line("Experiencia", experience),
    line("Personas", people),
    line("Monto", `${amount} ${currency}`),
    line("Cliente", payerName),
    line("Email cliente", payerEmail),
    line("Medio de pago", paymentMethod),
    line("Referencia (fingerprint)", ref),
    line("Session ID", sessionId),
    line("Fecha", date)
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5;color:#1f2937">
<h2 style="color:#1f3c68">Pago aprobado</h2>
<table style="border-collapse:collapse">
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Experiencia</td><td>${escHtml(experience)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Personas</td><td>${escHtml(people)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Monto</td><td>${escHtml(amount)} ${escHtml(currency)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Cliente</td><td>${escHtml(payerName)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Email cliente</td><td>${escHtml(payerEmail)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Medio de pago</td><td>${escHtml(paymentMethod)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Referencia</td><td>${escHtml(ref)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Session ID</td><td>${escHtml(sessionId)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Fecha</td><td>${escHtml(date)}</td></tr>
</table>
</body></html>`;

  return { text, html, subject: `Pago aprobado — ${experience}` };
}

/**
 * @param {object} payment — merged payment record after store update
 * @param {object|null} attempt — latest paymentAttempts entry metadata
 * @returns {Promise<{ sent: boolean, omitted?: boolean }>}
 */
export async function sendPaymentApprovedNotification(payment, attempt = null) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const to = String(process.env.NOTIFICATION_EMAIL || "").trim();

  if (!apiKey || !to) {
    // eslint-disable-next-line no-console
    console.warn("[payment-email] omitted: RESEND_API_KEY or NOTIFICATION_EMAIL not configured");
    return { sent: false, omitted: true };
  }

  const from =
    String(process.env.RESEND_FROM || "").trim() ||
    "Sacramento Adventures <onboarding@resend.dev>";

  const { text, html, subject } = buildEmailBodies(payment, attempt);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.warn("[payment-email] error sending", {
        status: res.status,
        detail: String(detail).slice(0, 300)
      });
      return { sent: false };
    }

    // eslint-disable-next-line no-console
    console.log("[payment-email] sent", {
      experience: payment?.experience,
      sessionId: payment?.sessionId,
      fingerprint: payment?.fingerprint
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[payment-email] error sending", {
      message: err instanceof Error ? err.message : String(err)
    });
    return { sent: false };
  }
}
