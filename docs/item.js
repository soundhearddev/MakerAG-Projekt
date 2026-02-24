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
        const btnId = `pdfBtn_${Math.random().toString(36).slice(2)}`;
        const wrapId = `pdfWrap_${Math.random().toString(36).slice(2)}`;

        const wrapper = document.createElement("p");

        wrapper.innerHTML = `
        <a href="${url}" target="_blank">${label}</a>
    `;

        const btn = wrapper.querySelector(`a`);
        const div = wrapper.querySelector(`#${wrapId}`);

        btn.addEventListener("click", () => {
            div.style.display = div.style.display === "none" ? "block" : "none";
        });

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





            if (data.error) {
                document.getElementById("item-title").textContent = "Fehler: " + data.message;
                return;
            }

            // Seitentitel
            document.title = `${item.brand} ${item.model}`;
            document.getElementById("item-title").textContent = `${item.brand} ${item.model}`;

            // Beschreibung
            if (item.description) {
                document.getElementById("item-description").textContent = item.description;
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

            if (item.category) {
                const kat = item.subcategory ? `${item.category} / ${item.subcategory}` : item.category;
                statusDiv.appendChild(infoLine("Kategorie", kat));
            }

            if (item.location_schrank || item.location_regal || item.location_position) {
                const loc = `Schrank ${item.location_schrank ?? "–"}, Regal ${item.location_regal ?? "–"}, Position ${item.location_position ?? "–"}`;
                statusDiv.appendChild(infoLine("Standort", loc));
            }

            if (item.tags) statusDiv.appendChild(infoLine("Tags", item.tags));
            if (item.notes) statusDiv.appendChild(infoLine("Notizen", item.notes));


            // Specs
            const specsList = document.getElementById("specs-list");
            appendAll(specsList, [
                specItem("Prozessor", item.cpu || item.processor),
                specItem("Grafikkarte", item.gpu),
                specItem("RAM", item.ram),
                specItem("Bildschirm", item.display || item.screen),
                specItem("Mainboard", item.mainboard),
                specItem("Massenspeicher", item.storage),
                specItem("Gewicht", item.weight ? item.weight + " kg" : null),
                specItem("Interfaces", item.interfaces),
                specItem("Power", item.power),
                specItem("Firmware", item.firmware_version),
                specItem("Erscheinungsjahr", item.year),
            ]);

            // Bilder
            const images = item.images || (item.thumbnail ? [item.thumbnail] : []);
            if (images.length > 0) {
                const gallery = document.getElementById("image-gallery");
                images.forEach((src, i) => {
                    const img = document.createElement("img");
                    img.src = src;
                    img.alt = `Bild ${i + 1}`;
                    img.style.height = "300px";
                    gallery.appendChild(img);
                });
            } else {
                document.getElementById("image-gallery").style.display = "none";

            }
        })
        .catch(err => {
            document.getElementById("item-title").textContent = "Fehler beim Laden";
            console.error("item fetch error:", err);
        });

    // ── 2. PDFs aus <id>/pdf/ dynamisch laden ───────────────────────────────
    //
    // Benötigt: /api/list_files.php?path=<id>/pdf/
    // Gibt zurück: { "files": ["Handbuch.pdf", "Datenblatt.pdf", ...] }

    fetch(`/api/list_files.php?path=${encodeURIComponent(id + "/pdf/")}`)
        .then(res => res.json())
        .then(data => {
            if (!data.files || data.files.length === 0) return;

            const docsContainer = document.getElementById("docs-container");

            // Abschnitts-Überschrift nur einmal
            const heading = document.createElement("p");
            heading.innerHTML = "<strong>Sonstige Dokumente:</strong>";
            docsContainer.appendChild(heading);

            data.files.forEach(filename => {
                const url = `/${id}/pdf/${filename}`;
                // Dateiname ohne Endung als Label
                const label = filename.replace(/\.pdf$/i, "");
                docsContainer.appendChild(makePdfBlock(label, url));
            });
            console.log("API Response:", data);
        })
        .catch(err => {
            // Kein PDF-Ordner vorhanden → Container einfach leer lassen
            console.warn("PDF-Liste konnte nicht geladen werden:", err);
        });


})();
