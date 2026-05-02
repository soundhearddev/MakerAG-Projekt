// ██╗   ██╗██╗███╗   ███╗        █████╗  █████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗  ██╗██████╗  ██████╗        ██╗ ██████╗
// ██║   ██║██║████╗ ████║       ██╔══██╗██╔══██╗████╗ ████║████╗ ████║██╔══██╗████╗ ██║██╔══██╗██╔════╝        ██║██╔════╝
// ╚██╗ ██╔╝██║██╔████╔██║█████╗ ██║  ╚═╝██║  ██║██╔████╔██║██╔████╔██║███████║██╔██╗██║██║  ██║╚█████╗         ██║╚█████╗ 
//  ╚████╔╝ ██║██║╚██╔╝██║╚════╝ ██║  ██╗██║  ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚████║██║  ██║ ╚═══██╗   ██╗  ██║ ╚═══██╗
//   ╚██╔╝  ██║██║ ╚═╝ ██║       ╚█████╔╝╚█████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚███║██████╔╝██████╔╝██╗╚█████╔╝██████╔╝
//    ╚═╝   ╚═╝╚═╝     ╚═╝        ╚════╝  ╚════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚══╝╚═════╝ ╚═════╝ ╚═╝ ╚════╝ ╚═════╝ 

// Alle bekannten Befehle. Jeder Eintrag: { match: RegExp|string, run: fn, desc: string, group: string }
// "match" kann ein exakter String sein oder eine RegExp für Argumente.
// "group" wird in :help zur Gruppierung benutzt.

window.VimCommands = [
  // ── Hilfe ─────────────────────────────────────────────────────────────────
  {
    match: /^h(elp)?$/,
    desc: ":help – Alle Befehle anzeigen",
    group: "Hilfe",
    run() {
      if (window.VimBar) window.VimBar.help();
    },
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    match: /^w$/,
    desc: ":w – Einstellungen speichern",
    group: "Settings",
    run() {
      if (typeof window.saveSettings === "function") window.saveSettings();
      else _warn(":w – saveSettings nicht gefunden");
    },
  },
  {
    match: /^q$/,
    desc: ":q – Offenes Modal schließen",
    group: "Settings",
    run() {
      if (typeof window.closeCurrentModal === "function")
        window.closeCurrentModal();
      else _warn(":q – kein Modal offen");
    },
  },
  {
    match: /^wq$/,
    desc: ":wq – Speichern & Modal schließen",
    group: "Settings",
    run() {
      if (typeof window.saveSettings === "function") window.saveSettings();
      if (typeof window.closeCurrentModal === "function")
        window.closeCurrentModal();
    },
  },
  {
    match: /^q!$/,
    desc: ":q! – Settings auf Standard zurücksetzen",
    group: "Settings",
    run() {
      if (typeof window.handleReset === "function") window.handleReset();
      else _warn(":q! – handleReset nicht gefunden");
    },
  },
  {
    match: /^export$/,
    desc: ":export – Settings als JSON herunterladen",
    group: "Settings",
    run() {
      if (typeof window.exportSettings === "function") window.exportSettings();
      else _warn(":export – exportSettings nicht gefunden");
    },
  },
  {
    match: /^import$/,
    desc: ":import – Settings aus JSON importieren",
    group: "Settings",
    run() {
      if (typeof window.importSettings === "function") window.importSettings();
      else _warn(":import – importSettings nicht gefunden");
    },
  },
  {
    match: /^cache clear$/,
    desc: ":cache clear – sessionStorage leeren",
    group: "Settings",
    run() {
      sessionStorage.clear();
      _info("Cache geleert");
    },
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  {
    match: /^e (\S+)$/,
    desc: ":e <n> – Modal öffnen (settings, themes, ...)",
    group: "Modals",
    run(m) {
      if (typeof window.openModal === "function") window.openModal(m[1]);
      else _warn(":e – openModal nicht gefunden");
    },
  },
  {
    match: /^center$/,
    desc: ":center – Offenes Modal zentrieren",
    group: "Modals",
    run() {
      const active = document.querySelector(".settings-modal.active");
      if (active && typeof window.centerModal === "function") {
        window.centerModal(active);
      } else {
        _warn(":center – kein Modal offen");
      }
    },
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  {
    match: /^tabn$/,
    desc: ":tabn – Nächsten Tab aktivieren",
    group: "Tabs",
    run() {
      _switchTab(+1);
    },
  },
  {
    match: /^tabp$/,
    desc: ":tabp – Vorherigen Tab aktivieren",
    group: "Tabs",
    run() {
      _switchTab(-1);
    },
  },
  {
    match: /^tab (\d+)$/,
    desc: ":tab <n> – Tab n direkt aktivieren (1-basiert)",
    group: "Tabs",
    run(m) {
      const tabs = [...document.querySelectorAll(".tab-btn")];
      const target = tabs[parseInt(m[1]) - 1];
      if (target) target.click();
      else _warn(`:tab – Tab ${m[1]} nicht gefunden`);
    },
  },

  // ── Theme ─────────────────────────────────────────────────────────────────
  {
    match: /^theme (\S+)$/,
    desc: ":theme <n> – Theme wechseln",
    group: "Theme",
    run(m) {
      _applyTheme(m[1]);
    },
  },
  {
    match: /^set theme=(\S+)$/,
    desc: ":set theme=<n> – Theme setzen (Vim-Syntax)",
    group: "Theme",
    run(m) {
      _applyTheme(m[1]);
    },
  },
  {
    match: /^themes$/,
    desc: ":themes – Themes mit Tastaturnavigation auswählen",
    group: "Theme",
    run() {
      const known = ["default", "hell", "water", "green", "redmoon", "dark"];
      const root = getComputedStyle(document.documentElement);
      const available = known.filter((n) =>
        root.getPropertyValue(`--${n}-primary`).trim(),
      );
      const current = document.body.getAttribute("data-theme") || "default";
      let selected = available.indexOf(current);
      if (selected === -1) selected = 0;

      if (typeof window.showModal !== "function") {
        _info("Themes: " + available.join(", "));
        return;
      }

      const id = "vim-themes-picker";

      function renderRows() {
        return available
          .map((t, i) => {
            const accent =
              root.getPropertyValue(`--${t}-accent`).trim() || "#888";
            const isCurrent = t === current;
            const isSelected = i === selected;
            return `
            <div class="vim-theme-row" data-index="${i}" data-theme="${t}"
                 style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                        border-radius:4px; cursor:pointer;
                        background:${isSelected ? "var(--cat-accent,#4a9eff)22" : "transparent"};
                        border:1px solid ${isSelected ? "var(--cat-accent,#4a9eff)55" : "transparent"};
                        transition: background 0.1s;">
              <span style="width:11px; height:11px; border-radius:50%;
                           background:${accent}; flex-shrink:0; display:inline-block;"></span>
              <span style="font-family:monospace; flex:1;">${t}</span>
              ${isCurrent ? '<span style="font-size:11px; opacity:0.5;">aktiv</span>' : ""}
              <span style="font-size:11px; opacity:0.4; font-family:monospace;">${t[0]}</span>
            </div>`;
          })
          .join("");
      }

      window.showModal(
        'Themes  <span style="font-size:11px;opacity:0.5;font-weight:normal;">j/k · Enter · Buchstabe</span>',
        `
        <div id="${id}" style="min-width:240px; outline:none;" tabindex="0">
          ${renderRows()}
        </div>
      `,
      );

      requestAnimationFrame(() => {
        const container = document.getElementById(id);
        if (!container) return;
        container.focus();

        function refresh() {
          container.innerHTML = renderRows();
          container.querySelectorAll(".vim-theme-row").forEach((row) => {
            row.addEventListener("click", () => {
              selected = parseInt(row.dataset.index);
              _applyTheme(available[selected]);
              refresh();
            });
          });
          const activeRow = container.querySelector(
            `[data-index="${selected}"]`,
          );
          if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
        }

        refresh();

        container.addEventListener("keydown", (e) => {
          if (e.key === "j" || e.key === "ArrowDown") {
            e.preventDefault();
            selected = (selected + 1) % available.length;
            refresh();
          } else if (e.key === "k" || e.key === "ArrowUp") {
            e.preventDefault();
            selected = (selected - 1 + available.length) % available.length;
            refresh();
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            _applyTheme(available[selected]);
            const overlay = container.closest('[style*="position: fixed"]');
            if (overlay) overlay.remove();
          } else if (e.key.length === 1) {
            const idx = available.findIndex((t) =>
              t.startsWith(e.key.toLowerCase()),
            );
            if (idx !== -1) {
              selected = idx;
              refresh();
            }
          }
        });
      });
    },
  },

  // ── Darstellung ───────────────────────────────────────────────────────────
  {
    match: /^set fs=(\d+)$/,
    desc: ":set fs=<px> – Schriftgröße setzen",
    group: "Darstellung",
    run(m) {
      _setFontSize(parseInt(m[1]));
    },
  },
  {
    match: /^set fs\+(\d*)$/,
    desc: ":set fs+ – Schrift vergrößern (+1px oder +n)",
    group: "Darstellung",
    run(m) {
      const delta = parseInt(m[1]) || 1;
      _setFontSize(_currentFontSize() + delta);
    },
  },
  {
    match: /^set fs-(\d*)$/,
    desc: ":set fs- – Schrift verkleinern (-1px oder -n)",
    group: "Darstellung",
    run(m) {
      const delta = parseInt(m[1]) || 1;
      _setFontSize(_currentFontSize() - delta);
    },
  },
  {
    match: /^anim(ations)?$/,
    desc: ":anim – Animationen ein/aus umschalten",
    group: "Darstellung",
    run() {
      const on = !document.body.classList.contains("no-animations");
      document.body.classList.toggle("no-animations", on);
      const el = document.getElementById("animations");
      if (el) {
        el.checked = !on;
        el.dispatchEvent(new Event("change"));
      }
      _info(`Animationen: ${on ? "aus" : "an"}`);
    },
  },
  {
    match: /^zoom (\d+)%?$/,
    desc: ":zoom <n> – Seiten-Zoom setzen (z.B. :zoom 110)",
    group: "Darstellung",
    run(m) {
      document.body.style.zoom = (parseInt(m[1]) / 100).toString();
      _info(`Zoom: ${m[1]}%`);
    },
  },

  // ── System ────────────────────────────────────────────────────────────────
  {
    match: /^debug$/,
    desc: ":debug – Debug-Modus umschalten",
    group: "System",
    run() {
      const el = document.getElementById("debug-mode");
      if (el) {
        el.checked = !el.checked;
        el.dispatchEvent(new Event("change"));
      } else _warn(":debug – Element nicht gefunden");
    },
  },
  {
    match: /^gol$/,
    desc: ":gol – Game of Life umschalten",
    group: "System",
    run() {
      const el = document.getElementById("golMode");
      if (el) {
        el.checked = !el.checked;
        el.dispatchEvent(new Event("change"));
      } else _warn(":gol – nicht verfügbar");
    },
  },
  {
    match: /^vim$/,
    desc: ":vim – Vim-Modus deaktivieren",
    group: "System",
    run() {
      const el = document.getElementById("vim-mode");
      if (el) {
        el.checked = false;
        el.dispatchEvent(new Event("change"));
      }
    },
  },
  {
    match: /^version$/,
    desc: ":version – System-Info anzeigen",
    group: "System",
    run() {
      const cmds = (window.VimCommands || []).length;
      const theme = document.body.getAttribute("data-theme") || "default";
      const fs = document.body.style.fontSize || "15px";

      if (typeof window.showModal === "function") {
        window.showModal(
          "System-Info",
          `
          <table style="width:100%; border-collapse:collapse; font-family:monospace; font-size:13px;">
            ${[
            ["Version", "0.5.0"],
            ["Befehle", cmds],
            ["Theme", theme],
            ["Schriftgröße", fs],
            ["Seite", window.location.pathname],
          ]
            .map(
              ([k, v]) => `
              <tr>
                <td style="padding:4px 12px 4px 0; opacity:0.55; white-space:nowrap;">${k}</td>
                <td style="padding:4px 0; font-weight:500;">${v}</td>
              </tr>`,
            )
            .join("")}
          </table>
        `,
        );
      }
    },
  },
  {
    match: /^ls$/,
    desc: ":ls – LocalStorage-Keys auflisten",
    group: "System",
    run() {
      const keys = Object.keys(localStorage);
      if (!keys.length) {
        _info("localStorage ist leer");
        return;
      }
      if (typeof window.showModal === "function") {
        const rows = keys
          .map((k) => {
            const size = `${((localStorage.getItem(k) || "").length / 1024).toFixed(1)} KB`;
            return `<div style="display:flex; justify-content:space-between; padding:4px 0;
                              border-bottom:1px solid var(--cat-extra,#333)22;
                              font-family:monospace; font-size:12px;">
                    <span>${k}</span>
                    <span style="opacity:0.45;">${size}</span>
                  </div>`;
          })
          .join("");
        window.showModal(
          "localStorage",
          `<div style="min-width:260px;">${rows}</div>`,
        );
      }
    },
  },

  // ── Suche ─────────────────────────────────────────────────────────────────
  {
    match: /^\/(.+)$/,
    desc: "/<query> – Suche starten",
    group: "Suche",
    run(m) {
      const el =
        document.getElementById("searchInput") ||
        document.querySelector("input[type=search], input[name=query]");
      if (el) {
        el.value = m[1];
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.focus();
      } else {
        window.location.href = `/search.html?query=${encodeURIComponent(m[1])}`;
      }
    },
  },
  {
    match: /^sort (\S+)$/,
    desc: ":sort <feld> – Sortierfeld setzen",
    group: "Suche",
    run(m) {
      const el = document.getElementById("sortField");
      if (el) {
        el.value = m[1];
        el.dispatchEvent(new Event("change"));
      } else _warn(":sort – kein Sortierfeld auf dieser Seite");
    },
  },
  {
    match: /^order (asc|desc)$/i,
    desc: ":order asc|desc – Sortierrichtung",
    group: "Suche",
    run(m) {
      const el = document.getElementById("sortOrder");
      if (el) {
        el.value = m[1].toUpperCase();
        el.dispatchEvent(new Event("change"));
      } else _warn(":order – kein Sortierfeld auf dieser Seite");
    },
  },
  {
    match: /^nofilter$/,
    desc: ":nofilter – Aktiven Filter entfernen",
    group: "Suche",
    run() {
      const btn = document.querySelector(".filter-chip-remove");
      if (btn) btn.click();
      else _warn(":nofilter – kein aktiver Filter");
    },
  },

  // ── Inhalt ────────────────────────────────────────────────────────────────
  {
    match: /^latest$/,
    desc: ":latest – Neueste Items laden",
    group: "Inhalt",
    run() {
      const btn = document.getElementById("load-latest");
      if (btn) btn.click();
      else if (typeof window.loadLatestEntries === "function")
        window.loadLatestEntries();
      else _warn(":latest – nicht auf dieser Seite");
    },
  },
  {
    match: /^random$/,
    desc: ":random – Zufälliges Item laden",
    group: "Inhalt",
    run() {
      const btn = document.getElementById("random-item-btn");
      if (btn) btn.click();
      else if (typeof window.loadRandomItem === "function")
        window.loadRandomItem();
      else _warn(":random – nicht auf dieser Seite");
    },
  },
  {
    match: /^cats$/,
    desc: ":cats – Kategorien neu laden",
    group: "Inhalt",
    run() {
      if (typeof window.loadCategories === "function") window.loadCategories();
      else _warn(":cats – loadCategories nicht gefunden");
    },
  },
  {
    match: /^count$/,
    desc: ":count – Item-Anzahl aktualisieren",
    group: "Inhalt",
    run() {
      if (typeof window.loadItemCount === "function") window.loadItemCount();
      else _warn(":count – loadItemCount nicht gefunden");
    },
  },
  {
    match: /^reload( \S+)?$/,
    desc: ":reload [partial] – Seite oder Partial neu laden",
    group: "Inhalt",
    run(m) {
      const partial = m[1]?.trim();
      if (!partial) {
        if (typeof window.reloadAllComponents === "function")
          window.reloadAllComponents();
        else window.location.reload();
      } else {
        if (typeof window.loadHTML === "function")
          window.loadHTML(partial, `/partials/${partial}.html`, false);
        else _warn(`:reload – loadHTML nicht gefunden`);
      }
    },
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  {
    match: /^goto (.+)$/,
    desc: ":goto <raum> – Raum in Suche öffnen",
    group: "Navigation",
    run(m) {
      window.location.href = `/search.html?searchFor=Raum&query=${encodeURIComponent(m[1])}`;
    },
  },
  {
    match: /^obj (.+)$/,
    desc: ":obj <id> – Objekt in Suche öffnen",
    group: "Navigation",
    run(m) {
      window.location.href = `/search.html?searchFor=Locker&query=${encodeURIComponent(m[1])}`;
    },
  },
  {
    match: /^open (.+)$/,
    desc: ":open <url> – URL öffnen",
    group: "Navigation",
    run(m) {
      const url = m[1].startsWith("http") ? m[1] : `https://${m[1]}`;
      window.location.href = url;
    },
  },
  {
    match: /^back$/,
    desc: ":back – Zurück navigieren",
    group: "Navigation",
    run() {
      window.history.back();
    },
  },
  {
    match: /^fwd$/,
    desc: ":fwd – Vorwärts navigieren",
    group: "Navigation",
    run() {
      window.history.forward();
    },
  },
  {
    match: /^top$/,
    desc: ":top – Zum Seitenanfang scrollen",
    group: "Navigation",
    run() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  },
  {
    match: /^bottom$/,
    desc: ":bottom – Zum Seitenende scrollen",
    group: "Navigation",
    run() {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    },
  },
  {
    match: /^copy url$/,
    desc: ":copy url – Aktuelle URL in Zwischenablage",
    group: "Navigation",
    run() {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => _info("URL kopiert!"))
        .catch(() => _warn("Kopieren fehlgeschlagen"));
    },
  },

  // ── Feedback ──────────────────────────────────────────────────────────────
  {
    match: /^submit$/,
    desc: ":submit – Formular absenden",
    group: "Feedback",
    run() {
      const btn =
        document.getElementById("submit") ||
        document.querySelector("button[type=submit], input[type=submit]");
      if (btn) btn.click();
      else _warn(":submit – kein Submit-Button gefunden");
    },
  },

  // ── Extras ────────────────────────────────────────────────────────────────
  {
    match: /^time$/,
    desc: ":time – Aktuelle Uhrzeit & Datum anzeigen",
    group: "Extras",
    run() {
      const now = new Date();
      const t = now.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const d = now.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      _info(`${d}, ${t}`);
    },
  },
  {
    match: /^focus$/,
    desc: ":focus – Erstes Eingabefeld fokussieren",
    group: "Extras",
    run() {
      const el = document.querySelector(
        "input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([id=vim-bar] *), textarea",
      );
      if (el) el.focus();
      else _warn(":focus – kein Eingabefeld gefunden");
    },
  },
  {
    match: /^print$/,
    desc: ":print – Seite drucken",
    group: "Extras",
    run() {
      window.print();
    },
  },

  // ── Easter Eggs ───────────────────────────────────────────────────────────
  {
    match: /^!rm -rf \/$/,
    desc: "???",
    group: "Extras",
    run() {
      if (typeof window.showModal !== "function") return;
      window.showModal(
        "Permission denied",
        `<pre style="font-family:monospace; font-size:13px; line-height:1.8; margin:0; opacity:0.85;">rm: cannot remove '/': Permission denied\nOperation not permitted.\n</pre>`,
      );
    },
  },
  {
    match: /^!fastfetch$/,
    desc: ":!fastfetch – System-Info anzeigen",
    group: "System",
    run() {
      if (typeof window.showModal !== "function") return;

      const ua = navigator.userAgent;

      let os = "Unknown";
      let asciiKey = "unknown";
      if (ua.includes("Windows NT 10.0")) { os = "Windows 10/11"; asciiKey = "windows"; }
      else if (ua.includes("Windows")) { os = "Windows"; asciiKey = "windows"; }
      else if (ua.includes("Mac OS X")) { os = "macOS"; asciiKey = "macos"; }
      else if (ua.includes("Android")) { os = "Android"; asciiKey = "android"; }
      else if (ua.includes("iPhone") || ua.includes("iPad")) { os = "iOS"; asciiKey = "ios"; }
      else if (ua.includes("Linux")) { os = "Linux"; asciiKey = "linux"; }

      let browser = "Unknown";
      if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Edg")) browser = "Edge";
      else if (ua.includes("OPR")) browser = "Opera";
      else if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari")) browser = "Safari";

      const screen = `${window.screen.width}x${window.screen.height}`;
      const viewport = `${window.innerWidth}x${window.innerHeight}`;
      const dpr = window.devicePixelRatio || 1;
      const lang = navigator.language || "–";
      const cores = navigator.hardwareConcurrency || "–";
      const touch = navigator.maxTouchPoints > 0 ? "Ja" : "Nein";
      const memory = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "–";
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "–";
      const theme = document.body.getAttribute("data-theme") || "default";

      const icons = {
        windows: `/images/os/windows.png`,
        macos: `/images/os/macos.png`,
        linux: `/images/os/linux.png`,
        android: `/images/os/android.svg`,
        ios: `/images/os/ios.png`,
        unknown: `/images/os/unknown.svg`,
      };

      const fields = [
        ["OS", os],
        ["Browser", browser],
        ["Sprache", lang],
        ["Zeitzone", tz],
        ["Auflösung", screen],
        ["Viewport", viewport],
        ["DPR", dpr],
        ["CPU Kerne", cores],
        ["RAM", memory],
        ["Touch", touch],
        ["Theme", theme],
      ];

      const rows = fields.map(([k, v]) => `
      <tr>
        <td style="padding:2px 14px 2px 0; opacity:0.55; white-space:nowrap; font-weight:600;">${k}</td>
        <td style="padding:2px 0;">${v}</td>
      </tr>`).join("");

      window.showModal("fastfetch", `
      <div style="display:flex; gap:24px; align-items:flex-start; font-family:monospace; font-size:13px;">
        <img src="${icons[asciiKey]}" style="width:250px; height:250px; object-fit:contain; flex-shrink:0;" />
        <table style="border-collapse:collapse;">${rows}</table>
      </div>
    `);
    },
  },
  {
    match: /^!cowsay (.+)$/,
    desc: "???",
    group: "Extras",
    run(m) {
      const text = m[1];
      const len = text.length;
      const cow = `  ${"_".repeat(len + 2)}\n< ${text} >\n  ${"‾".repeat(len + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
      if (typeof window.showModal === "function") {
        window.showModal(
          "cowsay",
          `<pre style="font-family:monospace; font-size:13px; line-height:1.5; margin:0;">${cow}</pre>`,
        );
      }
    },
  },
];


// ── Private Helfer ────────────────────────────────────────────────────────

function _info(msg) {
  if (window.VimBar?._showMsg) window.VimBar._showMsg(msg, "info");
  else console.info("[VimBar]", msg);
}

function _warn(msg) {
  if (window.VimBar?._showMsg) window.VimBar._showMsg(msg, "error");
  else console.warn("[VimBar]", msg);
}

function _applyTheme(name) {
  if (typeof window.applyTheme === "function") window.applyTheme(name);
  else {
    _warn(`:theme – applyTheme nicht gefunden`);
    return;
  }
  if (typeof window.handleThemeSelect === "function")
    window.handleThemeSelect(name);
}

function _setFontSize(px) {
  const clamped = Math.max(10, Math.min(30, px));
  document.body.style.fontSize = clamped + "px";
  const el = document.getElementById("font-size");
  if (el) {
    el.value = clamped;
    el.dispatchEvent(new Event("input"));
  }
  _info(`Schriftgröße: ${clamped}px`);
}

function _currentFontSize() {
  return parseInt(document.body.style.fontSize) || 15;
}

function _switchTab(dir) {
  const tabs = [...document.querySelectorAll(".tab-btn")];
  if (!tabs.length) {
    _warn("Keine Tabs gefunden");
    return;
  }
  const active = tabs.findIndex((t) => t.classList.contains("active"));
  const next =
    tabs[((active === -1 ? 0 : active) + dir + tabs.length) % tabs.length];
  if (next) next.click();
}