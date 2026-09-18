<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import AvatarEditor from '$lib/komponente/AvatarEditor.svelte';
  import { ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from 'zajednicko';

  let konfiguracija = $state<AvatarConfigV1>(ZADANI_AVATAR_CONFIG);
  let ucitavanje = $state(true);
  let spremanje = $state(false);
  let greska = $state<string | null>(null);
  let jeGost = $state(false);

  onMount(async () => {
    try {
      const profil = await api<{ avatarConfig: AvatarConfigV1 | null; email: string | null }>('/profil');
      konfiguracija = profil.avatarConfig ?? ZADANI_AVATAR_CONFIG;
      jeGost = !profil.email;
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
      void goto('/profil');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Spremanje avatara nije uspjelo.';
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
  {#if greska}<p role="alert" class="greska">{greska}</p>{/if}
  {#if ucitavanje}
    <p>Učitavanje avatara…</p>
  {:else if jeGost}
    <section class="gost-poruka" aria-labelledby="gost-naslov">
      <h1 id="gost-naslov">Uredi svoj avatar</h1>
      <p>Za uređivanje profilne slike trebaš imati registrirani račun.</p>
      <div class="gost-akcije">
        <a href="/registracija">Registriraj se</a>
        <a href="/prijava">Već imaš račun? Prijavi se</a>
      </div>
    </section>
  {:else}
    <AvatarEditor pocetnaKonfiguracija={konfiguracija} naslov="Uredi avatar" spremanje={spremanje} onSpremi={spremiAvatar} />
  {/if}
</main>

<style>
  .avatar-stranica { width: 100%; max-width: 980px; margin: 0 auto; }
  .greska { color: var(--boja-akcent); font-weight: 700; }
  .gost-poruka { max-width: 560px; padding: 48px 0; }
  .gost-poruka h1 { margin: 0 0 12px; font-family: var(--font-naslov); }
  .gost-poruka p { color: var(--boja-tekst-sekundarni); }
  .gost-akcije { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  .gost-akcije a { padding: 10px 16px; border-radius: var(--radijus-pill); background: var(--boja-pozadina-primarna); color: white; font-weight: 700; text-decoration: none; }
  .gost-akcije a + a { background: #faf8f0; color: var(--boja-tekst-osnovni); }
</style>
