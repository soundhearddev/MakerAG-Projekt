// =============================================================================
// MAIN SCRIPT - Startseite
// =============================================================================

const log = {
  info: (msg, data) =>
    console.log(`%c[INFO] ${msg}`, "color: #0066ff", data || ""),
  error: (msg, data) =>
    console.error(`%c[ERROR] ${msg}`, "color: #ff4444", data || ""),
  success: (msg, data) =>
    console.log(`%c[SUCCESS] ${msg}`, "color: #00aa00", data || ""),
};

window.scrollTo(0, 0);

// =============================================================================
// STATE MANAGEMENT
// =============================================================================
const state = {
  allItems: [],
  categories: new Set(),
  totalCount: 0,
};

// =============================================================================
// ITEM COUNT LADEN
// =============================================================================
async function loadItemCount() {
  try {
    const res = await fetch("/api/count.php");
    const data = await res.json();

    if (data.success) {
      state.totalCount = data.count;
      document.getElementById("item-count").textContent = data.count;
      log.success("Item-Count geladen:", data.count);
    } else {
      throw new Error(data.message || "Unbekannter Fehler");
    }
  } catch (err) {
    log.error("Fehler beim Laden des Item-Counts:", err);
    document.getElementById("item-count").textContent = "Fehler";
  }
}

// =============================================================================
// LOCKER SCROLL
// =============================================================================
const locker = document.getElementById("locker");

document.getElementById("scrollLeft").onclick = () => {
  locker.scrollBy({
    left: -500,
    behavior: "smooth"
  });
};

document.getElementById("scrollRight").onclick = () => {
  locker.scrollBy({
    left: 500,
    behavior: "smooth"
  });
};

// =============================================================================
// NEUESTE EINTRÄGE LADEN
// =============================================================================
async function loadLatestEntries() {
  const container = document.getElementById("latest-entries");
  const button = document.getElementById("load-latest");

  button.textContent = "Lade...";
  button.disabled = true;

  try {
    const res = await fetch("/api/fetch_all_items.php?latest=true&limit=10");

    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    if (!response.success) {
      throw new Error(response.message || "Unbekannter Fehler");
    }

    const items = response.data || [];

    if (items.length === 0) {
      container.innerHTML = '<p class="no-items">Keine Einträge gefunden</p>';
      return;
    }

    log.success("Neueste Einträge geladen:", items.length);

    // Render Items
    container.innerHTML = items
      .map(
        (item) => `
            <div class="latest-item-card">
                ${item.thumbnail
            ? `<img src="${item.thumbnail}" alt="${item.name}" class="item-thumbnail">`
            : `<img src="/images/uhhhh.jpg" alt="Kein Bild" class="item-thumbnail placeholder">`
          }
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p class="item-meta">
                        <span class="category">${item.category || "Keine Kategorie"
          }</span>
                        ${item.brand
            ? `<span class="brand">${item.brand}</span>`
            : ""
          }
                    </p>
                    <div class="item-actions">
                        ${item.docs_link
            ? `<a href="${item.docs_link}" class="btn-docs" target="_blank">Docs</a>`
            : ""
          }
                        <a href="/search.html?query=${encodeURIComponent(
            item.name
          )}" class="btn-search">Details</a>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    button.textContent = "Neu laden";

  } catch (err) {
    log.error("Fehler beim Laden der neuesten Einträge:", err);
    container.innerHTML = `<p class="error-message">Fehler beim Laden: ${err.message}</p>`;
    button.textContent = "Erneut versuchen";
  } finally {
    button.disabled = false;
  }
}

document
  .getElementById("load-latest")
  ?.addEventListener("click", loadLatestEntries);

// =============================================================================
// ZUFÄLLIGES ITEM
// =============================================================================
async function loadRandomItem() {
  const button = document.getElementById("random-item-btn");
  const statusDiv = document.getElementById("random-item-status");

  button.textContent = "Lade...";
  button.disabled = true;
  statusDiv.innerHTML = "";

  try {
    const res = await fetch("/api/fetch_all_items.php?random=true&limit=1");

    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    if (!response.success || !response.data || response.data.length === 0) {
      throw new Error("Keine Items gefunden");
    }

    const item = response.data[0];
    log.success("Zufälliges Item geladen:", item.name);

    statusDiv.innerHTML = `
  <div class="random-item-result random-item-button">
    ${item.thumbnail
        ? `<img src="${item.thumbnail}" alt="${item.name}" class="random-thumbnail">`
        : `<img src="/images/uhhhh.jpg" alt="Kein Bild" class="random-thumbnail placeholder">`
      }
                <div class="random-item-details">
                    <h3>${item.name}</h3>
                    <div class="random-meta">
                        ${item.category
        ? `<span class="badge">${item.category}</span>`
        : ""
      }
                        ${item.brand
        ? `<span class="badge">${item.brand}</span>`
        : ""
      }
                        ${item.model
        ? `<span class="badge">${item.model}</span>`
        : ""
      }
                    </div>
                    ${item.notes
        ? `<p class="random-notes">${item.notes.substring(
          0,
          150
        )}${item.notes.length > 150 ? "..." : ""}</p>`
        : ""
      }
                    <div class="random-actions">
                        ${item.docs_link
        ? `<a href="${item.docs_link}" class="btn-docs random-item-button" target="_blank">Dokumentation</a>`
        : ""
      }
                        <a href="/search.html?query=${encodeURIComponent(
        item.name
      )}" class="btn-details random-item-button">Alle Details</a>
                    </div>
                </div>
            </div>
        `;

    button.textContent = "Neues zufälliges Item";
  } catch (err) {
    log.error("Fehler beim Laden des zufälligen Items:", err);
    statusDiv.innerHTML = `<p class="error-message">Fehler: ${err.message}</p>`;
    button.textContent = "Erneut versuchen";
  } finally {
    button.disabled = false;
  }
}

document
  .getElementById("random-item-btn")
  ?.addEventListener("click", loadRandomItem);

// Star-SVGs zum Random Button hinzufügen
document.addEventListener("DOMContentLoaded", () => {
  const randomBtn = document.getElementById("random-item-btn");
  if (randomBtn && !randomBtn.querySelector(".star-1")) {
    const starSVG = `
            <svg class="star-1" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
            <svg class="star-2" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
            <svg class="star-3" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
            <svg class="star-4" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
            <svg class="star-5" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
            <svg class="star-6" viewBox="0 0 139 139" xmlns="http://www.w3.org/2000/svg">
                <path class="fil0" d="M69.5 0l8.93 27.48h28.93l-23.41 17.01 8.93 27.48L69.5 54.96l-23.38 17.01 8.93-27.48-23.41-17.01h28.93z"/>
            </svg>
        `;
    randomBtn.insertAdjacentHTML("afterbegin", starSVG);
  }
});

// =============================================================================
// KATEGORIEN LADEN
// =============================================================================
async function loadCategories() {
  try {
    const res = await fetch("/api/fetch_all_items.php?limit=1000");

    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    if (!response.success) {
      throw new Error(response.message || "Unbekannter Fehler");
    }

    const items = response.data || [];
    state.allItems = items;

    // Extrahiere Kategorien
    const categoryCounts = {};
    items.forEach((item) => {
      if (item.category) {
        categoryCounts[item.category] =
          (categoryCounts[item.category] || 0) + 1;
      }
    });

    log.success("Kategorien geladen:", Object.keys(categoryCounts).length);

    // Render Kategorien
    const container = document.querySelector("#Kategorien .row");
    if (!container) return;

    container.innerHTML = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([category, count]) => `
                <div class="category-card" onclick="window.location.href='/search.html?category=${encodeURIComponent(
          category
        )}'">
                    <h3>${category}</h3>
                    <p class="category-count">${count} ${count === 1 ? "Item" : "Items"
          }</p>
                </div>
            `
      )
      .join("");
  } catch (err) {
    log.error("Fehler beim Laden der Kategorien:", err);
    const container = document.querySelector("#Kategorien .row");
    if (container) {
      container.innerHTML = `<p class="error-message">Fehler beim Laden der Kategorien</p>`;
    }
  }
}

// =============================================================================
// INITIALISIERUNG
// =============================================================================
async function init() {
  log.info("Initialisiere Startseite...");

  try {
    await Promise.all([loadItemCount(), loadCategories()]);
    log.success("Startseite erfolgreich geladen");
  } catch (err) {
    log.error("Fehler bei der Initialisierung:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

log.info("main_script.js geladen - ID-basierte Pfade aktiv");

window.scrollTo(0, 0);