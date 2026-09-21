/**
 * Internal B2B agency inquiry email (Resend).
 * Confirmation email to the applicant: not sent yet — see sendAgenciesInquiryConfirmationToApplicant.
 */

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function line(label, value) {
  const v = value == null || value === "" ? null : String(value).trim();
  if (!v) return null;
  return `${label}:\n${v}`;
}

function formatList(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.map((x) => `• ${x}`).join("\n");
}

const COMPANY_TYPE_LABELS = {
  travel_agency: "Agencia de viajes",
  tour_operator: "Tour operador",
  dmc: "DMC",
  other: "Otro"
};

const INTEREST_LABELS = {
  tours: "Tours guiados",
  transfers: "Traslados",
  wineries: "Bodegas",
  gastro: "Gastronomía",
  horseback: "Cabalgatas",
  boat: "Paseos en barco",
  experiences: "Experiencias",
  itineraries: "Itinerarios personalizados"
};

const PASSENGER_LABELS = {
  individual: "Viajeros individuales",
  couples_families: "Parejas / Familias",
  groups: "Grupos",
  corporate: "Corporativo / Incentivos"
};

const LANGUAGE_LABELS = {
  en: "English",
  es: "Español",
  pt: "Português"
};

export function mapAgenciesInquiryLabels(data) {
  const companyType = COMPANY_TYPE_LABELS[data.companyType] || data.companyType || "";
  const interests = (data.interests || []).map((v) => INTEREST_LABELS[v] || v);
  const passengerTypes = (data.passengerTypes || []).map((v) => PASSENGER_LABELS[v] || v);
  const language = LANGUAGE_LABELS[String(data.language || "").toLowerCase()] || data.language || "—";
  return { companyType, interests, passengerTypes, language };
}

export function buildAgenciesInquiryEmailBodies(data, receivedAtIso) {
  const { companyType, interests, passengerTypes, language } = mapAgenciesInquiryLabels(data);
  const receivedAt =
    receivedAtIso ||
    new Date().toLocaleString("es-UY", {
      timeZone: "America/Montevideo",
      dateStyle: "short",
      timeStyle: "medium"
    });

  const textBlocks = [
    "NUEVA SOLICITUD — ÁREA DE AGENCIAS",
    "",
    line("Nombre", data.name),
    line("Agencia / Empresa", data.company),
    line("País", data.country),
    line("Ciudad", data.city),
    line("Email", data.email),
    line("WhatsApp / Teléfono", data.phone),
    line("Sitio web", data.website),
    line("Tipo de empresa", companyType),
    "",
    line("Servicios de interés", formatList(interests)),
    "",
    line("Tipo de pasajeros / segmentos", formatList(passengerTypes)),
    "",
    line("Mensaje / Comentarios", data.message),
    "",
    line("Idioma desde el que completó el formulario", language),
    line("Fecha/hora de recepción", receivedAt)
  ].filter(Boolean);

  const text = textBlocks.join("\n\n");
  const subject = `Nueva solicitud de tarifas B2B — ${String(data.company || "Agencia").trim()}`;

  const row = (label, value) => {
    if (value == null || String(value).trim() === "") return "";
    return `<tr><td style="padding:6px 14px 6px 0;font-weight:600;vertical-align:top;white-space:nowrap">${escHtml(label)}</td><td style="padding:6px 0;white-space:pre-wrap">${escHtml(String(value))}</td></tr>`;
  };

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5;color:#1f2937">
<h2 style="color:#1f3c68;margin:0 0 16px">NUEVA SOLICITUD — ÁREA DE AGENCIAS</h2>
<table style="border-collapse:collapse;max-width:640px">
${row("Nombre", data.name)}
${row("Agencia / Empresa", data.company)}
${row("País", data.country)}
${row("Ciudad", data.city)}
${row("Email", data.email)}
${row("WhatsApp / Teléfono", data.phone)}
${row("Sitio web", data.website)}
${row("Tipo de empresa", companyType)}
${interests.length ? row("Servicios de interés", formatList(interests)) : ""}
${passengerTypes.length ? row("Tipo de pasajeros / segmentos", formatList(passengerTypes)) : ""}
${row("Mensaje / Comentarios", data.message)}
${row("Idioma", language)}
${row("Fecha/hora de recepción", receivedAt)}
</table>
</body></html>`;

  return { text, html, subject };
}

/**
 * Reserved for a future auto-reply to the agency contact.
 * @returns {Promise<{ sent: boolean, omitted: boolean }>}
 */
export async function sendAgenciesInquiryConfirmationToApplicant(_data) {
  return { sent: false, omitted: true };
}

/**
 * @param {object} data — validated inquiry payload
 * @returns {Promise<{ sent: boolean, omitted?: boolean, error?: string }>}
 */
export async function sendAgenciesInquiryNotification(data) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const to =
    String(process.env.AGENCIES_INQUIRY_EMAIL || "").trim() ||
    String(process.env.NOTIFICATION_EMAIL || "").trim() ||
    "contacto@sacraadventures.com";

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn("[agencies-inquiry] omitted: RESEND_API_KEY not configured");
    return { sent: false, omitted: true, error: "email_not_configured" };
  }

  const from =
    String(process.env.RESEND_FROM || "").trim() ||
    "Sacramento Adventures <onboarding@resend.dev>";

  const receivedAtIso = new Date().toISOString();
  const { text, html, subject } = buildAgenciesInquiryEmailBodies(data, receivedAtIso);
  const replyTo = String(data.email || "").trim();

  const payload = {
    from,
    to: [to],
    subject,
    text,
    html
  };
  if (replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    payload.reply_to = replyTo;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.warn("[agencies-inquiry] email error", {
        status: res.status,
        detail: String(detail).slice(0, 300)
      });
      return { sent: false, error: "email_send_failed" };
    }

    // eslint-disable-next-line no-console
    console.log("[agencies-inquiry] email sent", {
      company: data.company,
      to
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[agencies-inquiry] email error", {
      message: err instanceof Error ? err.message : String(err)
    });
    return { sent: false, error: "email_send_failed" };
  }
}
