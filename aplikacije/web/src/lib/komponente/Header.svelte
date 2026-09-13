<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { obrisiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import Avatar from './Avatar.svelte';

  interface Profil {
    nadimak: string;
    avatarId: number;
    rang: string | null;
    email: string | null;
  }

  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);
  let otvorenIzbornik = $state(false);

  async function odjaviSe() {
    obrisiSesijskiToken();
    profil = null;
    jeGost = true;
    otvorenIzbornik = false;
    await osvjeziSocketIdentitet();
    void goto('/');
  }

  onMount(() => {
    const azurirajAvatar = (dogadaj: Event) => {
      const avatarId = (dogadaj as CustomEvent<{ avatarId: number }>).detail.avatarId;
      profil = profil ? { ...profil, avatarId } : profil;
    };
    window.addEventListener('kaladont:avatar-promijenjen', azurirajAvatar);

    void (async () => {
      try {
        const odgovor = await api<Profil>('/profil');
        profil = odgovor;
        jeGost = !odgovor.email;
      } catch {
        // Neuspjelo dohvaćanje (npr. istekao token) - prikaži gosta bez rušenja stranice
        jeGost = true;
      }
    })();

    return () => window.removeEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
  });
</script>

<header class="header">
  <div class="header-sadrzaj">
    <nav class="lijevo">
      <a href="/" class="nav-link" class:aktivan={$page.url.pathname === '/'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>Početna</span>
      </a>
      <a href="/pravila" class="nav-link" class:aktivan={$page.url.pathname === '/pravila'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span>Pravila</span>
      </a>
      <a href="/ljestvica" class="nav-link" class:aktivan={$page.url.pathname === '/ljestvica'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
        </svg>
        <span>Ljestvice</span>
      </a>
      <a href="/postavke" class="nav-link" class:aktivan={$page.url.pathname === '/postavke'} aria-label="Postavke">
        <svg class="ikona-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Postavke</span>
      </a>
    </nav>

    <div class="desno">
      {#if profil}
          {#if jeGost}
            <a href="/profil" class="profil-link" class:aktivan={$page.url.pathname === '/profil'} aria-label="Moj profil">
              <Avatar avatarId={profil.avatarId} rang={profil.rang} gost velicina={42} />
            </a>
          {:else}
            <div class="profil-izbornik">
              <button
                type="button"
                class="profil-okidac"
                aria-expanded={otvorenIzbornik}
                aria-haspopup="menu"
                onclick={() => (otvorenIzbornik = !otvorenIzbornik)}
              >
                <Avatar avatarId={profil.avatarId} rang={profil.rang} velicina={42} />
                <span class="profil-ime">{profil.nadimak}</span>
              </button>
              {#if otvorenIzbornik}
                <div class="profil-izbornik-sadrzaj" role="menu">
                  <a href="/profil" role="menuitem" onclick={() => (otvorenIzbornik = false)}>Moj profil</a>
                  <button type="button" role="menuitem" onclick={odjaviSe}>Odjavi se</button>
                </div>
              {/if}
            </div>
          {/if}
      {/if}
    </div>
  </div>
</header>

<style>
  .header {
    width: 100%;
    background: white;
    border-bottom: 1px solid #e5ddc8;
    font-size: var(--tekst-baza);
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

  @media (min-width: 768px) {
    .header-sadrzaj {
      max-width: 980px;
    }
  }

  .lijevo {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .desno {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
    line-height: 1.1;
    gap: 3px;
  }

  .nav-link:hover {
    text-decoration: none;
    color: var(--boja-akcent);
  }

  .nav-link.aktivan {
    color: var(--boja-akcent);
  }

  .ikona-svg {
    stroke: currentColor;
  }

  .profil-link,
  .profil-okidac {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    cursor: pointer;
  }

  .profil-okidac {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .profil-izbornik {
    position: relative;
  }

  .profil-izbornik-sadrzaj {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 10;
    min-width: 132px;
    padding: 6px;
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    box-shadow: var(--sjena-suptilna);
  }

  .profil-izbornik-sadrzaj a,
  .profil-izbornik-sadrzaj button {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .profil-izbornik-sadrzaj a:hover,
  .profil-izbornik-sadrzaj button:hover {
    color: var(--boja-akcent);
  }

  .profil-ime {
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
    font-size: 12px;
    line-height: 1.2;
  }

  .profil-okidac:hover .profil-ime {
    color: var(--boja-akcent);
  }
</style>
