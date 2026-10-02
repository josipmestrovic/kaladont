<script lang="ts">
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik, obrisiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import Kaladont2d5d from '$lib/komponente/Kaladont2d5d.svelte';
  import KontrolePristupacnosti from '$lib/komponente/KontrolePristupacnosti.svelte';
  import { X } from 'lucide-svelte';

  const registriran = jeRegistriranKorisnik();
  let otvoreniModal = $state<'igra' | 'pravno' | null>(null);

  function zatvoriNaEscape(dogadaj: KeyboardEvent) {
    if (dogadaj.key === 'Escape') otvoreniModal = null;
  }

  async function odjaviSe() {
    await api('/racuni/odjava', { method: 'POST' }).catch(() => {});
    obrisiSesijskiToken();
    await osvjeziSocketIdentitet().catch(() => {});
    window.dispatchEvent(new CustomEvent('kaladont:identitet-promijenjen'));
    window.location.assign('/');
  }
</script>

<svelte:window onkeydown={zatvoriNaEscape} />

<svelte:head>
  <title>Kaladont Multiplayer Online</title>
  <meta name="description" content="Igraj Kaladont online u Dvoboju, Četveroboju ili privatnoj sobi sa svojom ekipom." />
</svelte:head>

<main class="landing">
  <section class="izbornik" aria-labelledby="naslov-kaladont">
    <header class="landing-tekst">
      <img class="demo-oznaka" src="/slike/demo-slika.png" alt="Demo verzija igre" />
      <h1 id="naslov-kaladont"><span class="ime-igre">KALADONT</span> <span class="vrsta-igre">online</span></h1>
    </header>

    <div class="navigacijski-blok">
    <div class="desktop-navigacija-red">
      <Kaladont2d5d />
      <nav class="glavna-navigacija" aria-label="Glavna navigacija">
      <button type="button" class="navigacijska-stavka primarna" onclick={() => (otvoreniModal = 'igra')}>
        <img class="ikona-sucelja" src="/ikone/07-igraj.png" alt="" aria-hidden="true" />
        <span>Igraj</span>
      </button>
      <a href="/profil" class="navigacijska-stavka">
        <img class="ikona-sucelja" src="/ikone/31-moj-profil.png" alt="" aria-hidden="true" />
        <span>Moj profil</span>
      </a>
      <a href="/ljestvica" class="navigacijska-stavka">
        <img class="ikona-sucelja" src="/ikone/09-ljestvice.png" alt="" aria-hidden="true" />
        <span>Ljestvice</span>
      </a>
      <a href="/pravila" class="navigacijska-stavka">
        <img class="ikona-sucelja" src="/ikone/08-pravila.png" alt="" aria-hidden="true" />
        <span>Pravila</span>
      </a>
      <a href="/postavke" class="navigacijska-stavka">
        <img class="ikona-sucelja" src="/ikone/11-postavke.png" alt="" aria-hidden="true" />
        <span>Postavke</span>
      </a>
      {#if registriran}
        <button type="button" class="navigacijska-stavka odjava-stavka" onclick={odjaviSe}>
          <img class="ikona-sucelja" src="/ikone/12-odjavi-se.png" alt="" aria-hidden="true" />
          <span>Odjavi se</span>
        </button>
      {:else}
        <a href="/prijava" class="navigacijska-stavka">
          <img class="ikona-sucelja" src="/ikone/13-prijavi-se.png" alt="" aria-hidden="true" />
          <span>Prijavi se</span>
        </a>
        <a href="/registracija" class="navigacijska-stavka">
          <img class="ikona-sucelja" src="/ikone/14-registriraj-se.png" alt="" aria-hidden="true" />
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
      <a href="/novosti">
        <span>Što je novo?</span>
      </a>
      <a href="/povratne-informacije">
        <span>Pomozi poboljšati igru</span>
      </a>
      <button type="button" onclick={() => (otvoreniModal = 'pravno')}>Uvjeti i privatnost</button>
    </nav>
  </footer>
</main>

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

      {#if otvoreniModal === 'igra'}
        <p class="modal-nadnaslov">Odaberi stol</p>
        <h2 id="modal-naslov">Kako želiš igrati?</h2>
        <div class="modal-opcije">
          <a href="/red?mod=dva_igraca" class="modal-opcija">
            <img src="/ikone/17-soba-2-igraca.png" alt="" aria-hidden="true" /><span><strong>Dvoboj</strong><small>2 igrača</small></span>
          </a>
          <a href="/red?mod=cetiri_igraca" class="modal-opcija">
            <img src="/ikone/16-soba-4-igraca.png" alt="" aria-hidden="true" /><span><strong>Četveroboj</strong><small>4 igrača</small></span>
          </a>
          <a href="/soba/kreiraj" class="modal-opcija">
            <img src="/ikone/18-privatna-soba.png" alt="" aria-hidden="true" /><span><strong>Privatna soba</strong><small>Prilagodi pravila i pozovi svoju ekipu.</small></span>
          </a>
        </div>
      {:else}
        <h2 id="modal-naslov">Što te zanima?</h2>
        <div class="modal-opcije pravne-opcije">
          <a href="/uvjeti" class="modal-opcija pravna-opcija">
            <span><strong>Uvjeti korištenja</strong><small>Pravila korištenja igre i odgovornosti igrača.</small></span>
          </a>
          <a href="/privatnost" class="modal-opcija pravna-opcija">
            <span><strong>Pravila privatnosti</strong><small>Koje podatke koristimo, zašto i koliko dugo.</small></span>
          </a>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Sve vertikalne mjere skaliraju se s visinom ekrana kako bi naslovnica stala bez scrolla (do ~560px). */
  .landing {
    --landing-padding: clamp(8px, 3dvh, 40px);
    --landing-razmak: clamp(8px, 2.5dvh, 32px);
    --visina-stavke: clamp(44px, 7dvh, 72px);
    --razmak-stavki: clamp(6px, 1.2dvh, 12px);
    --velicina-ikone: calc(var(--visina-stavke) * 0.6);
    --font-stavke: clamp(18px, 3dvh, 25px);
    --velicina-naslova: clamp(52px, 10dvh, 92px);
    --visina-kontrole: clamp(40px, 6dvh, 56px);
    --visina-ilustracije: min(470px, calc(7 * var(--visina-stavke) + 6 * var(--razmak-stavki)));

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
    text-align: center;
  }

  .landing-tekst {
    display: block;
    padding-top: clamp(16px, 3dvh, 36px);
    text-align: left;
  }

  .demo-oznaka {
    display: inline-block;
    width: clamp(88px, 10vw, 128px);
    height: auto;
    margin: 0 0 4px 6px;
    transform: rotate(-4deg);
    object-fit: contain;
    vertical-align: middle;
  }

  h1 {
    margin: 0;
    font-size: var(--velicina-naslova);
    line-height: 0.88;
  }

  .navigacijski-blok {
    display: grid;
    gap: var(--razmak-stavki);
  }

  .ime-igre,
  .vrsta-igre {
    display: block;
  }

  .vrsta-igre { font-size: 0.72em; }

  @media (min-width: 1000px) {
    .landing { gap: 0; }

    .izbornik {
      justify-content: flex-start;
      gap: 0;
    }

    .navigacijski-blok {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--landing-razmak);
    }

    .ime-igre,
    .vrsta-igre { display: inline; }
  }

  .glavna-navigacija {
    display: grid;
    gap: var(--razmak-stavki);
    width: min(100%, 480px);
    margin: 0 0 0 auto;
  }

  .desktop-navigacija-red {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
  }

  .kontrole-pristupacnosti-naslovnica {
    display: flex;
    width: min(100%, 480px);
    margin: 0 0 0 auto;
  }

  .navigacijska-stavka {
    width: 100%;
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

  .navigacijska-stavka > span { text-align: left; }

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
  }

  .landing-footer nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px 18px;
  }

  .landing-footer a,
  .landing-footer button {
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

  .landing-footer a { text-decoration: underline; }
  .landing-footer a:hover,
  .landing-footer button:hover { color: var(--boja-akcent-tekst); }

  @media (max-width: 999px) {
    .izbornik {
      justify-content: flex-start;
      gap: 40px;
    }

    .kontrole-pristupacnosti-naslovnica {
      margin-inline: auto;
    }

    .landing {
      --landing-padding: clamp(8px, 3dvh, 50px);
      --landing-razmak: clamp(8px, 2.5dvh, 28px);
      --visina-stavke: clamp(40px, 7dvh, 68px);
      --razmak-stavki: clamp(5px, 1.2dvh, 12px);
      --font-stavke: clamp(17px, 2.8dvh, 22px);
      --velicina-naslova: clamp(34px, 6.5dvh, 58px);
    }

    .izbornik { width: min(100%, 440px); margin: 0 auto; }
    .landing-tekst { text-align: center; }
    .desktop-navigacija-red { display: block; }
    h1 { line-height: 0.95; }
    :global(html[data-font-disleksiju]) h1 { font-size: calc(var(--velicina-naslova) * 0.7); }
    :global(html[data-font-disleksiju]) .vrsta-igre { margin-top: clamp(4px, 1dvh, 8px); }
    .landing-footer nav { gap: 0 8px; }
    .landing-footer a,
    .landing-footer button { padding: clamp(2px, 0.6dvh, 8px) 6px; font-size: clamp(12px, 2dvh, var(--tekst-sitni)); line-height: 1.2; }
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
  .pravna-opcija { grid-template-columns: 1fr; text-align: center; }
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
