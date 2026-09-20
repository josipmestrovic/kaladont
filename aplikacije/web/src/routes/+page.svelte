<script lang="ts">
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik, obrisiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
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
  <meta name="description" content="Igraj Kaladont online s dva ili četiri igrača ili stvori privatnu sobu za svoju ekipu." />
</svelte:head>

<main class="landing">
  <section class="izbornik" aria-labelledby="naslov-kaladont">
    <header class="landing-tekst">
      <p class="nadnaslov">Hrvatska online igra riječi</p>
      <h1 id="naslov-kaladont"><span class="ime-igre">KALADONT</span> <span class="vrsta-igre">multiplayer</span></h1>
    </header>

    <nav class="glavna-navigacija" aria-label="Glavna navigacija">
      <button type="button" class="navigacijska-stavka primarna" onclick={() => (otvoreniModal = 'igra')}>
        <span class="ikona-sucelja ikona-toothbrush" aria-hidden="true"></span>
        <span>Igraj</span>
      </button>
      <a href="/pravila" class="navigacijska-stavka">
        <span class="ikona-sucelja ikona-spellbook" aria-hidden="true"></span>
        <span>Pravila</span>
      </a>
      <a href="/ljestvica" class="navigacijska-stavka">
        <span class="ikona-sucelja ikona-ljestvica" aria-hidden="true"></span>
        <span>Ljestvica</span>
      </a>
      <a href="/profil#statistika" class="navigacijska-stavka">
        <span class="ikona-sucelja ikona-gamepad" aria-hidden="true"></span>
        <span>Moja statistika</span>
      </a>
      {#if registriran}
        <a href="/postavke" class="navigacijska-stavka">
          <span class="ikona-sucelja ikona-postavke" aria-hidden="true"></span>
          <span>Postavke</span>
        </a>
        <button type="button" class="navigacijska-stavka odjava-stavka" onclick={odjaviSe}>
          <span class="ikona-sucelja ikona-odjava" aria-hidden="true"></span>
          <span>Odjavi se</span>
        </button>
      {:else}
        <a href="/prijava" class="navigacijska-stavka">
          <span class="ikona-sucelja ikona-racun" aria-hidden="true"></span>
          <span>Prijavi se</span>
        </a>
        <a href="/registracija" class="navigacijska-stavka">
          <span class="ikona-sucelja ikona-racun" aria-hidden="true"></span>
          <span>Registriraj se</span>
        </a>
      {/if}
    </nav>
  </section>

  <footer class="landing-footer">
    <button type="button" onclick={() => (otvoreniModal = 'pravno')}>Uvjeti i privatnost</button>
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
            <span><strong>2 igrača</strong><small>Brzi dvoboj, jedan protiv jednog.</small></span>
          </a>
          <a href="/red?mod=cetiri_igraca" class="modal-opcija">
            <span><strong>4 igrača</strong><small>Klasična partija do posljednjeg igrača.</small></span>
          </a>
          <a href="/soba/kreiraj" class="modal-opcija">
            <span><strong>Privatna soba</strong><small>Prilagodi pravila i pozovi svoju ekipu.</small></span>
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
  .landing {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(100dvh - 82px);
    padding: 64px 0 20px;
  }

  .izbornik {
    width: min(100%, 720px);
    margin-top: 12px;
    text-align: center;
  }

  .landing-tekst { margin-bottom: 32px; }

  .nadnaslov {
    margin: 0 0 8px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 92px;
    line-height: 0.88;
  }

  .ime-igre,
  .vrsta-igre {
    display: block;
  }

  .vrsta-igre { font-size: 0.72em; }

  .glavna-navigacija {
    display: grid;
    gap: 12px;
    width: min(100%, 480px);
    margin: 0 auto;
  }

  .navigacijska-stavka {
    width: 100%;
    height: 72px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 24px;
    align-items: center;
    justify-items: start;
    gap: 12px;
    padding: 13px 20px;
    border: 1px solid #d8cfb8;
    border-radius: 8px;
    background: rgb(255 255 255 / 82%);
    box-shadow: 0 5px 16px rgb(38 34 27 / 7%);
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-naslov);
    font-size: 25px;
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
    width: 44px;
    height: 44px;
    display: block;
    background-color: currentColor;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
  }

  .ikona-toothbrush { mask-image: url('/ikone/sucelje/Name=GiToothbrush.svg'); }
  .ikona-spellbook { mask-image: url('/ikone/sucelje/Name=GiSecretBook.svg'); }
  .ikona-ljestvica { mask-image: url('/ikone/sucelje/Name=GiTrophiesShelf.svg'); }
  .ikona-gamepad { mask-image: url('/ikone/sucelje/Name=GiGamepad.svg'); }
  .ikona-postavke { mask-image: url('/ikone/sucelje/Name=GiAutoRepair.svg'); }
  .ikona-odjava { mask-image: url('/ikone/sucelje/Name=GiExitDoor.svg'); }
  .ikona-racun { mask-image: url('/ikone/sucelje/Name=GiTwoShadows.svg'); }
  .ikona-dva-igraca { mask-image: url('/ikone/sucelje/Name=GiLevelTwoAdvanced.svg'); }
  .ikona-cetiri-igraca { mask-image: url('/ikone/sucelje/Name=GiLevelFourAdvanced.svg'); }
  .ikona-privatna-soba { mask-image: url('/ikone/sucelje/Name=GiLockedDoor.svg'); }

  .navigacijska-stavka:hover {
    transform: translateY(-2px);
    border-color: var(--boja-mint);
    box-shadow: 0 9px 24px rgb(38 34 27 / 11%);
  }

  .navigacijska-stavka.primarna {
    border-color: var(--boja-mint);
    background: var(--boja-mint);
    color: white;
  }

  .navigacijska-stavka > span { text-align: left; }

  .navigacijska-stavka.primarna::after { color: var(--boja-zuta-krema); }

  .navigacijska-stavka.odjava-stavka {
    border-color: rgb(228 87 46 / 42%);
    background: rgb(228 87 46 / 9%);
    color: var(--boja-akcent);
  }

  .navigacijska-stavka.odjava-stavka::after { color: var(--boja-akcent); }
  .navigacijska-stavka.odjava-stavka:hover { border-color: var(--boja-akcent); }

  .landing-footer {
    margin-top: auto;
    padding-top: 28px;
  }

  .landing-footer button {
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: var(--tekst-sitni);
    text-decoration: underline;
    cursor: pointer;
  }

  .landing-footer button:hover { color: var(--boja-akcent); }

  @media (max-width: 767px) {
    .landing {
      min-height: calc(100dvh - 96px);
      padding: 58px 0 16px;
    }

    .izbornik { width: min(100%, 440px); margin: 0 auto; }
    .landing-tekst { margin-bottom: 28px; text-align: center; }
    h1 { font-size: 48px; line-height: 0.95; }
    .navigacijska-stavka { height: 68px; font-size: 22px; }
    .landing-footer { padding-top: 24px; }
  }

  .modal-podloga {
    position: fixed;
    z-index: 160;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(26 24 21 / 38%);
    backdrop-filter: blur(8px);
  }

  .modal-sadrzaj {
    position: relative;
    max-width: 480px;
    width: 100%;
    padding: 30px;
    border: 1px solid #ded4bd;
    border-radius: 12px;
    background: var(--boja-krem);
    box-shadow: 0 20px 64px rgb(26 24 21 / 25%);
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

  .zatvori-modal:hover { background: #efe9da; color: var(--boja-tekst-osnovni); }

  .modal-nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  .modal-sadrzaj h2 { margin: 0 36px 22px; font-size: 31px; line-height: 1.1; }
  .modal-opcije { display: grid; gap: 10px; }

  .modal-opcija {
    display: grid;
    grid-template-columns: 1fr;
    align-items: center;
    gap: 13px;
    padding: 14px 16px;
    border: 1px solid #d8cfb8;
    border-radius: 8px;
    background: white;
    color: var(--boja-tekst-osnovni);
    text-align: left;
    text-decoration: none;
  }

  .modal-opcija:hover { border-color: var(--boja-mint); background: #f7fbf8; }
  .pravna-opcija { grid-template-columns: 1fr; text-align: center; }
  .modal-opcija span { display: grid; gap: 2px; }
  .modal-opcija strong { color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: 19px; }
  .modal-opcija small { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); line-height: 1.35; }

  @media (max-width: 420px) {
    .modal-sadrzaj { padding: 26px 18px 20px; }
    .modal-sadrzaj h2 { font-size: 27px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .navigacijska-stavka { transition: none; }
  }
</style>
