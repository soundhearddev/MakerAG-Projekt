// ██╗████████╗███████╗███╗   ███╗        ██╗ ██████╗
// ██║╚══██╔══╝██╔════╝████╗ ████║        ██║██╔════╝
// ██║   ██║   █████╗  ██╔████╔██║        ██║╚█████╗ 
// ██║   ██║   ██╔══╝  ██║╚██╔╝██║   ██╗  ██║ ╚═══██╗
// ██║   ██║   ███████╗██║ ╚═╝ ██║██╗╚█████╔╝██████╔╝
// ╚═╝   ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝ ╚════╝ ╚═════╝ 

(function () {
  "use strict";

  const match = window.location.pathname.match(/\/docs\/(\d+)\//);
  const id = match ? match[1] : 17;

  // ── Hilfsfunktionen ──────────────────────────────────────────────────────

  function slug(str) {
    if (str == null && str !== 0) return "";
    return String(str).toLowerCase().trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "");
  }

  function infoLine(label, value) {
    if (!value) return null;
    const div = document.createElement("div");
    div.className = `info-line info-${slug(label)}`;
    div.setAttribute("data-label", slug(label));
    div.innerHTML = `<strong>${label}:</strong> ${value}`;
    return div;
  }

  function appendIf(el, child) {
    if (child) el.appendChild(child);
  }

  function makeBtn(label, variant = "primary") {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = `edit-btn edit-btn--${variant}`;
    return btn;
  }

  function makeInput(placeholder, value = "") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = placeholder;
    inp.value = value;
    inp.className = "edit-input";
    return inp;
  }

  function makePopup(content) {
    const popup = document.createElement("div");
    popup.className = "edit-popup";
    popup.appendChild(content);
    return popup;
  }

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

  fetch(`/api/fetch_from_id.php?id=${encodeURIComponent(id)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success || !data.data?.length) {
        document.getElementById("item-title").textContent = "Nicht gefunden";
        return;
      }

      const item = data.data[0];


      // TITEL 
      const title = item.name || `${item.brand} ${item.model}`;

      document.title = title;
      document.getElementById("item-title").textContent = title;

      // Beschreibung
      if (item.name) {
        const descEl = document.getElementById("item-description");
        if (item.brand || item.model) {
          descEl.textContent = `${item.brand ?? ""} ${item.model ?? ""}`.trim();
        }
      }

      // Status-Block
      const statusDiv = document.getElementById("status");
      statusDiv.className = "status-info";

      if (item.status) buildStatusEditor(statusDiv, item);

      if (item.item_condition) appendIf(statusDiv, infoLine(
        "Zustand",
        `<span class="condition-${slug(item.item_condition)} item-condition">${item.item_condition}</span>`,
      ));

      if (item.category_name) {
        const kat = item.parent_category
          ? `${item.parent_category} / ${item.category_name}`
          : item.category_name;
        appendIf(statusDiv, infoLine("Kategorie", `<span class="item-category">${kat}</span>`));
      }

      buildLocationEditor(statusDiv, item);

      if (item.tags?.length) appendIf(statusDiv, infoLine(
        "Tags",
        item.tags.map((t) => `<span class="item-tag">${t}</span>`).join(", "),
      ));

      if (item.serial_number) appendIf(statusDiv, infoLine(
        "Seriennummer", `<span class="item-serial">${item.serial_number}</span>`,
      ));
      if (item.quantity) appendIf(statusDiv, infoLine(
        "Anzahl", `<span class="item-quantity">${item.quantity}</span>`,
      ));
      if (item.notes) appendIf(statusDiv, infoLine(
        "Notizen", `<span class="item-notes">${item.notes}</span>`,
      ));

      // Specs
      const specsList = document.getElementById("specs-list");
      specsList.innerHTML = "";
      const { specs } = item;

      if (specs && !Array.isArray(specs) && typeof specs === "object" && Object.keys(specs).length) {
        Object.entries(specs).forEach(([key, value]) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${key}:</strong> ${value}`;
          specsList.appendChild(li);
        });
      } else if (Array.isArray(specs) && specs.length) {
        specs.forEach((spec) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${spec.key || spec.label}:</strong> ${spec.value}`;
          specsList.appendChild(li);
        });
      } else {
        specsList.closest(".container")?.style.setProperty("display", "none");
      }

      // Bilder
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
            img.addEventListener("click", () => window.open(img.src, "_blank"));
            gallery.appendChild(img);
          });
        })
        .catch(() => {
          document.getElementById("image-gallery")
            ?.closest(".container")
            ?.style.setProperty("display", "none");
        });

      // PDFs
      Promise.all([
        fetch(`/api/get_data.php?id=${id}&type=pdf`).then(r => r.json()),
        fetch(`/api/get_data.php?id=${id}&type=html`).then(r => r.json()),
      ]).then(([pdfData, htmlData]) => {
        console.log("PDF files:", pdfData.data);
        console.log("HTML files:", htmlData.data);

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
          const name = file.filename
            .replace(/\.(pdf|html?)$/i, "")
            .replace(/--\s*pdf\s*version/i, isPdf ? "-- PDF version" : "-- HTML version");
          p.innerHTML = `${file.icon} <a href="${file.path}" target="_blank">${name}</a>`;
          docsContainer.appendChild(p);
        });

      }).catch((err) => console.warn("Dokumente:", err));
    });

  // ── Status Editor ────────────────────────────────────────────────────────

  function buildStatusEditor(container, item) {
    const ALLOWED_STATUS = ["verfügbar", "ausgeliehen", "defekt", "verschollen", "entsorgt"];

    const wrapper = document.createElement("div");

    const row = document.createElement("div");
    row.className = "editor-row";

    const h2 = document.createElement("h2");
    h2.textContent = item.status;
    h2.className = `status-${slug(item.status)}`;

    const editBtn = makeBtn("Status ändern", "secondary");
    row.append(h2, editBtn);
    wrapper.appendChild(row);

    let popup = null;

    editBtn.addEventListener("click", () => {
      if (popup) { popup.remove(); popup = null; return; }

      const inner = document.createElement("div");
      inner.className = "editor-row";

      const select = document.createElement("select");
      select.className = "edit-select";
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

          h2.textContent = newStatus;
          h2.className = `status-${slug(newStatus)}`;
          item.status = newStatus;
          popup.remove();
          popup = null;
        } catch (err) {
          console.error("Status-Update fehlgeschlagen:", err);
          alert("Fehler: " + err.message);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Speichern";
        }
      });
    });

    container.appendChild(wrapper);
  }

  // ── Location Editor ──────────────────────────────────────────────────────

  function buildLocationEditor(container, item) {

    // falls website einfach nicht laden
    if (item.category_id == 4) return;

    const wrapper = document.createElement("div");
    wrapper.className = "info-line info-standort";
    wrapper.setAttribute("data-label", "standort");

    // ── Anzeigezeile ──────────────────────────────────────────────────────

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

    // ── Drawer ────────────────────────────────────────────────────────────

    const drawer = document.createElement("div");
    drawer.className = "loc-drawer";
    drawer.hidden = true;
    wrapper.appendChild(drawer);

    // Suchfeld
    const searchInp = makeInput("Raum, Schrank, Fach…");
    searchInp.className += " loc-search";

    // Location-Liste
    const listEl = document.createElement("ul");
    listEl.className = "loc-list";

    // Notiz
    const noteWrap = document.createElement("div");
    noteWrap.className = "loc-note-wrap";
    const noteLbl = document.createElement("label");
    noteLbl.textContent = "Notiz (optional)";
    noteLbl.className = "edit-field__label";
    const noteInp = makeInput("z.B. hinten links, in der Schublade…", item.location_note || "");
    noteWrap.append(noteLbl, noteInp);

    // Aktionszeile
    const actions = document.createElement("div");
    actions.className = "editor-row loc-actions";
    const saveBtn = makeBtn("Speichern");
    const cancelBtn = makeBtn("Abbrechen", "secondary");
    actions.append(saveBtn, cancelBtn);

    drawer.append(searchInp, listEl, noteWrap, actions);

    // ── State ─────────────────────────────────────────────────────────────

    let locations = [];
    let selectedId = item.location?.id ? String(item.location.id) : null;
    let loaded = false;

    function setListError(msg) {
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.className = "loc-list__empty loc-list__error";
      li.textContent = msg;
      listEl.appendChild(li);
    }

    function renderList(filter = "") {
      listEl.innerHTML = "";
      const q = filter.toLowerCase();
      const visible = q
        ? locations.filter((l) => formatLocation(l).toLowerCase().includes(q))
        : locations;

      if (!visible.length) {
        const empty = document.createElement("li");
        empty.className = "loc-list__empty";
        empty.textContent = filter ? "Keine Treffer" : "Keine Locations vorhanden";
        listEl.appendChild(empty);
        return;
      }

      visible.forEach((loc) => {
        const li = document.createElement("li");
        li.className = "loc-list__item";
        li.dataset.id = loc.id;
        li.textContent = formatLocation(loc);
        if (String(loc.id) === selectedId) li.classList.add("is-selected");
        li.addEventListener("click", () => {
          listEl.querySelectorAll(".loc-list__item").forEach((el) => el.classList.remove("is-selected"));
          li.classList.add("is-selected");
          selectedId = String(loc.id);
        });
        listEl.appendChild(li);
      });
    }

    async function openDrawer() {
      drawer.hidden = false;
      editBtn.textContent = "schließen";

      if (!loaded) {
        listEl.innerHTML = "<li class='loc-list__empty'>Lädt…</li>";
        try {
          const res = await fetch("/api/edit-location.php?action=list");

          // Nicht-2xx abfangen bevor .json() aufgerufen wird
          if (!res.ok) {
            let errMsg = `Serverfehler ${res.status}`;
            try {
              const errJson = await res.json();
              // API_DEBUG liefert debug-Feld mit Datenbankfehler
              errMsg = errJson.debug || errJson.error || errMsg;
            } catch (_) { /* Response war kein JSON */ }
            setListError(`Fehler: ${errMsg}`);
            loaded = true; // nicht nochmal versuchen bis Seite neu geladen wird
            return;
          }

          const json = await res.json();
          if (!json.success) {
            setListError(`Fehler: ${json.error || "Unbekannter Fehler"}`);
            loaded = true;
            return;
          }
          locations = json.data.locations ?? [];
        } catch (e) {
          console.warn("Locations konnten nicht geladen werden", e);
          setListError("Verbindungsfehler beim Laden der Standorte.");
          loaded = true;
          return;
        }
        loaded = true;
      }

      noteInp.value = item.location_note || "";
      renderList(searchInp.value);
    }

    function closeDrawer() {
      drawer.hidden = true;
      editBtn.textContent = "ändern";
      searchInp.value = "";
    }

    // ── Events ────────────────────────────────────────────────────────────

    editBtn.addEventListener("click", () =>
      drawer.hidden ? openDrawer() : closeDrawer()
    );

    searchInp.addEventListener("input", () => renderList(searchInp.value));

    cancelBtn.addEventListener("click", closeDrawer);

    saveBtn.addEventListener("click", async () => {
      if (!selectedId) {
        alert("Bitte einen Standort auswählen.");
        return;
      }
      await submitLocation(
        {
          id: item.id,
          location_id: parseInt(selectedId),
          location_note: noteInp.value.trim(),
        },
        locSpan, item, saveBtn,
        closeDrawer,
      );
    });

    container.appendChild(wrapper);
  }

  // ── Location speichern ───────────────────────────────────────────────────

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

      item.location = json.data.location;
      item.location_note = json.data.location_note ?? null;
      locSpan.textContent = formatLocation(item.location, item.location_note);
      onDone();
    } catch (err) {
      console.error("Location-Update fehlgeschlagen:", err);
      alert("Fehler: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

})();