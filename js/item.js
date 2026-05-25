// ██╗████████╗███████╗███╗   ███╗        ██╗ ██████╗
// ██║╚══██╔══╝██╔════╝████╗ ████║        ██║██╔════╝
// ██║   ██║   █████╗  ██╔████╔██║        ██║╚█████╗ 
// ██║   ██║   ██╔══╝  ██║╚██╔╝██║   ██╗  ██║ ╚═══██╗
// ██║   ██║   ███████╗██║ ╚═╝ ██║██╗╚█████╔╝██████╔╝
// ╚═╝   ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝ ╚════╝ ╚═════╝ 
//
// item.js — Detailseite für ein einzelnes Inventar-Item
//
// Diese Datei übernimmt alles was auf /docs/items/<id>/ passiert:
// - Item-Daten vom Server laden und ins DOM rendern
// - Inline-Editoren für Status, Standort und Menge einbauen
// - Bilder und Dokumente (PDF/HTML) nachladen und anzeigen
//
// Kein Framework, kein Build-Step — reines vanilla JS,
// läuft direkt im Browser sobald die Seite geladen ist.

(function () {
  "use strict";

  // Die Item-ID steckt in der URL: /docs/items/42/
  // Wir lesen sie mit einer Regex aus window.location.pathname heraus.
  // Fallback auf 17, damit die Seite auch ohne gültige URL nicht crasht
  // (z.B. während der Entwicklung direkt auf /docs/items/ ohne ID).
  const match = window.location.pathname.match(/\/docs\/items\/(\d+)\//);
  const id = match ? match[1] : 17;

  // ── Hilfsfunktionen ──────────────────────────────────────────────────────
  //
  // Kleine, wiederverwendbare Utilities die an mehreren Stellen gebraucht
  // werden. Alle rein funktional, kein Side-Effect auf den DOM außer makeBtn,
  // makeInput und makePopup — die erstellen Elemente aber hängen sie nicht ein.

  // Wandelt einen beliebigen String in einen CSS-kompatiblen Slug um.
  // Wird benutzt um aus Statuswerten wie "verfügbar" Klassen wie
  // "status-verfugbar" zu bauen — Leerzeichen → Bindestrich,
  // Sonderzeichen und Umlaute raus, alles lowercase.
  function slug(str) {
    if (str == null && str !== 0) return "";
    return String(str).toLowerCase().trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "");
  }

  // Baut eine einzelne Info-Zeile im Status-Block:
  // <div class="info-line info-<label>"><strong>Label:</strong> Wert</div>
  // Das innerHTML für value ist erlaubt weil wir den Wert selbst kontrollieren
  // (kommt immer aus API-Daten, nie direkt aus Nutzereingabe ungefiltert).
  // Gibt null zurück wenn kein Wert vorhanden — appendIf filtert das dann raus.
  function infoLine(label, value) {
    if (!value) return null;
    const div = document.createElement("div");
    div.className = `info-line info-${slug(label)}`;
    div.setAttribute("data-label", slug(label));
    div.innerHTML = `<strong>${label}:</strong> ${value}`;
    return div;
  }

  // Hängt ein Element nur an wenn es nicht null ist.
  // Wird überall genutzt wo infoLine() aufgerufen wird,
  // damit wir kein leeres Element im DOM haben wenn das Feld fehlt.
  function appendIf(el, child) {
    if (child) el.appendChild(child);
  }

  // Erstellt einen Button mit einem bestimmten visuellen Variant.
  // "primary" = Hauptaktion (Speichern), "secondary" = Nebenaction (Abbrechen, Ändern).
  // Die Klassen kommen aus dem globalen CSS — hier wird nur die Struktur gebaut.
  function makeBtn(label, variant = "primary") {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = `edit-btn edit-btn--${variant}`;
    return btn;
  }

  // Einheitliches Text-Input-Element für alle Inline-Editoren.
  // value vorbelegen damit der Nutzer sofort sieht was aktuell gesetzt ist
  // und nicht von vorne tippen muss.
  function makeInput(placeholder, value = "") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = placeholder;
    inp.value = value;
    inp.className = "edit-input";
    return inp;
  }

  // Wrapper-div für ein Popup — taucht direkt unter dem auslösenden Element auf.
  // Kein absolutes Positioning aus JS heraus, das übernimmt CSS via .edit-popup.
  function makePopup(content) {
    const popup = document.createElement("div");
    popup.className = "edit-popup";
    popup.appendChild(content);
    return popup;
  }

  // Formatiert ein Location-Objekt { room, schrank, fach } zu einem
  // lesbaren String: "Raum A, Schrank 2, Fach 3 (hinten links)"
  // Fehlende Felder werden einfach übersprungen — nicht jeder Standort
  // hat alle drei Ebenen. Wenn gar nichts da ist kommt "—".
  function formatLocation(loc, note) {
    const parts = [];
    if (loc) {
      if (loc.room) parts.push(`Raum ${loc.room}`);
      if (loc.schrank) parts.push(`Schrank ${loc.schrank}`);
      if (loc.fach) parts.push(`Fach ${loc.fach}`);
    }
    if (note) parts.push(`(${note})`);
    return parts.length ? parts.join(", ") : "—";
  }

  // ── Item laden ───────────────────────────────────────────────────────────
  //
  // Der einzige initiale Fetch — alles andere (Bilder, PDFs, Location-Liste)
  // wird erst danach ausgelöst, entweder sofort im .then() oder lazy on demand
  // (z.B. die Location-Liste erst wenn der Nutzer auf "ändern" klickt).

  fetch(`/api/fetch_from_id.php?id=${encodeURIComponent(id)}`)
    .then((res) => res.json())
    .then((data) => {
      // API gibt immer { success, data: [...] } zurück.
      // Leeres Array bedeutet Item existiert nicht (gelöscht, falsche ID, etc.).
      if (!data.success || !data.data?.length) {
        document.getElementById("item-title").textContent = "Nicht gefunden";
        return;
      }

      // data.data ist ein Array, aber wir fragen immer nur eine ID ab —
      // also ist data.data[0] unser Item-Objekt.
      const item = data.data[0];

      // ── Titel ────────────────────────────────────────────────────────────
      // Manche Items haben einen eigenen Namen (z.B. "Lötstationen-Set"),
      // andere sind nur über Marke + Modell identifiziert ("Bosch GSR 12V").
      // Wir bevorzugen name, fallback ist die Kombination aus beidem.
      const title = item.name || `${item.brand} ${item.model}`;

      // Sowohl der Browser-Tab-Titel als auch die sichtbare H1 werden gesetzt.
      document.title = title;
      document.getElementById("item-title").textContent = title;

      // Die Beschreibungszeile unter dem Titel zeigt das Modell an —
      // aber nur wenn es auch einen separaten name gibt, sonst würde
      // "Bosch GSR 12V" doppelt stehen: einmal als Titel, einmal als Beschreibung.
      if (item.name) {
        const descEl = document.getElementById("item-description");
        if (item.brand || item.model) {
          descEl.textContent = `Modell: ${item.brand ?? ""} ${item.model ?? ""}`.trim();
        }
      }

      // ── Status-Block ─────────────────────────────────────────────────────
      // Alle Metadaten (Status, Zustand, Kategorie, Standort, Tags, …)
      // landen in diesem einen div. Die Reihenfolge der appendIf-Aufrufe
      // bestimmt die visuelle Reihenfolge im Block.
      const statusDiv = document.getElementById("status");
      statusDiv.className = "status-info";

      // Status bekommt einen eigenen Editor (Dropdown + Speichern-Button),
      // alle anderen Felder sind entweder reine Anzeige oder haben
      // ihre eigene Build-Funktion unten.
      if (item.status) buildStatusEditor(statusDiv, item);

      // item_condition ist ein enum-artiges Feld ("gut", "beschädigt", etc.) —
      // per slug-Klasse kann CSS das unterschiedlich einfärben.
      if (item.item_condition) appendIf(statusDiv, infoLine(
        "Zustand",
        `<span class="condition-${slug(item.item_condition)} item-condition">${item.item_condition}</span>`,
      ));

      // Kategorien können verschachtelt sein (Eltern → Kind).
      // Wenn parent_category vorhanden ist zeigen wir den vollen Pfad.
      if (item.category_name) {
        const kat = item.parent_category
          ? `${item.parent_category} / ${item.category_name}`
          : item.category_name;
        appendIf(statusDiv, infoLine("Kategorie", `<span class="item-category">${kat}</span>`));
      }

      // Standort-Editor: zeigt Raum/Schrank/Fach und erlaubt Änderung
      // via schrittweisem Dropdown-Flow (erst Raum, dann Schrank, dann Fach).
      buildLocationEditor(statusDiv, item);

      // Tags sind ein Array von Strings — jeder bekommt sein eigenes <span>
      // damit CSS sie als Badge stylen kann.
      if (item.tags?.length) appendIf(statusDiv, infoLine(
        "Tags",
        item.tags.map((t) => `<span class="item-tag">${t}</span>`).join(", "),
      ));

      if (item.serial_number) appendIf(statusDiv, infoLine(
        "Seriennummer", `<span class="item-serial">${item.serial_number}</span>`,
      ));

      // Mengen-Editor: nur wenn quantity > 0 gesetzt ist.
      // Zeigt einen +/- Balken um verfügbare vs. Gesamtmenge darzustellen.
      if (item.quantity) buildQuantityEditor(statusDiv, item);

      if (item.notes) appendIf(statusDiv, infoLine(
        "Notizen", `<span class="item-notes">${item.notes}</span>`,
      ));

      // ── Technische Specs ─────────────────────────────────────────────────
      // specs kann entweder ein Objekt { "Spannung": "230V", ... } sein
      // oder ein Array [{ key: "Spannung", value: "230V" }, ...] —
      // beides kommt aus der DB, je nachdem wie das Item angelegt wurde.
      // Anzahl/Quantity-Felder überspringen wir hier, die haben ihren
      // eigenen Editor weiter oben und würden sonst doppelt erscheinen.
      const specsList = document.getElementById("specs-list");
      specsList.innerHTML = "";
      const { specs } = item;

      if (specs && !Array.isArray(specs) && typeof specs === "object" && Object.keys(specs).length) {
        // Objekt-Format: direkt über Entries iterieren
        Object.entries(specs).forEach(([key, value]) => {
          if (/^(anzahl|quantity|menge)$/i.test(key.trim())) return;
          const li = document.createElement("li");
          li.innerHTML = `<strong>${key}:</strong> ${value}`;
          specsList.appendChild(li);
        });
      } else if (Array.isArray(specs) && specs.length) {
        // Array-Format: key oder label als Bezeichner, value als Wert
        specs.forEach((spec) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${spec.key || spec.label}:</strong> ${spec.value}`;
          specsList.appendChild(li);
        });
      } else {
        // Keine Specs vorhanden → ganzen Container ausblenden statt leere Liste
        specsList.closest(".container")?.style.setProperty("display", "none");
      }

      // ── Bilder ───────────────────────────────────────────────────────────
      // Bilder werden separat nachgeladen, nicht im Haupt-Fetch mitgeliefert,
      // damit der erste Render schnell ist und Bilder nachladen können.
      // Thumbnails werden herausgefiltert (nur für interne Zwecke, nicht zur Anzeige).
      fetch(`/api/get_data.php?id=${id}&type=image`)
        .then((res) => res.json())
        .then((imgData) => {
          const gallery = document.getElementById("image-gallery");
          const files = (imgData.data || []).filter((f) => !/thumb/i.test(f.filename));
          if (!files.length) {
            gallery.closest(".container")?.style.setProperty("display", "none");
            return;
          }
          files.forEach((file, i) => {
            const img = document.createElement("img");
            img.src = file.path;
            img.alt = `Bild ${i + 1}`;
            img.className = "gallery-img";
            // Klick öffnet das Bild in Originalgröße im neuen Tab —
            // kein Lightbox-Overhead, reicht für den Inventar-Kontext.
            img.addEventListener("click", () => window.open(img.src, "_blank"));
            gallery.appendChild(img);
          });
        })
        .catch(() => {
          // Bei Fehler einfach den ganzen Galerie-Container verstecken,
          // damit kein hässlicher leerer Block auf der Seite bleibt.
          document.getElementById("image-gallery")
            ?.closest(".container")
            ?.style.setProperty("display", "none");
        });

      // ── Dokumente (PDF + HTML) ───────────────────────────────────────────
      // PDFs und HTML-Versionen von Datenblättern etc. werden parallel geladen
      // (Promise.all) um nicht zwei sequentielle Requests zu machen.
      // Danach werden beide Listen zusammengeführt und als Links angezeigt.
      Promise.all([
        fetch(`/api/get_data.php?id=${id}&type=pdf`).then(r => r.json()),
        fetch(`/api/get_data.php?id=${id}&type=html`).then(r => r.json()),
      ]).then(([pdfData, htmlData]) => {
        // Beide Arrays mergen, jedes File bekommt ein passendes Icon
        const files = [
          ...(pdfData.data || []).map(f => ({ ...f, icon: "📄" })),
          ...(htmlData.data || []).map(f => ({ ...f, icon: "🌐" })),
        ];
        if (!files.length) return;

        const docsContainer = document.getElementById("docs-container");
        const heading = document.createElement("p");
        heading.innerHTML = "<strong>Dokumente:</strong>";
        docsContainer.appendChild(heading);

        files.forEach((file) => {
          const p = document.createElement("p");
          const isPdf = file.filename.match(/\.pdf$/i);
          // Dateinamen bereinigen: Erweiterung und redundante Versionshinweise entfernen
          const name = file.filename
            .replace(/\.(pdf|html?)$/i, "")
            .replace(/--\s*pdf\s*version/i, isPdf ? "-- PDF version" : "-- HTML version");
          p.innerHTML = `${file.icon} <a href="${file.path}" target="_blank">${name}</a>`;
          docsContainer.appendChild(p);
        });

      }).catch((err) => console.warn("Dokumente:", err));
    });

  // ── Status Editor ────────────────────────────────────────────────────────
  //
  // Rendert die aktuelle Status-H2 + "Status ändern"-Button.
  // Bei Klick erscheint ein Popup mit einem <select> der alle anderen
  // erlaubten Status-Werte zeigt (aktuellen ausschließen).
  // Zweiter Klick auf denselben Button schließt das Popup wieder —
  // das toggle-Pattern: popup existiert → entfernen statt neu erstellen.

  function buildStatusEditor(container, item) {
    // Vollständige Liste der gültigen Status-Werte.
    // Bewusst hartcodiert hier statt vom Server zu laden —
    // diese Werte sind ein Application-Constraint, kein Datenbankinhalt.
    const ALLOWED_STATUS = ["verfügbar", "ausgeliehen", "defekt", "verschollen", "entsorgt"];

    const wrapper = document.createElement("div");

    const row = document.createElement("div");
    row.className = "editor-row";

    // H2 dient gleichzeitig als Statusanzeige und wird nach erfolgreichem
    // Speichern direkt geupdated — kein Page-Reload nötig.
    const h2 = document.createElement("h2");
    h2.textContent = item.status;
    h2.className = `status-${slug(item.status)}`;

    const editBtn = makeBtn("Status ändern", "secondary");
    row.append(h2, editBtn);
    wrapper.appendChild(row);

    // popup ist eine closure-Variable damit wir prüfen können ob es
    // gerade offen ist (nicht null) und es ggf. schließen können.
    let popup = null;

    editBtn.addEventListener("click", () => {
      // Toggle-Logik: wenn popup schon existiert, einfach entfernen
      if (popup) { popup.remove(); popup = null; return; }

      const inner = document.createElement("div");
      inner.className = "editor-row";

      const select = document.createElement("select");
      select.className = "edit-select";
      // Aktuellen Status aus den Optionen herausfiltern —
      // es wäre sinnlos "verfügbar → verfügbar" speichern zu können.
      ALLOWED_STATUS
        .filter((s) => s !== item.status)
        .forEach((s) => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          select.appendChild(opt);
        });

      const saveBtn = makeBtn("Speichern");
      const cancelBtn = makeBtn("✕", "secondary");
      inner.append(select, saveBtn, cancelBtn);

      popup = makePopup(inner);
      wrapper.appendChild(popup);

      cancelBtn.addEventListener("click", () => { popup.remove(); popup = null; });

      saveBtn.addEventListener("click", async () => {
        const newStatus = select.value;
        // Button während des Requests deaktivieren + visuelles Feedback
        saveBtn.disabled = true;
        saveBtn.textContent = "…";
        try {
          const res = await fetch("/api/edit-state.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, status: newStatus }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Fehler");

          // Erfolgreich: H2 direkt im DOM aktualisieren,
          // item.status für zukünftige Filterlogik ebenfalls updaten,
          // Popup schließen.
          h2.textContent = newStatus;
          h2.className = `status-${slug(newStatus)}`;
          item.status = newStatus;
          popup.remove();
          popup = null;
        } catch (err) {
          console.error("Status-Update fehlgeschlagen:", err);
          alert("Fehler: " + err.message);
        } finally {
          // Button immer wieder aktivieren, egal ob Erfolg oder Fehler
          saveBtn.disabled = false;
          saveBtn.textContent = "Speichern";
        }
      });
    });

    container.appendChild(wrapper);
  }

  // ── Mengen-Editor ────────────────────────────────────────────────────────
  //
  // Zeigt wie viele Einheiten eines Items gerade verfügbar sind (quantity_available)
  // im Verhältnis zur Gesamtmenge (quantity). Visualisiert als Balken + direkt
  // editierbares Number-Input + +/- Buttons.
  //
  // quantity_available kann fehlen wenn das Item frisch angelegt wurde —
  // in dem Fall wird es vom Server nachgeladen (GET edit-quantity.php).

  function buildQuantityEditor(container, item) {
    const total = parseInt(item.quantity) || 0;
    if (total <= 0) return; // Kein sinnvoller Editor ohne Gesamtmenge

    const wrapper = document.createElement("div");
    wrapper.className = "info-line info-anzahl";
    wrapper.setAttribute("data-label", "anzahl");

    // available wird als lokale Variable gehalten und bei jedem
    // erfolgreichen API-Call mit dem Server-Response-Wert synchronisiert —
    // niemals optimistisch updaten, immer auf Server-Antwort warten.
    let available = item.quantity_available != null
      ? parseInt(item.quantity_available)
      : total;

    // render() baut den gesamten Inhalt von wrapper neu auf.
    // Wird nach jedem Update aufgerufen statt nur einzelne Felder zu patchen —
    // einfacher und fehlerfreier als selektives DOM-Patching bei einem so
    // kleinen Element.
    function render() {
      wrapper.innerHTML = "";

      const row = document.createElement("div");
      row.className = "editor-row qty-row";

      const label = document.createElement("span");
      label.innerHTML = "<strong>Anzahl:</strong> ";

      // Füllstandsbalken: CSS-Custom-Property --qty-pct steuert die Breite.
      // Farbklasse wird nach Schwellenwerten vergeben (0%, ≤33%, ≤66%, >66%).
      const barWrap = document.createElement("div");
      barWrap.className = "qty-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "qty-bar";
      const pct = total > 0 ? (available / total) * 100 : 0;
      bar.style.setProperty("--qty-pct", pct + "%");
      bar.classList.add(
        pct <= 0 ? "qty-bar--empty" :
          pct <= 33 ? "qty-bar--low" :
            pct <= 66 ? "qty-bar--mid" : "qty-bar--full"
      );
      barWrap.appendChild(bar);

      // Number-Input erlaubt direktes Eintippen einer Zahl —
      // on change wird auf 0..total geclamped bevor der API-Call geht.
      // on blur resettet auf den letzten validen Wert falls der Nutzer
      // etwas Ungültiges eingetippt aber nicht bestätigt hat.
      const count = document.createElement("input");
      count.type = "number";
      count.className = "qty-count qty-count--input";
      count.value = available;
      count.min = 0;
      count.max = total;
      count.addEventListener("change", () => {
        const v = Math.max(0, Math.min(total, parseInt(count.value) || 0));
        updateQty(v);
      });
      count.addEventListener("blur", () => { count.value = available; });

      // − Button: deaktiviert wenn bereits 0 verfügbar
      const minusBtn = makeBtn("−", "secondary");
      minusBtn.className += " qty-btn";
      minusBtn.disabled = available <= 0;
      minusBtn.title = "Eines entnehmen";

      // + Button: deaktiviert wenn alles verfügbar (nichts ausgeliehen)
      const plusBtn = makeBtn("+", "secondary");
      plusBtn.className += " qty-btn";
      plusBtn.disabled = available >= total;
      plusBtn.title = "Eines zurücklegen";

      minusBtn.addEventListener("click", () => updateQty(available - 1));
      plusBtn.addEventListener("click", () => updateQty(available + 1));

      row.append(label, minusBtn, barWrap, count, plusBtn);
      wrapper.appendChild(row);
    }

    // Sendet den neuen Wert an den Server und synchronisiert danach
    // den lokalen State mit dem was der Server zurückgibt.
    // So kann der Server die Zahl z.B. noch clampen oder validieren
    // ohne dass wir aus dem Sync geraten.
    async function updateQty(newVal) {
      if (newVal < 0 || newVal > total) return;

      try {
        const res = await fetch("/api/edit-quantity.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, quantity_available: newVal }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Fehler");

        // Server-Antwort als neue Wahrheit nehmen und neu rendern
        available = json.data.quantity_available;
        item.quantity_available = available;
        render();
      } catch (err) {
        console.error("Quantity-Update fehlgeschlagen:", err);
        alert("Fehler: " + err.message);
      }
    }

    // Wenn quantity_available nicht im ursprünglichen Item-Objekt war
    // (z.B. weil die fetch_from_id API das Feld nicht immer mitliefert),
    // holen wir es separat nach. render() wird dann ein zweites Mal
    // aufgerufen — das ist okay weil wrapper noch nicht im DOM hängt
    // wenn der erste render() ausgeführt wird... oder hängt schon drin
    // wegen appendChild weiter unten, aber ein Re-render schadet nicht.
    if (item.quantity_available == null) {
      fetch(`/api/edit-quantity.php?id=${item.id}`)
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            available = json.data.quantity_available;
            item.quantity_available = available;
            render();
          }
        })
        .catch(() => { }); // Fallback: Anzeige mit total, kein Crash
    }

    render();
    container.appendChild(wrapper);
  }

  // ── Standort-Editor ──────────────────────────────────────────────────────
  //
  // Der komplexeste Editor auf der Seite: ein dreistufiger Drill-Down
  // (Raum → Schrank → Fach) der als ausklappbarer Drawer unter der
  // Standort-Anzeige erscheint.
  //
  // Die verfügbaren Locations werden erst beim ersten Öffnen geladen (lazy),
  // danach gecacht in `locations` damit kein zweiter Request nötig ist.
  //
  // Besonderheit bei Kategorie 4: Diese Kategorie steht für Räume selbst —
  // ein Raum hat keinen Standort innerhalb eines anderen Raums, deshalb
  // wird der Editor für diese Items komplett übersprungen.

  function buildLocationEditor(container, item) {

    // Kategorie 4 = Räume — die haben keinen Standort, früh raus.
    if (item.category_id == 4) return;

    const wrapper = document.createElement("div");
    wrapper.className = "info-line info-standort";
    wrapper.setAttribute("data-label", "standort");

    // ── Anzeigezeile ────────────────────────────────────────────────────────
    // Immer sichtbar: zeigt den aktuellen Standort-String + "ändern"-Button.
    // locSpan wird nach erfolgreichem Speichern direkt geupdated.
    const row = document.createElement("div");
    row.className = "editor-row";

    const labelEl = document.createElement("span");
    labelEl.innerHTML = "<strong>Standort:</strong> ";

    const locSpan = document.createElement("span");
    locSpan.className = "item-location-display THE_location";
    locSpan.textContent = formatLocation(item.location, item.location_note);

    const editBtn = makeBtn("ändern", "secondary");
    row.append(labelEl, locSpan, editBtn);
    wrapper.appendChild(row);

    // ── Drawer ──────────────────────────────────────────────────────────────
    // Der Drawer ist anfangs hidden und wird per editBtn toggle geöffnet/geschlossen.
    // Enthält alle drei Drill-Down-Schritte, die Notiz und die Aktionsbuttons.
    const drawer = document.createElement("div");
    drawer.className = "loc-drawer";
    drawer.hidden = true;
    wrapper.appendChild(drawer);

    // Schritt 1: Raum-Select
    // Wird mit allen Räumen aus der API befüllt wenn der Drawer geöffnet wird.
    const roomWrap = document.createElement("div");
    roomWrap.className = "loc-step";
    const roomLbl = document.createElement("label");
    roomLbl.textContent = "Raum";
    roomLbl.className = "edit-field__label";
    const roomSel = document.createElement("select");
    roomSel.className = "edit-select";
    roomWrap.append(roomLbl, roomSel);

    // Schritt 2: Schrank-Select
    // Erscheint erst nach Raum-Auswahl, zeigt nur Schränke im gewählten Raum.
    const schrankWrap = document.createElement("div");
    schrankWrap.className = "loc-step";
    schrankWrap.hidden = true;
    const schrankLbl = document.createElement("label");
    schrankLbl.textContent = "Schrank";
    schrankLbl.className = "edit-field__label";
    const schrankSel = document.createElement("select");
    schrankSel.className = "edit-select";
    schrankWrap.append(schrankLbl, schrankSel);

    // Schritt 3: Fach-Select
    // Erscheint erst nach Schrank-Auswahl. Wenn ein Schrank keine Fächer hat,
    // wird dieser Schritt übersprungen und die Aktionsbuttons erscheinen direkt.
    const fachWrap = document.createElement("div");
    fachWrap.className = "loc-step";
    fachWrap.hidden = true;
    const fachLbl = document.createElement("label");
    fachLbl.textContent = "Fach";
    fachLbl.className = "edit-field__label";
    const fachSel = document.createElement("select");
    fachSel.className = "edit-select";
    fachWrap.append(fachLbl, fachSel);

    // Optionale Notiz — erscheint sobald eine vollständige Location gewählt ist.
    const noteWrap = document.createElement("div");
    noteWrap.className = "loc-note-wrap";
    noteWrap.hidden = true;
    const noteLbl = document.createElement("label");
    noteLbl.textContent = "Notiz (optional)";
    noteLbl.className = "edit-field__label";
    const noteInp = makeInput("z.B. hinten links, in der Schublade…", item.location_note || "");
    noteWrap.append(noteLbl, noteInp);

    // Speichern + Abbrechen, erscheinen ebenfalls erst wenn Location vollständig
    const actions = document.createElement("div");
    actions.className = "editor-row loc-actions";
    actions.hidden = true;
    const saveBtn = makeBtn("Speichern");
    const cancelBtn = makeBtn("Abbrechen", "secondary");
    actions.append(saveBtn, cancelBtn);

    drawer.append(roomWrap, schrankWrap, fachWrap, noteWrap, actions);

    // ── State ───────────────────────────────────────────────────────────────
    // locations: flache Liste aller Standort-Einträge aus der API.
    //   Jeder Eintrag hat { id, room_id, room, schrank, fach }.
    //   Daraus leiten wir die Dropdown-Optionen ab statt separate Endpoints
    //   für Räume/Schränke/Fächer zu haben.
    // selectedId: die Location-ID des aktuell vollständig gewählten Eintrags —
    //   wird beim POST mitgeschickt.
    // loaded: Lazy-Loading-Flag, damit wir die API nur einmal anfragen.
    let locations = [];
    let selectedId = null;
    let loaded = false;

    // ── Hilfsfunktionen ─────────────────────────────────────────────────────

    // Dedupliziert ein Array und sortiert numerisch wenn möglich, sonst alphabetisch.
    // Schrank "10" soll nach Schrank "9" kommen, nicht davor (alphabetisch wäre "10" < "9").
    function uniqueSorted(arr) {
      return [...new Set(arr)].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : String(a).localeCompare(String(b));
      });
    }

    // Befüllt ein <select>-Element mit einem Placeholder + den übergebenen Optionen.
    // Placeholder ist disabled+selected damit er angezeigt wird aber nicht wählbar ist.
    function fillSelect(sel, options, placeholder) {
      sel.innerHTML = "";
      const def = document.createElement("option");
      def.value = "";
      def.textContent = placeholder;
      def.disabled = true;
      def.selected = true;
      sel.appendChild(def);
      options.forEach((val) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
      });
    }

    // Befüllt roomSel mit allen eindeutigen Räumen aus locations.
    // Benutzt room_id als option-value (stabil) und room-Name als label (lesbar).
    // Nach dem Befüllen: wenn item.location.room gesetzt ist, den passenden
    // Eintrag vorauswählen und sofort onRoomChange(false) aufrufen —
    // false = kein Reset der nachfolgenden Dropdowns, wir befüllen die durch.
    function buildRoomSelect() {
      const roomMap = new Map();
      locations.forEach((l) => {
        if (l.room_id != null) roomMap.set(String(l.room_id), l.room);
      });

      roomSel.innerHTML = "";
      const def = document.createElement("option");
      def.value = "";
      def.textContent = "— Raum wählen —";
      def.disabled = true;
      def.selected = true;
      roomSel.appendChild(def);

      roomMap.forEach((name, id) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        roomSel.appendChild(opt);
      });

      // Aktuellen Standort vorauswählen wenn vorhanden
      if (item.location?.room) {
        const currentRoomOpt = [...roomSel.options].find(
          (o) => o.textContent === item.location.room
        );
        if (currentRoomOpt) {
          roomSel.value = currentRoomOpt.value;
          onRoomChange(false);
        }
      }
    }

    // Reagiert auf Raum-Änderung: filtert locations auf den gewählten Raum,
    // extrahiert alle eindeutigen Schranknummern und befüllt schrankSel.
    // reset=true: Schrank/Fach/Notiz/Actions ausblenden (Nutzer hat neu gewählt).
    // reset=false: vorherigen Schrank vorauswählen (initiales Prefill).
    function onRoomChange(reset = true) {
      const roomId = roomSel.value;
      if (!roomId) return;

      const inRoom = locations.filter((l) => String(l.room_id) === roomId);
      const schraenke = uniqueSorted(
        inRoom.map((l) => l.schrank).filter((s) => s != null)
      );

      fillSelect(schrankSel, schraenke, "— Schrank wählen —");
      schrankWrap.hidden = false;
      // Bei Raum-Änderung alles was "tiefer" liegt zurücksetzen
      fachWrap.hidden = true;
      noteWrap.hidden = true;
      actions.hidden = true;
      selectedId = null;

      if (!reset && item.location?.schrank) {
        const match = [...schrankSel.options].find(
          (o) => o.value === item.location.schrank
        );
        if (match) {
          schrankSel.value = match.value;
          onSchrankChange(false);
        }
      }
    }

    // Reagiert auf Schrank-Änderung: filtert auf Raum + Schrank,
    // extrahiert Fächer. Wenn keine Fächer vorhanden ist dieser Schrank
    // der tiefste Punkt — Location-ID direkt aus dem ersten (einzigen) Eintrag
    // nehmen und Notiz + Actions einblenden ohne Fach-Step.
    function onSchrankChange(reset = true) {
      const roomId = roomSel.value;
      const schrank = schrankSel.value;
      if (!schrank) return;

      const inSchrank = locations.filter(
        (l) => String(l.room_id) === roomId && l.schrank === schrank
      );
      const faecher = uniqueSorted(
        inSchrank.map((l) => l.fach).filter((f) => f != null)
      );

      if (faecher.length === 0) {
        // Schrank ohne Fächer: Location ist bereits vollständig bestimmt
        fachWrap.hidden = true;
        const loc = inSchrank[0];
        selectedId = loc ? String(loc.id) : null;
        noteWrap.hidden = false;
        actions.hidden = false;
        return;
      }

      fillSelect(fachSel, faecher, "— Fach wählen —");
      fachWrap.hidden = false;
      noteWrap.hidden = true;
      actions.hidden = true;
      selectedId = null;

      if (!reset && item.location?.fach) {
        const match = [...fachSel.options].find(
          (o) => o.value === item.location.fach
        );
        if (match) {
          fachSel.value = match.value;
          onFachChange();
        }
      }
    }

    // Reagiert auf Fach-Änderung: findet den exakten Location-Eintrag
    // anhand aller drei Ebenen und speichert dessen ID in selectedId.
    // Erst jetzt sind Notiz und Actions sichtbar — der Nutzer hat alles gewählt.
    function onFachChange() {
      const roomId = roomSel.value;
      const schrank = schrankSel.value;
      const fach = fachSel.value;
      if (!fach) return;

      const loc = locations.find(
        (l) =>
          String(l.room_id) === roomId &&
          l.schrank === schrank &&
          l.fach === fach
      );
      selectedId = loc ? String(loc.id) : null;
      noteWrap.hidden = false;
      actions.hidden = false;
    }

    // ── Events ───────────────────────────────────────────────────────────────
    roomSel.addEventListener("change", () => onRoomChange(true));
    schrankSel.addEventListener("change", () => onSchrankChange(true));
    fachSel.addEventListener("change", () => onFachChange());

    // Öffnet den Drawer. Beim ersten Öffnen: Locations vom Server laden,
    // dann buildRoomSelect() aufrufen. Bei weiteren Öffnungen: nur
    // buildRoomSelect() (Daten sind gecacht in `locations`).
    async function openDrawer() {
      drawer.hidden = false;
      editBtn.textContent = "schließen";

      if (!loaded) {
        // Placeholder während des Ladens
        roomSel.innerHTML = "<option disabled selected>Lädt…</option>";
        try {
          const res = await fetch("/api/edit-location.php?action=list");
          if (!res.ok) {
            // Serverfehler: versuchen den Debug-Text aus dem JSON zu holen,
            // sonst HTTP-Status als Fallback anzeigen
            let msg = `Serverfehler ${res.status}`;
            try { const j = await res.json(); msg = j.debug || j.error || msg; } catch (_) { }
            roomSel.innerHTML = `<option disabled selected>Fehler: ${msg}</option>`;
            loaded = true;
            return;
          }
          const json = await res.json();
          if (!json.success) {
            roomSel.innerHTML = `<option disabled selected>Fehler: ${json.error}</option>`;
            loaded = true;
            return;
          }
          locations = json.data.locations ?? [];
        } catch (e) {
          // Netzwerkfehler (kein JSON, Timeout, etc.)
          roomSel.innerHTML = `<option disabled selected>Verbindungsfehler</option>`;
          loaded = true;
          return;
        }
        loaded = true;
      }

      // Notiz-Feld auf aktuellen Wert zurücksetzen und alle Folge-Steps
      // ausblenden — Nutzer fängt immer bei Raum an
      noteInp.value = item.location_note || "";
      schrankWrap.hidden = true;
      fachWrap.hidden = true;
      noteWrap.hidden = true;
      actions.hidden = true;
      buildRoomSelect();
    }

    function closeDrawer() {
      drawer.hidden = true;
      editBtn.textContent = "ändern";
    }

    editBtn.addEventListener("click", () =>
      drawer.hidden ? openDrawer() : closeDrawer()
    );

    cancelBtn.addEventListener("click", closeDrawer);

    saveBtn.addEventListener("click", async () => {
      // selectedId ist null wenn die Auswahl noch nicht vollständig ist
      // (z.B. Raum gewählt aber kein Schrank) — dann Guard-Clause.
      if (!selectedId) {
        alert("Bitte einen Standort vollständig auswählen.");
        return;
      }
      await submitLocation(
        { id: item.id, location_id: parseInt(selectedId), location_note: noteInp.value.trim() },
        locSpan, item, saveBtn, closeDrawer,
      );
    });

    container.appendChild(wrapper);
  }

  // ── Location speichern ───────────────────────────────────────────────────
  //
  // Ausgelagert aus buildLocationEditor damit es eine klare Trennung zwischen
  // "UI aufbauen" und "Daten senden" gibt.
  // Updatet nach Erfolg direkt locSpan und item.location — kein Reload.
  // btn wird während des Requests deaktiviert um Doppel-Submits zu verhindern.

  async function submitLocation(payload, locSpan, item, btn, onDone) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const res = await fetch("/api/edit-location.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Fehler");

      // Server gibt die neue Location als Objekt zurück — damit sind
      // wir sicher synchron mit dem was in der DB steht.
      item.location = json.data.location;
      item.location_note = json.data.location_note ?? null;
      locSpan.textContent = formatLocation(item.location, item.location_note);
      onDone(); // Drawer schließen
    } catch (err) {
      console.error("Location-Update fehlgeschlagen:", err);
      alert("Fehler: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

})();