// ...existing code...
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

            Was jetzt nicht nagezeigt wird ist dass data.data[0] entpricht. Also all diese Daten in eintrag [0] sind. Um also auf diese Daten zuzugreifen, muss man den Eintrag [0] aus dem Array nehmen. 

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

            let h2 = null;

            if (item.status) {
                h2 = document.createElement("h2");
                h2.textContent = item.status;
                h2.className = `status-${slug(item.status)}`;
                statusDiv.appendChild(h2);
            }

            if (item.item_condition) {
                const cond = slug(item.item_condition);
                appendIf(statusDiv, infoLine("Zustand", `<span class="condition-${cond}">${item.item_condition}</span>`));
            }

            // Kategorie
            if (item.category_name) {
                const kat = item.parent_category
                    ? `${item.parent_category} / ${item.category_name}`
                    : item.category_name;
                appendIf(statusDiv, infoLine("Kategorie", kat));
            }

            // Standort aus location-Objekt
            if (item.location) {
                const loc = item.location;
                const parts = [
                    loc.room ? `Raum ${loc.room}` : null,
                    loc.schrank ? `Schrank ${loc.schrank}` : null,
                    loc.regal ? `Regal ${loc.regal}` : null,
                    loc.position ? `Position ${loc.position}` : null,
                ].filter(Boolean).join(", ");
                if (parts) {
                    appendIf(statusDiv, infoLine("Standort", parts));
                }
                
                // Separate div für Schrank/Regal mit CLASS
                const cabinetParts = [
                    loc.schrank ? `Schrank ${loc.schrank}` : null,
                    loc.regal ? `Regal ${loc.regal}` : null,
                ].filter(Boolean).join(", ");
                
                if (cabinetParts) {
                    const div = document.createElement("div");
                    div.className = "THE_location";
                    div.innerHTML = cabinetParts;
                    statusDiv.appendChild(div);
                }
            }

            // Tags (Array)
            if (item.tags && item.tags.length > 0) {
                appendIf(statusDiv, infoLine("Tags", item.tags.join(", ")));
            }

            // Seriennummer
            if (item.serial_number) {
                appendIf(statusDiv, infoLine("Seriennummer", item.serial_number));
            }

            // Anzahl
            if (item.quantity) {
                appendIf(statusDiv, infoLine("Anzahl", item.quantity));
            }

            if (item.notes) {
                appendIf(statusDiv, infoLine("Notizen", item.notes));
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

            // Bilder
            fetch(`/api/list_files.php?path=${encodeURIComponent("docs/" + id + "/images/")}&type=image`)
                .then(res => res.json())
                .then(imgData => {
                    const gallery = document.getElementById("image-gallery");
                    const files = (imgData.files || []).filter(f => !/thumb/i.test(f));

                    if (files.length === 0) {
                        const c = gallery.closest(".container");
                        if (c) c.style.display = "none";
                        return;
                    }

                    files.forEach((filename, i) => {
                        const img = document.createElement("img");
                        img.src = `/docs/${id}/images/${filename}`;
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

            // PDFs
            fetch(`/api/list_files.php?path=${encodeURIComponent("docs/" + id + "/pdf/")}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.files || data.files.length === 0) return;

                    const docsContainer = document.getElementById("docs-container");
                    const heading = document.createElement("p");
                    heading.innerHTML = "<strong>Dokumente:</strong>";
                    docsContainer.appendChild(heading);

                    data.files.forEach(filename => {
                        const url = `/docs/${id}/pdf/${encodeURIComponent(filename)}`;
                        const label = filename.replace(/\.pdf$/i, "");
                        const p = document.createElement("p");
                        p.innerHTML = `📄 <a href="${url}" target="_blank">${label}</a>`;
                        docsContainer.appendChild(p);
                    });
                })
                .catch(err => console.warn("PDF-Liste:", err));
        })
})();
