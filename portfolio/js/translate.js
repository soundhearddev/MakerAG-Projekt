document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll("#language-switcher button");
    let currentLanguage = localStorage.getItem("language") || "de"; // || "de" für den Standart

    async function loadTranslations(lang) {  // async = erst wenn komplett geladen ist, dann erst ausführen
        try {
            const response = await fetch("/json/translations.json");
            const data = await response.json();
            return data[lang];
        } catch {
            return {};
        }
    }

    async function updateTexts(lang) {
        const texts = await loadTranslations(lang);
        document.querySelectorAll("[data-i18n]").forEach(element => { //alle Elemente mit data-i18n werden geholt
            const key = element.getAttribute("data-i18n");
            if (texts[key]) element.innerText = texts[key];
        });
        localStorage.setItem("language", lang);
    }

    buttons.forEach(button => {
        button.addEventListener("click", (event) => {
            const lang = event.currentTarget.getAttribute("data-lang");
            if (lang) updateTexts(lang);
        });
    });

    updateTexts(currentLanguage);
});
