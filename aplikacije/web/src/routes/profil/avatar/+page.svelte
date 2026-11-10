<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import AvatarEditor from '$lib/komponente/AvatarEditor.svelte';
  import { ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from 'zajednicko';

  let konfiguracija = $state<AvatarConfigV1>(ZADANI_AVATAR_CONFIG);
  let ucitavanje = $state(true);
  let spremanje = $state(false);
  let greska = $state<string | null>(null);
  let jeGost = $state(false);

  // Zadnji korak registracije vodi ovamo; tada se mijenjaju natpisi i odrediste nakon spremanja.
  const zavrsavaRegistraciju = $derived($page.url.searchParams.get('registracija') === '1');

  onMount(async () => {
    try {
      const profil = await api<{ avatarConfig: AvatarConfigV1 | null; email: string | null; vrsta: string }>(
        '/profil',
      );
      jeGost = profil.vrsta === 'gost' || !profil.email;
      if (jeGost && !zavrsavaRegistraciju) {
        return;
      }
      konfiguracija = profil.avatarConfig ?? ZADANI_AVATAR_CONFIG;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Avatar nije moguće učitati.';
    } finally {
      ucitavanje = false;
    }
  });

  async function spremiAvatar(novaKonfiguracija: AvatarConfigV1): Promise<void> {
    spremanje = true;
    greska = null;
    try {
      const odgovor = await api<{ avatarConfig: AvatarConfigV1; avatarRevision: number }>('/profil/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarConfig: novaKonfiguracija }),
      });
      konfiguracija = odgovor.avatarConfig;
      dohvatiSocket().emit('igrac:avatar-azuriraj', { avatarConfig: odgovor.avatarConfig, avatarRevision: odgovor.avatarRevision });
      window.dispatchEvent(new CustomEvent('kaladont:avatar-promijenjen', { detail: { avatarConfig: odgovor.avatarConfig } }));
      void goto(zavrsavaRegistraciju ? '/potvrdi-email?dobrodosao=1' : '/profil');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Spremanje avatara nije uspjelo.';
      throw e;
    } finally {
      spremanje = false;
    }
  }
</script>

<svelte:head>
  <title>{zavrsavaRegistraciju ? 'Stvori avatar' : 'Uredi avatar'} | Kaladont</title>
</svelte:head>

<main class="avatar-stranica">
  {#if greska}<p role="alert" class="greska">{greska}</p>{/if}
  {#if ucitavanje}
    <p>Učitavanje avatara…</p>
  {:else if jeGost && !zavrsavaRegistraciju}
    <section class="gost-gate" aria-labelledby="avatar-gost-naslov">
      <h1 id="avatar-gost-naslov">Avatar za registrirane igrače</h1>
      <p>
        Gosti koriste zadani avatar. Prijavi se ili otvori račun da urediš svoj izgled.
      </p>
      <div class="gost-akcije">
        <a href="/prijava" class="gumb">Prijavi se</a>
        <a href="/registracija" class="gumb sekundarni">Registriraj se</a>
      </div>
    </section>
  {:else}
    <AvatarEditor
      pocetnaKonfiguracija={konfiguracija}
      naslov={zavrsavaRegistraciju ? 'Stvori avatar' : 'Uredi avatar'}
      tekstSpremanja={zavrsavaRegistraciju ? 'Završi registraciju' : 'Spremi'}
      spremiBezPromjene={zavrsavaRegistraciju}
      spremanje={spremanje}
      onSpremi={spremiAvatar}
    />
  {/if}
</main>

<style>
  .avatar-stranica {
    width: 100%;
    max-width: 980px;
    margin: 0 auto;
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
