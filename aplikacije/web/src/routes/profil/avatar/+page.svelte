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

  // Zadnji korak registracije vodi ovamo; tada se mijenjaju natpisi i odrediste nakon spremanja.
  const zavrsavaRegistraciju = $derived($page.url.searchParams.get('registracija') === '1');

  onMount(async () => {
    try {
      const profil = await api<{ avatarConfig: AvatarConfigV1 | null }>('/profil');
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
  .avatar-stranica { width: 100%; max-width: 980px; margin: 0 auto; }
  .greska { color: var(--boja-poraz-tekst); font-weight: 700; }
</style>
