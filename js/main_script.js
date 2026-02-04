// =============================================================================
// MAIN SCRIPT - Startseite
// =============================================================================

// Debug Logging
// ich fand das sogar am amfang cool, aber jetzt sieht es ahh aus. deswegen nutze ich es an machen stellen nicht
// und weil ich vergessen habe, dass ich das hatte.....
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

// laden der php datei 
async function loadItemCount() {
  try {
    const res = await fetch("/api/count.php");
    const data = await res.json();

    if (data.success) {
      // zählen
      state.totalCount = data.count;

      // schreiben
      document.getElementById("item-count").textContent = data.count;

      // loggen
      log.success("Item-Count geladen:", data.count);
    } else {
      throw new Error(data.message || "Unbekannter Fehler");
    }
    // die einzigen fehler die ich meistens hatte waren von php, deswegen war dort sogar der error log am wichtigsten
  } catch (err) {
    log.error("Fehler beim Laden des Item-Counts:", err);
    document.getElementById("item-count").textContent = "Fehler";
  }
}

// =============================================================================
// LOCKER SCOLL
// =============================================================================
//ganz simpler scoll code für die Schränke und Räume und so
const locker = document.getElementById("locker");

document.getElementById("scrollLeft").onclick = () => {
  locker.scrollBy({
    left: -500, // weite nach links
    behavior: "smooth"
  });
};

document.getElementById("scrollRight").onclick = () => {
  locker.scrollBy({
    left: 500, // weite nach rechts
    behavior: "smooth"
  });
};

// =============================================================================
// NEUESTE EINTRÄGE LADEN
// =============================================================================

// das neuste eintrage laden hat sogar am meisten spaß gemacht.
// ich hatte paar coole ideen wie man es anzeigen kann aber die waren dann doch zu aufwendig für das projekt.
// villeicht mach ich sie als website in docs/ 

async function loadLatestEntries() {
  const container = document.getElementById("latest-entries");
  const button = document.getElementById("load-latest");

  // habe ich nie gesehen, es hat immer so schnell geladen.
  // wenn der PI aber belastet wird später mit meheren nutzer wird man es aber bestimmt sehen
  button.textContent = "Lade...";
  // damit man es nicht spammen kann
  // man könnte rein theoretisch die seite einfach neu laden und es dann nochmal drücken.
  // um dass zu countern könnte man die daten als localstorage oder so speichern und erste jede minute neu laden lassen 
  button.disabled = true;

  // php <3
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
    // das Rendern was eine sachen die ich nicht wirklich schlecht fand, aber auch nicht gut.
    // es war nicht sooo schlimm nur das schreiben ohne syntax manchaml und dass alles einfach und '' ist hat genervt
    container.innerHTML = items
      // das anzeigen des bildes kann weg gemacht werden aber ich liebe einfach das bild und es hat so gut gepasst
      .map(
        (item) => `
            <div class="latest-item-card">
                ${item.thumbnail
            ? `<img src="${item.thumbnail}" alt="${item.name}" class="item-thumbnail">`
            : `<img src="images/uhhhh.jpg" alt="Kein Bild" class="item-thumbnail placeholder">`

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

    // sollte man villeicht weg lassen...
    button.textContent = "Neu laden";


  } catch (err) {
    log.error("Fehler beim Laden der neuesten Einträge:", err);
    container.innerHTML = `<p class="error-message">Fehler beim Laden: ${err.message}</p>`;
    button.textContent = "Erneut versuchen";
  } finally {

    button.disabled = false;
  }
}

// Event Listener für "Neueste Einträge laden" Button
document
  .getElementById("load-latest")
  ?.addEventListener("click", loadLatestEntries);




// =============================================================================
// ZUFÄLLIGES ITEM
// =============================================================================
// ich nehme zurück was ich davor gesagt habe
// hirmit hatte ich am meisten spaß
// es ist eigentlich genau das gleiche wie das eben nur mit bisschen anderen html code

// aber es hat mehr spaß gemacht sich immer auf EIN elemnt zu konzentrieren und nciht auf 10 gleiche
async function loadRandomItem() {
  const button = document.getElementById("random-item-btn");
  const statusDiv = document.getElementById("random-item-status");

  button.textContent = "Lade...";
  button.disabled = true;
  statusDiv.innerHTML = "";

  try {
    // Lade ein zufälliges Item
    const res = await fetch("/api/fetch_all_items.php?random=true&limit=1");

    // debugging zeug
    if (!res.ok) {
      throw new Error("Server Error " + res.status);
    }

    const response = await res.json();

    // noch mehr debugging zeug
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

// Event Listener für Random Item Button
document
  .getElementById("random-item-btn")
  ?.addEventListener("click", loadRandomItem);

// Füge Star-SVGs zum Random Button hinzu
// ganz seltsam. ich hatte das in css und es hat nicht richtig funktioniert.
// stellt sich herraus. man muss es in javascirpt machen. ganz seltsam
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
// ich fande es am amfang etwas unnötig aber nach ein bisschen feedback wurde ich überzeugt
// und es macht schon sinn
// sie sache ist ich denke oft nicht an die wirkliche funktionalität sondern eher wie beindruckend es ist.
// aber es sollte schon funktionsfähig sein damit man auch wirklich die website nutzt.
// das vergesse ich oft...
async function loadCategories() {
  try {
    // Lade alle Items um Kategorien zu extrahieren
    // villeicht nicht der beste weg aber egal
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

    // Render Kategorie ding
    const container = document.querySelector("#Kategorien .row");
    if (!container) return;

    container.innerHTML = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1]) // Sortiere nach Anzahl
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
// lädt alles und so
async function init() {
  log.info("Initialisiere Startseite...");

  try {
    // Lade Daten parallel
    // das ist dieses timing
    await Promise.all([loadItemCount(), loadCategories()]);

    log.success("Startseite erfolgreich geladen");
  } catch (err) {
    log.error("Fehler bei der Initialisierung:", err);
  }
}

// Starte Initialisierung nach DOM-Ready
// ganz einfaches if statement 
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Formatiere Datum

// das habe
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}



log.info("main_script.js geladen");

//doppelt hällt besser
window.scrollTo(0, 0);