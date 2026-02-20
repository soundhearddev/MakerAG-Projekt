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
        <button id="${btnId}">${label}</button>
        <div id="${wrapId}" style="display: none; margin-top: 20px;">
            <embed src="${url}" type="application/pdf" width="100%" height="1080px" />
            <p>Falls das PDF nicht angezeigt wird,
                <a href="${url}" target="_blank">hier öffnen</a> oder
                <a href="${url}" download>herunterladen</a>.
            </p>
        </div>
    `;

    const btn = wrapper.querySelector(`#${btnId}`);
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
            if (data.error) {
                document.getElementById("item-title").textContent = "Fehler: " + data.message;
                return;
            }

            // Seitentitel
            document.title = `${data.brand} ${data.model}`;
            document.getElementById("item-title").textContent = `${data.brand} ${data.model}`;

            // Beschreibung
            if (data.description) {
                document.getElementById("item-description").textContent = data.description;
            }

            // Status / Meta-Infos
            const statusDiv = document.getElementById("status");

            if (data.status) {
                const h = document.createElement("h2");
                h.textContent = data.status;
                statusDiv.appendChild(h);
            }

            if (data.item_condition) {
                statusDiv.appendChild(infoLine("Zustand", data.item_condition));
            }

            if (data.category) {
                const kat = data.subcategory ? `${data.category} / ${data.subcategory}` : data.category;
                statusDiv.appendChild(infoLine("Kategorie", kat));
            }

            if (data.location_schrank || data.location_regal || data.location_position) {
                const loc = `Schrank ${data.location_schrank ?? "–"}, Regal ${data.location_regal ?? "–"}, Position ${data.location_position ?? "–"}`;
                statusDiv.appendChild(infoLine("Standort", loc));
            }

            if (data.tags) statusDiv.appendChild(infoLine("Tags", data.tags));
            if (data.notes) statusDiv.appendChild(infoLine("Notizen", data.notes));

            
            // Specs
            const specsList = document.getElementById("specs-list");
            appendAll(specsList, [
                specItem("Prozessor", data.cpu || data.processor),
                specItem("Grafikkarte", data.gpu),
                specItem("RAM", data.ram),
                specItem("Bildschirm", data.display || data.screen),
                specItem("Mainboard", data.mainboard),
                specItem("Massenspeicher", data.storage),
                specItem("Gewicht", data.weight ? data.weight + " kg" : null),
                specItem("Interfaces", data.interfaces),
                specItem("Power", data.power),
                specItem("Firmware", data.firmware_version),
                specItem("Erscheinungsjahr", data.year),
            ]);

            // Bilder
            const images = data.images || (data.thumbnail ? [data.thumbnail] : []);
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
                document.getElementById("images-container").style.display = "none";
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
        })
        .catch(err => {
            // Kein PDF-Ordner vorhanden → Container einfach leer lassen
            console.warn("PDF-Liste konnte nicht geladen werden:", err);
        });

})();
