/**
 * Admin pagos — usa la misma base API que el resto del sitio (Render en GitHub Pages, local en dev).
 * Opcional: <script>window.SACRAMENTO_PAYMENTS_API_BASE = 'https://tu-backend.com';</script> antes de cargar este script.
 */
(function () {
  const TOKEN_KEY = "sacramento_admin_jwt";

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

  function readFilters() {
    return {
      status: el("filter-status")?.value?.trim() || "",
      experience: el("filter-experience")?.value?.trim() || "",
      q: el("filter-q")?.value?.trim() || "",
      from: el("filter-from")?.value?.trim() || "",
      to: el("filter-to")?.value?.trim() || "",
      limit: el("filter-limit")?.value || "100",
      sort: el("filter-sort")?.value || "updatedAt",
      order: el("filter-order")?.value || "desc"
    };
  }

  function renderRows(items) {
    const tbody = el("payments-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="9" class="admin-empty">No hay pagos que coincidan con los filtros.</td>';
      tbody.appendChild(tr);
      return;
    }
    for (const row of items) {
      const tr = document.createElement("tr");
      const url = row.paymentUrl || "";
      tr.innerHTML = `
        <td>${esc(row.createdAt || "—")}</td>
        <td>${esc(row.updatedAt || "—")}</td>
        <td>${esc(row.experience || "—")}</td>
        <td>${esc(row.people != null ? row.people : "—")}</td>
        <td>${esc(row.amount != null ? row.amount : "—")}</td>
        <td>${esc(row.currency || "—")}</td>
        <td><span class="admin-badge">${esc(row.status || "—")}</span></td>
        <td class="mono">${esc(row.sessionId || "—")}</td>
        <td class="url-cell">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  async function loadPayments() {
    setStatus("", "");
    el("btn-refresh").disabled = true;
    try {
      const f = readFilters();
      const data = await apiFetchPayments(f);
      el("payments-meta").textContent = `Mostrando ${data.items?.length || 0} de ${data.total ?? 0} (offset ${data.offset ?? 0})`;
      renderRows(data.items || []);
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
    });

    el("btn-refresh").addEventListener("click", () => loadPayments());

    ["filter-status", "filter-experience", "filter-q", "filter-from", "filter-to", "filter-limit", "filter-sort", "filter-order"].forEach(
      (id) => {
        const node = el(id);
        if (node) {
          node.addEventListener("change", () => loadPayments());
          if (id === "filter-q") node.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              loadPayments();
            }
          });
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
