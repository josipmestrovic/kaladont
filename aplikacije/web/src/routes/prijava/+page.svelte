<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { spremiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import UnosLozinke from '$lib/komponente/UnosLozinke.svelte';

  let email = $state('');
  let lozinka = $state('');
  let slanjeUTijeku = $state(false);
  let poruka = $state<string | null>(null);

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    if (slanjeUTijeku) return;
    slanjeUTijeku = true;
    poruka = null;
    try {
      const odgovor = await api<{ sesijskiToken: string }>('/racuni/prijava', {
        method: 'POST',
        body: JSON.stringify({ email, lozinka }),
      });
      spremiSesijskiToken(odgovor.sesijskiToken);
        await osvjeziSocketIdentitet();
      void goto('/');
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Prijava nije uspjela.';
    } finally {
      slanjeUTijeku = false;
    }
  }
</script>

<svelte:head>
  <title>Prijava | Kaladont</title>
</svelte:head>

<main class="prijava">
  <h1>Prijava</h1>

  <form onsubmit={posalji}>
    <label class="labela">
      Email
      <input type="email" bind:value={email} required placeholder="tvoj@email.com" />
    </label>

    <UnosLozinke bind:vrijednost={lozinka} />

    <button type="submit" disabled={!email || !lozinka || slanjeUTijeku}>
      {slanjeUTijeku ? 'Prijava...' : 'Prijavi se'}
    </button>
  </form>

  {#if poruka}
    <p role="alert" class="greska">{poruka}</p>
  {/if}

  <p class="registracija-link">
    Nemaš račun? <a href="/registracija">Registriraj se</a>
  </p>
  <p class="registracija-link"><a href="/zaboravljena-lozinka">Zaboravio/la si lozinku?</a></p>
</main>

<style>
  .prijava {
    max-width: 440px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    text-align: left;
    padding: 24px 0;
  }

  h1 {
    font-family: var(--font-naslov);
    line-height: 1.15;
    margin: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .labela {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
    font-size: var(--tekst-sitni);
  }

  input {
    font-size: 18px;
    padding: 12px 16px;
    border-radius: var(--radijus-kartica);
    border: 2px solid #e5ddc8;
    width: 100%;
  }

  button {
    font-family: var(--font-naslov);
    font-size: 22px;
    letter-spacing: 1.5px;
    font-weight: 700;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 14px 32px;
    background: var(--boja-pozadina-primarna);
    color: white;
    cursor: pointer;
    margin-top: 8px;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .registracija-link {
    margin: 8px 0 0;
    color: var(--boja-tekst-sekundarni);
  }

  .registracija-link a {
    color: var(--boja-tekst-naslov);
    text-decoration: underline;
    font-weight: 700;
  }

  .greska {
    color: #c0392b;
    margin: 0;
    font-weight: 600;
  }
</style>
