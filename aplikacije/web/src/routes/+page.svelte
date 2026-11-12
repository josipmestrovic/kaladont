<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik, prijediNaGostujucuSesiju } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import { ucitajModalIgraAsete, urlAseta } from '$lib/asetovi-core.js';
  import { zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import Kaladont2d5d from '$lib/komponente/Kaladont2d5d.svelte';
  import KontrolePristupacnosti from '$lib/komponente/KontrolePristupacnosti.svelte';
  import PopupNovihMisija from '$lib/komponente/PopupNovihMisija.svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import {
    NASLOVNICA_SEO_DESCRIPTION,
    NASLOVNICA_SEO_TITLE,
    naslovnicaJsonLd,
  } from '$lib/seo.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';
  import { X } from 'lucide-svelte';

  const registriran = jeRegistriranKorisnik();
  let otvoreniModal = $state<'igra' | null>(null);

  function otvoriModal(vrsta: 'igra') {
    otvoreniModal = vrsta;
    zabiljeziUmamiDogadjaj('igraj-klik');
    ucitajModalIgraAsete();
    zagrijGameplayZvukove();
  }

  function zatvoriNaEscape(dogadaj: KeyboardEvent) {
    if (dogadaj.key === 'Escape') otvoreniModal = null;
  }

  async function odjaviSe() {
    if (!confirm('Jeste li sigurni da se želite odjaviti?')) return;
    await api('/racuni/odjava', { method: 'POST' }).catch(() => {});
    // Novi gost token prije socketa/profila — prazan Bearer ostavlja avatar/sandučic mrtvim.
    await prijediNaGostujucuSesiju();
    await osvjeziSocketIdentitet().catch(() => {});
    window.dispatchEvent(new CustomEvent('kaladont:identitet-promijenjen'));
    window.location.assign('/');
  }

  onMount(() => {
    if ($page.url.searchParams.get('igraj') === '1') otvoriModal('igra');
  });
</script>

<svelte:window onkeydown={zatvoriNaEscape} />

<SeoGlava
  title={NASLOVNICA_SEO_TITLE}
  description={NASLOVNICA_SEO_DESCRIPTION}
  putanja="/"
  jsonLd={naslovnicaJsonLd()}
/>

<main class="landing">
  <section class="izbornik" aria-labelledby="naslov-kaladont">
    <header class="landing-tekst">
      <img class="demo-oznaka" src="/slike/demo-slika.webp" alt="Demo verzija igre" width="120" height="48" />
      <h1 id="naslov-kaladont"><span class="ime-igre">KALADONT</span> <span class="vrsta-igre">online</span></h1>
      <p class="seo-uvod">
        Hrvatska online igra riječi: reci riječ na zadnja dva slova prethodne i ostani zadnji za stolom.
        <a href="/pravila-kaladonta">Pročitaj pravila</a>
        ili se
        <a href="https://forum.kaladont.hr" rel="noopener noreferrer" data-umami-event="forum-klik-landing"
          >pridruži zajednici</a
        >.
      </p>
    </header>

    <div class="navigacijski-blok">
    <div class="desktop-navigacija-red">
      <Kaladont2d5d />
      <nav class="glavna-navigacija" aria-label="Glavna navigacija">
      <button type="button" class="navigacijska-stavka primarna" onclick={() => otvoriModal('igra')}>
        <img class="ikona-sucelja" src={urlAseta('/ikone/07-igraj.png')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Igraj</span>
      </button>
      <a href="/profil" class="navigacijska-stavka">
        <img class="ikona-sucelja" src={urlAseta('/ikone/61-korisnicki-profil.webp')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Moj profil</span>
      </a>
      <a href="/misije" class="navigacijska-stavka">
        <img class="ikona-sucelja" src={urlAseta('/ikone/62-misije.webp')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Misije</span>
      </a>
      <a href="/ljestvice" class="navigacijska-stavka">
        <img class="ikona-sucelja" src={urlAseta('/ikone/09-ljestvice.png')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Ljestvice</span>
      </a>
      <a href="/pravila-kaladonta" class="navigacijska-stavka">
        <img class="ikona-sucelja" src={urlAseta('/ikone/08-pravila.png')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Pravila</span>
      </a>
      <a href="/postavke" class="navigacijska-stavka">
        <img class="ikona-sucelja" src={urlAseta('/ikone/11-postavke.png')} alt="" aria-hidden="true" width="58" height="58" />
        <span>Postavke</span>
      </a>
      {#if registriran}
        <button type="button" class="navigacijska-stavka odjava-stavka" onclick={odjaviSe}>
          <img class="ikona-sucelja" src={urlAseta('/ikone/12-odjavi-se.png')} alt="" aria-hidden="true" width="58" height="58" />
          <span>Odjavi se</span>
        </button>
      {:else}
        <a href="/prijava" class="navigacijska-stavka">
          <img class="ikona-sucelja" src={urlAseta('/ikone/13-prijavi-se.png')} alt="" aria-hidden="true" width="58" height="58" />
          <span>Prijavi se</span>
        </a>
        <a href="/registracija" class="navigacijska-stavka">
          <img class="ikona-sucelja" src={urlAseta('/ikone/14-registriraj-se.png')} alt="" aria-hidden="true" width="58" height="58" />
          <span>Registriraj se</span>
        </a>
      {/if}
      </nav>
    </div>
    <div class="kontrole-pristupacnosti-naslovnica">
      <KontrolePristupacnosti />
    </div>
    </div>
  </section>

  <footer class="landing-footer">
    <nav aria-label="Dodatne poveznice">
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

  {#if otvoreniModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-podloga" role="presentation" onclick={() => (otvoreniModal = null)}>
    <div
      class="modal-sadrzaj"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-naslov"
      tabindex="-1"
      onclick={(dogadaj) => dogadaj.stopPropagation()}
      onkeydown={(dogadaj) => dogadaj.stopPropagation()}
    >
      <button type="button" class="zatvori-modal" aria-label="Zatvori" onclick={() => (otvoreniModal = null)}>
        <X size={22} aria-hidden="true" />
      </button>

      <p class="modal-nadnaslov">Odaberi stol</p>
      <h2 id="modal-naslov">Kako želiš igrati?</h2>
      <div class="modal-opcije">
        <a href="/red?mod=dva_igraca" class="modal-opcija">
          <img src="/ikone/17-soba-2-igraca.png" alt="" aria-hidden="true" /><span><strong>Dvoboj</strong><small>2 igrača</small></span>
        </a>
        <a href="/red?mod=cetiri_igraca" class="modal-opcija">
          <img src="/ikone/16-soba-4-igraca.png" alt="" aria-hidden="true" /><span><strong>Četveroboj</strong><small>4 igrača</small></span>
        </a>
        <a href="/zagrijavanje" class="modal-opcija">
          <img src="/ikone/67-zagrijavanje-bot.webp" alt="" aria-hidden="true" /><span><strong>Zagrijavanje</strong><small>Igraj dvoboj protiv računala.</small></span>
        </a>
        <a href="/soba/kreiraj" class="modal-opcija">
          <img src="/ikone/18-privatna-soba.png" alt="" aria-hidden="true" /><span><strong>Privatna soba</strong><small>Prilagodi pravila i pozovi svoju ekipu.</small></span>
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Fiksni font navigacije (20 mobitel / 24 desktop); vertikalni scroll na naslovnici je dopušten. */
  /* Visine računaju na do 8 navigacijskih stavki (gost + Misije). */
  .landing {
    --landing-padding: clamp(6px, 2.2dvh, 32px);
    --landing-razmak: clamp(6px, 2dvh, 28px);
    --visina-stavke: clamp(40px, 6.2dvh, 66px);
    --razmak-stavki: clamp(4px, 1dvh, 10px);
    --razmak-pristupacnosti: clamp(10px, 1.6dvh, 20px);
    --velicina-ikone: calc(var(--visina-stavke) * 0.84);
    --font-stavke: 24px;
    --velicina-naslova: clamp(48px, 9dvh, 86px);
    --visina-kontrole: clamp(36px, 5.5dvh, 52px);
    --visina-ilustracije: min(470px, calc(8 * var(--visina-stavke) + 7 * var(--razmak-stavki)));

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
  }

  .izbornik {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: clamp(6px, 1.2dvh, 14px);
    width: min(100%, 980px);
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .landing-tekst {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding-top: clamp(10px, 2dvh, 28px);
    text-align: left;
  }

  .demo-oznaka {
    display: block;
    width: clamp(52px, calc(var(--velicina-naslova) * 0.9), 96px);
    height: auto;
    margin: 0 0 4px;
    transform: rotate(-4deg);
    object-fit: contain;
  }

  h1 {
    margin: 0;
    font-size: var(--velicina-naslova);
    line-height: 0.88;
  }

  .seo-uvod {
    max-width: 34rem;
    margin: clamp(4px, 0.8dvh, 10px) 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: clamp(12px, 1.6dvh, 15px);
    font-weight: 600;
    line-height: 1.3;
  }

  .seo-uvod a {
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }

  /* Na niskim / srednjim ekranima ostaje u DOM-u za SEO, bez dodatnog scrolla
     (uključujući 1440×900 s fontom za disleksiju). */
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
    display: grid;
    gap: var(--razmak-pristupacnosti);
    min-width: 0;
    width: 100%;
  }

  .ime-igre,
  .vrsta-igre {
    display: block;
  }

  .vrsta-igre { font-size: 0.72em; }

  @media (min-width: 1000px) {
    .landing { gap: 0; --landing-padding: clamp(6px, 1.6dvh, 20px); }

    .izbornik {
      justify-content: flex-start;
      gap: 0;
    }

    .navigacijski-blok {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: max(var(--landing-razmak), var(--razmak-pristupacnosti));
    }

    .ime-igre,
    .vrsta-igre { display: inline; }
  }

  @media (min-width: 1000px) and (max-height: 600px) {
    .landing {
      --visina-stavke: clamp(36px, 5.5dvh, 52px);
      --razmak-stavki: clamp(3px, 0.7dvh, 6px);
      --landing-razmak: clamp(4px, 1.2dvh, 12px);
      --velicina-naslova: clamp(40px, 7dvh, 64px);
      --visina-kontrole: clamp(32px, 5dvh, 44px);
    }
  }

  .glavna-navigacija {
    display: grid;
    gap: var(--razmak-stavki);
    width: min(100%, 480px);
    min-width: 0;
    max-width: 100%;
    margin: 0 0 0 auto;
  }

  .desktop-navigacija-red {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    min-width: 0;
    max-width: 100%;
  }

  .kontrole-pristupacnosti-naslovnica {
    display: flex;
    width: min(100%, 480px);
    min-width: 0;
    max-width: 100%;
    margin: 0 0 0 auto;
    text-align: left;
  }

  .kontrole-pristupacnosti-naslovnica :global(.kontrola-pristupacnosti) {
    gap: 6px;
    padding-inline: 8px;
  }

  .navigacijska-stavka {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: var(--visina-stavke);
    display: grid;
    grid-template-columns: calc(var(--velicina-ikone) + 4px) minmax(0, 1fr) 24px;
    align-items: center;
    justify-items: start;
    gap: 12px;
    padding: 0 20px;
    border: 1px solid var(--boja-plocica-obrub);
    border-radius: 8px;
    background: var(--boja-plocica);
    box-shadow: var(--sjena-suptilna);
    color: var(--boja-plocica-tekst);
    font-family: var(--font-naslov);
    font-size: var(--font-stavke);
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .navigacijska-stavka > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .navigacijska-stavka::after {
    content: '›';
    justify-self: end;
    color: var(--boja-mint);
    font-family: var(--font-tijelo);
    font-size: 27px;
    font-weight: 500;
  }

  .ikona-sucelja {
    width: var(--velicina-ikone);
    height: var(--velicina-ikone);
    display: block;
    object-fit: contain;
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

  .navigacijska-stavka.primarna::after { color: var(--boja-mint); }

  :global(html[data-tema='svijetla']) .navigacijska-stavka.primarna::after { color: var(--boja-zuta-krema); }

  .navigacijska-stavka.odjava-stavka {
    border-color: rgb(228 87 46 / 42%);
    background: var(--boja-plocica);
    color: var(--boja-crvena);
  }

  .navigacijska-stavka.odjava-stavka::after { color: var(--boja-crvena); }
  .navigacijska-stavka.odjava-stavka:hover { border-color: var(--boja-crvena); }

  .landing-footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    width: min(100%, 980px);
  }

  .copyright { flex: none; font-size: 12px; line-height: 16px; color: var(--boja-tekst-sekundarni); white-space: nowrap; }

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
    .landing-footer a { padding-inline: 0; }
  }

  @media (max-width: 999px) {
    .izbornik {
      justify-content: flex-start;
      /* Više prostora između naslova i navigacije na mobitelu. */
      gap: 24px;
    }

    .kontrole-pristupacnosti-naslovnica :global(.kontrola-pristupacnosti) {
      gap: 4px;
      padding-inline: 6px;
    }

    .landing {
      --landing-padding: clamp(4px, 0.8dvh, 8px);
      --landing-razmak: clamp(4px, 1.6dvh, 18px);
      --visina-stavke: clamp(34px, 5.4dvh, 56px);
      --razmak-stavki: clamp(6px, 1.2dvh, 12px);
      --razmak-pristupacnosti: clamp(12px, 2.2dvh, 20px);
      --font-stavke: 20px;
      --velicina-naslova: clamp(30px, 5.5dvh, 52px);
      --visina-kontrole: clamp(32px, 5dvh, 48px);
    }

    .izbornik { width: min(100%, 440px); margin: 0 auto; }
    .landing-tekst {
      width: 100%;
      margin-inline: 0;
      text-align: left;
      align-items: flex-start;
    }
    .glavna-navigacija,
    .kontrole-pristupacnosti-naslovnica {
      width: 100%;
      margin-inline: 0;
    }
    .desktop-navigacija-red { display: block; }
    h1 { line-height: 0.95; }
    :global(html[data-font-disleksiju]) h1 { font-size: calc(var(--velicina-naslova) * 0.7); }
    :global(html[data-font-disleksiju]) .vrsta-igre { margin-top: clamp(4px, 1dvh, 8px); }
    .landing-footer { flex-direction: column; gap: 2px; }
    .landing-footer nav { justify-content: center; gap: 0 8px; }
    .copyright { font-size: 11px; line-height: 14px; }
    .landing-footer a { padding: clamp(2px, 0.6dvh, 8px) 6px; font-size: clamp(12px, 2dvh, var(--tekst-sitni)); line-height: 1.2; }
  }

  /* Ispod 430px: manji naslov + rezerviran prostor desno za sandučic/avatar. */
  @media (max-width: 429px) {
    .landing {
      --velicina-naslova: clamp(26px, 4.7dvh, 44px);
    }

    .landing-tekst {
      max-width: calc(100% - 96px);
      padding-right: 4px;
      box-sizing: border-box;
    }
  }

  /* Uski telefoni: tipke i kontrole moraju nastaviti se sužavati unutar paddingsa stranice. */
  @media (max-width: 379px) {
    .navigacijska-stavka {
      gap: 8px;
      padding-inline: 12px;
      grid-template-columns: calc(var(--velicina-ikone) + 2px) minmax(0, 1fr) 18px;
    }

    .navigacijska-stavka::after {
      font-size: 22px;
    }

    .kontrole-pristupacnosti-naslovnica :global(.kontrola-pristupacnosti) {
      gap: 4px;
      padding-inline: 4px;
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    .landing {
      --landing-razmak: 4px;
      --razmak-stavki: clamp(4px, 0.9dvh, 8px);
      --razmak-pristupacnosti: clamp(8px, 1.6dvh, 14px);
      --visina-stavke: clamp(30px, 4.8dvh, 44px);
      --velicina-naslova: clamp(28px, 5dvh, 44px);
      --landing-padding: 2px;
    }

    .landing-tekst {
      padding-top: clamp(4px, 1dvh, 12px);
    }
  }

  @media (max-width: 429px) and (max-height: 700px) {
    .landing {
      --velicina-naslova: clamp(24px, 4.3dvh, 38px);
    }
  }

  @media (max-width: 999px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(30px, 4.8dvh, 46px);
      --razmak-stavki: clamp(4px, 0.9dvh, 8px);
      --razmak-pristupacnosti: clamp(8px, 1.6dvh, 14px);
      --landing-razmak: clamp(3px, 1.2dvh, 12px);
    }
  }

  @media (max-width: 999px) and (max-height: 700px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(26px, 4.1dvh, 40px);
      --visina-kontrole: clamp(26px, 4.1dvh, 38px);
      --razmak-stavki: clamp(2px, 0.6dvh, 5px);
      --razmak-pristupacnosti: clamp(5px, 1dvh, 10px);
      --landing-padding: 0px;
      --landing-razmak: 2px;
      --velicina-naslova: clamp(24px, 4.5dvh, 40px);
    }

    :global(html[data-font-disleksiju]) .landing-tekst {
      padding-top: 2px;
    }

    :global(html[data-font-disleksiju]) .izbornik {
      gap: 16px;
    }
  }

  @media (max-width: 429px) and (max-height: 700px) {
    :global(html[data-font-disleksiju]) .landing {
      --visina-stavke: clamp(24px, 3.9dvh, 38px);
      --visina-kontrole: clamp(22px, 3.6dvh, 34px);
      --razmak-stavki: 2px;
      --razmak-pristupacnosti: 4px;
      --velicina-naslova: clamp(22px, 4dvh, 34px);
    }

    :global(html[data-font-disleksiju]) .kontrole-pristupacnosti-naslovnica :global(.kontrola-pristupacnosti) {
      padding-block: 4px;
      padding-inline: 4px;
      min-height: var(--visina-kontrole);
    }

    :global(html[data-font-disleksiju]) .landing-footer {
      gap: 0;
    }

    :global(html[data-font-disleksiju]) .landing-footer a {
      padding-block: 1px;
    }
  }

  .modal-podloga {
    position: fixed;
    z-index: 160;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--boja-zastor);
    backdrop-filter: blur(8px);
  }

  .modal-sadrzaj {
    position: relative;
    max-width: 480px;
    width: 100%;
    padding: 30px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 12px;
    background: var(--boja-povrsina);
    box-shadow: var(--sjena-modal);
    text-align: center;
  }

  .zatvori-modal {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    cursor: pointer;
  }

  .zatvori-modal:hover { background: var(--boja-obrub); color: var(--boja-tekst-osnovni); }

  .modal-nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-akcent-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  .modal-sadrzaj h2 { margin: 0 36px 22px; font-size: 31px; line-height: 1.1; }
  .modal-opcije { display: grid; gap: 10px; }

  .modal-opcija {
    display: grid;
    grid-template-columns: 56px 1fr;
    align-items: center;
    gap: 13px;
    padding: 14px 16px;
    border: 1px solid var(--boja-plocica-obrub);
    border-radius: 8px;
    background: var(--boja-plocica);
    color: var(--boja-plocica-tekst);
    text-align: left;
    text-decoration: none;
  }

  .modal-opcija:hover { border-color: var(--boja-mint); }
  .modal-opcija > img { width: 56px; height: 56px; object-fit: contain; }
  .modal-opcija span { display: grid; gap: 2px; }
  .modal-opcija strong { color: var(--boja-mint-tamni); font-family: var(--font-naslov); font-size: 19px; }
  .modal-opcija small { color: #5c554a; font-size: var(--tekst-sitni); line-height: 1.35; }

  @media (max-width: 999px) {
    .modal-sadrzaj { padding: 26px 18px 20px; }
    .modal-sadrzaj h2 { font-size: 27px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .navigacijska-stavka { transition: none; }
  }
</style>
