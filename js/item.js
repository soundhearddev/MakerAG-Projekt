// ██╗████████╗███████╗███╗░░░███╗░░░░░░░░██╗░██████╗
// ██║╚══██╔══╝██╔════╝████╗░████║░░░░░░░░██║██╔════╝
// ██║░░░██║░░░█████╗░░██╔████╔██║░░░░░░░░██║╚█████╗░
// ██║░░░██║░░░██╔══╝░░██║╚██╔╝██║░░░██╗░░██║░╚═══██╗
// ██║░░░██║░░░███████╗██║░╚═╝░██║██╗╚█████╔╝██████╔╝
// ╚═╝░░░╚═╝░░░╚══════╝╚═╝░░░░░╚═╝╚═╝░╚════╝░╚═════╝░

(function () {
  const match = window.location.pathname.match(/\/docs\/(\d+)\//);
  const id = match ? match[1] : 17;

  // ── Hilfsfunktionen ──────────────────────────────────────────────────────

  function slug(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .toLowerCase()
      .trim()
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

  function makePopup(content) {
    const popup = document.createElement("div");
    popup.className = "edit-popup";
    popup.style.cssText =
      "margin-top:8px; padding:10px; background:var(--cat-secondary,#222); border-radius:6px;";
    popup.appendChild(content);
    return popup;
  }

  function makeBtn(label, variant = "primary") {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (variant === "secondary")
      btn.style.cssText =
        "background:transparent; color:gray; border:1px solid gray;";
    return btn;
  }

  function makeInput(placeholder, value = "") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = placeholder;
    inp.value = value;
    inp.style.cssText =
      "width:100%; padding:4px 6px; border-radius:4px; border:1px solid #555; background:var(--cat-primary,#333); color:inherit; box-sizing:border-box;";
    return inp;
  }

  function formatLocation(loc, note) {
    const parts = [];
    if (loc) {
      if (loc.room) parts.push(`Raum ${loc.room}`);
      if (loc.schrank) parts.push(`Schrank ${loc.schrank}`);
      if (loc.regal) parts.push(`Regal ${loc.regal}`);
      if (loc.position) parts.push(loc.position);
    }
    if (note) parts.push(`(${note})`);
    return parts.length ? parts.join(", ") : "—";
  }

  // ── Item laden ───────────────────────────────────────────────────────────

  fetch(`/api/fetch_from_id.php?id=${encodeURIComponent(id)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success || !data.data || data.data.length === 0) {
        document.getElementById("item-title").textContent = "Nicht gefunden";
        return;
      }

      const item = data.data[0];

      // Titel
      const title =
        item.category_id == 4
          ? item.name || item.model
          : `${item.brand} ${item.model}`;
      document.title = title;
      document.getElementById("item-title").textContent = title;

      // Beschreibung
      if (item.name) {
        const descEl = document.getElementById("item-description");
        if (item.category_id == 4 && item.brand) {
          const a = document.createElement("a");
          a.href = item.brand;
          a.target = "_blank";
          a.textContent = item.name;
          descEl.appendChild(a);
        } else {
          descEl.textContent = item.name;
        }
      }

      const statusDiv = document.getElementById("status");
      statusDiv.className = "status-info";

      if (item.status) buildStatusEditor(statusDiv, item);

      if (item.item_condition)
        appendIf(
          statusDiv,
          infoLine(
            "Zustand",
            `<span class="condition-${slug(item.item_condition)} item-condition">${item.item_condition}</span>`,
          ),
        );

      if (item.category_name) {
        const kat = item.parent_category
          ? `${item.parent_category} / ${item.category_name}`
          : item.category_name;
        appendIf(
          statusDiv,
          infoLine("Kategorie", `<span class="item-category">${kat}</span>`),
        );
      }

      buildLocationEditor(statusDiv, item);

      if (item.tags?.length)
        appendIf(
          statusDiv,
          infoLine(
            "Tags",
            item.tags
              .map((t) => `<span class="item-tag">${t}</span>`)
              .join(", "),
          ),
        );

      if (item.serial_number)
        appendIf(
          statusDiv,
          infoLine(
            "Seriennummer",
            `<span class="item-serial">${item.serial_number}</span>`,
          ),
        );
      if (item.quantity)
        appendIf(
          statusDiv,
          infoLine(
            "Anzahl",
            `<span class="item-quantity">${item.quantity}</span>`,
          ),
        );
      if (item.notes)
        appendIf(
          statusDiv,
          infoLine("Notizen", `<span class="item-notes">${item.notes}</span>`),
        );

      // Specs
      const specsList = document.getElementById("specs-list");
      specsList.innerHTML = "";
      const specs = item.specs;

      if (
        specs &&
        !Array.isArray(specs) &&
        typeof specs === "object" &&
        Object.keys(specs).length
      ) {
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
          const files = (imgData.data || []).filter(
            (f) => !/thumb/i.test(f.filename),
          );
          if (!files.length) {
            gallery.closest(".container")?.style.setProperty("display", "none");
            return;
          }
          files.forEach((file, i) => {
            const img = document.createElement("img");
            img.src = file.path;
            img.alt = `Bild ${i + 1}`;
            img.style.cssText =
              "height:300px; cursor:pointer; border-radius:4px;";
            img.addEventListener("click", () => window.open(img.src, "_blank"));
            gallery.appendChild(img);
          });
        })
        .catch(() =>
          document
            .getElementById("image-gallery")
            ?.closest(".container")
            ?.style.setProperty("display", "none"),
        );

      // PDFs
      fetch(`/api/get_data.php?id=${id}&type=pdf`)
        .then((res) => res.json())
        .then((pdfData) => {
          const files = pdfData.data || [];
          if (!files.length) return;
          const docsContainer = document.getElementById("docs-container");
          const heading = document.createElement("p");
          heading.innerHTML = "<strong>Dokumente:</strong>";
          docsContainer.appendChild(heading);
          files.forEach((file) => {
            const p = document.createElement("p");
            p.innerHTML = `📄 <a href="${file.path}" target="_blank">${file.filename.replace(/\.pdf$/i, "")}</a>`;
            docsContainer.appendChild(p);
          });
        })
        .catch((err) => console.warn("PDF-Liste:", err));
    });

  // ── Status Editor ────────────────────────────────────────────────────────

  function buildStatusEditor(container, item) {
    const ALLOWED_STATUS = [
      "verfügbar",
      "ausgeliehen",
      "defekt",
      "verschollen",
      "entsorgt",
    ];
    const wrapper = document.createElement("div");

    const row = document.createElement("div");
    row.style.cssText =
      "display:flex; align-items:center; gap:10px; flex-wrap:wrap;";

    const h2 = document.createElement("h2");
    h2.textContent = item.status;
    h2.className = `status-${slug(item.status)}`;

    const editBtn = makeBtn("Status ändern", "secondary");
    row.append(h2, editBtn);
    wrapper.appendChild(row);

    let popup = null;

    editBtn.addEventListener("click", () => {
      if (popup) {
        popup.remove();
        popup = null;
        return;
      }

      const inner = document.createElement("div");
      inner.style.cssText =
        "display:flex; gap:6px; align-items:center; flex-wrap:wrap;";

      const select = document.createElement("select");
      ALLOWED_STATUS.filter((s) => s !== item.status).forEach((s) => {
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

      cancelBtn.addEventListener("click", () => {
        popup.remove();
        popup = null;
      });

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
    const wrapper = document.createElement("div");
    wrapper.className = "info-line info-standort";
    wrapper.setAttribute("data-label", "standort");

    const row = document.createElement("div");
    row.style.cssText =
      "display:flex; align-items:center; gap:10px; flex-wrap:wrap;";

    const labelEl = document.createElement("span");
    labelEl.innerHTML = "<strong>Standort:</strong> ";

    const locSpan = document.createElement("span");
    locSpan.className = "item-location-display";
    locSpan.textContent = formatLocation(item.location, item.location_note);

    const editBtn = makeBtn("Ort ändern", "secondary");
    row.append(labelEl, locSpan, editBtn);
    wrapper.appendChild(row);

    let popup = null;

    editBtn.addEventListener("click", async () => {
      if (popup) {
        popup.remove();
        popup = null;
        return;
      }

      let locations = [];
      try {
        const res = await fetch("/api/edit-location.php?action=list");
        const json = await res.json();
        locations = json.success ? json.data.locations : [];
      } catch (e) {
        console.warn("Locations konnten nicht geladen werden", e);
      }

      const inner = document.createElement("div");
      inner.style.cssText =
        "display:flex; flex-direction:column; gap:10px; min-width:280px;";

      // Tab-Bar
      const tabBar = document.createElement("div");
      tabBar.style.cssText = "display:flex; gap:6px;";
      const tabExisting = makeBtn("Bestehend", "secondary");
      const tabNew = makeBtn("Neu erfassen", "secondary");
      tabBar.append(tabExisting, tabNew);
      inner.appendChild(tabBar);

      // ── Tab: Bestehend ────────────────────────────────────────────
      const existingArea = document.createElement("div");
      existingArea.style.cssText =
        "display:flex; flex-direction:column; gap:8px;";

      if (!locations.length) {
        existingArea.textContent = "Keine Locations in der DB.";
      } else {
        const select = document.createElement("select");
        select.style.width = "100%";
        locations.forEach((loc) => {
          const opt = document.createElement("option");
          opt.value = loc.id;
          opt.textContent = formatLocation(loc);
          if (item.location && String(loc.id) === String(item.location.id))
            opt.selected = true;
          select.appendChild(opt);
        });

        const noteWrap = document.createElement("div");
        noteWrap.style.cssText =
          "display:flex; flex-direction:column; gap:2px;";
        const noteLbl = document.createElement("label");
        noteLbl.textContent = "Location Note";
        noteLbl.style.fontSize = "0.85em";
        const noteInp = makeInput(
          "z.B. hinten links, in der Schublade…",
          item.location_note || "",
        );
        noteWrap.append(noteLbl, noteInp);

        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex; gap:6px;";
        const saveBtn = makeBtn("Speichern");
        const cancelBtn = makeBtn("✕", "secondary");
        btnRow.append(saveBtn, cancelBtn);

        existingArea.append(select, noteWrap, btnRow);

        cancelBtn.addEventListener("click", () => {
          popup.remove();
          popup = null;
        });
        saveBtn.addEventListener("click", async () => {
          await submitLocation(
            {
              id: item.id,
              location_id: parseInt(select.value),
              location_note: noteInp.value.trim(),
            },
            locSpan,
            item,
            saveBtn,
            popup,
            () => {
              popup = null;
            },
          );
        });
      }

      // ── Tab: Neu erfassen ─────────────────────────────────────────
      const newArea = document.createElement("div");
      newArea.style.cssText = "display:none; flex-direction:column; gap:8px;";

      const newFields = [
        { key: "room", label: "Raum", placeholder: "z.B. EG" },
        { key: "schrank", label: "Schrank", placeholder: "z.B. S oder 3" },
        { key: "regal", label: "Regal", placeholder: "z.B. 2" },
        { key: "position", label: "Position", placeholder: "z.B. links oben" },
        {
          key: "note",
          label: "Location Note",
          placeholder: "z.B. hinten links, in der Schublade…",
        },
      ];

      const inputs = {};
      newFields.forEach((f) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex; flex-direction:column; gap:2px;";
        const lbl = document.createElement("label");
        lbl.textContent = f.label;
        lbl.style.fontSize = "0.85em";
        const inp = makeInput(f.placeholder);
        inputs[f.key] = inp;
        wrap.append(lbl, inp);
        newArea.appendChild(wrap);
      });

      const btnRowNew = document.createElement("div");
      btnRowNew.style.cssText = "display:flex; gap:6px;";
      const saveNew = makeBtn("Anlegen & Speichern");
      const cancelNew = makeBtn("✕", "secondary");
      btnRowNew.append(saveNew, cancelNew);
      newArea.appendChild(btnRowNew);

      cancelNew.addEventListener("click", () => {
        popup.remove();
        popup = null;
      });
      saveNew.addEventListener("click", async () => {
        const payload = {
          id: item.id,
          room: inputs.room.value.trim(),
          schrank: inputs.schrank.value.trim(),
          regal: inputs.regal.value.trim(),
          position: inputs.position.value.trim(),
          location_note: inputs.note.value.trim(),
        };
        if (!payload.room && !payload.schrank && !payload.regal) {
          alert("Mindestens Raum, Schrank oder Regal angeben.");
          return;
        }
        await submitLocation(payload, locSpan, item, saveNew, popup, () => {
          popup = null;
        });
      });

      // Tab-Logik
      function showTab(which) {
        existingArea.style.display = which === "existing" ? "flex" : "none";
        newArea.style.display = which === "new" ? "flex" : "none";
        tabExisting.style.opacity = which === "existing" ? "1" : "0.5";
        tabNew.style.opacity = which === "new" ? "1" : "0.5";
      }

      tabExisting.addEventListener("click", () => showTab("existing"));
      tabNew.addEventListener("click", () => showTab("new"));
      showTab("existing");

      inner.append(existingArea, newArea);
      popup = makePopup(inner);
      wrapper.appendChild(popup);
    });

    container.appendChild(wrapper);
  }

  // ── Location speichern ───────────────────────────────────────────────────

  async function submitLocation(payload, locSpan, item, btn, popup, onDone) {
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
      popup.remove();
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
