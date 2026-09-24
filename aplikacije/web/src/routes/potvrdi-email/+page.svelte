<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { obrisiSesijskiToken, prijediNaGostujucuSesiju } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';

  interface Profil {
    email: string | null;
    emailNaCekanju: string | null;
    emailPotvrdjen: boolean;
  }

  let profil = $state<Profil | null>(null);
  let poruka = $state<string | null>(null);
  let greska = $state<string | null>(null);
  let saljeSe = $state(false);

  const emailZaPotvrdu = $derived(profil?.emailNaCekanju ?? profil?.email ?? '');

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
      if (profil.emailPotvrdjen) void goto('/');
    } catch {
      void goto('/prijava');
    }
  });

  async function ponovnoPosalji(): Promise<void> {
    saljeSe = true;
    poruka = null;
    greska = null;
    try {
      const odgovor = await api<{ poruka: string }>('/racuni/ponovno-poslati-potvrdu', { method: 'POST' });
      poruka = odgovor.poruka;
    } catch (razlog) {
      greska = razlog instanceof Error ? razlog.message : 'Ponovno slanje nije uspjelo.';
    } finally {
      saljeSe = false;
    }
  }

  async function igrajKaoGost(): Promise<void> {
    saljeSe = true;
    await api('/racuni/odjava', { method: 'POST' }).catch(() => {});
    obrisiSesijskiToken();
    await prijediNaGostujucuSesiju();
    await osvjeziSocketIdentitet();
    window.dispatchEvent(new CustomEvent('kaladont:identitet-promijenjen'));
    void goto('/');
  }
</script>

<svelte:head>
  <title>Potvrdi email | Kaladont</title>
</svelte:head>

<main class="potvrda-emaila">
  <p class="nadnaslov">Još jedan korak</p>
  <h1>Potvrdi email adresu</h1>
  {#if profil}
    <p>Poslali smo poveznicu za potvrdu na:</p>
    <strong class="email">{emailZaPotvrdu}</strong>
    <p>Provjeri primljenu poštu i mapu Neželjena pošta. Dok ne potvrdiš adresu, ne možeš ulaziti u javne ni privatne partije.</p>
    <div class="akcije">
      <button type="button" onclick={() => void ponovnoPosalji()} disabled={saljeSe}>
        {saljeSe ? 'Šaljem...' : 'Ponovno pošalji potvrdu'}
      </button>
      <a href="/postavke">Promijeni email adresu</a>
      <button type="button" class="sporedno" onclick={() => void igrajKaoGost()} disabled={saljeSe}>Igraj kao gost</button>
    </div>
  {:else}
    <p>Učitavanje podataka računa...</p>
  {/if}
  {#if poruka}<p class="obavijest" role="status">{poruka}</p>{/if}
  {#if greska}<p class="greska" role="alert">{greska}</p>{/if}
</main>

<style>
  .potvrda-emaila { width: min(560px, 100%); margin: 0 auto; padding: 56px 0; text-align: center; }
  .nadnaslov { margin: 0 0 8px; color: var(--boja-akcent); font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0 0 20px; font-family: var(--font-naslov); font-size: var(--naslov-1); line-height: 1.05; }
  .potvrda-emaila > p { color: var(--boja-tekst-sekundarni); line-height: 1.6; }
  .email { display: block; margin: 8px 0 20px; overflow-wrap: anywhere; font-size: var(--tekst-veliki); }
  .akcije { display: grid; gap: 12px; margin-top: 28px; }
  button, a { padding: 12px 16px; border: 1px solid var(--boja-pozadina-primarna); border-radius: var(--radijus-kartica); background: var(--boja-pozadina-primarna); color: white; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
  .sporedno, a { background: transparent; color: var(--boja-pozadina-primarna); }
  .obavijest { color: var(--boja-pozadina-primarna) !important; font-weight: 700; }
  .greska { color: var(--boja-akcent) !important; font-weight: 700; }
</style>
