<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
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

  let { prethodnaPutanja = null } = $props<{ prethodnaPutanja?: string | null }>();
  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);
  const jeNaslovna = $derived($page.url.pathname === '/');
  const prikaziPovratakNaPocetnu = $derived(!jeNaslovna && prethodnaPutanja !== '/');

  function vratiSe() {
    window.history.back();
  }

  async function ucitajProfil() {
    try {
      const odgovor = await api<Profil>('/profil');
      profil = odgovor;
      jeGost = !odgovor.email;
    } catch {
      profil = null;
      jeGost = true;
    }
  }

  onMount(() => {
    const azurirajAvatar = (dogadaj: Event) => {
      const detalji = (dogadaj as CustomEvent<{ avatarConfig: AvatarConfigV1 }>).detail;
      profil = profil ? { ...profil, avatarConfig: detalji.avatarConfig } : profil;
    };
    const azurirajIdentitet = () => void ucitajProfil();
    window.addEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
    window.addEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);

    void ucitajProfil();

    return () => {
      window.removeEventListener('kaladont:avatar-promijenjen', azurirajAvatar);
      window.removeEventListener('kaladont:identitet-promijenjen', azurirajIdentitet);
    };
  });
</script>

<header class="header">
  <div class="header-sadrzaj">
    {#if jeNaslovna}
      <a href="/novosti" class="novosti-link" aria-label="Što je novo?">
        <span class="novosti-ikona" aria-hidden="true"></span>
        <span>Što je novo?</span>
      </a>
    {:else}
      <div class="lijeve-akcije">
        <button type="button" class="header-akcija" aria-label="Nazad" onclick={vratiSe}>
          <span class="povratak-ikona" aria-hidden="true"></span>
          <span>Nazad</span>
        </button>
        {#if prikaziPovratakNaPocetnu}
          <a href="/" class="header-akcija" aria-label="Početna">
            <span class="pocetna-ikona" aria-hidden="true"></span>
            <span>Početna</span>
          </a>
        {/if}
      </div>
    {/if}

    <div class="desno">
      {#if profil}
          {#if jeGost}
            <a href="/profil" class="profil-link" aria-label="Moj profil">
              <span class="header-avatar"><Avatar avatarId={profil.avatarId} avatarConfig={profil.avatarConfig} rang={vratiVeciRang(profil.rang, profil.rang1v1)} gost velicina={80} prikaziRangBorder={false} /></span>
              <span class="profil-ime">{profil.nadimak}</span>
            </a>
          {:else}
            <a href="/profil" class="profil-link registrirani-profil" aria-label="Moj profil">
              <span class="header-avatar"><Avatar avatarId={profil.avatarId} avatarConfig={profil.avatarConfig} rang={vratiVeciRang(profil.rang, profil.rang1v1)} velicina={80} prikaziRangBorder={false} /></span>
              <span class="profil-ime">{profil.nadimak}</span>
            </a>
          {/if}
      {/if}
    </div>
  </div>
</header>

<style>
  .header {
    width: 100%;
    background: transparent;
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

  .novosti-link {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    height: 80px;
    gap: 3px;
    padding: 0;
    color: var(--boja-tekst-osnovni);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    cursor: pointer;
  }

  .novosti-ikona {
    width: 59px;
    height: 59px;
    display: block;
    background-color: #1a1815;
    mask: url('/ikone/sucelje/Name=GiNotebook.svg') center / 48px 48px no-repeat;
  }

  .novosti-link:hover .novosti-ikona,
  .novosti-link:focus-visible .novosti-ikona {
    background-color: var(--boja-akcent);
  }

  .novosti-link:hover,
  .novosti-link:focus-visible {
    color: var(--boja-akcent);
    text-decoration: none;
  }

  .lijeve-akcije {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-akcija {
    width: auto;
    min-width: 80px;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 3px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }

  .povratak-ikona,
  .pocetna-ikona {
    width: 59px;
    height: 59px;
    display: block;
    background-color: var(--boja-akcent);
  }

  .povratak-ikona {
    mask: url('/ikone/sucelje/Name=GiReturnArrow.svg') center / 48px 48px no-repeat;
  }

  .pocetna-ikona {
    mask: url('/ikone/sucelje/Name=GiFastBackwardButton.svg') center / 48px 48px no-repeat;
  }

  .header-akcija:hover,
  .header-akcija:focus-visible {
    color: var(--boja-akcent);
    text-decoration: none;
  }

  .header-akcija:hover .povratak-ikona,
  .header-akcija:focus-visible .povratak-ikona,
  .header-akcija:hover .pocetna-ikona,
  .header-akcija:focus-visible .pocetna-ikona {
    background-color: #1a1815;
  }

  .desno {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  @media (min-width: 768px) {
    .header-avatar { display: inline-flex; }
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
    max-width: 150px;
    overflow: hidden;
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.6px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 600px) {
    .profil-ime {
      font-size: 15px;
    }
  }

  .profil-link:hover .profil-ime {
    color: var(--boja-akcent);
  }

  @media (max-width: 599px) {
    .profil-link { flex-direction: row; gap: 8px; }
    .profil-ime {
      max-width: 112px;
      font-size: 14px;
      letter-spacing: 0.35px;
    }
  }

  @media (max-width: 599px) {
    .header-sadrzaj { padding-inline: 16px; }
    .novosti-link, .header-akcija { font-size: 14px; }
    .lijeve-akcije { gap: 4px; }
    .header-akcija { min-width: 68px; }
  }
</style>
