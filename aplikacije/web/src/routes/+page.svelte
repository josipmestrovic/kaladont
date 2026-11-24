<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { BROJ_AKTIVNIH_IZAZOVA } from 'zajednicko';
  import { api } from '$lib/api.js';
  import { NAJNOVIJE_IZDANJE } from '$lib/izdanja.js';
  import { zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import { putanjaBrzeIgre } from '$lib/igraj-rute.js';
  import { dohvatiKatalogIzazova } from '$lib/izazovi-klijent.js';
  import {
    defaultOpisIzazova,
    izracunajPrikazIzazova,
    type PrikazIzazovaKartice,
  } from '$lib/naslovnica-izazovi.js';
  import BrzePostavke from '$lib/komponente/BrzePostavke.svelte';
  import NaslovnicaNapredak from '$lib/komponente/NaslovnicaNapredak.svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import {
    ariaBadgaDostignuca,
    labelaZvjezdicaDostignuca,
    MAKSIMALNO_ZVJEZDICA_NASLOVNICA,
    normalizirajZvjezdiceDostignuca,
    type PrikazZvjezdicaDostignuca,
  } from '$lib/naslovnica-dostignuca.js';
  import {
    ariaBadgaMisija,
    labelaAktivnihMisija,
    natpisBadgaMisija,
  } from '$lib/naslovnica-misije.js';
  import {
    NASLOVNICA_SEO_DESCRIPTION,
    NASLOVNICA_SEO_TITLE,
    naslovnicaJsonLd,
  } from '$lib/seo.js';
  import {
    dohvatiStanjeMisijaStore,
    invalidirajStanjeMisija,
    osigurajStanjeMisija,
  } from '$lib/stanje-misija.svelte.js';
  import { osigurajProfil, stanjeProfila } from '$lib/stanje-profila.svelte.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  const misijeStore = dohvatiStanjeMisijaStore();
  const misijeBadge = $derived(natpisBadgaMisija(misijeStore.aktivne));
  const misijeLabela = $derived(labelaAktivnihMisija(misijeStore.aktivne));
  const misijeAria = $derived(ariaBadgaMisija(misijeStore.aktivne));
  const godinaCopyright = new Date().getFullYear();

  const FOCUS_REFRESH_MS = 45_000;
  let zadnjiFocusRefresh = 0;
  let izazoviPrikaz = $state<PrikazIzazovaKartice>({
    vrsta: 'default',
    opis: defaultOpisIzazova(BROJ_AKTIVNIH_IZAZOVA),
  });
  let izazoviGeneracija = 0;
  let kolekcijaGeneracija = 0;
  let dostignucaGeneracija = 0;
  let kolekcijaRazinaNaziv = $state('Početnik');
  let brojRijeciKolekcije = $state<number | null>(null);
  let dostignucaZvjezdice = $state<PrikazZvjezdicaDostignuca>({
    ukupno: 0,
    maksimalno: MAKSIMALNO_ZVJEZDICA_NASLOVNICA,
  });
  type DostignuceNaslovnice = {
    id: string;
    naziv: string;
    opis: string;
    kategorija: 'napredak' | 'rijeci' | 'vjestina' | 'kaladont' | 'igra';
    pragovi: readonly number[];
    razina: number;
    vrijednost: number;
    sljedeciPrag: number | null;
  };
  let dostignucaPopis = $state<DostignuceNaslovnice[]>([]);
  const kolekcijaBrojLabela = $derived(
    brojRijeciKolekcije === null
      ? '…'
      : brojRijeciKolekcije === 1
        ? '1 riječ'
        : `${brojRijeciKolekcije} riječi`,
  );
  const kolekcijaAria = $derived(
    brojRijeciKolekcije === null
      ? `Kolekcija riječi, ${kolekcijaRazinaNaziv}`
      : `Kolekcija riječi, ${kolekcijaBrojLabela}, ${kolekcijaRazinaNaziv}`,
  );
  const dostignucaLabela = $derived(labelaZvjezdicaDostignuca(dostignucaZvjezdice));
  const dostignucaAria = $derived(ariaBadgaDostignuca(dostignucaZvjezdice));
  const jeGost = $derived(
    stanjeProfila.status === 'spreman' && stanjeProfila.profil?.vrsta === 'gost',
  );

  function idiUBrzuIgru(opcije: { izQueryja?: boolean } = {}) {
    if (!opcije.izQueryja) zabiljeziUmamiDogadjaj('naslovnica-brza-igra-klik');
    zagrijGameplayZvukove();
    void goto(putanjaBrzeIgre());
  }

  function naTreningKlik() {
    zabiljeziUmamiDogadjaj('naslovnica-trening-klik');
    zagrijGameplayZvukove();
  }

  async function osvjeziIzazove() {
    const generacija = ++izazoviGeneracija;
    try {
      const katalog = await dohvatiKatalogIzazova();
      if (generacija !== izazoviGeneracija) return;
      izazoviPrikaz = izracunajPrikazIzazova(katalog);
    } catch {
      if (generacija !== izazoviGeneracija) return;
      izazoviPrikaz = { vrsta: 'default', opis: defaultOpisIzazova(BROJ_AKTIVNIH_IZAZOVA) };
    }
  }

  async function osvjeziKolekciju() {
    const generacija = ++kolekcijaGeneracija;
    try {
      const odgovor = await api<{
        ukupnoOtkljucano?: number;
        kolekcionarskaRazina?: { naziv?: string };
      }>('/profil/kolekcija');
      if (generacija !== kolekcijaGeneracija) return;
      const naziv = odgovor.kolekcionarskaRazina?.naziv?.trim();
      kolekcijaRazinaNaziv = naziv && naziv.length > 0 ? naziv : 'Početnik';
      const broj = odgovor.ukupnoOtkljucano;
      brojRijeciKolekcije =
        typeof broj === 'number' && Number.isFinite(broj) && broj >= 0 ? Math.floor(broj) : null;
    } catch {
      // Zadrži zadnji uspješan sažetak; ne piši Početnik/0 preko stvarnog napretka.
      if (generacija !== kolekcijaGeneracija) return;
    }
  }

  async function osvjeziDostignucaZvjezdice() {
    const generacija = ++dostignucaGeneracija;
    try {
      const odgovor = await api<{
        ukupnoZvjezdica?: number;
        maksimalnoZvjezdica?: number;
        dostignuca?: DostignuceNaslovnice[];
      }>('/dostignuca');
      if (generacija !== dostignucaGeneracija) return;
      dostignucaZvjezdice = normalizirajZvjezdiceDostignuca(odgovor);
      dostignucaPopis = Array.isArray(odgovor.dostignuca) ? odgovor.dostignuca : [];
    } catch {
      // Zadrži zadnji uspješan sažetak; ne piši 0 zvjezdica preko stvarnog napretka.
      if (generacija !== dostignucaGeneracija) return;
    }
  }

  function osvjeziNaslovnicu() {
    void osigurajProfil({ forsaj: true }).then(() => {
      if (stanjeProfila.status === 'spreman' || stanjeProfila.status === 'greska') {
        void osvjeziIzazove();
        void osigurajStanjeMisija({ forsaj: true });
        void osvjeziKolekciju();
        void osvjeziDostignucaZvjezdice();
      }
    });
  }

  onMount(() => {
    // ?igraj=1 → izravno Troboj / Brza igra (bez modala).
    if ($page.url.searchParams.get('igraj') === '1') idiUBrzuIgru({ izQueryja: true });

    const naIdentitet = () => {
      izazoviGeneracija += 1;
      kolekcijaGeneracija += 1;
      dostignucaGeneracija += 1;
      izazoviPrikaz = { vrsta: 'default', opis: defaultOpisIzazova(BROJ_AKTIVNIH_IZAZOVA) };
      kolekcijaRazinaNaziv = 'Početnik';
      brojRijeciKolekcije = null;
      dostignucaZvjezdice = {
        ukupno: 0,
        maksimalno: MAKSIMALNO_ZVJEZDICA_NASLOVNICA,
      };
      dostignucaPopis = [];
      invalidirajStanjeMisija();
      osvjeziNaslovnicu();
    };
    window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);

    const naVidljivost = () => {
      if (document.visibilityState !== 'visible') return;
      if ($page.url.pathname !== '/') return;
      const sada = Date.now();
      if (sada - zadnjiFocusRefresh < FOCUS_REFRESH_MS) return;
      zadnjiFocusRefresh = sada;
      osvjeziNaslovnicu();
    };
    document.addEventListener('visibilitychange', naVidljivost);

    // Dijeli in-flight s Headerom; zatim GET /izazovi, /misije, kolekcija i dostignuća.
    void osigurajProfil().then(() => {
      void osvjeziIzazove();
      void osigurajStanjeMisija();
      void osvjeziKolekciju();
      void osvjeziDostignucaZvjezdice();
    });

    return () => {
      window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
      document.removeEventListener('visibilitychange', naVidljivost);
      izazoviGeneracija += 1;
      kolekcijaGeneracija += 1;
      dostignucaGeneracija += 1;
    };
  });
</script>

<SeoGlava
  title={NASLOVNICA_SEO_TITLE}
  description={NASLOVNICA_SEO_DESCRIPTION}
  putanja="/"
  jsonLd={naslovnicaJsonLd()}
/>

<main class="landing">
  <section class="izbornik" aria-labelledby="naslov-kaladont">
    <div class="navigacijski-blok">
      <div class="profil-red">
        <NaslovnicaNapredak
          izazoviZavrseno={izazoviPrikaz.vrsta === 'napredak' ? izazoviPrikaz.zavrseno : 0}
          dostignuca={dostignucaPopis}
        />
      </div>
      <nav class="glavna-navigacija" aria-label="Glavna navigacija">
        <button
          type="button"
          class="navigacijska-stavka primarna"
          aria-labelledby="naslov-brza-igra"
          aria-describedby="opis-brza-igra napomena-brza-igra{jeGost ? ' gost-napomena-brza-igra' : ''}"
          data-testid="naslovnica-brza-igra"
          onclick={() => idiUBrzuIgru()}
        >
          <span class="stavka-sadrzaj">
            <img
              class="stavka-ikona stavka-ikona--primarna"
              src="/ikone/07-igraj.png"
              alt=""
              width="72"
              height="72"
            />
            <span class="stavka-tekst">
              <strong id="naslov-brza-igra">Troboj</strong>
              <small id="opis-brza-igra">Igraj online u troje.</small>
              <small id="napomena-brza-igra" class="stavka-napomena"
                >Ako nema igrača, pridružit će se botovi.</small
              >
            </span>
          </span>
          <span class="primarna-akcija">
            <span class="cta" aria-hidden="true">
              <svg class="cta-play" viewBox="0 0 12 14" width="16" height="18" aria-hidden="true">
                <path fill="currentColor" d="M1 1.2v11.6L11 7 1 1.2Z" />
              </svg>
              Igraj odmah
            </span>
            {#if jeGost}
              <small
                id="gost-napomena-brza-igra"
                class="stavka-napomena stavka-napomena--gost"
                data-testid="naslovnica-brza-igra-gost-napomena"
                >Besplatno · Bez registracije</small
              >
            {/if}
          </span>
        </button>

        <a
          href="/izazovi"
          class="navigacijska-stavka"
          aria-labelledby="naslov-izazovi"
          aria-describedby="opis-izazovi{izazoviPrikaz.vrsta === 'napredak' ? ' broj-izazovi' : ''}"
          data-testid="naslovnica-izazovi"
          onclick={() => zabiljeziUmamiDogadjaj('naslovnica-izazovi-klik')}
        >
          <span class="stavka-sadrzaj">
            <img class="stavka-ikona" src="/ikone/06-trofej.png" alt="" width="48" height="48" />
            <span class="stavka-tekst">
              <strong id="naslov-izazovi">Izazovi</strong>
              <small id="opis-izazovi">{izazoviPrikaz.opis}</small>
              {#if izazoviPrikaz.vrsta === 'napredak'}
                <span class="izazovi-napredak">
                  <span
                    class="izazovi-napredak__traka"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={izazoviPrikaz.ukupno}
                    aria-valuenow={izazoviPrikaz.zavrseno}
                    aria-labelledby="broj-izazovi"
                  >
                    <span style={`width: ${izazoviPrikaz.postotak}%`}></span>
                  </span>
                  <span id="broj-izazovi" class="izazovi-napredak__broj">
                    {izazoviPrikaz.zavrseno} / {izazoviPrikaz.ukupno} završenih izazova
                  </span>
                </span>
              {/if}
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>

        <a
          href="/trening"
          class="navigacijska-stavka"
          aria-labelledby="naslov-trening"
          aria-describedby="opis-trening"
          data-testid="naslovnica-trening"
          onclick={naTreningKlik}
        >
          <span class="stavka-sadrzaj">
            <img class="stavka-ikona" src="/ikone/67-zagrijavanje-bot.webp" alt="" width="48" height="48" />
            <span class="stavka-tekst">
              <strong id="naslov-trening">Trening</strong>
              <small id="opis-trening">Vježbaj protiv botova po svojim pravilima.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>

        <a
          href="/soba/kreiraj"
          class="navigacijska-stavka privatna"
          aria-labelledby="naslov-privatna"
          aria-describedby="opis-privatna"
          data-testid="naslovnica-privatna-soba"
          onclick={() => zabiljeziUmamiDogadjaj('naslovnica-privatna-soba-klik')}
        >
          <span class="stavka-sadrzaj">
            <img class="stavka-ikona" src="/ikone/18-privatna-soba.png" alt="" width="48" height="48" />
            <span class="stavka-tekst">
              <strong id="naslov-privatna">Privatna soba</strong>
              <small id="opis-privatna">Pozovi ekipu i igrajte po svojim pravilima.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>

        <a
          href="/ljestvice"
          class="navigacijska-stavka"
          aria-labelledby="naslov-ljestvice"
          aria-describedby="opis-ljestvice"
          data-testid="naslovnica-ljestvice"
          onclick={() => zabiljeziUmamiDogadjaj('naslovnica-ljestvice-klik')}
        >
          <span class="stavka-sadrzaj">
            <img class="stavka-ikona" src="/ikone/09-ljestvice.png" alt="" width="48" height="48" />
            <span class="stavka-tekst">
              <strong id="naslov-ljestvice">Ljestvice</strong>
              <small id="opis-ljestvice">Usporedi se s najboljim igračima.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>
      </nav>

      <div class="sporedni-red">
        <nav class="sporedna-navigacija" aria-label="Napredak i pomoć">
          <a
            href="/misije"
            class="sporedni-precac"
            data-testid="naslovnica-misije"
            aria-label={`Misije, ${misijeAria}`}
            onclick={() => zabiljeziUmamiDogadjaj('naslovnica-misije-klik')}
          >
            <span class="sporedni-precac__ikona">
              <img src="/ikone/62-misije.webp" alt="" width="48" height="48" />
              {#if misijeBadge}
                <span class="sporedni-precac__badge" data-testid="naslovnica-misije-badge" aria-hidden="true"
                  >{misijeBadge}</span
                >
              {/if}
            </span>
            <span class="sporedni-precac__tekst">
              <span class="sporedni-precac__naslov">Misije</span>
              <small class="sporedni-precac__podnaslov" data-testid="naslovnica-misije-labela"
                >{misijeLabela}</small
              >
            </span>
          </a>
          <a
            href="/profil#rijeci"
            class="sporedni-precac"
            data-testid="naslovnica-kolekcija"
            aria-label={kolekcijaAria}
            onclick={() => zabiljeziUmamiDogadjaj('naslovnica-kolekcija-klik')}
          >
            <span class="sporedni-precac__ikona">
              <img src="/ikone/08-pravila.png" alt="" width="48" height="48" />
            </span>
            <span class="sporedni-precac__tekst">
              <span class="sporedni-precac__naslov">
                <span class="samo-desktop">Kolekcija riječi</span>
                <span class="samo-mobilni">Kolekcija</span>
              </span>
              <small class="sporedni-precac__podnaslov" data-testid="naslovnica-kolekcija-labela">
                <span class="samo-desktop">{kolekcijaBrojLabela}</span>
                <span class="samo-mobilni">{kolekcijaBrojLabela}</span>
              </small>
              <small class="sporedni-precac__razina samo-desktop" aria-hidden="true"
                >{kolekcijaRazinaNaziv}</small
              >
            </span>
          </a>
          <a
            href="/profil#dostignuca"
            class="sporedni-precac"
            data-testid="naslovnica-dostignuca"
            aria-label={`Dostignuća, ${dostignucaAria}`}
            onclick={() => zabiljeziUmamiDogadjaj('naslovnica-dostignuca-klik')}
          >
            <span class="sporedni-precac__ikona">
              <img src="/ikone/27-zvjezdica-puna.png" alt="" width="48" height="48" />
            </span>
            <span class="sporedni-precac__tekst">
              <span class="sporedni-precac__naslov">Dostignuća</span>
              <small class="sporedni-precac__podnaslov" data-testid="naslovnica-dostignuca-labela"
                >{dostignucaLabela}</small
              >
            </span>
          </a>
        </nav>
      </div>

      <div class="brze-postavke-blok">
        <BrzePostavke />
      </div>
    </div>
  </section>
  <div class="landing-prostor landing-prostor--dolje" aria-hidden="true"></div>

  <footer class="landing-footer">
    <p class="podnozje-red">
      <span class="podnozje-lijevo">
        {#if NAJNOVIJE_IZDANJE}
          <span class="zadnje-azuriranje">
            Ažurirano
            <time datetime={NAJNOVIJE_IZDANJE.objavljeno}>{NAJNOVIJE_IZDANJE.datumHr}</time>
            <span class="razdjelnik" aria-hidden="true">·</span>
            <a
              class="sto-je-novo"
              href="/novosti"
              onclick={() => zabiljeziUmamiDogadjaj('naslovnica-novosti-klik')}
            >Što je novo?</a>
          </span>
        {/if}
      </span>
      <span class="copyright">© {godinaCopyright} Kaladont</span>
      <span class="podnozje-desno">
        <a href="/uvjeti">Uvjeti</a>
        <span class="razdjelnik" aria-hidden="true">·</span>
        <a href="/privatnost">Privatnost</a>
      </span>
    </p>
  </footer>
</main>

<style>
  /* Centriran landing; naslov (h1) je u Headeru kao logo (absolute overlay). */
  .landing {
    /* Visina absolute headera + željeni razmak do profila (16–24 mobitel). */
    --header-clearance: 52px;
    --razmak-header-profil: 20px;
    --landing-padding-dolje: clamp(8px, 2.2dvh, 32px);
    --razmak-stavki: 12px;
    --font-stavke: clamp(16px, 2.6dvh, 20px);
    --font-opisa: clamp(13px, 2dvh, 15px);
    --padding-stavke: 16px;
    --razmak-naslov-opis: 6px;
    --radijus-stavke: 16px;
    --ikona-sporedna: 36px;
    --ikona-primarna: 48px;
    --font-brza-igra: clamp(22px, 3dvh, 24px);
    --sirina-grida: 980px;
    --sjena-stavke: 0 1px 4px rgb(0 0 0 / 18%);
    --sjena-stavke-hover: 0 4px 14px rgb(0 0 0 / 22%);

    position: relative;
    isolation: isolate;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding-top: calc(var(--header-clearance) + var(--razmak-header-profil));
    padding-bottom: var(--landing-padding-dolje);
    padding-inline: 16px;
  }

  /* Donji spacer: footer na dnu kad sadržaj stane; bez gornjeg flex zraka. */
  .landing-prostor {
    flex: 1 1 0;
    min-height: 8px;
    width: 100%;
    pointer-events: none;
  }

  .izbornik {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 16px;
    width: min(100%, var(--sirina-grida));
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .navigacijski-blok {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-width: 0;
    width: 100%;
  }

  .profil-red {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
  }

  .brze-postavke-blok {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--boja-tekst-sekundarni) 24%, transparent);
  }

  .glavna-navigacija {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--razmak-stavki);
    width: 100%;
    min-width: 0;
  }

  .navigacijska-stavka {
    position: relative;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: var(--padding-stavke);
    border: 1px solid var(--boja-plocica-obrub);
    border-radius: var(--radijus-stavke);
    background: var(--boja-plocica);
    box-shadow: var(--sjena-stavke);
    color: var(--boja-plocica-tekst);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }

  .stavka-sadrzaj {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-width: 0;
    text-align: left;
  }

  .stavka-ikona {
    display: block;
    width: var(--ikona-sporedna);
    height: var(--ikona-sporedna);
    object-fit: contain;
    flex-shrink: 0;
  }

  .stavka-ikona--primarna {
    width: var(--ikona-primarna);
    height: var(--ikona-primarna);
  }

  .stavka-tekst {
    display: grid;
    gap: var(--razmak-naslov-opis);
    min-width: 0;
  }

  .stavka-tekst strong {
    font-family: var(--font-naslov);
    font-size: var(--font-stavke);
    font-weight: 700;
    line-height: 1.15;
  }

  .stavka-tekst small {
    color: color-mix(in srgb, var(--boja-plocica-tekst) 72%, transparent);
    font-family: var(--font-tijelo);
    font-size: var(--font-opisa);
    font-weight: 500;
    line-height: 1.35;
  }

  .stavka-napomena {
    display: block;
    margin-top: 4px;
    color: color-mix(in srgb, #1a1815 68%, transparent);
    font-size: clamp(13px, 1.9dvh, 15px);
    font-weight: 500;
    font-style: normal;
    line-height: 1.3;
  }

  .stavka-napomena--gost {
    margin-top: 0;
    color: color-mix(in srgb, #1a1815 62%, transparent);
    font-size: 13px;
    font-weight: 600;
    text-align: center;
  }

  .primarna-akcija {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
  }

  .izazovi-napredak {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .izazovi-napredak__traka {
    display: block;
    width: 100%;
    height: 7px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: color-mix(in srgb, #1a1815 12%, transparent);
  }

  .izazovi-napredak__traka > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-zuta-krema);
  }

  .izazovi-napredak__broj {
    color: color-mix(in srgb, #1a1815 70%, transparent);
    font-family: var(--font-tijelo);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
  }

  .cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    min-height: 46px;
    margin-top: 4px;
    padding: 10px 18px;
    border-radius: 12px;
    background: var(--boja-mint);
    color: #fff;
    font-family: var(--font-naslov);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .cta-play {
    flex-shrink: 0;
  }

  .strelica {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: color-mix(in srgb, var(--boja-plocica-tekst) 55%, transparent);
    font-size: 20px;
    font-weight: 500;
    line-height: 1;
    pointer-events: none;
    transition: transform 180ms ease;
  }

  .navigacijska-stavka.primarna {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 16px;
    min-height: 112px;
    padding: 20px;
    border-color: transparent;
    background: var(--boja-zuta-krema);
    color: #1a1815;
  }

  .navigacijska-stavka.primarna .stavka-sadrzaj {
    gap: 14px;
  }

  .navigacijska-stavka.primarna .stavka-tekst strong {
    font-size: var(--font-brza-igra);
  }

  .navigacijska-stavka.primarna .stavka-tekst small {
    color: color-mix(in srgb, #1a1815 72%, transparent);
    font-size: clamp(15px, 2.1dvh, 17px);
    font-weight: 500;
  }

  .navigacijska-stavka.primarna .cta {
    margin-top: 0;
    min-height: 46px;
  }

  @media (min-width: 1000px) {
    .landing {
      --ikona-primarna: 52px;
      --ikona-sporedna: 40px;
      --padding-stavke: 22px 24px;
      --font-brza-igra: 24px;
    }

    .navigacijska-stavka.primarna {
      grid-template-columns: minmax(0, 1fr) minmax(240px, 300px);
      align-items: stretch;
      gap: 24px;
      min-height: 128px;
      padding: 24px;
    }

    .navigacijska-stavka.primarna .primarna-akcija {
      align-self: center;
    }

    .navigacijska-stavka.primarna .cta {
      width: 100%;
      min-height: 50px;
      margin-top: 0;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 17px;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .navigacijska-stavka:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--boja-mint) 55%, var(--boja-plocica-obrub));
      box-shadow: var(--sjena-stavke-hover);
    }

    .navigacijska-stavka:hover .strelica {
      transform: translateX(3px);
    }

    .navigacijska-stavka.primarna:hover {
      border-color: transparent;
    }

    .sporedni-precac:hover {
      color: var(--boja-akcent-tekst);
      background: var(--boja-povrsina-2);
      border-color: color-mix(in srgb, #fff 20%, transparent);
    }

    :global(html[data-tema='svijetla']) .sporedni-precac:hover {
      background: color-mix(in srgb, var(--boja-mint) 12%, transparent);
      border-color: color-mix(in srgb, var(--boja-mint) 34%, transparent);
    }
  }

  .navigacijska-stavka:focus-visible {
    outline: 3px solid var(--boja-zuta-krema);
    outline-offset: 3px;
  }

  .sporedni-precac:focus-visible {
    outline: 3px solid var(--boja-zuta-krema);
    outline-offset: 2px;
    border-radius: 12px;
  }

  .sporedni-red {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .sporedna-navigacija {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    justify-content: center;
    justify-items: stretch;
    align-items: stretch;
  }

  .sporedni-precac {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    width: 100%;
    min-height: 100%;
    padding: 12px 8px;
    border-radius: 12px;
    background: var(--boja-povrsina);
    border: 1px solid color-mix(in srgb, #fff 14%, transparent);
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    text-decoration: none;
    transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
  }

  :global(html[data-tema='svijetla']) .sporedni-precac {
    background: color-mix(in srgb, var(--boja-mint) 7%, transparent);
    border-color: color-mix(in srgb, var(--boja-mint) 26%, transparent);
  }

  .sporedni-precac__tekst {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 0;
  }

  .sporedni-precac__naslov {
    display: block;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
  }

  .sporedni-precac__podnaslov,
  .sporedni-precac__razina {
    display: block;
    margin: 0;
    color: color-mix(in srgb, var(--boja-tekst-sekundarni) 88%, transparent);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
  }

  .sporedni-precac__razina {
    font-weight: 500;
    opacity: 0.9;
  }

  .samo-mobilni {
    display: none;
  }

  .samo-desktop {
    display: inline;
  }

  .sporedni-precac img {
    display: block;
    width: 36px;
    height: 36px;
    object-fit: contain;
  }

  .sporedni-precac__ikona {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    overflow: visible;
  }

  .sporedni-precac__badge {
    position: absolute;
    top: -6px;
    right: -10px;
    z-index: 1;
    min-width: 22px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--boja-crvena);
    color: #fff;
    font-family: var(--font-tijelo);
    font-size: 14px;
    font-weight: 800;
    line-height: 20px;
    text-align: center;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--boja-pozadina) 80%, transparent);
    pointer-events: none;
  }

  .landing-footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: min(100%, var(--sirina-grida));
    text-align: center;
  }

  .podnozje-red {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 8px;
    width: 100%;
    max-width: 100%;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.3;
  }

  .podnozje-lijevo,
  .podnozje-desno {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 8px;
  }

  .podnozje-red .razdjelnik {
    color: color-mix(in srgb, var(--boja-tekst-sekundarni) 70%, transparent);
  }

  .zadnje-azuriranje {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 8px;
  }

  .zadnje-azuriranje time {
    white-space: nowrap;
  }

  .copyright {
    white-space: nowrap;
  }

  .landing-footer a {
    display: inline-flex;
    align-items: center;
    padding: clamp(4px, 1dvh, 8px) 2px;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: var(--tekst-sitni);
    text-decoration: underline;
    cursor: pointer;
    white-space: nowrap;
  }

  .landing-footer a:hover { color: var(--boja-akcent-tekst); }

  @media (min-width: 1000px) {
    .landing {
      /* Desktop H1 ~60px + top 6px; razmak header→profil 24–40 px. */
      --header-clearance: 70px;
      --razmak-header-profil: 32px;
      --landing-padding-dolje: clamp(8px, 1.8dvh, 24px);
      --font-stavke: 20px;
      --font-opisa: 15px;
      --padding-stavke: 22px 24px;
      --ikona-sporedna: 40px;
      --ikona-primarna: 52px;
      --font-brza-igra: 24px;
      --razmak-stavki: 14px;
      --sjena-stavke: 0 1px 5px rgb(0 0 0 / 16%);
      --sjena-stavke-hover: 0 4px 16px rgb(0 0 0 / 20%);
    }

    .izbornik,
    .navigacijski-blok {
      gap: 24px;
    }

    .profil-red {
      align-items: stretch;
      width: 100%;
    }

    .profil-red :global(.naslovnica-napredak-omotac) {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin: 0;
    }

    .brze-postavke-blok {
      gap: 12px;
      padding-top: 12px;
      width: 100%;
      max-width: none;
      margin-inline: 0;
    }

    .landing-footer {
      width: min(100%, var(--sirina-grida));
      justify-content: stretch;
      text-align: left;
    }

    .podnozje-red {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 12px 16px;
    }

    .podnozje-lijevo {
      flex-wrap: wrap;
      justify-content: flex-start;
      justify-self: start;
      min-width: 0;
      max-width: 100%;
    }

    .copyright {
      justify-self: center;
      text-align: center;
      min-width: 0;
    }

    .podnozje-desno {
      flex-wrap: wrap;
      justify-content: flex-end;
      justify-self: end;
      min-width: 0;
      max-width: 100%;
    }

    .zadnje-azuriranje {
      justify-content: flex-start;
    }

    .glavna-navigacija {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: stretch;
    }

    .navigacijska-stavka {
      min-height: 116px;
      height: 100%;
      box-sizing: border-box;
    }

    .navigacijska-stavka.primarna {
      grid-column: 1 / -1;
      height: auto;
    }

    .sporedni-red {
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-top: 0;
      width: 100%;
    }

    .sporedna-navigacija {
      gap: 12px;
      margin: 0 auto;
      width: min(100%, 580px);
      max-width: 580px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      justify-content: center;
      justify-items: stretch;
    }

    .sporedni-precac {
      gap: 10px;
      padding: 14px 12px;
      font-size: 15px;
    }

    .sporedni-precac__tekst {
      min-height: 0;
      gap: 3px;
    }

    .sporedni-precac__naslov {
      font-size: 15px;
      line-height: 1.2;
    }

    .sporedni-precac__podnaslov,
    .sporedni-precac__razina {
      font-size: 12px;
      line-height: 1.25;
    }

    .sporedni-precac__badge {
      top: -7px;
      right: -12px;
      font-size: 14px;
      min-width: 22px;
      height: 20px;
      padding: 0 6px;
      line-height: 20px;
    }

    .sporedni-precac img,
    .sporedni-precac__ikona {
      width: 40px;
      height: 40px;
    }
  }

  /* Niski desktop: smanji prazan prostor, CTA ostaje vidljiv, scroll je dopušten. */
  @media (min-width: 1000px) and (max-height: 700px) {
    .landing {
      --razmak-stavki: 10px;
      --razmak-header-profil: 24px;
      --landing-padding-dolje: clamp(4px, 1dvh, 12px);
      --padding-stavke: 16px 20px;
      --razmak-naslov-opis: 4px;
    }

    .landing-prostor {
      min-height: 4px;
    }

    .izbornik,
    .navigacijski-blok {
      gap: 12px;
    }

    .navigacijska-stavka {
      min-height: 84px;
    }

    .navigacijska-stavka.primarna {
      min-height: 100px;
    }
  }

  @media (max-width: 999px) {
    .landing {
      --header-clearance: 48px;
      --razmak-header-profil: 16px;
      --landing-padding-dolje: clamp(6px, 1.2dvh, 12px);
      --font-stavke: clamp(20px, 3dvh, 22px);
      --font-opisa: clamp(15px, 2.2dvh, 16px);
      --ikona-sporedna: 40px;
      --ikona-primarna: 48px;
      --font-brza-igra: clamp(22px, 3dvh, 24px);
      --sirina-grida: 440px;
      padding-inline: 12px;
    }

    .samo-desktop {
      display: none;
    }

    .samo-mobilni {
      display: inline;
    }

    .izbornik,
    .navigacijski-blok {
      gap: 14px;
    }

    .navigacijska-stavka:not(.primarna) {
      min-height: 88px;
      box-sizing: border-box;
    }

    .podnozje-red {
      flex-direction: column;
      gap: 10px;
    }

    .landing-footer a {
      padding: 6px 4px;
      font-size: 13px;
      line-height: 1.3;
    }

    .copyright {
      font-size: 13px;
      line-height: 1.3;
      order: 3;
    }

    .podnozje-desno {
      order: 2;
    }
  }

  @media (max-width: 379px) {
    .landing {
      --font-stavke: 20px;
      --font-opisa: clamp(14px, 3.6vw, 15px);
      --padding-stavke: 16px 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .navigacijska-stavka,
    .strelica,
    .sporedni-precac {
      transition: none;
    }

    .navigacijska-stavka:hover .strelica {
      transform: none;
    }
  }

  :global(html[data-tema='svijetla']) .landing {
    --sjena-stavke: 0 1px 4px rgb(38 34 27 / 8%);
    --sjena-stavke-hover: 0 4px 14px rgb(38 34 27 / 12%);
  }
</style>
