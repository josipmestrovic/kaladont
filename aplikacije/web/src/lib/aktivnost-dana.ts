/**
 * Centralni klijentski okidač za evidenciju aktivnog dana.
 * Šalje samo pri stvarnoj vidljivoj aktivnosti registriranog čovjeka.
 */
import { api } from './api.js';
import { jeRegistriranKorisnik } from './identitet.js';
import { pokaziUspjeh } from './uspjeh-obavijest.svelte.js';

interface OdgovorAktivnostiDana {
  ok: true;
  lokalniDatum: string;
  trenutniNiz: number;
  najboljiNiz: number;
  razinaDostignuca: number;
  novootkljucanaRazina: number | null;
  serverTimeIso: string;
  sljedeciDanOdIso: string;
}

let uLetu: Promise<void> | null = null;
let potvrdeniLokalniDatum: string | null = null;
let sljedeciDanOdMs: number | null = null;
let cekaInputNakonPonoci = false;
let pokrenuto = false;

function smijeSlati(): boolean {
  return typeof document !== 'undefined'
    && jeRegistriranKorisnik()
    && document.visibilityState === 'visible';
}

function resetirajDedupe(): void {
  potvrdeniLokalniDatum = null;
  sljedeciDanOdMs = null;
  cekaInputNakonPonoci = false;
}

async function posaljiJednom(): Promise<void> {
  if (!smijeSlati()) return;
  if (uLetu) return uLetu;

  uLetu = (async () => {
    try {
      const odgovor = await api<OdgovorAktivnostiDana>('/racuni/aktivnost-dana', { method: 'POST', body: '{}' });
      potvrdeniLokalniDatum = odgovor.lokalniDatum;
      sljedeciDanOdMs = Date.parse(odgovor.sljedeciDanOdIso);
      cekaInputNakonPonoci = false;
      if (odgovor.novootkljucanaRazina !== null && odgovor.trenutniNiz > 0) {
        const dana = odgovor.trenutniNiz;
        pokaziUspjeh(`Bravo! Stalno si tu, ${dana} ${dana === 1 ? 'dan' : 'dana'} zaredom!`);
      }
    } catch {
      // Igra i dalje radi; retry na sljedeću stvarnu aktivnost.
    } finally {
      uLetu = null;
    }
  })();

  return uLetu;
}

function trebaNoviDanNakonPonoci(): boolean {
  return sljedeciDanOdMs !== null && Date.now() >= sljedeciDanOdMs;
}

function naVidljivost(): void {
  if (!smijeSlati()) return;
  if (potvrdeniLokalniDatum !== null && !trebaNoviDanNakonPonoci()) return;
  void posaljiJednom();
}

function naIdentitet(): void {
  resetirajDedupe();
  if (smijeSlati()) void posaljiJednom();
}

function naKorisnickiInput(): void {
  if (!smijeSlati()) return;
  if (!trebaNoviDanNakonPonoci() && potvrdeniLokalniDatum !== null) return;
  if (trebaNoviDanNakonPonoci() || potvrdeniLokalniDatum === null) {
    cekaInputNakonPonoci = false;
    void posaljiJednom();
  }
}

function naPromjenaVidljivosti(): void {
  if (document.visibilityState !== 'visible') return;
  if (trebaNoviDanNakonPonoci()) {
    // Tab je ostao otvoren preko ponoći: čekaj stvarni input, ne auto-ping.
    cekaInputNakonPonoci = true;
    return;
  }
  naVidljivost();
}

/**
 * Jednokratna registracija lifecycle hookova (layout).
 * Vraća cleanup.
 */
export function pokreniEvidencijuAktivnogDana(): () => void {
  if (typeof window === 'undefined' || pokrenuto) return () => {};
  pokrenuto = true;

  if (smijeSlati()) void posaljiJednom();

  const onVisibility = () => naPromjenaVidljivosti();
  const onIdentitet = () => naIdentitet();
  const onInput = () => {
    if (cekaInputNakonPonoci || trebaNoviDanNakonPonoci() || potvrdeniLokalniDatum === null) {
      naKorisnickiInput();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('kaladont:identitet-promijenjen', onIdentitet);
  window.addEventListener('pointerdown', onInput, { passive: true });
  window.addEventListener('keydown', onInput);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('kaladont:identitet-promijenjen', onIdentitet);
    window.removeEventListener('pointerdown', onInput);
    window.removeEventListener('keydown', onInput);
    pokrenuto = false;
    uLetu = null;
    resetirajDedupe();
  };
}
