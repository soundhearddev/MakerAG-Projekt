(function () {

    const match = window.location.pathname.match(/\/docs\/(\d+)\//);
    const id = match ? match[1] : 17;

    console.log("ID:", id);

    // ── Hilfsfunktionen ─────────────────────────────────────

    function specItem(label, value) {
        if (!value) return null;
        const li = document.createElement("li");
        li.innerHTML = `<strong>${label}:</strong> ${value}`;
        return li;
    }

    function infoLine(label, value) {
        if (!value) return null;
        const p = document.createElement("p");
        p.innerHTML = `<strong>${label}:</strong> ${value}`;
        return p;
    }

    function appendAll(parent, elements) {
        elements.forEach(el => el && parent.appendChild(el));
    }

    function makePdfBlock(label, url) {
        const wrapper = document.createElement("p");
        wrapper.innerHTML = `<a href="${url}" target="_blank">${label}</a>`;
        return wrapper;
    }

    // ── 1. Item-Daten laden ──────────────────────────────────────────────────

    fetch(`/api/fetch_from_id.php?id=${encodeURIComponent(id)}`)
        .then(res => res.json())
        .then(data => {
            console.log("API Response:", data);

            if (!data.success || !data.data || data.data.length === 0) {
                document.getElementById("item-title").textContent = "Nicht gefunden";
                return;
            }

            const item = data.data[0];

            // Seitentitel
            document.title = `${item.brand} ${item.model}`;
            document.getElementById("item-title").textContent = `${item.brand} ${item.model}`;

            // Beschreibung (name als Untertitel, falls vorhanden)
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

            if (item.status) {
                const h = document.createElement("h2");
                h.textContent = item.status;
                statusDiv.appendChild(h);
            }

            if (item.item_condition) {
                statusDiv.appendChild(infoLine("Zustand", item.item_condition));
            }

            // Kategorie
            if (item.category_name) {
                const kat = item.parent_category
                    ? `${item.parent_category} / ${item.category_name}`
                    : item.category_name;
                statusDiv.appendChild(infoLine("Kategorie", kat));
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
                if (parts) statusDiv.appendChild(infoLine("Standort", parts));
            }

            // Tags (Array)
            if (item.tags && item.tags.length > 0) {
                statusDiv.appendChild(infoLine("Tags", item.tags.join(", ")));
            }

            // Seriennummer
            if (item.serial_number) {
                statusDiv.appendChild(infoLine("Seriennummer", item.serial_number));
            }

            // Anzahl
            if (item.quantity) {
                statusDiv.appendChild(infoLine("Anzahl", item.quantity));
            }

            if (item.notes) {
                statusDiv.appendChild(infoLine("Notizen", item.notes));
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
                // falls kine specs dann den ganzen container entfernern:
                specsList.closest(".container").style.display = "none";
                
            }

            // Bilder
            fetch(`/api/list_files.php?path=${encodeURIComponent("docs/" + id + "/images/")}&type=image`)
                .then(res => res.json())
                .then(imgData => {
                    const gallery = document.getElementById("image-gallery");
                    const files = (imgData.files || []).filter(f => !/thumb/i.test(f));

                    if (files.length === 0) {
                        gallery.closest(".container").style.display = "none";
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
                    document.getElementById("image-gallery").closest(".container").style.display = "none";
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