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
    vrsta: 'gost' | 'registriran' | 'admin';
    avatarConfig: AvatarConfigV1 | null;
  }

  let { prethodnaPutanja = null, mozeNaprijed = false } = $props<{ prethodnaPutanja?: string | null; mozeNaprijed?: boolean }>();
  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);
  const jeNaslovna = $derived($page.url.pathname === '/');
  const prikaziPovratakNaPocetnu = $derived(!jeNaslovna && prethodnaPutanja !== '/');

  function vratiSe() {
    window.history.back();
  }

  function idiNaprijed() {
    window.history.forward();
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
      <div class="naslovne-akcije">
        <a href="/novosti" class="novosti-link" aria-label="Što je novo?">
          <img class="header-ikona" src="/ikone/01-sto-je-novo.png" alt="" aria-hidden="true" />
          <span>Što je novo?</span>
        </a>
        {#if profil && !jeGost}
          <a href="/povratne-informacije" class="novosti-link" aria-label="Pomozi poboljšati igru">
            <img class="header-ikona" src="/ikone/02-pomozi-poboljsati-igru.png" alt="" aria-hidden="true" />
            <span>Pomozi poboljšati igru</span>
          </a>
        {/if}
      </div>
    {:else}
      <div class="lijeve-akcije">
        <button type="button" class="header-akcija" aria-label="Nazad" onclick={vratiSe}>
          <img class="header-ikona" src="/ikone/03-nazad.png" alt="" aria-hidden="true" />
          <span>Nazad</span>
        </button>
        {#if prikaziPovratakNaPocetnu}
          <a href="/" class="header-akcija" aria-label="Početna">
            <img class="header-ikona" src="/ikone/04-naslovna.png" alt="" aria-hidden="true" />
            <span>Početna</span>
          </a>
        {/if}
        {#if mozeNaprijed}
          <button type="button" class="header-akcija" aria-label="Naprijed" onclick={idiNaprijed}>
            <img class="header-ikona" src="/ikone/05-naprijed.png" alt="" aria-hidden="true" />
            <span>Naprijed</span>
          </button>
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

{#if profil?.vrsta === 'admin'}
  <nav class="admin-navigacija" aria-label="Administracija">
    <a href="/admin#rjecnik">Rječnik</a>
    <a href="/admin#prijave">Prijave</a>
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
    font-size: 25px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
  }

  .naslovne-akcije {
    display: flex;
    align-items: center;
    gap: 36px;
  }

  .header-ikona {
    width: 44px;
    height: 44px;
    display: block;
    object-fit: contain;
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
    font-size: 25px;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }

  .header-akcija:hover,
  .header-akcija:focus-visible {
    color: var(--boja-akcent);
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
    font-size: 25px;
    letter-spacing: 0.6px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profil-link:hover .profil-ime {
    color: var(--boja-akcent);
  }

  @media (max-width: 599px) {
    .profil-link { gap: 0; }
    .profil-ime { display: none; }
  }

  @media (max-width: 599px) {
    .header-sadrzaj { padding-inline: 16px; }
    .novosti-link, .header-akcija { font-size: 22px; }
    .naslovne-akcije .header-ikona {
      width: 33px;
      height: 33px;
    }
    .lijeve-akcije { gap: 4px; }
    .header-akcija { min-width: 68px; }
    .naslovne-akcije {
      height: 80px;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0;
    }
    .naslovne-akcije .novosti-link {
      width: max-content;
      height: 33px;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      text-align: left;
      font-size: 16px;
    }
    .desno { margin-left: 0; }
  }
</style>
