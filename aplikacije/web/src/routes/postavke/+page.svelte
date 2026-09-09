<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { BROJ_AVATARA } from '$lib/avatari.js';
  import Avatar from '$lib/komponente/Avatar.svelte';

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

  interface Partija {
    partijaId: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
    pocetak: string;
  }

  let profil = $state<Profil | null>(null);
  let partije = $state<Partija[]>([]);
  let greska = $state<string | null>(null);
  let spremaSe = $state(false);

  let noviEmail = $state('');
  let lozinkaZaEmail = $state('');
  let porukaEmail = $state<string | null>(null);

  let trenutnaLozinka = $state('');
  let novaLozinka = $state('');
  let porukaLozinka = $state<string | null>(null);

  onMount(async () => {
    if (!jeRegistriranKorisnik()) return;
    try {
      profil = await api<Profil>('/profil');
      if (profil) {
        const odgovor = await api<{ partije: Partija[] }>(`/povijest/${profil.igracId}`);
        partije = odgovor.partije;
      }
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje postavki.';
    }
  });

  async function odaberiAvatar(avatarId: number) {
    if (!profil) return;
    spremaSe = true;
    try {
      await api('/profil/avatar', { method: 'PUT', body: JSON.stringify({ avatarId }) });
      profil = { ...profil, avatarId };
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
      porukaLozinka = 'Lozinka promijenjena.';
      trenutnaLozinka = '';
      novaLozinka = '';
    } catch (e) {
      porukaLozinka = e instanceof Error ? e.message : 'Neuspjela promjena lozinke.';
    }
  }
</script>

<h1>Postavke</h1>

{#if !jeRegistriranKorisnik()}
  <p>Panel postavki dostupan je samo registriranim korisnicima.</p>
  <p><a href="/registracija">Registriraj se</a></p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if profil}
  <h2>Avatar</h2>
  <div class="avatar-grid">
    {#each Array.from({ length: BROJ_AVATARA }, (_, i) => i) as avatarId (avatarId)}
      <button
        type="button"
        class="avatar-opcija"
        class:odabran={profil.avatarId === avatarId}
        disabled={spremaSe}
        onclick={() => odaberiAvatar(avatarId)}
      >
        <Avatar {avatarId} velicina={56} />
      </button>
    {/each}
  </div>

  <h2>Border</h2>
  <p>
    Trenutni border: <strong>{profil.rang ?? 'Piskaralo (bez bordera)'}</strong> — border se dodjeljuje
    automatski prema tvom rangu, ne bira se ručno.
  </p>

  <h2>Statistika</h2>
  <ul>
    <li>Odigrane partije: {profil.odigrane}</li>
    <li>Pobjede: {profil.pobjede}</li>
    <li>Ukupno eliminacija: {profil.eliminacijeUkupno}</li>
    <li>Ukupno bodova: {profil.bodoviUkupno}</li>
    <li>Prosjek bodova: {profil.prosjekBodova.toFixed(2)}</li>
  </ul>

  <h2>Povijest partija</h2>
  {#if partije.length === 0}
    <p>Još nema odigranih partija.</p>
  {:else}
    <ul>
      {#each partije as p (p.partijaId)}
        <li>{p.plasman}. mjesto — {p.bodovi} bodova, {p.eliminacije} eliminacija</li>
      {/each}
    </ul>
  {/if}

  <h2>Promjena emaila</h2>
  <form onsubmit={promijeniEmail}>
    <label>Trenutni email: {profil.email}</label>
    <label>Novi email <input type="email" bind:value={noviEmail} required /></label>
    <label>Lozinka (potvrda) <input type="password" bind:value={lozinkaZaEmail} required /></label>
    <button type="submit">Promijeni email</button>
  </form>
  {#if porukaEmail}<p>{porukaEmail}</p>{/if}

  <h2>Promjena lozinke</h2>
  <form onsubmit={promijeniLozinku}>
    <label>Trenutna lozinka <input type="password" bind:value={trenutnaLozinka} required /></label>
    <label>Nova lozinka (min. 8 znakova) <input type="password" bind:value={novaLozinka} minlength="8" required /></label>
    <button type="submit">Promijeni lozinku</button>
  </form>
  {#if porukaLozinka}<p>{porukaLozinka}</p>{/if}
{:else}
  <p>Učitavanje...</p>
{/if}

<style>
  .avatar-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .avatar-opcija {
    background: none;
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 2px;
    cursor: pointer;
  }

  .avatar-opcija.odabran {
    border-color: var(--boja-pozadina-primarna);
  }

  .avatar-opcija:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
    margin-bottom: 24px;
  }

  form input {
    padding: 8px 12px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    font-size: var(--tekst-baza);
  }

  form button {
    align-self: flex-start;
    background: var(--boja-pozadina-primarna);
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: var(--radijus-pill);
    cursor: pointer;
    font-weight: bold;
  }
</style>
