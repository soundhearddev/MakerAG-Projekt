



(function () {

    const match = window.location.pathname.match(/\/docs\/(\d+)\//);
    const id = match ? match[1] : 17;

    //debug 
    // console.log("ID:", id);

    // Hilfs-Funktion: Slug für CSS-Klassen
    function slug(str) {
        if (!str && str !== 0) return '';
        return String(str).toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-_]/g, '');
    }

    // diese Funktion erstellt eine Info-Zeile als DIV mit passenden Klassen und data-label
    function infoLine(label, value) {
        if (!value) return null;
        const labelClass = slug(label);
        const div = document.createElement("div");
        div.className = `info-line info-${labelClass}`;
        div.setAttribute("data-label", labelClass);
        div.innerHTML = `<strong>${label}:</strong> ${value}`;
        return div;
    }

    function appendIf(el, child) {
        if (child) el.appendChild(child);
    }


    // ── 1. Item-Daten laden ──────────────────────────────────────────────────

    fetch(`/api/fetch_from_id.php?id=${encodeURIComponent(id)}`)
        .then(res => res.json())
        .then(data => {
            //debug
            //console.log("API Response:", data);


            // Error Handling
            if (!data.success || !data.data || data.data.length === 0) {
                document.getElementById("item-title").textContent = "Nicht gefunden";
                return;
            }



            /* die API gibt einen Array zurück:
            {
                "success": true,
                "count": 1,
                "data": [
                    {
                        "id": 17,
                        "name": "FUJITSU SIEMENS Laptop",
                        ... usw. 
                    }
                ]
            }

            Was jetzt nicht gezeigt wird ist dass data.data[0] entpricht. Also all diese Daten in eintrag [0] sind. Um also auf diese Daten zuzugreifen, muss man den Eintrag [0] aus dem Array nehmen. 

            "console.log("API Response:", data);" hat da sehr geholfen 
            
            */
            const item = data.data[0];

            // Seitentitel
            if (item.category_id == 4) {
                document.title = item.name || item.model;
                document.getElementById("item-title").textContent = item.name || item.model;
            } else {
                document.title = `${item.brand} ${item.model}`;
                document.getElementById("item-title").textContent = `${item.brand} ${item.model}`;
            }

            // Beschreibung (name als Untertitel, falls vorhanden)
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




            // Status / Meta-Infos
            const statusDiv = document.getElementById("status");
            statusDiv.className = "status-info";

            if (item.status) {
                const ALLOWED_STATUS = ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'];

                // h2 + Button nebeneinander
                const statusHeader = document.createElement('div');
                statusHeader.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

                const h2 = document.createElement("h2");
                h2.textContent = item.status;
                h2.className = `status-${slug(item.status)}`;

                const changeStatusBtn = document.createElement("button");
                changeStatusBtn.textContent = "Status ändern";

                statusHeader.appendChild(h2);
                statusHeader.appendChild(changeStatusBtn);
                statusDiv.appendChild(statusHeader);

                // Dropdown-Zeile (wird beim Klick eingefügt)
                const statusPopup = document.createElement('div');
                statusPopup.id = 'status-popup';
                statusPopup.style.cssText = 'display: none; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap;';

                const select = document.createElement('select');
                select.id = 'status-select-popup';

                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = 'Speichern';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '✕';
                cancelBtn.style.cssText = 'background: transparent; color: gray;';

                statusPopup.appendChild(select);
                statusPopup.appendChild(confirmBtn);
                statusPopup.appendChild(cancelBtn);
                statusDiv.appendChild(statusPopup);

                // Toggle Dropdown
                changeStatusBtn.addEventListener("click", () => {
                    const isOpen = statusPopup.style.display === 'flex';
                    if (isOpen) {
                        statusPopup.style.display = 'none';
                        return;
                    }
                    // Optionen neu befüllen (aktuellen Status ausschließen)
                    select.innerHTML = ALLOWED_STATUS
                        .filter(s => s !== item.status)
                        .map(s => `<option value="${s}">${s}</option>`)
                        .join('');
                    statusPopup.style.display = 'flex';
                });

                cancelBtn.addEventListener('click', () => {
                    statusPopup.style.display = 'none';
                });

                confirmBtn.addEventListener('click', async () => {
                    const newStatus = select.value;
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = '...';
                    try {
                        const res = await fetch('/api/edit-state.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id, status: newStatus }),
                        });
                        const json = await res.json();
                        if (!json.success) throw new Error(json.error || 'Fehler');

                        // UI aktualisieren
                        h2.textContent = newStatus;
                        h2.className = `status-${slug(newStatus)}`;
                        item.status = newStatus;
                        statusPopup.style.display = 'none';
                    } catch (err) {
                        console.error('Status-Update fehlgeschlagen:', err);
                        alert('Fehler: ' + err.message);
                    } finally {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Speichern';
                    }
                });
            }

            if (item.item_condition) {
                const cond = slug(item.item_condition);
                appendIf(statusDiv, infoLine("Zustand", `<span class="condition-${cond} item-condition">${item.item_condition}</span>`));
            }


            // Kategorie
            if (item.category_name) {
                const kat = item.parent_category
                    ? `${item.parent_category} / ${item.category_name}`
                    : item.category_name;
                appendIf(statusDiv, infoLine("Kategorie", `<span class="item-category">${kat}</span>`));
            }

            // Standort aus location-Objekt
            if (item.location) {
                const loc = item.location;
                const parts = [
                    loc.room ? `<span class="THE_location location-room">Raum ${loc.room}</span>` : null,
                    loc.schrank ? `<span class="THE_location location-schrank">Schrank ${loc.schrank}</span>` : null,
                    loc.regal ? `<span class="THE_location location-regal">Regal ${loc.regal}</span>` : null,
                    loc.position ? `<span class="THE_location location-position">Position ${loc.position}</span>` : null,
                ].filter(Boolean).join(", ");

                if (parts) {
                    appendIf(statusDiv, infoLine("Standort", parts));
                }
            }

            // Tags (Array)
            if (item.tags && item.tags.length > 0) {
                const tagSpans = item.tags.map(t => `<span class="item-tag">${t}</span>`).join(", ");
                appendIf(statusDiv, infoLine("Tags", tagSpans));
            }

            // Seriennummer
            if (item.serial_number) {
                appendIf(statusDiv, infoLine("Seriennummer", `<span class="item-serial">${item.serial_number}</span>`));
            }

            // Anzahl
            if (item.quantity) {
                appendIf(statusDiv, infoLine("Anzahl", `<span class="item-quantity">${item.quantity}</span>`));
            }

            // Notizen
            if (item.notes) {
                appendIf(statusDiv, infoLine("Notizen", `<span class="item-notes">${item.notes}</span>`));
            }

            // Specs (dynamisch aus Objekt oder Array)
            const specsList = document.getElementById("specs-list");
            specsList.innerHTML = "";

            const specs = item.specs;

            if (specs && typeof specs === 'object' && !Array.isArray(specs) && Object.keys(specs).length > 0) {
                // Objekt: { Prozessor: "...", Grafikkarte: "..." }
                Object.entries(specs).forEach(([key, value]) => {
                    const li = document.createElement("li");
                    li.innerHTML = `<strong>${key}:</strong> ${value}`;
                    specsList.appendChild(li);
                });
            } else if (Array.isArray(specs) && specs.length > 0) {
                // Array: [{ label: "...", value: "..." }]
                specs.forEach(spec => {
                    const li = document.createElement("li");
                    li.innerHTML = `<strong>${spec.key || spec.label}:</strong> ${spec.value}`;
                    specsList.appendChild(li);
                });
            } else {
                // falls keine specs dann den ganzen container entfernen:
                const c = specsList.closest(".container");
                if (c) c.style.display = "none";
            }

            // ── Bilder ───────────────────────────────────────────────────────
            fetch(`/api/get_data.php?id=${id}&type=image`)
                .then(res => res.json())
                .then(imgData => {
                    const gallery = document.getElementById("image-gallery");
                    // thumb-Dateien rausfiltern
                    const files = (imgData.data || []).filter(f => !/thumb/i.test(f.filename));

                    if (files.length === 0) {
                        const c = gallery.closest(".container");
                        if (c) c.style.display = "none";
                        return;
                    }

                    files.forEach((file, i) => {
                        const img = document.createElement("img");
                        img.src = file.path;
                        img.alt = `Bild ${i + 1}`;
                        img.style.cssText = "height:300px; cursor:pointer; border-radius:4px;";
                        img.addEventListener("click", () => window.open(img.src, "_blank"));
                        gallery.appendChild(img);
                    });
                })
                .catch(() => {
                    const g = document.getElementById("image-gallery");
                    if (g && g.closest(".container")) g.closest(".container").style.display = "none";
                });

            // ── PDFs ─────────────────────────────────────────────────────────
            fetch(`/api/get_data.php?id=${id}&type=pdf`)
                .then(res => res.json())
                .then(pdfData => {
                    const files = pdfData.data || [];
                    if (files.length === 0) return;

                    const docsContainer = document.getElementById("docs-container");
                    const heading = document.createElement("p");
                    heading.innerHTML = "<strong>Dokumente:</strong>";
                    docsContainer.appendChild(heading);

                    files.forEach(file => {
                        const p = document.createElement("p");
                        p.innerHTML = `📄 <a href="${file.path}" target="_blank">${file.filename.replace(/\.pdf$/i, "")}</a>`;
                        docsContainer.appendChild(p);
                    });
                })
                .catch(err => console.warn("PDF-Liste:", err));
        })
})();