<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { obrisiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import Avatar from './Avatar.svelte';
  import { vratiVeciRang, type AvatarConfigV1 } from 'zajednicko';

  interface Profil {
    nadimak: string;
    avatarId: number;
    rang: string | null;
    rang1v1: string | null;
    email: string | null;
    avatarConfig: AvatarConfigV1 | null;
  }

  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);

  async function odjaviSe() {
    await api('/racuni/odjava', { method: 'POST' }).catch(() => {});
    obrisiSesijskiToken();
    profil = null;
    jeGost = true;
    void osvjeziSocketIdentitet().catch(() => {});
    void goto('/');
  }

  onMount(() => {
    const azurirajAvatar = (dogadaj: Event) => {
      const detalji = (dogadaj as CustomEvent<{ avatarConfig: AvatarConfigV1 }>).detail;
      profil = profil ? { ...profil, avatarConfig: detalji.avatarConfig } : profil;
    };
    const azurirajOdjavu = () => {
      profil = null;
      jeGost = true;
    };
    window.addEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
    window.addEventListener('kaladont:odjava', azurirajOdjavu);

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

    return () => {
      window.removeEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
      window.removeEventListener('kaladont:odjava', azurirajOdjavu);
    };
  });
</script>

<header class="header">
  <div class="header-sadrzaj">
    <nav class="lijevo">
      <a href="/" class="nav-link igraj-link" class:aktivan={$page.url.pathname === '/'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7h10c2.5 0 4.2 2 4.8 5l.8 4c.4 2-1.1 3.5-2.8 3.5-1.5 0-2.4-1-3.3-2.2l-.7-1H8.2l-.7 1C6.6 18.5 5.7 19.5 4.2 19.5c-1.7 0-3.2-1.5-2.8-3.5l.8-4C2.8 9 4.5 7 7 7Z"></path>
          <path d="M7 10v5M4.5 12.5h5"></path>
          <circle cx="16.5" cy="12" r=".75"></circle>
          <circle cx="19" cy="14" r=".75"></circle>
        </svg>
        <span>Igraj</span>
      </a>
      <a href="/pravila-kaladonta" class="nav-link" class:aktivan={$page.url.pathname === '/pravila-kaladonta' || $page.url.pathname === '/pomoc' || $page.url.pathname === '/pravila'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5.5C10.5 4 8.5 3 5 3v15c3.5 0 5.5 1 7 2.5"></path>
          <path d="M12 5.5C13.5 4 15.5 3 19 3v15c-3.5 0-5.5 1-7 2.5"></path>
          <path d="M12 5.5v15"></path>
        </svg>
        <span>Pravila</span>
      </a>
      <a href="/ljestvica" class="nav-link" class:aktivan={$page.url.pathname === '/ljestvica'}>
        <svg class="ikona-svg" viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
        </svg>
        <span>Ljestvice</span>
      </a>
      {#if profil}
        <a href="/profil" class="nav-link mobilni-profil-link" class:aktivan={$page.url.pathname === '/profil'} aria-label="Profil">
          <svg class="ikona-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="3.5"></circle>
            <path d="M5 21c.8-4 3.1-6 7-6s6.2 2 7 6"></path>
          </svg>
          <span>Profil</span>
        </a>
      {/if}
      {#if false}<a href="/postavke" class="nav-link" class:aktivan={$page.url.pathname === '/postavke'} aria-label="Postavke">
        <svg class="ikona-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Postavke</span>
      </a>{/if}
    </nav>

    <div class="desno">
      {#if profil}
          {#if jeGost}
            <a href="/profil" class="profil-link" class:aktivan={$page.url.pathname === '/profil'} aria-label="Moj profil">
              <span class="header-avatar"><Avatar avatarId={profil.avatarId} avatarConfig={profil.avatarConfig} rang={vratiVeciRang(profil.rang, profil.rang1v1)} gost velicina={59} prikaziRangBorder={false} /></span>
              <span class="profil-oznaka">Profil</span>
            </a>
          {:else}
            <a href="/profil" class="profil-link registrirani-profil" class:aktivan={$page.url.pathname === '/profil'} aria-label="Moj profil">
              <span class="header-avatar"><Avatar avatarId={profil.avatarId} avatarConfig={profil.avatarConfig} rang={vratiVeciRang(profil.rang, profil.rang1v1)} velicina={59} prikaziRangBorder={false} /></span>
              <span class="profil-ime">{profil.nadimak}</span>
              <span class="profil-oznaka">Profil</span>
            </a>
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
    gap: 24px;
  }

  .desno {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  @media (min-width: 768px) {
    .header-avatar { display: inline-flex; }
  }

  .nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.6px;
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
    width: 22px;
    height: 22px;
    stroke: currentColor;
  }

  .profil-link {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    cursor: pointer;
  }

  .profil-ime {
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.6px;
    line-height: 1.2;
  }

  .profil-oznaka {
    display: none;
    color: var(--boja-tekst-osnovni);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.6px;
    line-height: 1.2;
  }

  @media (min-width: 600px) {
    .nav-link {
      font-size: 15px;
    }

    .lijevo > .nav-link .ikona-svg { width: 22px; height: 22px; }

    .profil-ime {
      font-size: 15px;
    }
  }

  .profil-link:hover .profil-ime {
    color: var(--boja-akcent);
  }

  .mobilni-profil-link { display: none; }

  @media (max-width: 599px) {
    .lijevo { gap: 0; }
    .profil-link {
      flex-direction: column;
      gap: 3px;
    }
    .profil-ime { display: none; }
    .profil-oznaka {
      display: block;
      font-size: 14px;
      letter-spacing: 0.35px;
    }
  }

  @media (max-width: 599px) {
    .header-sadrzaj { padding-inline: 16px; }
    .lijevo {
      width: 100%;
      justify-content: space-between;
      gap: 0;
    }
    .lijevo > .nav-link {
      min-width: 0;
      font-size: 14px;
      letter-spacing: 0.35px;
    }
    .lijevo > .nav-link .ikona-svg { width: 24px; height: 24px; }
    .mobilni-profil-link { display: flex; }
    .desno { display: none; }
  }
</style>
