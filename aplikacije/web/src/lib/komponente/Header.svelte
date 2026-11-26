<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { prijediNaGostujucuSesiju } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import {
    azurirajAvatarProfila,
    invalidirajProfil,
    osigurajProfil,
    stanjeProfila,
  } from '$lib/stanje-profila.svelte.js';
  import Avatar from './Avatar.svelte';
  import SanducicIkona from './SanducicIkona.svelte';
  import { type AvatarConfigV1 } from 'zajednicko';

  let { prethodnaPutanja = null, mozeNaprijed = false } = $props<{ prethodnaPutanja?: string | null; mozeNaprijed?: boolean }>();
  let otvorenIzbornik = $state(false);
  let omotIzbornika: HTMLDivElement | undefined = $state();
  const jeNaslovna = $derived($page.url.pathname === '/');
  const prikaziPovratakNaPocetnu = $derived(!jeNaslovna && prethodnaPutanja !== '/');
  const profil = $derived(stanjeProfila.profil);
  const jeGost = $derived(profil?.vrsta === 'gost');
  const jeRegistriran = $derived(profil !== null && profil.vrsta !== 'gost');
  const prikaziAdminNav = $derived(!jeNaslovna && profil?.vrsta === 'admin');

  function vratiSe() {
    window.history.back();
  }

  function idiNaprijed() {
    window.history.forward();
  }

  function zatvoriIzbornik() {
    otvorenIzbornik = false;
  }

  function prebaciIzbornik() {
    otvorenIzbornik = !otvorenIzbornik;
  }

  async function odjaviSe() {
    if (!confirm('Jeste li sigurni da se želite odjaviti?')) return;
    zatvoriIzbornik();
    await api('/racuni/odjava', { method: 'POST' }).catch(() => {});
    // Novi gost token prije socketa/profila — prazan Bearer ostavlja avatar/sandučic mrtvim.
    await prijediNaGostujucuSesiju();
    await osvjeziSocketIdentitet().catch(() => {});
    invalidirajProfil();
    window.dispatchEvent(new CustomEvent('kaladont:identitet-promijenjen'));
    window.location.assign('/');
  }

  onMount(() => {
    const azurirajAvatar = (dogadaj: Event) => {
      const detalji = (dogadaj as CustomEvent<{ avatarConfig: AvatarConfigV1 }>).detail;
      azurirajAvatarProfila(detalji.avatarConfig);
    };
    const azurirajIdentitet = () => {
      invalidirajProfil();
      void osigurajProfil({ forsaj: true });
    };
    const naKlikIzvana = (dogadaj: MouseEvent) => {
      if (!otvorenIzbornik || !omotIzbornika) return;
      if (omotIzbornika.contains(dogadaj.target as Node)) return;
      zatvoriIzbornik();
    };
    const naTipku = (dogadaj: KeyboardEvent) => {
      if (dogadaj.key === 'Escape' && otvorenIzbornik) zatvoriIzbornik();
    };

    window.addEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
    window.addEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);
    document.addEventListener('click', naKlikIzvana);
    document.addEventListener('keydown', naTipku);

    void osigurajProfil();

    return () => {
      window.removeEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
      window.removeEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);
      document.removeEventListener('click', naKlikIzvana);
      document.removeEventListener('keydown', naTipku);
    };
  });

  // Navigacija zatvara meni (npr. klik na poveznicu unutar izbornika).
  $effect(() => {
    void $page.url.pathname;
    zatvoriIzbornik();
  });
</script>

<header class="header" class:header--naslovnica={jeNaslovna}>
  <div class="header-sadrzaj">
    {#if jeNaslovna}
      <h1 id="naslov-kaladont" class="logo-naslovnica">
        <span class="ime-igre">KALADONT</span>
        <span class="vrsta-igre">online</span>
      </h1>
    {:else}
      <div class="lijeve-akcije">
        <button type="button" class="header-akcija" aria-label="Nazad" onclick={vratiSe}>
          <img class="header-ikona" src="/ikone/03-nazad.png" alt="" aria-hidden="true" />
        </button>
        {#if prikaziPovratakNaPocetnu}
          <a href="/" class="header-akcija" aria-label="Početna">
            <img class="header-ikona" src="/ikone/04-naslovna.png" alt="" aria-hidden="true" />
          </a>
        {/if}
        {#if mozeNaprijed}
          <button type="button" class="header-akcija" aria-label="Naprijed" onclick={idiNaprijed}>
            <img class="header-ikona" src="/ikone/05-naprijed.png" alt="" aria-hidden="true" />
          </button>
        {/if}
      </div>
    {/if}

    <div class="desno" aria-label={jeNaslovna ? 'Profil i obavijesti' : undefined}>
      {#if profil}
          <SanducicIkona velicina={44} />
          <div class="profil-omot" bind:this={omotIzbornika}>
            <button
              type="button"
              class="profil-gumb"
              aria-label={jeNaslovna ? `Izbornik profila: ${profil.nadimak}` : 'Izbornik profila'}
              aria-haspopup="menu"
              aria-expanded={otvorenIzbornik}
              aria-controls="profil-izbornik"
              onclick={prebaciIzbornik}
            >
              <span class="header-avatar">
                <Avatar
                  avatarId={profil.avatarId}
                  avatarConfig={profil.avatarConfig}
                  rang={profil.rang === 'Piskaralo' ? null : profil.rang}
                  gost={jeGost}
                  velicina={50}
                />
              </span>
            </button>
            {#if otvorenIzbornik}
              <div
                id="profil-izbornik"
                class="profil-izbornik"
                role="menu"
                aria-label="Profil i račun"
              >
                <a href="/profil" class="profil-stavka" role="menuitem">Moj profil</a>
                {#if jeRegistriran}
                  <a href="/profil/avatar" class="profil-stavka" role="menuitem">Uredi avatar</a>
                {/if}
                <a href="/postavke" class="profil-stavka" role="menuitem">Postavke</a>
                <a
                  href="/pravila-kaladonta"
                  class="profil-stavka"
                  role="menuitem"
                  data-testid="naslovnica-pravila"
                >Pravila igre</a>
                {#if jeRegistriran}
                  <a href="/povratne-informacije" class="profil-stavka" role="menuitem">Povratne informacije</a>
                {/if}
                <div class="profil-razdjelnik" role="separator"></div>
                {#if jeGost}
                  <a href="/prijava" class="profil-stavka" role="menuitem">Prijavi se</a>
                  <a href="/registracija" class="profil-stavka" role="menuitem">Registriraj se</a>
                {:else if jeRegistriran}
                  <button type="button" class="profil-stavka odjava" role="menuitem" onclick={odjaviSe}>
                    Odjavi se
                  </button>
                {/if}
              </div>
            {/if}
          </div>
      {/if}
    </div>
  </div>
</header>

{#if prikaziAdminNav}
  <nav class="admin-navigacija" aria-label="Administracija">
    <a href="/admin">Nadzor</a>
    <a href="/admin/analitika">Analitika</a>
    <a href="/admin/prijave">Prijave</a>
    <a href="/admin/rjecnik">Rječnik</a>
    <a href="/misljenja-korisnika">Mišljenja korisnika</a>
  </nav>
{/if}

<style>
  .header {
    width: 100%;
    margin-top: 6px;
    background: transparent;
    font-family: var(--font-naslov);
    font-size: var(--tekst-baza);
  }

  /* Overlay na naslovnici — ne gura landing sadržaj dolje. */
  .header--naslovnica {
    position: absolute;
    top: 6px;
    left: 0;
    right: 0;
    z-index: 5;
    margin-top: 0;
    pointer-events: none;
  }

  .header--naslovnica .header-sadrzaj {
    pointer-events: none;
    align-items: center;
  }

  .header--naslovnica .logo-naslovnica,
  .header--naslovnica .desno {
    pointer-events: auto;
  }

  .header--naslovnica .desno {
    align-items: center;
    min-height: 44px;
    gap: 12px;
  }

  .logo-naslovnica {
    margin: 0;
    min-width: 0;
    max-width: min(100%, calc(100vw - 140px));
    display: flex;
    align-items: center;
    min-height: 44px;
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-naslov);
    font-size: clamp(22px, 4.2vw, 34px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.01em;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 1000px) {
    .logo-naslovnica {
      font-size: 60px;
      max-width: min(100%, calc(100vw - 160px));
    }
  }

  .logo-naslovnica .ime-igre,
  .logo-naslovnica .vrsta-igre {
    display: inline;
  }

  .logo-naslovnica .vrsta-igre {
    margin-left: 0.2em;
    font-size: 0.72em;
    font-weight: 700;
  }

  /* Uski mobitel: samo KALADONT, veći kao pravi naslov. */
  @media (max-width: 499px) {
    .logo-naslovnica {
      font-size: clamp(30px, 9vw, 40px);
      max-width: min(100%, calc(100vw - 120px));
    }

    .logo-naslovnica .vrsta-igre {
      display: none;
    }
  }

  .header-sadrzaj {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  @media (min-width: 1000px) {
    .header-sadrzaj {
      max-width: 980px;
    }
  }

  .header-ikona {
    display: block;
    width: 44px;
    height: 44px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .lijeve-akcije {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .header-akcija {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
    cursor: pointer;
  }

  .header-akcija:hover,
  .header-akcija:focus-visible {
    color: var(--boja-akcent-tekst);
    text-decoration: none;
  }

  .desno {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .admin-navigacija {
    width: min(100% - 32px, 980px);
    margin: -4px auto 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .admin-navigacija a {
    padding: 6px 10px;
    border: 1px solid var(--boja-akcent);
    border-radius: 6px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 700;
    text-decoration: none;
  }

  .profil-omot {
    position: relative;
  }

  .header-avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    /* Prostor za border ranga da ga roditelj ne odreže. */
    padding: 4px;
    margin: -4px;
  }

  .profil-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .profil-gumb:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 50%;
  }

  .profil-izbornik {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    right: 0;
    display: grid;
    min-width: 260px;
    width: max-content;
    gap: 2px;
    padding: 8px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina);
    box-shadow: var(--sjena-modal);
  }

  .profil-stavka {
    display: block;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: 18px;
    font-weight: 700;
    text-align: left;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }

  .profil-stavka:hover,
  .profil-stavka:focus-visible {
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
  }

  .profil-stavka.odjava {
    color: var(--boja-poraz-tekst);
  }

  .profil-razdjelnik {
    height: 1px;
    margin: 4px 2px;
    background: var(--boja-obrub);
  }

  @media (max-width: 999px) {
    .header-sadrzaj { padding-inline: 16px; }
    .lijeve-akcije { gap: 4px; }
    .desno { margin-left: 0; }
  }
</style>
