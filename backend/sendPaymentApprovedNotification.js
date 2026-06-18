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

function sanitizeWhatsAppForEmail(text) {
  let t = String(text || "").trim();
  if (!t) return "";
  const cutPatterns = [
    /\n\n(?:To confirm the reservation|Para confirmar la reserva|Para confirmar a reserva)[\s\S]*/i,
    /\n\n.*(?:complete the payment here|completar el pago aquí|concluir o pagamento aqui)[\s\S]*/i,
    /\n\n.*(?:Payment link could not be generated|no pudo generarse el enlace|não foi possível gerar o link)[\s\S]*/i,
    /\n\n.*(?:Please share payment instructions|compartir instrucciones de pago|instruções de pagamento)[\s\S]*/i,
    /\n\n.*(?:After payment, we will send|Después del pago|Após o pagamento)[\s\S]*/i,
    /\n\nhttps?:\/\/\S+[\s\S]*/i,
    /\n\n(?:Payment link could not be generated|El enlace de pago no pudo generarse)[\s\S]*/i
  ];
  for (const re of cutPatterns) {
    t = t.replace(re, "");
  }
  return t.trim();
}

function formatOrderPayloadFallback(op) {
  if (!op || typeof op !== "object") return "";
  const lines = [];

  const expName = op.experienceName;
  if (expName) lines.push(line("Experiencia reservada", expName));

  const visitDate = op.visitDate || op.date;
  if (visitDate) lines.push(line("Fecha", visitDate));

  const visitTime =
    op.visitTime ||
    op.cfg?.time ||
    op.group?.tourTime ||
    op.group?.time ||
    op.group?.departureTime;
  if (visitTime) lines.push(line("Hora", visitTime));

  if (op.cfg && typeof op.cfg === "object") {
    const c = op.cfg;
    if (c.package) lines.push(line("Paquete", c.package));
    if (c.guests != null) lines.push(line("Personas", c.guests));
    if (c.transport != null) lines.push(line("Transporte", c.transport ? "Sí" : "No"));
    if (c.time && c.time !== visitTime) lines.push(line("Hora de salida", c.time));
  }

  if (op.group && typeof op.group === "object") {
    const g = op.group;
    if (g.people != null && !op.cfg?.guests) lines.push(line("Personas", g.people));
    if (g.language) lines.push(line("Idioma", g.language));
    if (g.mateAddon) lines.push(line("Mate experience", "Sí"));
  }

  if (op.boatDepartureTime) {
    const bt =
      typeof op.boatDepartureTime === "object" && op.boatDepartureTime !== null
        ? Object.entries(op.boatDepartureTime)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : String(op.boatDepartureTime);
    if (bt) lines.push(line("Hora barco", bt));
  }

  if (Array.isArray(op.rooms) && op.rooms.length > 0) {
    op.rooms.forEach((r, i) => {
      const guests = r?.guests != null ? r.guests : "—";
      lines.push(line(`Habitación ${i + 1}`, `${guests} huésped(es)`));
    });
    if (op.roomSubtotal != null) lines.push(line("Subtotal habitaciones", `USD ${op.roomSubtotal}`));
  }

  if (Array.isArray(op.orders) && op.orders.length > 0) {
    lines.push("");
    lines.push("Detalle del pedido:");
    op.orders.forEach((o, i) => {
      if (!o || typeof o !== "object") return;
      lines.push(`— Pedido ${i + 1}`);
      if (o.packageLabel) lines.push(`  Paquete: ${o.packageLabel}`);
      if (o.main) lines.push(`  Principal: ${o.main}`);
      if (o.touristMain) lines.push(`  Menú turista: ${o.touristMain}`);
      if (o.starter) lines.push(`  Entrada: ${o.starter}`);
      if (o.walkingTourTime) lines.push(`  Hora walking tour: ${o.walkingTourTime}`);
      if (o.horsebackDepartureTime) lines.push(`  Hora cabalgata: ${o.horsebackDepartureTime}`);
      if (o.people != null) lines.push(`  Personas: ${o.people}`);
      const drinkParts = [];
      if (o.fullPints > 0) drinkParts.push(`${o.fullPints} pinta(s) completa(s)`);
      if (o.halfPints > 0) drinkParts.push(`${o.halfPints} media(s) pinta(s)`);
      if (drinkParts.length) lines.push(`  Bebidas: ${drinkParts.join(", ")}`);
      const foodParts = [];
      if (o.pizza > 0) foodParts.push(`${o.pizza} pizza(s)`);
      if (o.burger > 0) foodParts.push(`${o.burger} burger(s)`);
      if (o.fries > 0) foodParts.push(`${o.fries} papas fritas`);
      if (foodParts.length) lines.push(`  Comida: ${foodParts.join(", ")}`);
      if (Array.isArray(o.preferences) && o.preferences.length) {
        lines.push(`  Preferencias: ${o.preferences.join(", ")}`);
      }
    });
  }

  if (Array.isArray(op.bookings) && op.bookings.length > 0) {
    lines.push("");
    lines.push("Reservas:");
    op.bookings.forEach((booking, i) => {
      lines.push(`— Reserva ${i + 1}`);
      if (Array.isArray(booking?.orders)) {
        booking.orders.forEach((order, j) => {
          lines.push(`  Persona ${j + 1}:`);
          Object.entries(order || {}).forEach(([k, v]) => {
            if (v != null && v !== "") lines.push(`    ${k}: ${v}`);
          });
        });
      }
    });
  }

  if (op.total != null) lines.push(line("Total reserva", `USD ${op.total}`));
  else if (op.totalUsd != null) lines.push(line("Total menús", `USD ${op.totalUsd}`));

  return lines.join("\n").trim();
}

function getBookingDetailsText(payment) {
  const op = payment?.orderPayload;
  const fromWhatsApp = sanitizeWhatsAppForEmail(op?.whatsappMessage);
  if (fromWhatsApp) return fromWhatsApp;
  return formatOrderPayloadFallback(op);
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
  const bookingDetails = getBookingDetailsText(payment);

  const textParts = [
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
    line("Fecha del pago", date)
  ];
  if (bookingDetails) {
    textParts.push("", "——— Reserva ———", "", bookingDetails);
  }
  const text = textParts.join("\n");

  const bookingHtml = bookingDetails
    ? `<h3 style="color:#1f3c68;margin:24px 0 8px">Reserva</h3>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;margin:0;padding:12px;background:#f3f4f6;border-radius:6px">${escHtml(bookingDetails)}</pre>`
    : "";

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
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Fecha del pago</td><td>${escHtml(date)}</td></tr>
</table>
${bookingHtml}
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
