//  ██████╗███████╗ █████╗ ██████╗  █████╗ ██╗  ██╗        ██╗ ██████╗
// ██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██║  ██║        ██║██╔════╝
// ╚█████╗ █████╗  ███████║██████╔╝██║  ╚═╝███████║        ██║╚█████╗ 
//  ╚═══██╗██╔══╝  ██╔══██║██╔══██╗██║  ██╗██╔══██║   ██╗  ██║ ╚═══██╗
// ██████╔╝███████╗██║  ██║██║  ██║╚█████╔╝██║  ██║██╗╚█████╔╝██████╔╝
// ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 


// =============================================================================
// DEBUG-LOGGING SYSTEM
// =============================================================================
const log = {
  success: (msg, data) =>
    console.log(`%c[SUCCESS] ${msg}`, "color: green", data || ""),
  info: (msg, data) =>
    console.log(`%c[INFO] ${msg}`, "color: gray", data || ""),
  warning: (msg, data) => console.warn(`[WARNING] ${msg}`, data || ""),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ""),
  debug: (msg, data) =>
    console.log(`%c[DEBUG] ${msg}`, "color: gray", data || ""),
};

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) {
    log.error("Toast-Container nicht gefunden");
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================
const state = {
  currentQuery: "",
  currentData: [],
  searchTimeout: null,
  sortField: "id",
  sortOrder: "DESC",
  searchFor: "",
  limit: 50,
  isLoading: false,
  activeRequest: null,
  retryCount: 0,
  maxRetries: 3,
  categoryId: 0,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function highlightText(text, query) {
  if (!query) return escapeHtml(text || "");

  text = text === null || text === undefined ? "" : String(text);
  const escaped = escapeHtml(text);
  const safe = escapeRegExp(query);
  const regex = new RegExp(`(${safe})`, "gi");

  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function updateUrlParams(query) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (state.sortField !== "id") params.set("sort", state.sortField);
  if (state.sortOrder !== "DESC") params.set("order", state.sortOrder);
  if (state.limit !== 50) params.set("limit", state.limit);
  if (state.searchFor) params.set("searchFor", state.searchFor);
  if (state.categoryId > 0) params.set("category_id", state.categoryId);

  const newUrl = params.toString()
    ? `${window.location.pathname}?${params}`
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

// =============================================================================
// INITIALIZATION
// =============================================================================
// log.info("Seite wird geladen...");

function initFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);

    state.categoryId = parseInt(params.get("category_id")) || 0;
    if (params.get("sort")) state.sortField = params.get("sort");
    if (params.get("order")) state.sortOrder = params.get("order");
    if (params.get("limit")) state.limit = parseInt(params.get("limit")) || 50;
    if (params.get("searchFor")) state.searchFor = params.get("searchFor");

    const sortFieldEl = document.getElementById("sortField");
    const sortOrderEl = document.getElementById("sortOrder");
    const limitEl = document.getElementById("limitResults");
    const searchForEl = document.getElementById("searchFor");
    const searchInput = document.getElementById("searchInput");

    if (sortFieldEl) sortFieldEl.value = state.sortField;
    if (sortOrderEl) sortOrderEl.value = state.sortOrder;
    if (limitEl) limitEl.value = state.limit;
    if (searchForEl) searchForEl.value = state.searchFor;

    const initial =
      params.get("query") || params.get("category") || params.get("q") || "";
    if (searchInput && initial) searchInput.value = initial;

    // Zurück-Button wenn von Karte kommend
    if (params.get("searchFor") === "Locker") {
      const backBtn = document.getElementById("backToMap");
      if (backBtn) backBtn.classList.remove("hidden");
    }

    searchItems(initial);
  } catch (e) {
    log.error("Fehler beim Laden der URL-Parameter", e);
    showToast("Fehler beim Laden der URL-Parameter", "error");
  }
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================
async function searchItems(query) {
  if (state.activeRequest) {
    state.activeRequest.abort();
    state.isLoading = false;

    // log.debug("Vorherige Anfrage abgebrochen");
  }

  if (state.isLoading) {
    log.warning("Suche läuft bereits, überspringe...");
    return;
  }

  // log.debug("Suche wird ausgeführt für:", query);
  state.currentQuery = query;
  updateUrlParams(query);
  state.isLoading = true;

  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) {
    log.error("Tabellen-Body nicht gefunden");
    state.isLoading = false;
    return;
  }

  function renderSkeleton() {
    const rows = Array.from(
      { length: 8 },
      () => `
    <tr class="skeleton-row">
      <td><div class="skeleton-cell w-sm"></div></td>
      <td><div class="skeleton-cell w-sq"></div></td>
      <td><div class="skeleton-cell w-xl"></div></td>
      <td><div class="skeleton-cell w-md"></div></td>
      <td><div class="skeleton-cell w-md"></div></td>
      <td><div class="skeleton-cell w-lg"></div></td>
      <td><div class="skeleton-cell w-sm"></div></td>
      <td><div class="skeleton-cell w-md"></div></td>
      <td><div class="skeleton-cell w-sm"></div></td>
    </tr>`,
    ).join("");
    return rows;
  }

  tbody.innerHTML = renderSkeleton();

  try {
    const params = new URLSearchParams({
      query: query,
      sort: state.sortField,
      order: state.sortOrder,
      limit: state.limit,
      searchFor: state.searchFor,
      ...(state.categoryId > 0 && { category_id: state.categoryId }),
    });

    // log.debug("Sende Such-Anfrage mit Parametern:", params.toString());

    const controller = new AbortController();
    state.activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`/api/search.php?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeout);
    state.activeRequest = null;

    if (!res.ok) {
      throw new Error(`Server-Fehler ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Ungültige Antwort vom Server (kein JSON)");
    }

    const response = await res.json();

    if (!response.success) {
      throw new Error(
        response.error || response.message || "Unbekannter Fehler",
      );
    }

    const data = response.data || [];
    state.currentData = data;
    state.retryCount = 0;

    // log.success(`${response.count} Ergebnisse gefunden`);

    updateSearchInfo(response.count, query);
    renderFilterChips();

    renderTable(data, query);
  } catch (err) {
    log.error("Suchfehler", err);

    if (err.name === "AbortError") {
      log.error(
        "Die Suche dauerte zu lange und wurde abgebrochen. Bitte versuchen Sie es erneut.",
      );
    } else if (
      err.message.includes("NetworkError") ||
      err.message.includes("Failed to fetch")
    ) {
      log.error(
        "Verbindung zum Server fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung.",
      );

      if (state.retryCount < state.maxRetries) {
        state.retryCount++;
        // log.info(`Versuche erneut (${state.retryCount}/${state.maxRetries})...`);
        setTimeout(() => searchItems(query), 2000 * state.retryCount);
      }
    } else {
      log.error(`Fehler: ${err.message}`);
    }
  } finally {
    state.isLoading = false;
    state.activeRequest = null;
  }
}

function updateSearchInfo(count, query) {
  const info = document.getElementById("searchInfo");
  const countEl = document.getElementById("resultCount");
  const queryEl = document.getElementById("searchQuery");

  if (!info || !countEl || !queryEl) {
    log.error("Search-Info Elemente nicht gefunden");
    return;
  }

  countEl.textContent = `${count} ${count === 1 ? "Ergebnis" : "Ergebnisse"}`;

  if (query) {
    const fieldLabel = state.searchFor ? ` in ${state.searchFor}` : "";
    queryEl.textContent = `für "${escapeHtml(query)}"${fieldLabel}`;
    queryEl.style.display = "inline";
  } else {
    queryEl.style.display = "none";
  }

  info.classList.remove("hidden");
}

function renderQuantityBadge(qty) {
  const n = parseInt(qty);
  if (isNaN(n)) return '<span class="no-docs">—</span>';
  const cls = n === 0 ? "qty-zero" : n <= 2 ? "qty-low" : "qty-ok";
  return `<span class="qty-badge ${cls}">${n}</span>`;
}

function renderCategoryBadge(name, query) {
  if (!name) return '<span class="no-docs">—</span>';
  return `<span class="cat-badge">${highlightText(name, query)}</span>`;
}

function renderTable(data, query) {
  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="no-results">Keine Ergebnisse gefunden</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    const row = document.createElement("tr");
    row.dataset.itemId = item.id;

    const isExactIdMatch =
      query !== "" && String(item.id) === String(query).trim();
    if (isExactIdMatch) row.classList.add("exact-match");

    // Zeile klickbar machen (optional. hat mich manchmal genervt als ich infos kopieren wollte)
    //    row.addEventListener("click", () => {
    //      window.location.href = `/docs/${item.id}/index.html`;
    //    });

    const SEARCH_FOR_FIELD_MAP = {
      ID: "id",
      Name: "name",
      Kategorie: "category_name",
      Marke: "brand",
      Modell: "model",
      Seriennummer: "serial",
      Locker: "locker",
      Raum: "room",
    };

    function resolveQuery(field) {
      if (!state.searchFor) return query;
      return SEARCH_FOR_FIELD_MAP[state.searchFor] === field ? query : "";
    }

    row.innerHTML = `
      <td class="item-id">${escapeHtml(item.id)}</td>
      <td>${renderThumbnail(item.thumbnail, item.id)}</td>
      <td>${highlightText(item.name, resolveQuery("name"))}</td>
      <td>${renderCategoryBadge(item.category_name, resolveQuery("category_name"))}</td>
      <td>${highlightText(item.brand, resolveQuery("brand"))}</td>
      <td>${highlightText(item.model, resolveQuery("model"))}</td>
      <td>${renderQuantityBadge(item.quantity)}</td>
      <td>${highlightText(item.locker, resolveQuery("locker"))}${item.room ? ` <span style="opacity:0.5;font-size:0.75rem">(${escapeHtml(item.room)})</span>` : ""}</td>
      <td>${renderDocsLink(item.id)}</td>
    `;

    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);
}

function renderCell(value, field, index, query, isMultiline = false) {
  const text = value === null || value === undefined ? "" : String(value);

  const highlighted = highlightText(text, query);
  return isMultiline ? highlighted.replace(/\n/g, "<br>") : highlighted;
}

function renderThumbnail(path, itemId) {
  // Fallback auf /images/uhhhh.jpg wenn kein Thumbnail gefunden wurde
  const imagePath = path || "/images/uhhhh.jpg";

  return `<img src="${escapeHtml(imagePath)}"
              alt="Thumbnail für Item ${itemId}"
              class="thumbnail"
              loading="lazy"
              onerror="this.src='/images/uhhhh.jpg'">`;
}

function renderDocsLink(itemId) {
  return `<a href="/docs/${itemId}/index.html"
             target="_blank"
             rel="noopener noreferrer"
             class="docs-link"
             onclick="event.stopPropagation()">DOCS</a>`;
}

function renderFilterChips(query) {
  let container = document.getElementById("filterChips");
  if (!container) {
    container = document.createElement("div");
    container.id = "filterChips";
    container.className = "filter-chips";
    const searchInfo = document.getElementById("searchInfo");
    searchInfo?.parentNode.insertBefore(container, searchInfo);
  }

  container.innerHTML = "";

  if (state.searchFor) {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.innerHTML = `Feld: <strong>${escapeHtml(state.searchFor)}</strong>
      <button class="filter-chip-remove" title="Filter entfernen">✕</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      state.searchFor = "";
      document.getElementById("searchFor").value = "";
      searchItems(state.currentQuery);
    });
    container.appendChild(chip);
  }

  if (state.categoryId > 0) {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.innerHTML = `Kategorie-Filter aktiv
      <button class="filter-chip-remove" title="Filter entfernen">✕</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      state.categoryId = 0;
      searchItems(state.currentQuery);
    });
    container.appendChild(chip);
  }
}

// =============================================================================
// SEARCH INPUT HANDLING
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) {
    log.error("Search-Input nicht gefunden");
    return;
  }

  const debouncedSearch = debounce((query) => {
    searchItems(query);
  }, 300);

  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  const clearBtn = document.getElementById("clearSearch");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.focus();
      searchItems("");
    });
  }

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchItems(e.target.value);
    }
  });

  initFromUrl();
  updateSortIndicators();
  initTableSorting();
  updateSortIndicators();
});
// =============================================================================
// SORT & FILTER CONTROLS
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const sortField = document.getElementById("sortField");
  if (sortField) {
    sortField.addEventListener("change", (e) => {
      state.sortField = e.target.value;
      searchItems(state.currentQuery);
    });
  }

  const sortOrder = document.getElementById("sortOrder");
  if (sortOrder) {
    sortOrder.addEventListener("change", (e) => {
      state.sortOrder = e.target.value;
      searchItems(state.currentQuery);
    });
  }

  const limitResults = document.getElementById("limitResults");
  if (limitResults) {
    limitResults.addEventListener("change", (e) => {
      state.limit = parseInt(e.target.value) || 50;
      searchItems(state.currentQuery);
    });
  }

  const searchFor = document.getElementById("searchFor");
  if (searchFor) {
    searchFor.addEventListener("change", (e) => {
      state.searchFor = e.target.value;
      searchItems(state.currentQuery);
    });
  }
});



// =============================================================================
// TABLE SORT INDICATORS
// =============================================================================
function updateSortIndicators() {
  document.querySelectorAll("#resultsTable th[data-sort]").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === state.sortField) {
      th.classList.add(state.sortOrder === "ASC" ? "sort-asc" : "sort-desc");
    }
  });
}



function initTableSorting() {
  document.querySelectorAll("#resultsTable th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;

      if (state.sortField === field) {
        state.sortOrder = state.sortOrder === "ASC" ? "DESC" : "ASC";
      } else {
        state.sortField = field;
        state.sortOrder = "ASC";
      }

      // Dropdowns synchron halten
      const sortFieldEl = document.getElementById("sortField");
      const sortOrderEl = document.getElementById("sortOrder");
      if (sortFieldEl) sortFieldEl.value = state.sortField;
      if (sortOrderEl) sortOrderEl.value = state.sortOrder;

      updateSortIndicators();
      searchItems(state.currentQuery);
    });
  });
}

// =============================================================================
// PAGE VISIBILITY
// =============================================================================
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // log.debug("Seite ist nicht mehr sichtbar");
    if (state.activeRequest) {
      state.activeRequest.abort();
      state.activeRequest = null;
      state.isLoading = false;
    }
  } else {
    // log.debug("Seite ist wieder sichtbar");
  }
});

// =============================================================================
// ERROR RECOVERY
// =============================================================================
window.addEventListener("error", (e) => {
  log.error("Globaler JavaScript-Fehler", {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  log.error("Unhandled Promise Rejection", {
    reason: e.reason,
    promise: e.promise,
  });
});

// =============================================================================
// NETWORK STATUS MONITORING
// =============================================================================
window.addEventListener("online", () => {
  // log.success("Internetverbindung wiederhergestellt");
  showToast("Internetverbindung wiederhergestellt", "success");

  if (state.currentQuery !== null && !state.isLoading) {
    searchItems(state.currentQuery);
  }
});

window.addEventListener("offline", () => {
  log.warning("Internetverbindung verloren");
  showToast("Keine Internetverbindung", "warning", 5000);

  if (state.activeRequest) {
    state.activeRequest.abort();
    state.activeRequest = null;
    state.isLoading = false;
  }
});
