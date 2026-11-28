/*! GENERIRANO — ne uređuj ručno.
 * Izvor: src/lib/umami-sanitizacija.ts + umami-before-send-entry.ts
 * Regeneriraj: Vite plugin ili node skripte/generiraj-umami-before-send.mjs
 */

"use strict";
(() => {
  // src/lib/umami-sanitizacija.ts
  var IME_UMAMI_BEFORE_SEND = "kaladontUmamiBeforeSend";
  var UTM_ALLOWLISTA = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term"
  ];
  var UTM_MAX_DULJINA = 64;
  var SOBA_STATICKI = /* @__PURE__ */ new Set(["kreiraj"]);
  var UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  var CUID_ILI_ID = "[A-Za-z0-9_-]{8,}";
  var KOD_SOBE = "[2-9A-HJ-NP-Z]{6}";
  var PUTANJE = [
    { uzorak: new RegExp(`^/partija/arhiva/${UUID_SEGMENT}$`, "i"), zamjena: "/partija/arhiva/:id" },
    { uzorak: new RegExp(`^/partija/${UUID_SEGMENT}$`, "i"), zamjena: "/partija/:id" },
    { uzorak: new RegExp(`^/partija/${CUID_ILI_ID}$`, "i"), zamjena: "/partija/:id" },
    { uzorak: new RegExp(`^/soba/${KOD_SOBE}$`, "i"), zamjena: "/soba/:kod" },
    { uzorak: new RegExp(`^/profil/javni/${UUID_SEGMENT}$`, "i"), zamjena: "/profil/javni/:id" },
    { uzorak: new RegExp(`^/profil/javni/${CUID_ILI_ID}$`, "i"), zamjena: "/profil/javni/:id" },
    { uzorak: new RegExp(`^/pravila-kaladonta/${CUID_ILI_ID}$`, "i"), zamjena: "/pravila-kaladonta/:tema" }
  ];
  var NASLOV_UUID = new RegExp(UUID_SEGMENT, "ig");
  var NASLOV_KOD_SOBE = new RegExp(`\\b${KOD_SOBE}\\b`, "g");
  function normalizirajPutanjuZaAnalitiku(putanja) {
    let cista = putanja.split("?")[0]?.split("#")[0] || "/";
    try {
      cista = decodeURIComponent(cista);
    } catch {
    }
    if (cista.length > 1 && cista.endsWith("/")) {
      cista = cista.slice(0, -1);
    }
    return cista || "/";
  }
  function sanitizirajUmamiPutanju(putanja) {
    const cista = normalizirajPutanjuZaAnalitiku(putanja);
    const dijelovi = cista.split("/");
    if (dijelovi[1] === "soba" && dijelovi[2] && SOBA_STATICKI.has(dijelovi[2].toLowerCase())) {
      return cista;
    }
    for (const { uzorak, zamjena } of PUTANJE) {
      if (uzorak.test(cista)) return zamjena;
    }
    return cista;
  }
  function ocistiUtmVrijednost(sirova) {
    const bezKontrola = sirova.replace(/[\u0000-\u001f\u007f]/g, "");
    return bezKontrola.slice(0, UTM_MAX_DULJINA);
  }
  function filtrirajQuery(searchParams) {
    const zadrzani = new URLSearchParams();
    for (const kljuc of UTM_ALLOWLISTA) {
      const vrijednost = searchParams.get(kljuc);
      if (vrijednost != null && vrijednost !== "") {
        zadrzani.set(kljuc, ocistiUtmVrijednost(vrijednost));
      }
    }
    const tekst = zadrzani.toString();
    return tekst ? `?${tekst}` : "";
  }
  function sanitizirajUmamiUrl(sirovi, baza = "https://kaladont.hr") {
    const url = new URL(sirovi, baza);
    const putanja = sanitizirajUmamiPutanju(url.pathname);
    const query = filtrirajQuery(url.searchParams);
    return `${putanja}${query}`;
  }
  function sanitizirajUmamiReferrer(sirovi, baza = "https://kaladont.hr") {
    if (!sirovi) return "";
    try {
      const url = new URL(sirovi, baza);
      const lokalni = typeof globalThis.location?.origin === "string" ? globalThis.location.origin : new URL(baza).origin;
      if (url.origin !== lokalni && url.origin !== "https://kaladont.hr") {
        return url.origin;
      }
      const putanja = sanitizirajUmamiPutanju(url.pathname);
      const query = filtrirajQuery(url.searchParams);
      return `${putanja}${query}`;
    } catch {
      return "";
    }
  }
  function sanitizirajUmamiNaslov(naslov) {
    if (typeof naslov !== "string") return "";
    return naslov.replace(NASLOV_UUID, ":id").replace(NASLOV_KOD_SOBE, ":kod");
  }
  function umamiBeforeSend(_type, payload) {
    try {
      if (!payload || typeof payload !== "object") return false;
      const rezultat = { ...payload };
      const baza = typeof globalThis.location?.href === "string" ? globalThis.location.origin : "https://kaladont.hr";
      if (typeof rezultat.url === "string") {
        rezultat.url = sanitizirajUmamiUrl(rezultat.url, baza);
      }
      if (typeof rezultat.referrer === "string") {
        rezultat.referrer = sanitizirajUmamiReferrer(rezultat.referrer, baza);
      }
      if ("title" in rezultat) {
        rezultat.title = sanitizirajUmamiNaslov(rezultat.title);
      }
      return rezultat;
    } catch {
      return false;
    }
  }

  // src/lib/umami-before-send-entry.ts
  window[IME_UMAMI_BEFORE_SEND] = umamiBeforeSend;
})();
