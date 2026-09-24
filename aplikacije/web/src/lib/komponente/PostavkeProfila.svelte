<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { goto } from '$app/navigation';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import AudioKontrola from './AudioKontrola.svelte';

  interface Profil {
    email: string | null;
  }

  let profil = $state<Profil | null>(null);
  let greska = $state<string | null>(null);
  let noviEmail = $state('');
  let lozinkaZaEmail = $state('');
  let porukaEmail = $state<string | null>(null);
  let trenutnaLozinka = $state('');
  let novaLozinka = $state('');
  let porukaLozinka = $state<string | null>(null);
  const registriran = jeRegistriranKorisnik();

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profilnih podataka.';
    }
  });

  async function promijeniEmail(event: SubmitEvent) {
    event.preventDefault();
    porukaEmail = null;
    try {
      await api('/profil/email', { method: 'PUT', body: JSON.stringify({ noviEmail, lozinka: lozinkaZaEmail }) });
      void goto('/potvrdi-email');
      noviEmail = '';
      lozinkaZaEmail = '';
    } catch (e) {
      porukaEmail = e instanceof Error ? e.message : 'Neuspjela promjena emaila.';
    }
  }

  async function promijeniLozinku(event: SubmitEvent) {
    event.preventDefault();
    porukaLozinka = null;
    try {
      await api('/profil/lozinka', { method: 'PUT', body: JSON.stringify({ trenutnaLozinka, novaLozinka }) });
      porukaLozinka = 'Lozinka uspješno promijenjena.';
      trenutnaLozinka = '';
      novaLozinka = '';
    } catch (e) {
      porukaLozinka = e instanceof Error ? e.message : 'Neuspjela promjena lozinke.';
    }
  }
</script>

<section id="postavke" class="postavke-prikaz" aria-labelledby="postavke-naslov">
  <h2 id="postavke-naslov">Postavke</h2>
  <section class="sekcija">
    <h3>Zvuk i glasnoća</h3>
    <div class="zvuk-okvir"><AudioKontrola /></div>
  </section>

  {#if !registriran}
    <section class="sekcija gost-napomena">
      <h3>Dodatne postavke računa</h3>
      <p>Igraš kao gost. Za prilagodbu avatara, promjenu email adrese ili lozinke registriraj svoj račun.</p>
      <a href="/registracija" class="cta-gumb">Registriraj se</a>
    </section>
  {:else if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else if profil}
    <section class="sekcija" id="avatar">
      <h3>Prilagodi avatar</h3>
      <p class="podtekst">Sastavi svoj personalizirani avatar u zasebnom editoru.</p>
      <a href="/profil/avatar" class="spremnik-gumb">Uredi avatar</a>
    </section>

    <section class="sekcija">
      <h3>Promjena email adrese</h3>
      <p class="podtekst">Trenutni email: <strong>{profil.email}</strong></p>
      <form onsubmit={promijeniEmail} class="forma">
        <label class="labela">Novi email<input type="email" bind:value={noviEmail} required placeholder="novi@email.com" /></label>
        <label class="labela">Lozinka (za potvrdu)<input type="password" bind:value={lozinkaZaEmail} required placeholder="Lozinka" /></label>
        <button type="submit" class="spremnik-gumb">Promijeni email</button>
      </form>
      {#if porukaEmail}<p class="obavijest">{porukaEmail}</p>{/if}
    </section>

    <section class="sekcija">
      <h3>Promjena lozinke</h3>
      <form onsubmit={promijeniLozinku} class="forma">
        <label class="labela">Trenutna lozinka<input type="password" bind:value={trenutnaLozinka} required placeholder="Trenutna lozinka" /></label>
        <label class="labela">Nova lozinka (min. 8 znakova)<input type="password" bind:value={novaLozinka} minlength={8} required placeholder="Nova lozinka" /></label>
        <button type="submit" class="spremnik-gumb">Promijeni lozinku</button>
      </form>
      {#if porukaLozinka}<p class="obavijest">{porukaLozinka}</p>{/if}
    </section>
  {/if}
</section>

<style>
  .postavke-prikaz { max-width: 560px; padding: 8px 0 48px; display: flex; flex-direction: column; gap: 18px; }
  h2 { margin: 0 0 4px; font-family: var(--font-naslov); font-size: var(--naslov-2); }
  h3 { margin: 0; font-family: var(--font-naslov); font-size: var(--naslov-3); }
  .sekcija { display: flex; flex-direction: column; gap: 12px; padding: 20px; border: 1px solid #e5ddc8; border-radius: var(--radijus-kartica); background: white; box-shadow: var(--sjena-suptilna); }
  .zvuk-okvir { padding: 4px 0; }
  .gost-napomena { border-color: #f4c95d; background: #fdf6e2; }
  .gost-napomena p, .podtekst { margin: 0; color: var(--boja-tekst-sekundarni); }
  .cta-gumb, .spremnik-gumb { align-self: flex-start; padding: 10px 20px; border: 0; border-radius: var(--radijus-pill); background: var(--boja-pozadina-primarna); color: white; font: inherit; font-size: var(--tekst-sitni); font-weight: 700; text-decoration: none; cursor: pointer; }
  .forma { display: flex; flex-direction: column; gap: 12px; }
  .labela { display: flex; flex-direction: column; gap: 6px; font-size: var(--tekst-sitni); font-weight: 600; }
  input { width: 100%; padding: 10px 14px; border: 2px solid #e5ddc8; border-radius: var(--radijus-kartica); font-size: 16px; }
  .obavijest, .greska { margin: 0; color: var(--boja-pozadina-primarna); font-weight: 700; }
</style>
