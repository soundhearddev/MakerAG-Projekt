// ████████╗██╗  ██╗███████╗███╗   ███╗███████╗      ██╗      █████╗  █████╗ ██████╗ ███████╗██████╗         ██╗ ██████╗
// ╚══██╔══╝██║  ██║██╔════╝████╗ ████║██╔════╝      ██║     ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗        ██║██╔════╝
//    ██║   ███████║█████╗  ██╔████╔██║█████╗  █████╗██║     ██║  ██║███████║██║  ██║█████╗  ██████╔╝        ██║╚█████╗ 
//    ██║   ██╔══██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════╝██║     ██║  ██║██╔══██║██║  ██║██╔══╝  ██╔══██╗   ██╗  ██║ ╚═══██╗
//    ██║   ██║  ██║███████╗██║ ╚═╝ ██║███████╗      ███████╗╚█████╔╝██║  ██║██████╔╝███████╗██║  ██║██╗╚█████╔╝██████╔╝
//    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚══════╝      ╚══════╝ ╚════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝

(function () {
  "use strict";

  // IIFE: Theme vor erstem Paint setzen (kein Flackern)
  (function immediateThemeLoad() {
    try {
      const saved = localStorage.getItem("Settings-Obj");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const theme = parsed.theme || "default";
      const themes = {
        default: { primary: "#1a1a1a", secondary: "#202020", accent: "#fbf3d1", text: "#bebebe", extra: "#484655" },
        hell: { primary: "#ffffff", secondary: "#f7f7f8", accent: "#5a5a5a", text: "#000000", extra: "#d7e4fa" },
        water: { primary: "#062346", secondary: "#0e233f", accent: "#305577", text: "#f4f2ed", extra: "#173791" },
        green: { primary: "#3b5347", secondary: "#4a6755", accent: "#90ab8b", text: "#ffdbca", extra: "#6b8a7a" },
        redmoon: { primary: "#0e0e0e", secondary: "#100806", accent: "#640000", text: "#f5e6e8", extra: "#2f0101" },
      };
      const t = themes[theme] || themes.default;
      const s = document.createElement("style");
      s.id = "theme-preload";
      s.textContent = `:root{--cat-primary:${t.primary};--cat-secondary:${t.secondary};--cat-accent:${t.accent};--cat-text:${t.text};--cat-extra:${t.extra}}`;
      document.head.appendChild(s);
    } catch (e) { /* silent */ }
  })();

  function getThemeFromCSS(themeName) {
    const rootStyles = getComputedStyle(document.documentElement);
    const theme = {
      primary: rootStyles.getPropertyValue(`--${themeName}-primary`).trim(),
      secondary: rootStyles.getPropertyValue(`--${themeName}-secondary`).trim(),
      accent: rootStyles.getPropertyValue(`--${themeName}-accent`).trim(),
      text: rootStyles.getPropertyValue(`--${themeName}-text`).trim(),
      extra: rootStyles.getPropertyValue(`--${themeName}-extra`).trim(),
    };
    if (!theme.primary) {
      if (themeName === "default") return theme;
      return getThemeFromCSS("default");
    }
    return theme;
  }

  function applyTheme(themeName) {
    const theme = getThemeFromCSS(themeName);
    const root = document.documentElement;
    root.style.setProperty("--cat-primary", theme.primary);
    root.style.setProperty("--cat-secondary", theme.secondary);
    root.style.setProperty("--cat-accent", theme.accent);
    root.style.setProperty("--cat-text", theme.text);
    root.style.setProperty("--cat-extra", theme.extra);
    document.body.setAttribute("data-theme", themeName);
    root.setAttribute("data-theme", themeName);
    window.dispatchEvent(new CustomEvent("themeChanged", {
      detail: { theme: themeName, colors: theme },
    }));
  }

  function handleThemeSelect(themeName, currentSettings) {
    // currentSettings ist ein optionales Objekt mit { themePreviewMode }
    document.querySelectorAll(".theme-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.theme === themeName);
    });
    if (!currentSettings || currentSettings.themePreviewMode) {
      applyTheme(themeName);
    }
  }

  // Public API
  window.getThemeFromCSS = getThemeFromCSS;
  window.applyTheme = applyTheme;
  window.handleThemeSelect = handleThemeSelect;
})();