/**
 * Admin pagos — usa la misma base API que el resto del sitio (Render en GitHub Pages, local en dev).
 * Opcional: <script>window.SACRAMENTO_PAYMENTS_API_BASE = 'https://tu-backend.com';</script> antes de cargar este script.
 */
(function () {
  const TOKEN_KEY = "sacramento_admin_jwt";
  let latestReportCsv = "";

  const RESTAURANT_RULES = [
    { restaurant: "Bruma", patterns: ["bruma"] },
    { restaurant: "Las Liebres", patterns: ["liebres"] },
    { restaurant: "Meson", patterns: ["meson"] },
    { restaurant: "No aplica / Tours", patterns: ["walkingtour", "walking", "bike", "tour", "plaza", "day", "night"] }
  ];

  function getApiBase() {
    if (typeof window === "undefined") return "";
    if (window.SACRAMENTO_PAYMENTS_API_BASE) {
      return String(window.SACRAMENTO_PAYMENTS_API_BASE).replace(/\/+$/, "");
    }
    const host = window.location?.hostname || "";
    const proto = window.location?.protocol || "";
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8787";
    }
    if (proto === "file:") {
      return "http://localhost:8787";
    }
    return "https://sacramento-payments-test.onrender.com";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  function showView(name) {
    el("view-login").hidden = name !== "login";
    el("view-payments").hidden = name !== "payments";
  }

  function setStatus(msg, kind) {
    const box = el("status-msg");
    if (!box) return;
    box.textContent = msg || "";
    box.dataset.kind = kind || "";
    box.hidden = !msg;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function normalizeText(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function inferRestaurant(experienceRaw) {
    const exp = normalizeText(experienceRaw);
    for (const rule of RESTAURANT_RULES) {
      if (rule.patterns.some((p) => exp.includes(normalizeText(p)))) {
        return rule.restaurant;
      }
    }
    return "No aplica / Tours";
  }

  function enrichPaymentRow(row) {
    return {
      ...row,
      restaurant: inferRestaurant(row.experience)
    };
  }

  async function apiLogin(username, password) {
    const base = getApiBase();
    const res = await fetch(`${base}/api/payments/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }
    return data;
  }

  async function apiFetchPayments(params) {
    const base = getApiBase();
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.experience) q.set("experience", params.experience);
    if (params.q) q.set("q", params.q);
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.limit) q.set("limit", params.limit);
    if (params.offset) q.set("offset", params.offset);
    if (params.sort) q.set("sort", params.sort);
    if (params.order) q.set("order", params.order);

    const token = getToken();
    const res = await fetch(`${base}/api/payments/admin/payments?${q.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken("");
      throw new Error("SESSION_EXPIRED");
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function apiFetchAllPayments(params) {
    const limit = 500;
    let offset = 0;
    let total = Infinity;
    const all = [];
    while (offset < total) {
      const data = await apiFetchPayments({ ...params, limit, offset });
      const items = Array.isArray(data.items) ? data.items : [];
      all.push(...items);
      total = Number(data.total) || items.length;
      if (items.length === 0) break;
      offset += items.length;
      if (items.length < limit) break;
    }
    return all;
  }

  async function apiFetchPaymentDetail(sessionId) {
    const base = getApiBase();
    const token = getToken();
    const res = await fetch(`${base}/api/payments/admin/payments/${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken("");
      throw new Error("SESSION_EXPIRED");
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function readFilters() {
    return {
      status: el("filter-status")?.value?.trim() || "",
      experience: el("filter-experience")?.value?.trim() || "",
      restaurant: el("filter-restaurant")?.value?.trim() || "",
      q: el("filter-q")?.value?.trim() || "",
      from: el("filter-from")?.value?.trim() || "",
      to: el("filter-to")?.value?.trim() || "",
      limit: el("filter-limit")?.value || "100",
      sort: el("filter-sort")?.value || "updatedAt",
      order: el("filter-order")?.value || "desc"
    };
  }

  function applyRestaurantFilter(items, restaurant) {
    if (!restaurant) return items;
    return items.filter((x) => String(x.restaurant || "") === String(restaurant));
  }

  function renderRows(items) {
    const tbody = el("payments-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="12" class="admin-empty">No hay pagos que coincidan con los filtros.</td>';
      tbody.appendChild(tr);
      return;
    }
    for (const row of items) {
      const tr = document.createElement("tr");
      const url = row.paymentUrl || "";
      const attempts = Number.isFinite(Number(row.attemptsCount)) ? Number(row.attemptsCount) : 0;
      const sessionId = row.sessionId || "";
      tr.innerHTML = `
        <td>${esc(row.createdAt || "—")}</td>
        <td>${esc(row.updatedAt || "—")}</td>
        <td>${esc(row.experience || "—")}</td>
        <td>${esc(row.restaurant || "—")}</td>
        <td>${esc(row.people != null ? row.people : "—")}</td>
        <td>${esc(row.amount != null ? row.amount : "—")}</td>
        <td>${esc(row.currency || "—")}</td>
        <td><span class="admin-badge">${esc(row.status || "—")}</span></td>
        <td>${esc(attempts)}</td>
        <td class="mono">${esc(sessionId || "—")}</td>
        <td class="url-cell">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : "—"}</td>
        <td>${sessionId ? `<button type="button" class="admin-link-btn js-open-detail" data-session-id="${esc(sessionId)}">Ver detalle</button>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll(".js-open-detail").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await openPaymentDetail(btn.dataset.sessionId || "");
      });
    });
  }

  function detailCard(label, value) {
    return `<div class="admin-detail-item"><span class="k">${esc(label)}</span><span class="v">${esc(value || "—")}</span></div>`;
  }

  function formatCardText(card) {
    if (!card || typeof card !== "object") return "—";
    const parts = [];
    if (card.brand) parts.push(card.brand);
    if (card.maskedNumber) parts.push(card.maskedNumber);
    else if (card.last4) parts.push(`****${card.last4}`);
    return parts.join(" · ") || "—";
  }

  function renderAttemptRows(attempts) {
    const tbody = el("attempts-tbody");
    tbody.innerHTML = "";
    if (!attempts || attempts.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" class="admin-empty">Aún no hay intentos registrados por webhook para este pago.</td>';
      tbody.appendChild(tr);
      return;
    }
    const ordered = [...attempts].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
    for (const a of ordered) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(a.at || "—")}</td>
        <td>${esc(a.status || "—")}</td>
        <td>${esc(a.source || "—")}</td>
        <td>${esc(a.gateway || "—")}</td>
        <td>${esc(formatCardText(a.card))}</td>
        <td>${esc(a.card?.holderName || a.payer?.name || "—")}</td>
        <td>${esc(a.issuer?.name || a.issuer?.id || "—")}</td>
        <td>${esc(a.reference || "—")}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderPaymentDetail(item) {
    const summary = el("detail-summary");
    summary.innerHTML = [
      detailCard("Session ID", item.sessionId),
      detailCard("Estado actual", item.status),
      detailCard("Intentos webhook", item.attemptsCount),
      detailCard("Experiencia", item.experience),
      detailCard("Restoran", inferRestaurant(item.experience)),
      detailCard("Monto", `${item.amount ?? "—"} ${item.currency || ""}`.trim()),
      detailCard("Personas", item.people),
      detailCard("Creado", item.createdAt),
      detailCard("Actualizado", item.updatedAt),
      detailCard("Fingerprint", item.fingerprint)
    ].join("");
    renderAttemptRows(Array.isArray(item.paymentAttempts) ? item.paymentAttempts : []);
    el("view-detail").hidden = false;
  }

  async function openPaymentDetail(sessionId) {
    if (!sessionId) return;
    setStatus("", "");
    try {
      const data = await apiFetchPaymentDetail(sessionId);
      renderPaymentDetail(data.item || {});
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") {
        setStatus("Sesión expirada o token inválido. Iniciá sesión de nuevo.", "error");
        showView("login");
        return;
      }
      setStatus(e.message || "No se pudo cargar el detalle del pago.", "error");
    }
  }

  async function loadPayments() {
    setStatus("", "");
    el("btn-refresh").disabled = true;
    try {
      const f = readFilters();
      const data = await apiFetchPayments(f);
      const enriched = (data.items || []).map(enrichPaymentRow);
      const filtered = applyRestaurantFilter(enriched, f.restaurant);
      el("payments-meta").textContent = `Mostrando ${filtered.length || 0} de ${data.total ?? 0} (offset ${data.offset ?? 0})`;
      renderRows(filtered);
      el("view-detail").hidden = true;
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") {
        setStatus("Sesión expirada o token inválido. Iniciá sesión de nuevo.", "error");
        showView("login");
      } else {
        setStatus(e.message || "Error de red o del servidor.", "error");
      }
    } finally {
      el("btn-refresh").disabled = false;
    }
  }

  function csvEscape(v) {
    const s = String(v == null ? "" : v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsv(rows) {
    const headers = ["fecha", "restoran", "experiencia", "personas", "monto", "moneda", "estado", "sessionId", "paymentUrl"];
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.updatedAt || row.createdAt || ""),
          csvEscape(row.restaurant || ""),
          csvEscape(row.experience || ""),
          csvEscape(row.people ?? ""),
          csvEscape(row.amount ?? ""),
          csvEscape(row.currency || ""),
          csvEscape(row.status || ""),
          csvEscape(row.sessionId || ""),
          csvEscape(row.paymentUrl || "")
        ].join(",")
      );
    }
    return lines.join("\n");
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderReport(rows) {
    const wrap = el("report-wrap");
    const summary = el("report-summary");
    const tbody = el("report-tbody");
    summary.innerHTML = "";
    tbody.innerHTML = "";
    if (!rows.length) {
      wrap.hidden = false;
      summary.innerHTML = '<div class="admin-report-card"><h4>Sin resultados</h4><p>No hay pagos para ese filtro.</p></div>';
      return;
    }

    const byRestaurant = new Map();
    rows.forEach((r) => {
      const key = r.restaurant || "No aplica / Tours";
      if (!byRestaurant.has(key)) byRestaurant.set(key, { count: 0, people: 0, amount: 0 });
      const agg = byRestaurant.get(key);
      agg.count += 1;
      agg.people += Number(r.people) || 0;
      agg.amount += Number(r.amount) || 0;
    });

    byRestaurant.forEach((agg, restaurant) => {
      const card = document.createElement("div");
      card.className = "admin-report-card";
      card.innerHTML = `
        <h4>${esc(restaurant)}</h4>
        <p>Pagos: <strong>${agg.count}</strong></p>
        <p>Personas: <strong>${agg.people}</strong></p>
        <p>Total estimado: <strong>USD ${agg.amount.toFixed(2)}</strong></p>
      `;
      summary.appendChild(card);
    });

    rows
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${esc(row.updatedAt || row.createdAt || "—")}</td>
          <td>${esc(row.restaurant || "—")}</td>
          <td>${esc(row.experience || "—")}</td>
          <td>${esc(row.people != null ? row.people : "—")}</td>
          <td>${esc(row.amount != null ? row.amount : "—")}</td>
          <td>${esc(row.currency || "—")}</td>
          <td>${esc(row.status || "—")}</td>
          <td class="mono">${esc(row.sessionId || "—")}</td>
        `;
        tbody.appendChild(tr);
      });
    wrap.hidden = false;
  }

  async function generateReport() {
    setStatus("", "");
    const btnGenerate = el("btn-generate-report");
    const btnDownload = el("btn-download-report");
    btnGenerate.disabled = true;
    try {
      const f = readFilters();
      const all = await apiFetchAllPayments(f);
      const enriched = all.map(enrichPaymentRow);
      const filtered = applyRestaurantFilter(enriched, f.restaurant);
      renderReport(filtered);
      latestReportCsv = toCsv(filtered);
      btnDownload.disabled = filtered.length === 0;
      setStatus(`Reporte generado: ${filtered.length} registros.`, "ok");
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") {
        setStatus("Sesión expirada o token inválido. Iniciá sesión de nuevo.", "error");
        showView("login");
      } else {
        setStatus(e.message || "No se pudo generar el reporte.", "error");
      }
    } finally {
      btnGenerate.disabled = false;
    }
  }

  function init() {
    el("api-base-display").textContent = getApiBase();

    if (getToken()) {
      showView("payments");
      loadPayments();
    } else {
      showView("login");
    }

    el("login-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setStatus("", "");
      const u = el("login-user").value;
      const p = el("login-pass").value;
      el("btn-login").disabled = true;
      try {
        const data = await apiLogin(u, p);
        if (data.token) setToken(data.token);
        showView("payments");
        await loadPayments();
      } catch (e) {
        setStatus(e.message || "No se pudo iniciar sesión.", "error");
      } finally {
        el("btn-login").disabled = false;
      }
    });

    el("btn-logout").addEventListener("click", () => {
      setToken("");
      showView("login");
      setStatus("", "");
      el("view-detail").hidden = true;
      el("report-wrap").hidden = true;
    });

    el("btn-refresh").addEventListener("click", () => loadPayments());
    el("btn-generate-report").addEventListener("click", () => generateReport());
    el("btn-download-report").addEventListener("click", () => {
      if (!latestReportCsv) return;
      const d = new Date().toISOString().slice(0, 10);
      downloadCsv(latestReportCsv, `reporte-pagos-${d}.csv`);
    });

    ["filter-status", "filter-experience", "filter-restaurant", "filter-q", "filter-from", "filter-to", "filter-limit", "filter-sort", "filter-order"].forEach(
      (id) => {
        const node = el(id);
        if (node) {
          node.addEventListener("change", () => loadPayments());
          if (id === "filter-q") {
            node.addEventListener("keydown", (ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                loadPayments();
              }
            });
          }
        }
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
