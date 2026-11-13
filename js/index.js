// ██╗███╗  ██╗██████╗ ███████╗██╗  ██╗        ██╗ ██████╗
// ██║████╗ ██║██╔══██╗██╔════╝╚██╗██╔╝        ██║██╔════╝
// ██║██╔██╗██║██║  ██║█████╗   ╚███╔╝         ██║╚█████╗ 
// ██║██║╚████║██║  ██║██╔══╝   ██╔██╗    ██╗  ██║ ╚═══██╗
// ██║██║ ╚███║██████╔╝███████╗██╔╝╚██╗██╗╚█████╔╝██████╔╝
// ╚═╝╚═╝  ╚══╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 

// Escaped Text für die Verwendung in innerHTML (auch in Attributen).
const escHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

async function loadItemCount() {
  try {
    const res = await fetch("/api/count.php");
    const data = await res.json();
    if (data.success) {
      state.totalCount = data.count;
      const el = document.getElementById("item-count");
      el.removeAttribute("data-i18n"); // ← verhindert Überschreiben
      el.textContent = data.count;
    }
  } catch (err) {
    console.error("Fehler beim Laden des Item-Counts:", err);
    document.getElementById("item-count").textContent = T.counter_error;
  }
}

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
// NEUESTE EINTRÄGE LADEN
// =============================================================================
async function loadLatestEntries() {
  const container = document.getElementById("latest-entries");
  const button = document.getElementById("load-latest");

  button.textContent = T.loading;
  button.disabled = true;

  try {
    const res = await fetch("/api/fetch_all_items.php?limit=5");

    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    if (!response.success) {
      throw new Error(response.message || "Unbekannter Fehler");
    }

    const items = response.data || [];

    if (items.length === 0) {
      container.innerHTML = `<p class="no-items">${T.no_items}</p>`;
      return;
    }


    // Render Items
    container.innerHTML = items
      .map(
        (item) => `
            <div class="latest-item-card">
                ${item.thumbnail
            ? `<img src="${escHtml(item.thumbnail)}" alt="${escHtml(item.name)}" class="item-thumbnail">`
            : `<img src="/images/uhhhh.jpg" alt="${T.no_image_alt}" class="item-thumbnail placeholder">`
          }
                <div class="item-info">
                    <h3>${escHtml(item.name)}</h3>
                    <p class="item-meta">
                      <span class="category">${escHtml(item.category_name) || T.no_category}</span>
                        ${item.brand
            ? `<span class="brand">${escHtml(item.brand)}</span>`
            : ""
          }
                    </p>
                    <div class="item-actions">
                        ${item.docs_link
            ? `<a href="${escHtml(item.docs_link)}" class="btn-docs" target="_blank">${T.docs_btn}</a>`
            : ""
          }
                        <a href="/search.html?query=${encodeURIComponent(
            item.name,
          )}" class="btn-search">${T.details_btn}</a>
                    </div>
                </div>
            </div>
        `,
      )
      .join("");

    button.textContent = T.btn_reload;
  } catch (err) {
    console.error("Fehler beim Laden der neuesten Einträge:", err);
    container.innerHTML = `<p class="error-message">Fehler beim Laden: ${escHtml(err.message)}</p>`;
    button.textContent = T.btn_retry;
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

  button.textContent = T.loading;
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

    statusDiv.innerHTML = `
  <div class="random-item-result random-item-button">
    ${item.thumbnail
        ? `<img src="${escHtml(item.thumbnail)}" alt="${escHtml(item.name)}" class="random-thumbnail">`
        : `<img src="/images/uhhhh.jpg" alt="${T.no_image_alt}" class="random-thumbnail placeholder">`
      }
                <div class="random-item-details">
                    <h3>${escHtml(item.name)}</h3>
                    <div class="random-meta">
                        ${item.category_name
        ? `<span class="badge">${escHtml(item.category_name)}</span>`
        : ""
      }
                        ${item.brand
        ? `<span class="badge">${escHtml(item.brand)}</span>`
        : ""
      }
                        ${item.model
        ? `<span class="badge">${escHtml(item.model)}</span>`
        : ""
      }
                    </div>
                    ${item.notes
        ? `<p class="random-notes">${escHtml(item.notes.substring(0, 150))}${item.notes.length > 150 ? "..." : ""}</p>`
        : ""
      }
                    <div class="random-actions">
${item.docs_link
        ? `<a href="${escHtml(item.docs_link)}" class="btn-docs random-item-button" target="_blank">${T.docs_long_btn}</a>`
        : ""
      }
                        <a href="/search.html?query=${encodeURIComponent(
        item.name,
      )}" class="btn-details random-item-button">${T.all_details_btn}</a>
                    </div>
                </div>
            </div>
        `;

    button.textContent = T.btn_random_new;
  } catch (err) {
    console.error("Fehler beim Laden des zufälligen Items:", err);
    statusDiv.innerHTML = `<p class="error-message">Fehler: ${escHtml(err.message)}</p>`;
    button.textContent = T.btn_retry;
  } finally {
    button.disabled = false;
  }
}




// =============================================================================
// KATEGORIEN LADEN
// =============================================================================
async function loadCategories() {
  try {
    const res = await fetch("/api/fetch_catagory.php");

    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    if (!response.success) {
      throw new Error(response.message || "Unbekannter Fehler");
    }

    const categories = response.data || [];


    // Render Kategorien
    const container = document.querySelector("#Kategorien .row");
    if (!container) return;

    container.innerHTML = categories
      .sort((a, b) => b.item_count - a.item_count)
      .map(
        (cat) => `
                <div class="category-card" onclick="window.location.href='/search.html?category_id=${cat.id}'">
                    <h3>${escHtml(cat.name)}</h3>
                    ${cat.parent_name ? `<p class="category-parent">${escHtml(cat.parent_name)}</p>` : ""}
                    ${cat.item_count} ${cat.item_count === 1 ? T.item_singular : T.item_plural}
                </div>
            `,
      )
      .join("");
  } catch (err) {
    console.error("Fehler beim Laden der Kategorien:", err);
    const container = document.querySelector("#Kategorien .row");
    if (container) {
      container.innerHTML = `<p class="error-message">${T.error_load_categories}</p>`;
    }
  }
}

// =============================================================================
// INITIALISIERUNG
// =============================================================================
async function init() {
  await window.langReady;

  try {
    await Promise.all([loadItemCount(), loadCategories()]);
  } catch (err) {
    console.error("Fehler bei der Initialisierung:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// log.info("index.js geladen");