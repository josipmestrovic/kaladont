<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { NAJNOVIJE_IZDANJE } from '$lib/izdanja.js';
  import { ucitajModalIgraAsete } from '$lib/asetovi-core.js';
  import { zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import { putanjaBrzeIgre } from '$lib/igraj-rute.js';
  import ModalIgraj from '$lib/komponente/ModalIgraj.svelte';
  import PopupNovihMisija from '$lib/komponente/PopupNovihMisija.svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import {
    NASLOVNICA_SEO_DESCRIPTION,
    NASLOVNICA_SEO_TITLE,
    naslovnicaJsonLd,
  } from '$lib/seo.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  const registriran = jeRegistriranKorisnik();
  let otvoreniModal = $state(false);

  function idiUBrzuIgru() {
    zabiljeziUmamiDogadjaj('igraj-klik');
    zagrijGameplayZvukove();
    void goto(putanjaBrzeIgre());
  }

  function otvoriTrening() {
    otvoreniModal = true;
    zabiljeziUmamiDogadjaj('igraj-klik');
    ucitajModalIgraAsete();
    zagrijGameplayZvukove();
  }

  onMount(() => {
    // ?igraj=1 → izravno Brza igra (bez modala).
    if ($page.url.searchParams.get('igraj') === '1') idiUBrzuIgru();
  });
</script>

<SeoGlava
  title={NASLOVNICA_SEO_TITLE}
  description={NASLOVNICA_SEO_DESCRIPTION}
  putanja="/"
  jsonLd={naslovnicaJsonLd()}
/>

<main class="landing">
  <div class="landing-prostor landing-prostor--gore" aria-hidden="true"></div>
  <section class="izbornik" aria-labelledby="naslov-kaladont">
    <div class="navigacijski-blok">
      <nav class="glavna-navigacija" aria-label="Glavna navigacija">
        <button
          type="button"
          class="navigacijska-stavka primarna"
          aria-label="Igraj"
          data-testid="naslovnica-brza-igra"
          onclick={idiUBrzuIgru}
        >
          <span class="stavka-sadrzaj" aria-hidden="true">
            <span class="stavka-tekst">
              <strong>Igraj</strong>
              <small>Klasična online igra u 3 igrača.</small>
            </span>
          </span>
          <span class="cta" aria-hidden="true">
            <svg class="cta-play" viewBox="0 0 12 14" width="16" height="18" aria-hidden="true">
              <path fill="currentColor" d="M1 1.2v11.6L11 7 1 1.2Z" />
            </svg>
            Igraj odmah
          </span>
        </button>

        <a href="/izazovi" class="navigacijska-stavka" aria-label="Izazovi" data-testid="naslovnica-izazovi">
          <span class="stavka-sadrzaj" aria-hidden="true">
            <span class="stavka-tekst">
              <strong>Izazovi</strong>
              <small>Svladavaj sve teže izazove.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>

        <button
          type="button"
          class="navigacijska-stavka"
          aria-label="Trening"
          data-testid="naslovnica-trening"
          onclick={otvoriTrening}
        >
          <span class="stavka-sadrzaj" aria-hidden="true">
            <span class="stavka-tekst">
              <strong>Trening</strong>
              <small>Vježbaj protiv računala.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </button>

        <a href="/soba/kreiraj" class="navigacijska-stavka privatna" aria-label="Privatna soba">
          <span class="stavka-sadrzaj" aria-hidden="true">
            <span class="stavka-tekst">
              <strong>Privatna soba</strong>
              <small>Pozovi ekipu i igrajte zajedno.</small>
            </span>
          </span>
          <span class="strelica" aria-hidden="true">›</span>
        </a>

        <div
          class="navigacijska-stavka turniri uskoro"
          aria-label="Turniri, izlazi uskoro"
          data-testid="naslovnica-turniri"
        >
          <span class="stavka-sadrzaj" aria-hidden="true">
            <span class="stavka-tekst">
              <strong>Turniri</strong>
              <small>Izlazi uskoro</small>
            </span>
          </span>
          <span class="oznaka-uskoro" aria-hidden="true">Uskoro</span>
        </div>
      </nav>
      {#if NAJNOVIJE_IZDANJE}
        <p class="zadnje-azuriranje">
          Zadnje ažuriranje:
          <time datetime={NAJNOVIJE_IZDANJE.objavljeno}>{NAJNOVIJE_IZDANJE.datumHr}</time>
          <span class="razdjelnik" aria-hidden="true">·</span>
          <a class="sto-je-novo" href="/novosti">Vidi što je novo</a>
        </p>
      {/if}
    </div>
  </section>
  <div class="landing-prostor landing-prostor--dolje" aria-hidden="true"></div>

  <footer class="landing-footer">
    <nav aria-label="Dodatne poveznice">
      <a href="/povratne-informacije">Povratne informacije</a>
      <a href="/uvjeti">Uvjeti</a>
      <a href="/privatnost">Privatnost</a>
    </nav>
    <small class="copyright">© 2026 Kaladont. Sva prava pridržana.</small>
  </footer>
</main>

{#if registriran}
  <PopupNovihMisija />
{/if}

<ModalIgraj otvoren={otvoreniModal} nacin="laganini" onZatvori={() => (otvoreniModal = false)} />

<style>
  /* Centriran landing; naslov (h1) je u Headeru kao logo. */
  .landing {
    --landing-padding: clamp(8px, 2.2dvh, 32px);
    --razmak-stavki: 16px;
    --font-stavke: clamp(26px, 3.2dvh, 30px);
    --font-opisa: clamp(17px, 2.1dvh, 18px);
    --padding-stavke: clamp(24px, 2.8dvh, 28px);
    --razmak-naslov-opis: 9px;
    --radijus-stavke: 20px;

    position: relative;
    isolation: isolate;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding-block: var(--landing-padding);
    padding-inline: 16px;
  }

  /*
   * Jednaki vizualni razmaci: header ↔ izbornik ↔ footer.
   * Gornji prostor dobiva padding kao kompenzaciju za absolute header,
   * pa flex:1 na oba daje isti „prazan” razmak oko izbornika.
   */
  .landing-prostor {
    flex: 1 1 0;
    min-height: 8px;
    width: 100%;
    pointer-events: none;
  }

  .landing-prostor--gore {
    box-sizing: content-box;
    padding-top: 56px;
  }

  .izbornik {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: clamp(12px, 1.8dvh, 18px);
    width: min(100%, 560px);
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .navigacijski-blok {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 1.8dvh, 18px);
    min-width: 0;
    width: 100%;
  }

  .glavna-navigacija {
    display: grid;
    grid-template-columns: 1fr;
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
    box-shadow: var(--sjena-suptilna);
    color: var(--boja-plocica-tekst);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .stavka-sadrzaj {
    display: grid;
    gap: var(--razmak-naslov-opis);
    min-width: 0;
    text-align: left;
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
    color: #5c554a;
    font-family: var(--font-tijelo);
    font-size: var(--font-opisa);
    font-weight: 500;
    line-height: 1.35;
  }

  .cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    margin-top: 4px;
    padding: 10px 18px;
    border-radius: var(--radijus-pill);
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
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, #1a1815 8%, transparent);
    color: color-mix(in srgb, #1a1815 45%, transparent);
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    pointer-events: none;
  }

  .navigacijska-stavka.uskoro {
    cursor: not-allowed;
    opacity: 0.78;
  }

  .navigacijska-stavka.uskoro:hover,
  .navigacijska-stavka.uskoro:focus-visible {
    transform: none;
    border-color: var(--boja-plocica-obrub);
    box-shadow: var(--sjena-suptilna);
  }

  .oznaka-uskoro {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: var(--radijus-pill);
    background: color-mix(in srgb, #1a1815 8%, transparent);
    color: color-mix(in srgb, #1a1815 55%, transparent);
    font-family: var(--font-tijelo);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1;
    pointer-events: none;
  }

  .navigacijska-stavka.primarna {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 16px;
    border-color: transparent;
    background: var(--boja-zuta-krema);
    color: #1a1815;
  }

  .navigacijska-stavka.primarna .stavka-sadrzaj {
    gap: 10px;
  }

  .navigacijska-stavka.primarna .stavka-tekst small {
    color: color-mix(in srgb, #1a1815 72%, transparent);
    font-weight: 500;
  }

  .navigacijska-stavka.primarna .cta {
    margin-top: 0;
  }

  @media (min-width: 1000px) {
    .navigacijska-stavka.primarna {
      grid-template-columns: minmax(0, 1fr) minmax(200px, 38%);
      align-items: stretch;
      gap: 24px;
    }

    .navigacijska-stavka.primarna .cta {
      align-self: center;
      width: 100%;
      min-height: 48px;
      margin-top: 0;
      padding: 12px 20px;
      border-radius: 14px;
      font-size: 17px;
    }
  }

  .navigacijska-stavka:hover {
    transform: translateY(-2px);
    border-color: var(--boja-mint);
    box-shadow: var(--sjena-modal);
  }

  .navigacijska-stavka.primarna:hover {
    border-color: transparent;
  }

  .zadnje-azuriranje {
    margin: 0;
    width: 100%;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.3;
    text-align: left;
  }

  .zadnje-azuriranje time {
    white-space: nowrap;
  }

  .zadnje-azuriranje a {
    color: inherit;
    font-weight: inherit;
    text-decoration: underline;
    white-space: nowrap;
  }

  .zadnje-azuriranje a:hover { color: var(--boja-akcent-tekst); }

  :global(html[data-font-disleksiju]) .zadnje-azuriranje .razdjelnik { display: none; }
  :global(html[data-font-disleksiju]) .zadnje-azuriranje .sto-je-novo {
    display: block;
    width: fit-content;
  }

  .landing-footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    width: min(100%, 980px);
  }

  .copyright {
    flex: none;
    font-size: var(--tekst-sitni);
    line-height: 1.2;
    color: var(--boja-tekst-sekundarni);
    white-space: nowrap;
  }

  .landing-footer nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 8px 18px;
  }

  .landing-footer a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: clamp(4px, 1dvh, 8px) 10px;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: var(--tekst-sitni);
    text-decoration: underline;
    cursor: pointer;
  }

  .landing-footer a:hover { color: var(--boja-akcent-tekst); }

  @media (min-width: 1000px) {
    .landing {
      --landing-padding: clamp(8px, 1.8dvh, 24px);
      --font-stavke: clamp(26px, 2.8dvh, 30px);
      --font-opisa: 18px;
      --padding-stavke: 28px;
      --visina-stavke: 120px;
    }

    .landing-prostor--gore {
      padding-top: 80px;
    }

    .izbornik {
      width: min(100%, 820px);
    }

    .glavna-navigacija {
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: var(--visina-stavke);
    }

    .navigacijska-stavka {
      min-height: var(--visina-stavke);
      height: 100%;
      box-sizing: border-box;
    }

    .navigacijska-stavka.primarna {
      grid-column: 1 / -1;
    }

    .landing-footer a { padding-inline: 0; }
  }

  /* 4 CTA: kratki desktop viewport mora stati u 100dvh bez scrolla (E2E 1366×500). */
  @media (min-width: 1000px) and (max-height: 600px) {
    .landing {
      --razmak-stavki: 10px;
      --landing-padding: clamp(4px, 1dvh, 10px);
      --font-stavke: clamp(22px, 3.2dvh, 26px);
      --font-opisa: clamp(14px, 2dvh, 16px);
      --padding-stavke: clamp(14px, 2.4dvh, 20px);
      --razmak-naslov-opis: 6px;
      --visina-stavke: 88px;
    }

    .landing-prostor {
      min-height: 4px;
    }

    .landing-prostor--gore {
      padding-top: 40px;
    }

    .izbornik {
      gap: clamp(8px, 1.4dvh, 14px);
    }

    .cta {
      margin-top: 0;
      padding: 7px 14px;
      font-size: 14px;
    }

    .stavka-tekst small {
      line-height: 1.2;
    }
  }

  @media (min-width: 1000px) and (max-height: 520px) {
    .landing {
      --razmak-stavki: 8px;
      --font-stavke: clamp(20px, 3dvh, 24px);
      --font-opisa: clamp(13px, 1.9dvh, 15px);
      --padding-stavke: 12px 16px;
      --visina-stavke: 72px;
    }

    .zadnje-azuriranje {
      font-size: 11px;
    }

    .cta {
      display: none;
    }
  }

  @media (min-width: 1000px) and (max-height: 600px) {
    :global(html[data-font-disleksiju]) .landing {
      --razmak-stavki: 8px;
      --font-stavke: clamp(18px, 2.8dvh, 24px);
      --font-opisa: clamp(12px, 1.8dvh, 14px);
      --padding-stavke: 12px 16px;
    }
  }

  @media (max-width: 999px) {
    .landing {
      --landing-padding: clamp(6px, 1.2dvh, 12px);
      --font-stavke: clamp(22px, 3dvh, 24px);
      --visina-sporedne: 92px;
      padding-inline: 12px;
    }

    .landing-prostor--gore {
      padding-top: 60px;
    }

    .izbornik {
      width: min(100%, 440px);
      gap: clamp(12px, 1.6dvh, 16px);
    }

    .navigacijska-stavka:not(.primarna) {
      min-height: var(--visina-sporedne);
      box-sizing: border-box;
    }

    .landing-footer { flex-direction: column; gap: 2px; }
    .landing-footer nav { justify-content: center; gap: 0 8px; }
    .landing-footer a {
      padding: clamp(2px, 0.6dvh, 8px) 6px;
      font-size: clamp(12px, 2dvh, var(--tekst-sitni));
      line-height: 1.2;
    }
    .copyright {
      font-size: clamp(12px, 2dvh, var(--tekst-sitni));
      line-height: 1.2;
    }
  }

  @media (max-width: 379px) {
    .landing {
      --font-stavke: 24px;
      --font-opisa: clamp(14px, 3.6vw, 16px);
      --padding-stavke: 20px;
      --visina-sporedne: 88px;
    }

    .zadnje-azuriranje .razdjelnik { display: none; }
    .zadnje-azuriranje .sto-je-novo {
      display: block;
      width: fit-content;
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    .landing {
      --razmak-stavki: 12px;
      --font-stavke: clamp(20px, 2.8dvh, 22px);
      --font-opisa: 16px;
      --padding-stavke: 18px 20px;
      --visina-sporedne: 84px;
      --landing-padding: 4px;
    }

    /* Ispod 380px naslov kartice ostaje 24px. */
    @media (max-width: 379px) {
      .landing {
        --font-stavke: 24px;
      }
    }

    .landing-prostor--gore {
      padding-top: 52px;
    }

    .izbornik {
      gap: 10px;
    }

    .cta {
      padding: 8px 14px;
      font-size: 15px;
    }
  }

  @media (max-width: 999px) {
    :global(html[data-font-disleksiju]) .landing {
      --razmak-stavki: 12px;
      --font-stavke: clamp(20px, 2.7dvh, 22px);
      --font-opisa: 16px;
    }

    @media (max-width: 379px) {
      :global(html[data-font-disleksiju]) .landing {
        --font-stavke: 24px;
      }
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    :global(html[data-font-disleksiju]) .landing {
      --razmak-stavki: 10px;
      --landing-padding: 2px;
      --padding-stavke: 14px 16px;
    }

    :global(html[data-font-disleksiju]) .landing-prostor--gore {
      padding-top: 48px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .navigacijska-stavka { transition: none; }
  }
</style>
