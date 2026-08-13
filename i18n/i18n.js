(function () {
  const SUPPORTED_LANGS = ["es", "en"];
  const DEFAULT_LANG = "es";

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  const I18N_DIR = SCRIPT_SRC
    ? SCRIPT_SRC.substring(0, SCRIPT_SRC.lastIndexOf("/") + 1)
    : "i18n/";

  function langFromPathname(pathname) {
    const match = pathname.match(/^\/(es|en)(\/|$)/);
    return match ? match[1] : null;
  }

  function langFromSearch(search) {
    const params = new URLSearchParams(search);
    const lang = params.get("lang");
    return SUPPORTED_LANGS.includes(lang) ? lang : null;
  }

  function currentLang() {
    return (
      langFromPathname(window.location.pathname) ||
      langFromSearch(window.location.search) ||
      DEFAULT_LANG
    );
  }

  function stripLangPrefix(pathname) {
    return pathname.replace(/^\/(es|en)(?=\/|$)/, "");
  }

  function buildLangUrl(lang) {
    const { pathname, search, hash } = window.location;
    const params = new URLSearchParams(search);
    params.delete("lang");

    if (langFromPathname(pathname) !== null) {
      const stripped = stripLangPrefix(pathname);
      const normalized = stripped === "" ? "/" : stripped;
      const path = normalized === "/" ? `/${lang}/` : `/${lang}${normalized}`;
      const qs = params.toString();
      return path + (qs ? `?${qs}` : "") + hash;
    }

    params.set("lang", lang);
    const qs = params.toString();
    return pathname + (qs ? `?${qs}` : "") + hash;
  }

  function preserveLangInLinks(lang) {
    const fromPathname = langFromPathname(window.location.pathname) !== null;
    if (fromPathname || lang === DEFAULT_LANG) return;
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      if (
        /^(https?:)?\/\//.test(href) ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const params = new URLSearchParams(url.search);
        params.set("lang", lang);
        url.search = params.toString();
        a.setAttribute("href", url.pathname + url.search + url.hash);
      } catch (e) {
        /* ignore malformed links */
      }
    });
  }

  async function loadDictionary(lang) {
    const response = await fetch(`${I18N_DIR}${lang}.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Failed to load dictionary: ${lang}`);
    return response.json();
  }

  function lookupKey(dictionary, key) {
    return key.split(".").reduce((acc, part) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[part];
    }, dictionary);
  }

  function applyDictionary(dictionary) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const value = lookupKey(dictionary, key);
      if (value === undefined) return;
      el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      const value = lookupKey(dictionary, key);
      if (value === undefined) return;
      el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const raw = el.getAttribute("data-i18n-attr");
      if (!raw) return;

      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((pair) => {
          const parts = pair.split(":").map((s) => s.trim());
          if (parts.length !== 2) return;
          const [attr, key] = parts;
          const value = lookupKey(dictionary, key);
          if (value === undefined) return;
          el.setAttribute(attr, value);
        });
    });
  }

  function wireLanguageButtons() {
    document.querySelectorAll("[data-lang-button]").forEach((el) => {
      const target = el.getAttribute("data-lang-button");
      if (!target || !SUPPORTED_LANGS.includes(target)) return;

      el.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.assign(buildLangUrl(target));
      });
    });
  }

  function markActiveLanguage(lang) {
    document.querySelectorAll("[data-lang-button]").forEach((el) => {
      const target = el.getAttribute("data-lang-button");
      if (target === lang) {
        el.setAttribute("aria-current", "true");
        el.classList.add("lang-active");
      } else {
        el.removeAttribute("aria-current");
        el.classList.remove("lang-active");
      }
    });
  }

  async function init() {
    const lang = currentLang();
    document.documentElement.lang = lang;
    preserveLangInLinks(lang);
    wireLanguageButtons();
    markActiveLanguage(lang);

    try {
      const dictionary = await loadDictionary(lang);
      applyDictionary(dictionary);
    } catch (err) {
      console.error(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
