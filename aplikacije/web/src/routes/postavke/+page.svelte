<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import { AVATARI } from '$lib/avatari.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import AudioKontrola from '$lib/komponente/AudioKontrola.svelte';

  interface Profil {
    igracId: string;
    avatarId: number;
    rang: string | null;
    nadimak: string;
    email: string | null;
    odigrane: number;
    pobjede: number;
    eliminacijeUkupno: number;
    bodoviUkupno: number;
    prosjekBodova: number;
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

  const registriran = jeRegistriranKorisnik();

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

  async function promijeniEmail(e: SubmitEvent) {
    e.preventDefault();
    porukaEmail = null;
    try {
      await api('/profil/email', { method: 'PUT', body: JSON.stringify({ noviEmail, lozinka: lozinkaZaEmail }) });
      porukaEmail = 'Poslali smo potvrdu na novi email.';
      lozinkaZaEmail = '';
    } catch (e) {
      porukaEmail = e instanceof Error ? e.message : 'Neuspjela promjena emaila.';
    }
  }

  async function promijeniLozinku(e: SubmitEvent) {
    e.preventDefault();
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

<svelte:head>
  <title>Postavke | Kaladont</title>
</svelte:head>

<main class="postavke-stranica">
  <h1>Postavke</h1>

  <section class="sekcija">
    <h2>Zvuk i glasnoća</h2>
    <div class="zvuk-okvir">
      <AudioKontrola />
    </div>
  </section>

  {#if !registriran}
    <section class="sekcija gost-napomena">
      <h2>Dodatne postavke računa</h2>
      <p>
        Igraš kao gost. Za prilagodbu avatara, promjenu email adrese ili lozinke, registriraj svoj račun.
      </p>
      <a href="/registracija" class="cta-gumb">Registriraj se</a>
    </section>
  {:else if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else if profil}
    <section class="sekcija">
      <h2>Prilagodi avatar</h2>
      <div class="avatar-grid">
        {#each AVATARI as avatar (avatar.id)}
          <button
            type="button"
            class="avatar-opcija"
            class:odabran={profil.avatarId === avatar.id}
            disabled={spremaSe}
            aria-label={`Odaberi ${avatar.naziv}`}
            onclick={() => odaberiAvatar(avatar.id)}
          >
            <Avatar avatarId={avatar.id} velicina={72} />
          </button>
        {/each}
      </div>
    </section>

    <section class="sekcija">
      <h2>Promjena email adrese</h2>
      <p class="podtekst">Trenutni email: <strong>{profil.email}</strong></p>
      <form onsubmit={promijeniEmail} class="forma">
        <label class="labela">
          Novi email
          <input type="email" bind:value={noviEmail} required placeholder="novi@email.com" />
        </label>
        <label class="labela">
          Lozinka (za potvrdu)
          <input type="password" bind:value={lozinkaZaEmail} required placeholder="Lozinka" />
        </label>
        <button type="submit" class="spremnik-gumb">Promijeni email</button>
      </form>
      {#if porukaEmail}<p class="obavijest">{porukaEmail}</p>{/if}
    </section>

    <section class="sekcija">
      <h2>Promjena lozinke</h2>
      <form onsubmit={promijeniLozinku} class="forma">
        <label class="labela">
          Trenutna lozinka
          <input type="password" bind:value={trenutnaLozinka} required placeholder="Trenutna lozinka" />
        </label>
        <label class="labela">
          Nova lozinka (min. 8 znakova)
          <input type="password" bind:value={novaLozinka} minlength={8} required placeholder="Nova lozinka" />
        </label>
        <button type="submit" class="spremnik-gumb">Promijeni lozinku</button>
      </form>
      {#if porukaLozinka}<p class="obavijest">{porukaLozinka}</p>{/if}
    </section>
  {/if}
</main>

<style>
  .postavke-stranica {
    max-width: 520px;
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    font-family: var(--font-naslov);
    margin: 0;
    line-height: 1.1;
  }

  .sekcija {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 20px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sekcija h2 {
    font-size: var(--naslov-3);
    margin: 0;
  }

  .zvuk-okvir {
    padding: 4px 0;
  }

  .gost-napomena {
    background: #fdf6e2;
    border-color: #f4c95d;
  }

  .gost-napomena p {
    margin: 0;
    color: #5c554a;
  }

  .cta-gumb {
    display: inline-block;
    align-self: flex-start;
    background: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 700;
    text-decoration: none;
    padding: 10px 20px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
  }

  .podtekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .avatar-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .avatar-opcija {
    background: none;
    border: 3px solid transparent;
    border-radius: 50%;
    padding: 2px;
    cursor: pointer;
  }

  .avatar-opcija.odabran {
    border-color: var(--boja-pozadina-primarna);
  }

  .forma {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .labela {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
    font-size: var(--tekst-sitni);
  }

  input {
    font-size: 16px;
    padding: 10px 14px;
    border-radius: var(--radijus-kartica);
    border: 2px solid #e5ddc8;
    width: 100%;
  }

  .spremnik-gumb {
    align-self: flex-start;
    background: var(--boja-pozadina-primarna);
    color: white;
    font-family: var(--font-naslov);
    font-weight: 700;
    font-size: 16px;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 10px 24px;
    cursor: pointer;
  }

  .obavijest {
    margin: 0;
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-naslov);
    font-weight: 600;
  }

  .greska {
    color: #c0392b;
    font-weight: 600;
  }
</style>
