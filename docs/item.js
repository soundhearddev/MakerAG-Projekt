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
            if (item.name) {
                document.getElementById("item-description").textContent = item.name;
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
                const li = document.createElement("li");
                li.textContent = "Keine Specs vorhanden.";
                specsList.appendChild(li);
            }

            // Bilder aus /docs/{id}/images/ laden
            fetch(`/api/list_files.php?path=${encodeURIComponent("docs/" + id + "/images/")}&type=image`)
                .then(res => res.json())
                .then(imgData => {
                    const gallery = document.getElementById("image-gallery");
                    const files = imgData.files || [];
                    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

                    if (imageFiles.length > 0) {
                        imageFiles.forEach((filename, i) => {
                            const img = document.createElement("img");
                            img.src = `/docs/${id}/images/${filename}`;
                            img.alt = `Bild ${i + 1}`;
                            img.style.height = "300px";
                            gallery.appendChild(img);
                        });
                    } else {
                        gallery.closest(".container").style.display = "none";
                    }
                })
                .catch(() => {
                    document.getElementById("image-gallery").closest(".container").style.display = "none";
                });

            // Documents aus API (falls vorhanden)
            if (item.documents && item.documents.length > 0) {
                const docsContainer = document.getElementById("docs-container");
                const heading = document.createElement("p");
                heading.innerHTML = "<strong>Dokumente:</strong>";
                docsContainer.appendChild(heading);

                item.documents.forEach(doc => {
                    docsContainer.appendChild(makePdfBlock(doc.label || doc.name, doc.url));
                });
            }
        })
        .catch(err => {
            document.getElementById("item-title").textContent = "Fehler beim Laden";
            console.error("item fetch error:", err);
        });

    // ── 2. PDFs aus <id>/pdf/ dynamisch laden ───────────────────────────────

    fetch(`/api/list_files.php?path=${encodeURIComponent(id + "/images/pdf/")}`)
        .then(res => res.json())
        .then(data => {
            if (!data.files || data.files.length === 0) return;

            const docsContainer = document.getElementById("docs-container");

            const heading = document.createElement("p");
            heading.innerHTML = "<strong>Sonstige Dokumente:</strong>";
            docsContainer.appendChild(heading);

            data.files.forEach(filename => {
                const url = `/docs/${id}/images/pdf/${filename}`;
                const label = filename.replace(/\.pdf$/i, "");
                docsContainer.appendChild(makePdfBlock(label, url));
            });
        })
        .catch(err => {
            console.warn("PDF-Liste konnte nicht geladen werden:", err);
        });
    fetch(`/api/list_files.php?path=${encodeURIComponent(id + "/images/")}&type=image`)
        .then(res => res.json())
        .then(imgData => {
            console.log("Bilder API:", imgData);
            console.log("Pfad:", id + "/images/");
            // ...
        })
})();