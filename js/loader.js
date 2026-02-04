// Cache für geladene HTML-Dateien
const htmlCache = new Map();

// Timeout für Fetch-Requests (10 Sekunden)
const FETCH_TIMEOUT = 10000;

// Tracking für geladene Komponenten
let loadedComponents = 0;
const totalComponents = 3;

/**
 * Fetch mit Timeout
 */
function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout beim Laden von ${url}`)),
        timeout
      )
    ),
  ]);
}



/**
 * Hauptfunktion zum Laden von HTML-Partials
 * @param {string} id - ID des Ziel-Elements
 * @param {string} file - Pfad zur HTML-Datei
 * @param {boolean} useCache - Cache verwenden (Standard: true)
 * @returns {Promise<HTMLElement|null>}
 */
// NOTE: ich LIEBE diese @param und @returns sachen.
// ja ich habe das erst von ChatGPT kennengelernt aber esist so eine coole art um eine funktion zu erklären
// ich habe es leider nicht sehr oft genutzt... Eigentlich nie...


async function loadHTML(id, file, useCache = true) {
  const el = document.getElementById(id);

  if (!el) {
    console.warn(`Element mit ID "${id}" nicht gefunden`);
    return null;
  }

  try {
    let html;

    // Cache prüfen
    if (useCache && htmlCache.has(file)) {
      html = htmlCache.get(file);
    } else {
      const res = await fetchWithTimeout(file);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      html = await res.text();

      // Im Cache speichern
      if (useCache) {
        htmlCache.set(file, html);
      }
    }

    // HTML einfügen
    el.innerHTML = html;

    // Scripts ausführen
    executeScripts(el);

    // Event Listener für Settings initialisieren
    initializeSettingsEvents();

    // Komponente als geladen markieren
    loadedComponents++;

    console.log(
      `✓ ${file} erfolgreich geladen (${loadedComponents}/${totalComponents})`
    );
    return el;
  } catch (error) {
    console.error(`✗ Fehler beim Laden von ${file}:`, error.message);

    // Fallback-Inhalt anzeigen (nie genutzt, da ich eh schon 10 weitere fallbacks hatte)
    el.innerHTML = `
            <div style="padding: 1rem; background: #fee; border: 1px solid #c00; border-radius: 4px;">
                <strong>Fehler beim Laden</strong><br>
                <small>${file} konnte nicht geladen werden.</small>
            </div>
        `;

    return null;
  }
}

/**
 * Führt alle Script-Tags im geladenen HTML aus
 * @param {HTMLElement} container - Container-Element
 */
function executeScripts(container) {
  const scripts = container.querySelectorAll("script");

  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");

    // Attribute kopieren
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value);
    });

    if (oldScript.src) {
      // Externes Script
      newScript.src = oldScript.src;
      newScript.async = false; // Scripts in Reihenfolge ausführen
    } else {
      // Inline Script
      newScript.textContent = oldScript.textContent;
    }

    // Fehlerbehandlung für Scripts
    newScript.onerror = () => {
      console.error(
        `Fehler beim Ausführen von Script:`,
        oldScript.src || "inline"
      );
    };

    document.body.appendChild(newScript);

    // Original-Script entfernen
    oldScript.remove();
  });
}

/**
 * Initialisiert Event Listener für das Settings-Modal
 * Verhindert doppelte Listener durch removeEventListener
 */
function initializeSettingsEvents() {
  const openSettings = document.getElementById("open-settings");
  const closeSettings = document.getElementById("close-settings");
  const modal = document.getElementById("settings-modal");
  const menuCheckbox = document.getElementById("settings-icon");

  if (!modal) return;

  // Stelle sicher, dass Modal initial versteckt ist (Bug Fix #1)
  modal.classList.remove("active");

  // Stelle sicher, dass Checkbox unchecked ist (Bug Fix #1)
  if (menuCheckbox) {
    menuCheckbox.checked = false;
  }

  // Alte Listener entfernen (falls vorhanden)
  if (openSettings) {
    openSettings.replaceWith(openSettings.cloneNode(true));
    const newOpenBtn = document.getElementById("open-settings");

    newOpenBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Menü schließen
      if (menuCheckbox) {
        menuCheckbox.checked = false;
      }

      // Modal nach kurzer Verzögerung öffnen (für Animation)
      setTimeout(
        () => {
          modal.classList.add("active");
          centerModal();
        },
        menuCheckbox ? 400 : 0
      );
    });
  }

  if (closeSettings) {
    closeSettings.replaceWith(closeSettings.cloneNode(true));
    const newCloseBtn = document.getElementById("close-settings");

    newCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modal.classList.remove("active");
    });
  }

  // Klick außerhalb des Modals schließt es
  modal.addEventListener("mousedown", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  // ESC-Taste schließt Modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      modal.classList.remove("active");
    }
  });
}

/**
 * Zentriert das Modal-Fenster
 */
function centerModal() {
  const modalWindow = document.querySelector(".settings-modal-content");
  if (!modalWindow) return;

  const rect = modalWindow.getBoundingClientRect();

  modalWindow.style.left = `${window.innerWidth / 2 - rect.width / 2}px`;
  modalWindow.style.top = `${window.innerHeight / 2 - rect.height / 2}px`;
}

/**
 * Lädt alle Komponenten neu (z.B. für Debugging)
 */
function reloadAllComponents() {
  htmlCache.clear();

  return Promise.all([
    loadHTML("header", "/partials/header.html", false),
    loadHTML("nav", "/partials/nav.html", false),
    loadHTML("settings", "/partials/settings.html", false),
  ]);
}

// Für Debugging im Browser verfügbar machen
if (typeof window !== "undefined") {
  window.loadHTML = loadHTML;
  window.reloadAllComponents = reloadAllComponents;
}

// Globaler Error Handler
window.addEventListener("error", (e) => {
  console.error("Runtime Error:", e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled Promise Rejection:", e.reason);
});



// Initialisierung mit Error Handling
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Scroll-Position zurücksetzen
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";

    // Komponenten parallel laden
    await Promise.all([
      loadHTML("header", "/partials/header.html"),
      loadHTML("nav", "/partials/nav.html"),
      loadHTML("settings", "/partials/settings.html"),
    ]);

    // Kurze Verzögerung für Animation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Seite als geladen markieren
    document.body.classList.add("loaded");
    document.body.style.overflow = "";

    // Loader ausblenden
    const loader = document.querySelector(".page-loader");
    if (loader) {
      loader.classList.add("hidden");
      setTimeout(() => loader.remove(), 300);
    }

    // Event Delegation für Settings
    document.body.addEventListener("click", handleGlobalClicks);
  } catch (error) {
    console.error("Fehler beim Laden der Komponenten:", error);
    document.body.classList.add("loaded");
    document.body.style.overflow = "";

    const loader = document.querySelector(".page-loader");
    if (loader) loader.remove();
  }
});

function handleGlobalClicks(e) {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  if (e.target.id === "open-settings" || e.target.closest("#open-settings")) {
    e.preventDefault();
    modal.classList.add("active");
  } else if (
    e.target.id === "close-settings" ||
    e.target.closest("#close-settings")
  ) {
    e.preventDefault();
    modal.classList.remove("active");
  }
}
