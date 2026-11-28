<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import AvatarEditor from '$lib/komponente/AvatarEditor.svelte';
  import { kanonskiZapisAvatara, ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from 'zajednicko';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  let konfiguracija = $state<AvatarConfigV1>(ZADANI_AVATAR_CONFIG);
  let rang = $state<string | null>(null);
  let ucitavanje = $state(true);
  let spremanje = $state(false);
  let greskaUcitavanja = $state<string | null>(null);
  let greskaSpremanja = $state<string | null>(null);
  let jeGost = $state(false);
  let legacyBezConfiga = $state(false);

  onMount(async () => {
    try {
      const profil = await api<{
        avatarConfig: AvatarConfigV1 | null;
        email: string | null;
        emailPotvrdjen: boolean;
        vrsta: string;
        rang: string | null;
      }>('/profil');
      jeGost = profil.vrsta === 'gost' || !profil.email;
      if (jeGost) {
        return;
      }
      // Stari URL ?registracija=1 više ne otvara registracijski mod.
      if ($page.url.searchParams.get('registracija') === '1' && !profil.emailPotvrdjen) {
        void goto('/potvrdi-email', { replaceState: true });
        return;
      }
      legacyBezConfiga = profil.avatarConfig == null;
      konfiguracija = profil.avatarConfig ?? ZADANI_AVATAR_CONFIG;
      rang = profil.rang ?? null;
    } catch (e) {
      greskaUcitavanja = e instanceof Error ? e.message : 'Avatar nije moguće učitati.';
    } finally {
      ucitavanje = false;
    }
  });

  async function spremiAvatar(novaKonfiguracija: AvatarConfigV1): Promise<void> {
    spremanje = true;
    greskaSpremanja = null;
    // legacyBezConfiga = prvo spremanje (null → config); inače usporedi kanonski zapis.
    const avatarPromijenjen =
      legacyBezConfiga ||
      kanonskiZapisAvatara(konfiguracija) !== kanonskiZapisAvatara(novaKonfiguracija);
    try {
      const odgovor = await api<{ avatarConfig: AvatarConfigV1; avatarRevision: number; avatarSlikaHash?: string | null }>('/profil/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarConfig: novaKonfiguracija }),
      });
      konfiguracija = odgovor.avatarConfig;
      legacyBezConfiga = false;
      if (avatarPromijenjen) {
        zabiljeziUmamiDogadjaj('avatar-spremljen');
      }
      dohvatiSocket().emit('igrac:avatar-azuriraj', {
        avatarConfig: odgovor.avatarConfig,
        avatarRevision: odgovor.avatarRevision,
        avatarSlikaHash: odgovor.avatarSlikaHash ?? null,
      });
      window.dispatchEvent(new CustomEvent('kaladont:avatar-promijenjen', {
        detail: { avatarConfig: odgovor.avatarConfig, avatarSlikaHash: odgovor.avatarSlikaHash ?? null },
      }));
      void goto('/profil');
    } catch (e) {
      greskaSpremanja = e instanceof Error ? e.message : 'Spremanje avatara nije uspjelo.';
      throw e;
    } finally {
      spremanje = false;
    }
  }
</script>

<svelte:head>
  <title>Uredi avatar | Kaladont</title>
</svelte:head>

<main class="avatar-stranica">
  {#if ucitavanje}
    <p>Učitavanje avatara…</p>
  {:else if greskaUcitavanja}
    <p role="alert" class="greska">{greskaUcitavanja}</p>
  {:else if jeGost}
    <section class="gost-gate" aria-labelledby="avatar-gost-naslov">
      <h1 id="avatar-gost-naslov">Avatar za registrirane igrače</h1>
      <p>
        Promjena avatara dostupna je samo registriranim igračima. Prijavi se ili otvori račun da urediš svoj izgled.
      </p>
      <div class="gost-akcije">
        <a
          href="/prijava"
          class="gumb"
          onclick={() => zabiljeziUmamiDogadjaj('prijava-klik', { izvor: 'avatar_editor' })}
        >Prijavi se</a>
        <a
          href="/registracija"
          class="gumb sekundarni"
          onclick={() =>
            zabiljeziUmamiDogadjaj('registracija-klik', { izvor: 'avatar_editor' })}
        >Registriraj se</a>
      </div>
    </section>
  {:else}
    {#if greskaSpremanja}
      <p role="alert" class="greska">{greskaSpremanja}</p>
    {/if}
    <AvatarEditor
      pocetnaKonfiguracija={konfiguracija}
      {rang}
      naslov="Uredi avatar"
      tekstSpremanja="Spremi avatar"
      spremiBezPromjene={legacyBezConfiga}
      spremanje={spremanje}
      onSpremi={spremiAvatar}
    />
  {/if}
</main>

<style>
  .avatar-stranica {
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    padding: 8px 16px 0;
    box-sizing: border-box;
  }

  .greska {
    color: var(--boja-poraz-tekst);
    font-weight: 700;
  }

  .gost-gate {
    display: grid;
    gap: 12px;
    padding: 20px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
  }

  .gost-gate h1 {
    margin: 0;
    font-size: 1.35rem;
  }

  .gost-gate p {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }

  .gost-akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid var(--boja-cta-pozadina);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    text-decoration: none;
    font-weight: 700;
  }

  .gumb.sekundarni {
    background: transparent;
    color: var(--boja-tekst-osnovni);
    border-color: var(--boja-obrub);
  }
</style>
