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
          descEl.textContent = `Modell: ${item.brand ?? ""} ${item.model ?? ""}`.trim();
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
  function buildLocationEditor(container, item) {

    if (item.category_id == 4) return;

    const wrapper = document.createElement("div");
    wrapper.className = "info-line info-standort";
    wrapper.setAttribute("data-label", "standort");

    // ── Anzeigezeile ────────────────────────────────────────────────────────
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
    const drawer = document.createElement("div");
    drawer.className = "loc-drawer";
    drawer.hidden = true;
    wrapper.appendChild(drawer);

    // Schritt 1: Raum
    const roomWrap = document.createElement("div");
    roomWrap.className = "loc-step";
    const roomLbl = document.createElement("label");
    roomLbl.textContent = "Raum";
    roomLbl.className = "edit-field__label";
    const roomSel = document.createElement("select");
    roomSel.className = "edit-select";
    roomWrap.append(roomLbl, roomSel);

    // Schritt 2: Schrank
    const schrankWrap = document.createElement("div");
    schrankWrap.className = "loc-step";
    schrankWrap.hidden = true;
    const schrankLbl = document.createElement("label");
    schrankLbl.textContent = "Schrank";
    schrankLbl.className = "edit-field__label";
    const schrankSel = document.createElement("select");
    schrankSel.className = "edit-select";
    schrankWrap.append(schrankLbl, schrankSel);

    // Schritt 3: Fach
    const fachWrap = document.createElement("div");
    fachWrap.className = "loc-step";
    fachWrap.hidden = true;
    const fachLbl = document.createElement("label");
    fachLbl.textContent = "Fach";
    fachLbl.className = "edit-field__label";
    const fachSel = document.createElement("select");
    fachSel.className = "edit-select";
    fachWrap.append(fachLbl, fachSel);

    // Notiz
    const noteWrap = document.createElement("div");
    noteWrap.className = "loc-note-wrap";
    noteWrap.hidden = true;
    const noteLbl = document.createElement("label");
    noteLbl.textContent = "Notiz (optional)";
    noteLbl.className = "edit-field__label";
    const noteInp = makeInput("z.B. hinten links, in der Schublade…", item.location_note || "");
    noteWrap.append(noteLbl, noteInp);

    // Aktionszeile
    const actions = document.createElement("div");
    actions.className = "editor-row loc-actions";
    actions.hidden = true;
    const saveBtn = makeBtn("Speichern");
    const cancelBtn = makeBtn("Abbrechen", "secondary");
    actions.append(saveBtn, cancelBtn);

    drawer.append(roomWrap, schrankWrap, fachWrap, noteWrap, actions);

    // ── State ───────────────────────────────────────────────────────────────
    let locations = [];
    let selectedId = null;
    let loaded = false;

    // ── Hilfsfunktionen ─────────────────────────────────────────────────────

    function uniqueSorted(arr) {
      return [...new Set(arr)].sort((a, b) => {
        // numerisch wenn möglich, sonst alphabetisch
        const na = parseFloat(a), nb = parseFloat(b);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : String(a).localeCompare(String(b));
      });
    }

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

    function buildRoomSelect() {
      // Räume aus den geladenen locations ableiten (id + name)
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

      // Aktuellen Raum vorauswählen
      if (item.location?.room) {
        const currentRoomOpt = [...roomSel.options].find(
          (o) => o.textContent === item.location.room
        );
        if (currentRoomOpt) {
          roomSel.value = currentRoomOpt.value;
          onRoomChange(false); // Schrank befüllen ohne Reset
        }
      }
    }

    function onRoomChange(reset = true) {
      const roomId = roomSel.value;
      if (!roomId) return;

      const inRoom = locations.filter((l) => String(l.room_id) === roomId);
      const schraenke = uniqueSorted(
        inRoom.map((l) => l.schrank).filter((s) => s != null)
      );

      fillSelect(schrankSel, schraenke, "— Schrank wählen —");
      schrankWrap.hidden = false;
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
        // Kein Fach vorhanden → Location direkt über Schrank wählen
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

    async function openDrawer() {
      drawer.hidden = false;
      editBtn.textContent = "schließen";

      if (!loaded) {
        roomSel.innerHTML = "<option disabled selected>Lädt…</option>";
        try {
          const res = await fetch("/api/edit-location.php?action=list");
          if (!res.ok) {
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
          // room_id aus den location-Objekten fehlt im aktuellen GET — siehe Hinweis unten
          locations = json.data.locations ?? [];
        } catch (e) {
          roomSel.innerHTML = `<option disabled selected>Verbindungsfehler</option>`;
          loaded = true;
          return;
        }
        loaded = true;
      }

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

})();