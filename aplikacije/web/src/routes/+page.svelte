<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { NAJNOVIJE_IZDANJE, urlIzdanja } from '$lib/izdanja.js';
  import { ucitajModalIgraAsete, urlAseta } from '$lib/asetovi-core.js';
  import { zagrijGameplayZvukove } from '$lib/audio-manager.js';
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
  let nacinModala = $state<'natjecateljski' | 'laganini'>('natjecateljski');

  function otvoriModal(nacin: 'natjecateljski' | 'laganini' = 'natjecateljski') {
    nacinModala = nacin;
    otvoreniModal = true;
    zabiljeziUmamiDogadjaj('igraj-klik');
    ucitajModalIgraAsete();
    zagrijGameplayZvukove();
  }

  onMount(() => {
    // HINT: ?igraj=1 otvara modal na pravilnicima (zadano Ranked).
    if ($page.url.searchParams.get('igraj') === '1') otvoriModal('natjecateljski');
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
    <p class="seo-uvod">
      Hrvatska online igra riječi: reci riječ na zadnja dva slova prethodne i ostani zadnji za stolom.
      <a href="/pravila-kaladonta">Pročitaj pravila</a>
      ili se
      <a href="https://forum.kaladont.hr" rel="noopener noreferrer" data-umami-event="forum-klik-landing"
        >pridruži zajednici</a
      >.
    </p>

    <div class="navigacijski-blok">
      <nav class="glavna-navigacija" aria-label="Glavna navigacija">
        <button
          type="button"
          class="navigacijska-stavka primarna"
          aria-label="Ranked"
          onclick={() => otvoriModal('natjecateljski')}
        >
          <span class="stavka-tekst" aria-hidden="true">
            <strong>Ranked</strong>
            <small>Igraj za rang i mjesto na ljestvici.</small>
          </span>
          <img
            class="ikona-stavke"
            src={urlAseta('/ikone/07-igraj.png')}
            alt=""
            aria-hidden="true"
            width="72"
            height="72"
          />
        </button>
        <a href="/izazovi" class="navigacijska-stavka" aria-label="Izazovi" data-testid="naslovnica-izazovi">
          <span class="stavka-tekst" aria-hidden="true">
            <strong>Izazovi</strong>
            <small>Kampanja protiv računala.</small>
          </span>
          <img
            class="ikona-stavke"
            src={urlAseta('/ikone/06-trofej.png')}
            alt=""
            aria-hidden="true"
            width="72"
            height="72"
          />
        </a>
        <button
          type="button"
          class="navigacijska-stavka"
          aria-label="Zagrijavanje"
          onclick={() => otvoriModal('laganini')}
        >
          <span class="stavka-tekst" aria-hidden="true">
            <strong>Zagrijavanje</strong>
            <small>Igraj protiv računala.</small>
          </span>
          <img
            class="ikona-stavke"
            src={urlAseta('/ikone/67-zagrijavanje-bot.webp')}
            alt=""
            aria-hidden="true"
            width="72"
            height="72"
          />
        </button>
        <a href="/soba/kreiraj" class="navigacijska-stavka" aria-label="Privatna soba">
          <span class="stavka-tekst" aria-hidden="true">
            <strong>Privatna soba</strong>
            <small>Pozovi prijatelje preko linka.</small>
          </span>
          <img
            class="ikona-stavke"
            src={urlAseta('/ikone/18-privatna-soba.png')}
            alt=""
            aria-hidden="true"
            width="72"
            height="72"
          />
        </a>
      </nav>
      {#if NAJNOVIJE_IZDANJE}
        <p class="zadnje-azuriranje">
          Zadnje ažuriranje:
          <a href={urlIzdanja(NAJNOVIJE_IZDANJE)}
            ><time datetime={NAJNOVIJE_IZDANJE.objavljeno}>{NAJNOVIJE_IZDANJE.datumHr}</time></a
          >
          <span class="razdjelnik" aria-hidden="true">·</span>
          <a class="sto-je-novo" href="/novosti">Vidi što je novo</a>
        </p>
      {/if}
    </div>
  </section>

  <footer class="landing-footer">
    <nav aria-label="Dodatne poveznice">
      <!-- HINT PR15: Novosti prije O igri; /novosti više nije 307 redirect. -->
      <a href="/novosti">Novosti</a>
      <a href="/o-igri">O igri</a>
      <a href="/povratne-informacije">Pomozi poboljšati igru</a>
      <a href="/uvjeti">Uvjeti</a>
      <a href="/privatnost">Privatnost</a>
    </nav>
    <small class="copyright">© 2026 Kaladont. Sva prava pridržana.</small>
  </footer>
</main>

{#if registriran}
  <PopupNovihMisija />
{/if}

<ModalIgraj otvoren={otvoreniModal} nacin={nacinModala} onZatvori={() => (otvoreniModal = false)} />

<style>
  /* Centriran landing; naslov (h1) je u Headeru kao logo. */
  .landing {
    --landing-padding: clamp(8px, 2.2dvh, 32px);
    --landing-razmak: clamp(10px, 2.4dvh, 32px);
    --visina-stavke: clamp(64px, 8dvh, 88px);
    --razmak-stavki: clamp(10px, 1.4dvh, 14px);
    --font-stavke: clamp(29px, 3.8dvh, 38px);
    --font-opisa: clamp(18px, 2.4dvh, 22px);

    position: relative;
    isolation: isolate;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: var(--landing-razmak);
    min-height: 100vh;
    min-height: 100dvh;
    padding-block: var(--landing-padding);
    padding-inline: 16px;
  }

  .izbornik {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: clamp(18px, 3dvh, 36px);
    width: min(100%, 560px);
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .seo-uvod {
    max-width: 34rem;
    margin: 0 auto;
    color: var(--boja-tekst-sekundarni);
    font-size: clamp(12px, 1.6dvh, 15px);
    font-weight: 600;
    line-height: 1.3;
  }

  .seo-uvod a {
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }

  /* Na niskim / srednjim ekranima ostaje u DOM-u za SEO, bez dodatnog scrolla. */
  @media (max-height: 950px) {
    .seo-uvod {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
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
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: var(--visina-stavke);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    gap: 12px;
    padding: 12px 18px;
    border: 1px solid var(--boja-plocica-obrub);
    border-radius: 8px;
    background: var(--boja-plocica);
    box-shadow: var(--sjena-suptilna);
    color: var(--boja-plocica-tekst);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .stavka-tekst {
    display: grid;
    gap: 2px;
    min-width: 0;
    text-align: left;
  }

  .stavka-tekst strong {
    font-family: var(--font-naslov);
    font-size: var(--font-stavke);
    font-weight: 700;
    line-height: 1.15;
  }

  .stavka-tekst small {
    color: #5c554a;
    font-size: var(--font-opisa);
    font-weight: 600;
    line-height: 1.3;
  }

  /* Ikone samo desktop — visina ≈ naslov + opis. */
  .ikona-stavke {
    display: none;
  }

  @media (min-width: 1000px) {
    .navigacijska-stavka {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .ikona-stavke {
      display: block;
      width: auto;
      height: calc(var(--font-stavke) * 1.15 + 2px + var(--font-opisa) * 1.3);
      max-height: 100%;
      object-fit: contain;
      flex-shrink: 0;
    }
  }

  .navigacijska-stavka.primarna .stavka-tekst small {
    color: color-mix(in srgb, #1a1815 72%, transparent);
  }

  :global(html[data-tema='svijetla']) .navigacijska-stavka.primarna .stavka-tekst small {
    color: color-mix(in srgb, white 82%, transparent);
  }

  .navigacijska-stavka:hover {
    transform: translateY(-2px);
    border-color: var(--boja-mint);
    box-shadow: var(--sjena-modal);
  }

  .navigacijska-stavka.primarna {
    border-color: var(--boja-zuta-krema);
    background: var(--boja-zuta-krema);
    color: #1a1815;
  }

  :global(html[data-tema='svijetla']) .navigacijska-stavka.primarna {
    border-color: var(--boja-mint);
    background: var(--boja-mint);
    color: white;
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
      gap: 0;
      --landing-padding: clamp(8px, 1.8dvh, 24px);
      --font-stavke: clamp(31px, 4.1dvh, 41px);
    }

    .landing-footer a { padding-inline: 0; }
  }

  /* 4 CTA: kratki desktop viewport mora stati u 100dvh bez scrolla (E2E 1366×500). */
  @media (min-width: 1000px) and (max-height: 600px) {
    .landing {
      --visina-stavke: clamp(40px, 7.2dvh, 52px);
      --razmak-stavki: clamp(4px, 0.8dvh, 8px);
      --landing-razmak: clamp(4px, 1dvh, 10px);
      --landing-padding: clamp(4px, 1dvh, 10px);
      --font-stavke: clamp(22px, 3.4dvh, 28px);
      --font-opisa: clamp(13px, 2.2dvh, 16px);
    }

    .izbornik {
      gap: clamp(8px, 1.4dvh, 14px);
    }

    .navigacijska-stavka {
      padding-block: 6px;
    }

    .stavka-tekst small {
      line-height: 1.15;
    }
  }

  @media (min-width: 1000px) and (max-height: 520px) {
    .landing {
      --visina-stavke: clamp(36px, 6.8dvh, 44px);
      --razmak-stavki: 4px;
      --font-stavke: clamp(20px, 3.2dvh, 24px);
      --font-opisa: clamp(12px, 2dvh, 14px);
    }

    .zadnje-azuriranje {
      font-size: 11px;
    }
  }

  @media (min-width: 1000px) and (max-height: 600px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(36px, 6.4dvh, 46px);
      --razmak-stavki: 4px;
      --font-stavke: clamp(18px, 3dvh, 24px);
      --font-opisa: clamp(11px, 1.9dvh, 13px);
    }
  }

  @media (max-width: 999px) {
    .landing {
      --landing-padding: clamp(6px, 1.2dvh, 12px);
      --landing-razmak: clamp(8px, 2dvh, 20px);
      --visina-stavke: clamp(56px, 7dvh, 72px);
      --razmak-stavki: clamp(8px, 1.2dvh, 12px);
      --font-stavke: clamp(24px, 3.4dvh, 31px);
      padding-inline: 12px;
    }

    .izbornik {
      width: min(100%, 440px);
      gap: clamp(16px, 2.4dvh, 28px);
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

  @media (max-width: 429px) {
    .landing {
      --font-stavke: clamp(22px, 3.1dvh, 26px);
    }

    .navigacijska-stavka {
      padding-inline: 12px;
    }
  }

  @media (max-width: 379px) {
    .navigacijska-stavka {
      padding-inline: 10px;
    }

    .zadnje-azuriranje .razdjelnik { display: none; }
    .zadnje-azuriranje .sto-je-novo {
      display: block;
      width: fit-content;
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    .landing {
      --landing-razmak: 6px;
      --razmak-stavki: clamp(6px, 1dvh, 10px);
      --visina-stavke: clamp(48px, 6dvh, 60px);
      --font-stavke: clamp(22px, 3dvh, 26px);
      --landing-padding: 4px;
    }

    .izbornik {
      gap: 12px;
    }
  }

  @media (max-width: 999px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(44px, 5.6dvh, 58px);
      --razmak-stavki: clamp(6px, 1dvh, 10px);
      --landing-razmak: clamp(6px, 1.4dvh, 14px);
      --font-stavke: clamp(19px, 2.9dvh, 24px);
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(40px, 5dvh, 52px);
      --razmak-stavki: clamp(4px, 0.8dvh, 8px);
      --landing-padding: 2px;
      --landing-razmak: 4px;
    }
  }

  /* Samo navigacija: ispod 410px ~15% manji naslov i opis. */
  @media (max-width: 409px) {
    .landing {
      --font-stavke: clamp(19px, 2.6dvh, 22px);
      --font-opisa: clamp(15px, 2dvh, 19px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .navigacijska-stavka { transition: none; }
  }
</style>
