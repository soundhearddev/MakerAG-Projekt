// ██╗      █████╗ ███╗  ██╗ ██████╗         ██╗ ██████╗
// ██║     ██╔══██╗████╗ ██║██╔════╝         ██║██╔════╝
// ██║     ███████║██╔██╗██║██║  ██╗         ██║╚█████╗ 
// ██║     ██╔══██║██║╚████║██║  ╚██╗   ██╗  ██║ ╚═══██╗
// ███████╗██║  ██║██║ ╚███║╚██████╔╝██╗╚█████╔╝██████╔╝
// ╚══════╝╚═╝  ╚═╝╚═╝  ╚══╝ ╚═════╝ ╚═╝ ╚════╝ ╚═════╝ 


(async function () {
  const saved = localStorage.getItem("lang") || "de";

  // JSON laden
  let translations = {};
  try {
    const res = await fetch("/config/lang.index.json");
    translations = await res.json();
  } catch (e) {
    console.warn("[lang] Konnte lang.index.json nicht laden, Fallback auf leer");
  }

  // Aktuelle Sprache global verfügbar machen
  window.T = translations[saved] || translations["de"] || {};
  window._currentLang = saved;

  // data-i18n Elemente befüllen
  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (window.T[key]) el.textContent = window.T[key];
    });
    document.documentElement.lang = window._currentLang;
  }

  // Nach DOMContentLoaded anwenden (falls lang.js im <head> geladen wird)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTranslations);
  } else {
    applyTranslations();
  }

  // Sprachwechsel: reload damit auch JS-Strings (T.loading etc.) stimmen
  window.setLang = function (lang) {
    localStorage.setItem("lang", lang);
    location.reload();
  };

  window.applyTranslations = applyTranslations;

  const searchInput = document.getElementById("searchInput");
  if (searchInput && window.T?.search_placeholder)
    searchInput.placeholder = window.T.search_placeholder;

  const clearBtn = document.getElementById("clearSearch");
  if (clearBtn && window.T?.search_clear_title) {
    clearBtn.title = window.T.search_clear_title;
    clearBtn.setAttribute("aria-label", window.T.search_clear_aria);
  }
})();