<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import { AVATARI } from '$lib/avatari.js';
  import Avatar from './Avatar.svelte';
  import AudioKontrola from './AudioKontrola.svelte';

  interface Profil {
    avatarId: number;
    email: string | null;
  }

  let profil = $state<Profil | null>(null);
  let greska = $state<string | null>(null);
  let spremaSe = $state(false);
  let noviEmail = $state('');
  let lozinkaZaEmail = $state('');
  let porukaEmail = $state<string | null>(null);
  let trenutnaLozinka = $state('');
  let novaLozinka = $state('');
  let porukaLozinka = $state<string | null>(null);
  let spremaPromjene = $state(false);
  const registriran = jeRegistriranKorisnik();
  const imaNespremljenihPromjena = $derived(Boolean(noviEmail.trim() || lozinkaZaEmail || trenutnaLozinka || novaLozinka));

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profilnih podataka.';
    }
  });

  async function odaberiAvatar(avatarId: number) {
    if (!profil) return;
    spremaSe = true;
    try {
      await api('/profil/avatar', { method: 'PUT', body: JSON.stringify({ avatarId }) });
      await osvjeziSocketIdentitet();
      profil = { ...profil, avatarId };
      window.dispatchEvent(new CustomEvent('kaladont:avatar-promijenjen', { detail: { avatarId } }));
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo spremanje avatara.';
    } finally {
      spremaSe = false;
    }
  }

  async function promijeniEmail(event: SubmitEvent) {
    event.preventDefault();
    porukaEmail = null;
    porukaEmail = 'Promjena je spremna za spremanje.';
  }

  async function promijeniLozinku(event: SubmitEvent) {
    event.preventDefault();
    porukaLozinka = null;
    porukaLozinka = 'Promjena je spremna za spremanje.';
  }

  async function spremiPromjene() {
    if (!imaNespremljenihPromjena || spremaPromjene) return;
    spremaPromjene = true;
    try {
      if (noviEmail.trim() || lozinkaZaEmail) {
        await api('/profil/email', { method: 'PUT', body: JSON.stringify({ noviEmail, lozinka: lozinkaZaEmail }) });
      }
      if (trenutnaLozinka || novaLozinka) {
        await api('/profil/lozinka', { method: 'PUT', body: JSON.stringify({ trenutnaLozinka, novaLozinka }) });
      }
      porukaEmail = noviEmail.trim() ? 'Poslali smo potvrdu na novi email.' : null;
      porukaLozinka = novaLozinka ? 'Lozinka uspješno promijenjena.' : null;
      noviEmail = '';
      lozinkaZaEmail = '';
      trenutnaLozinka = '';
      novaLozinka = '';
      window.location.reload();
    } catch (e) {
      const poruka = e instanceof Error ? e.message : 'Neuspjelo spremanje promjena.';
      porukaEmail = poruka;
      porukaLozinka = poruka;
    } finally {
      spremaPromjene = false;
    }
  }
</script>

<section class="postavke-prikaz" aria-labelledby="postavke-naslov">
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
      <div class="avatar-grid">
        {#each AVATARI as avatar (avatar.id)}
          <button type="button" class="avatar-opcija" class:odabran={profil.avatarId === avatar.id} disabled={spremaSe} aria-label={`Odaberi ${avatar.naziv}`} onclick={() => odaberiAvatar(avatar.id)}>
            <Avatar avatarId={avatar.id} velicina={72} />
          </button>
        {/each}
      </div>
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
{#if imaNespremljenihPromjena}
  <div class="plutajuci-spremi">
    <button type="button" class="spremi-promjene" disabled={spremaPromjene} onclick={spremiPromjene}>
      {spremaPromjene ? 'Spremanje…' : 'Spremi promjene'}
    </button>
  </div>
{/if}

<style>
  .postavke-prikaz { max-width: 560px; padding: 8px 0 48px; display: flex; flex-direction: column; gap: 18px; }
  h2 { margin: 0 0 4px; font-family: var(--font-naslov); font-size: var(--naslov-2); }
  h3 { margin: 0; font-family: var(--font-naslov); font-size: var(--naslov-3); }
  .sekcija { display: flex; flex-direction: column; gap: 12px; padding: 20px; border: 1px solid #e5ddc8; border-radius: var(--radijus-kartica); background: white; box-shadow: var(--sjena-suptilna); }
  .zvuk-okvir { padding: 4px 0; }
  .gost-napomena { border-color: #f4c95d; background: #fdf6e2; }
  .gost-napomena p, .podtekst { margin: 0; color: var(--boja-tekst-sekundarni); }
  .cta-gumb, .spremnik-gumb { align-self: flex-start; padding: 10px 20px; border: 0; border-radius: var(--radijus-pill); background: var(--boja-pozadina-primarna); color: white; font: inherit; font-size: var(--tekst-sitni); font-weight: 700; text-decoration: none; cursor: pointer; }
  .avatar-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .avatar-opcija { padding: 2px; border: 3px solid transparent; border-radius: 50%; background: none; cursor: pointer; }
  .avatar-opcija.odabran { border-color: var(--boja-pozadina-primarna); }
  .forma { display: flex; flex-direction: column; gap: 12px; }
  .labela { display: flex; flex-direction: column; gap: 6px; font-size: var(--tekst-sitni); font-weight: 600; }
  input { width: 100%; padding: 10px 14px; border: 2px solid #e5ddc8; border-radius: var(--radijus-kartica); font-size: 16px; }
  .obavijest, .greska { margin: 0; color: var(--boja-pozadina-primarna); font-weight: 700; }
  .plutajuci-spremi { position: fixed; z-index: 20; right: 20px; bottom: 20px; }
  .spremi-promjene { padding: 12px 20px; border: 0; border-radius: var(--radijus-pill); background: var(--boja-pozadina-primarna); color: white; box-shadow: 0 4px 18px rgb(0 0 0 / 18%); font: inherit; font-weight: 800; cursor: pointer; }
  .spremi-promjene:disabled { opacity: 0.65; cursor: wait; }
  @media (max-width: 600px) { .plutajuci-spremi { right: 16px; bottom: 16px; left: 16px; } .spremi-promjene { width: 100%; } }
</style>
