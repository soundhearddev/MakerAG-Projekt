// =============================================================================
// DEBUG-LOGGING SYSTEM
// =============================================================================
const log = {
  success: (msg, data) => console.log(`%c[SUCCESS] ${msg}`, "color: green", data || ""),
  info: (msg, data) => console.log(`%c[INFO] ${msg}`, "color: blue", data || ""),
  warning: (msg, data) => console.warn(`[WARNING] ${msg}`, data || ""),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ""),
  debug: (msg, data) => console.log(`%c[DEBUG] ${msg}`, "color: gray", data || ""),
};

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    log.error("Toast-Container nicht gefunden");
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
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
  limit: 50,
  isLoading: false,
  activeRequest: null,
  retryCount: 0,
  maxRetries: 3,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement('div');
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

function isTokenExpired(token) {
  try {
    const stored = localStorage.getItem('editorTokenTimestamp');
    if (!stored) return true;
    
    const timestamp = parseInt(stored, 10);
    const hoursSinceStored = (Date.now() - timestamp) / (1000 * 60 * 60);
    
    return hoursSinceStored > 24;
  } catch {
    return true;
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================
log.info("Seite wird geladen...");

(function initFromUrl() {
  log.debug("URL-Parameter werden gelesen...");
  try {
    const params = new URLSearchParams(window.location.search);
    const initial =
      params.get("category") || params.get("query") || params.get("q") || "";

    if (initial) {
      log.info("Initiale Suche gefunden:", initial);
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.value = initial;
      }
      searchItems(initial);
    } else {
      log.debug("Keine URL-Parameter - lade alle Items");
      searchItems("");
    }
  } catch (e) {
    log.error("Fehler beim Laden der URL-Parameter", e);
    showToast("Fehler beim Laden der URL-Parameter", "error");
  }
})();

async function checkTokenOnLoad() {
  log.debug("Token-Check beim Seiten-Load...");
  const token = localStorage.getItem("editorToken");

  if (!token) {
    log.debug("Kein Token im localStorage vorhanden");
    return;
  }

  if (isTokenExpired(token)) {
    log.warning("Token ist abgelaufen");
    localStorage.removeItem("editorToken");
    localStorage.removeItem("editorTokenTimestamp");
    return;
  }

  log.info("Token gefunden, validiere...");
  try {
    const res = await fetch("/api/passcheck.php", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.success) {
      log.success("Token ist gültig! Editor-Mode aktiviert");
      activateEditorMode();
    } else {
      log.warning("Token ist ungültig, wird gelöscht");
      localStorage.removeItem("editorToken");
      localStorage.removeItem("editorTokenTimestamp");
    }
  } catch (err) {
    log.error("Token-Validierung fehlgeschlagen", err);
    localStorage.removeItem("editorToken");
    localStorage.removeItem("editorTokenTimestamp");
  }
}

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", checkTokenOnLoad);
} else {
  checkTokenOnLoad();
}

window.addEventListener("load", () => {
  log.success("Seite vollständig geladen");
});

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================
async function searchItems(query) {
  if (state.activeRequest) {
    state.activeRequest.abort();
    log.debug("Vorherige Anfrage abgebrochen");
  }

  if (state.isLoading) {
    log.warning("Suche läuft bereits, überspringe...");
    return;
  }

  log.debug("Suche wird ausgeführt für:", query);
  state.currentQuery = query;
  state.isLoading = true;

  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) {
    log.error("Tabellen-Body nicht gefunden");
    state.isLoading = false;
    return;
  }

  tbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="12">
        <div class="loading-message">
          <div class="spinner"></div>
          <span>Lade Daten...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      query: query,
      sort: state.sortField,
      order: state.sortOrder,
      limit: state.limit,
    });

    log.debug("Sende Such-Anfrage mit Parametern:", params.toString());

    const controller = new AbortController();
    state.activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`/api/search.php?${params}`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
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
      throw new Error(response.error || response.message || "Unbekannter Fehler");
    }

    const data = response.data || [];
    state.currentData = data;
    state.retryCount = 0;

    log.success(`${response.count} Ergebnisse gefunden`);

    updateSearchInfo(response.count, query);
    renderTable(data, query);
  } catch (err) {
    log.error("Suchfehler", err);

    if (err.name === 'AbortError') {
      showToast("Suche abgebrochen (Timeout)", "error");
      showError("Die Suche dauerte zu lange und wurde abgebrochen. Bitte versuchen Sie es erneut.");
    } else if (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")) {
      showToast("Netzwerkfehler", "error");
      showError("Verbindung zum Server fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung.");
      
      if (state.retryCount < state.maxRetries) {
        state.retryCount++;
        log.info(`Versuche erneut (${state.retryCount}/${state.maxRetries})...`);
        setTimeout(() => searchItems(query), 2000 * state.retryCount);
      }
    } else {
      showToast("Fehler beim Laden der Daten", "error");
      showError(`Fehler: ${err.message}`);
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
    queryEl.textContent = `für "${escapeHtml(query)}"`;
    queryEl.style.display = "inline";
  } else {
    queryEl.style.display = "none";
  }

  info.classList.remove("hidden");
}

function renderTable(data, query) {
  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) {
    log.error("Tabellen-Body nicht gefunden");
    return;
  }

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="no-results">Keine Ergebnisse gefunden</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    const row = document.createElement("tr");
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <td>${escapeHtml(item.id)}</td>
      <td>${renderThumbnail(item.thumbnail, item.id)}</td>
      <td>${renderCell(item.name, "name", index, query)}</td>
      <td>${renderCell(item.category, "category", index, query)}</td>
      <td>${renderCell(item.subcategory, "subcategory", index, query)}</td>
      <td>${renderCell(item.brand, "brand", index, query)}</td>
      <td>${renderCell(item.model, "model", index, query)}</td>
      <td>${renderCell(item.serial, "serial", index, query)}</td>
      <td>${renderCell(item.quantity, "quantity", index, query)}</td>
      <td>${renderCell(item.locker, "locker", index, query)}</td>
      <td>${
        state.editorMode
          ? renderEditableDocsLink(item.docs_link, index)
          : renderDocsLink(item.docs_link, item.id)
      }</td>
      <td>${renderCell(item.notes, "notes", index, query, true)}</td>
    `;
    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);

  if (state.editorMode) {
    enableInlineEditing(data);
  }
}

function renderCell(value, field, index, query, isMultiline = false) {
  const text = value === null || value === undefined ? "" : String(value);

  if (state.editorMode) {
    const escapedText = escapeHtml(text);
    return `<span class="cell ${isMultiline ? "multiline" : ""}"
                  data-row="${index}"
                  data-field="${field}"
                  contenteditable="false"
                  tabindex="0">${escapedText}</span>`;
  }

  const highlighted = highlightText(text, query);
  return isMultiline ? highlighted.replace(/\n/g, "<br>") : highlighted;
}

function renderThumbnail(path, itemId) {
  // Fallback auf /images/uhhhh.jpg wenn kein Thumbnail gefunden wurde
  const imagePath = path || '/images/uhhhh.jpg';
  
  return `<img src="${escapeHtml(imagePath)}"
              alt="Thumbnail für Item ${itemId}"
              class="thumbnail"
              loading="lazy"
              onerror="this.src='/images/uhhhh.jpg'">`;
}

function renderDocsLink(path, itemId) {
  if (!path) return '<span class="no-docs">-</span>';
  return `<a href="${escapeHtml(path)}"
             target="_blank"
             rel="noopener noreferrer"
             class="docs-link"
             title="Dokumentation für Item ${itemId}">DOCS</a>`;
}

function renderEditableDocsLink(path, index) {
  const escapedPath = escapeHtml(path || "");
  return `<span class="cell"
                data-row="${index}"
                data-field="docs_link"
                contenteditable="false"
                tabindex="0">${escapedPath}</span>`;
}

function showError(message) {
  const tbody = document.querySelector("#resultsTable tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="12" class="error-message">${escapeHtml(message)}</td></tr>`;
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
});

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (state.editorMode && Object.keys(state.editedData).length > 0) {
      const saveBtn = document.getElementById("saveChanges");
      if (saveBtn) saveBtn.click();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  if (e.key === "Escape") {
    if (document.activeElement.classList.contains("cell")) {
      document.activeElement.blur();
    } else if (document.activeElement.id === "searchInput") {
      document.activeElement.blur();
    }
  }
});

// =============================================================================
// PAGE VISIBILITY
// =============================================================================
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    log.debug("Seite ist nicht mehr sichtbar");
    if (state.activeRequest) {
      state.activeRequest.abort();
      state.activeRequest = null;
      state.isLoading = false;
    }
  } else {
    log.debug("Seite ist wieder sichtbar");
  }
});

// =============================================================================
// WINDOW BEFOREUNLOAD
// =============================================================================
window.addEventListener("beforeunload", (e) => {
  if (Object.keys(state.editedData || {}).length > 0) {
    e.preventDefault();
    e.returnValue = "Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?";
    return e.returnValue;
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
    colno: e.colno
  });
});

window.addEventListener("unhandledrejection", (e) => {
  log.error("Unhandled Promise Rejection", {
    reason: e.reason,
    promise: e.promise
  });
});

// =============================================================================
// NETWORK STATUS MONITORING
// =============================================================================
window.addEventListener("online", () => {
  log.success("Internetverbindung wiederhergestellt");
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

// =============================================================================
// FINALIZATION
// =============================================================================
log.success("search.js vollständig geladen und initialisiert");

window.APP_VERSION = "2.1.0";
window.APP_INIT_TIME = new Date().toISOString();

log.info("Application Info", {
  version: window.APP_VERSION,
  initialized: window.APP_INIT_TIME,
  mode: "ID-basierte Pfade aktiv"
});