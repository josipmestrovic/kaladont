<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
  import Avatar from './Avatar.svelte';
  import SanducicIkona from './SanducicIkona.svelte';
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
  let ucitavanjeProfila = false;
  let zakazanoUcitavanje = false;
  const jeNaslovna = $derived($page.url.pathname === '/');
  const prikaziPovratakNaPocetnu = $derived(!jeNaslovna && prethodnaPutanja !== '/');
  const prikaziAdminNav = $derived(!jeNaslovna && profil?.vrsta === 'admin');

  function vratiSe() {
    window.history.back();
  }

  function idiNaprijed() {
    window.history.forward();
  }

  async function ucitajProfil(pokusaji = 3) {
    // Vanjski identitet event usred loada — jedan follow-up, bez do/while petlje.
    if (ucitavanjeProfila) {
      zakazanoUcitavanje = true;
      return;
    }
    ucitavanjeProfila = true;
    try {
      let oporavakOdrađen = false;
      let pokusaj = 0;
      while (pokusaj < pokusaji) {
        try {
          const odgovor = await api<Profil>('/profil');
          profil = odgovor;
          jeGost = !odgovor.email;
          return;
        } catch {
          if (!oporavakOdrađen) {
            oporavakOdrađen = true;
            // Bez identitet eventa — inače bismo opet ušli u ovaj loader i mintali goste u petlji.
            await osvjeziGostSesijuNakon401({ emitirajIdentitet: false }).catch(() => {});
            continue; // isti pokusaj brojač: jedan free retry nakon zamjene tokena
          }
          pokusaj += 1;
          if (pokusaj < pokusaji) await new Promise((r) => setTimeout(r, 250 * pokusaj));
        }
      }
      profil = null;
      jeGost = true;
    } finally {
      ucitavanjeProfila = false;
      if (zakazanoUcitavanje) {
        zakazanoUcitavanje = false;
        void ucitajProfil();
      }
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

<header class="header" class:header--naslovnica={jeNaslovna}>
  <div class="header-sadrzaj">
    {#if !jeNaslovna}
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
    {:else}
      <div class="lijeve-akcije lijeve-akcije--prazno" aria-hidden="true"></div>
    {/if}

    <div class="desno" aria-label={jeNaslovna ? 'Profil i obavijesti' : undefined}>
      {#if profil}
          <SanducicIkona velicina={44} />
          <a
            href="/profil"
            class="profil-link"
            aria-label={jeNaslovna ? `Profil: ${profil.nadimak}` : 'Moj profil'}
          >
            <span class="header-avatar">
              <Avatar
                avatarId={profil.avatarId}
                avatarConfig={profil.avatarConfig}
                rang={vratiVeciRang(profil.rang, profil.rang1v1)}
                gost={jeGost}
                velicina={44}
              />
            </span>
          </a>
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
  }

  .header--naslovnica .desno {
    pointer-events: auto;
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
    width: 44px;
    height: 44px;
    display: block;
    object-fit: contain;
  }

  .lijeve-akcije {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .lijeve-akcije--prazno {
    min-width: 0;
    min-height: 0;
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

  .header-avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    /* Prostor za border ranga da ga roditelj ne odreže. */
    padding: 4px;
    margin: -4px;
  }

  .profil-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    text-decoration: none;
    cursor: pointer;
  }

  @media (max-width: 999px) {
    .header-sadrzaj { padding-inline: 16px; }
    .lijeve-akcije { gap: 4px; }
    .desno { margin-left: 0; }
  }
</style>
