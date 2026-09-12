<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { dohvatiSocket } from '$lib/socket.js';
  import { jeRegistriranKorisnik, jeOnboardingZavrsen, oznaciOnboardingZavrsen } from '$lib/identitet.js';
  import { AVATARI } from '$lib/avatari.js';
  import Avatar from '$lib/komponente/Avatar.svelte';

  let korak = $state<'ime' | 'avatar'>('ime');
  let ime = $state('');
  let odabraniAvatar = $state<number | null>(null);
  let greska = $state<string | null>(null);
  let slanjeUTijeku = $state(false);
  let imeInput: HTMLInputElement | null = $state(null);

  onMount(() => {
    if (jeRegistriranKorisnik() || jeOnboardingZavrsen()) {
      void goto('/red');
      return;
    }
    // Spaja se odmah kako bi gost-zapis postojao u bazi prije PUT /profil/* poziva
    dohvatiSocket();
    imeInput?.focus();
  });

  async function posaljiIme(e: SubmitEvent) {
    e.preventDefault();
    const nadimak = ime.trim();
    if (nadimak.length < 2 || slanjeUTijeku) return;
    slanjeUTijeku = true;
    greska = null;
    try {
      await api('/profil/nadimak', { method: 'PUT', body: JSON.stringify({ nadimak }) });
      korak = 'avatar';
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Spremanje imena nije uspjelo.';
    } finally {
      slanjeUTijeku = false;
    }
  }

  async function potvrdiAvatar() {
    if (odabraniAvatar === null || slanjeUTijeku) return;
    slanjeUTijeku = true;
    greska = null;
    try {
      await api('/profil/avatar', { method: 'PUT', body: JSON.stringify({ avatarId: odabraniAvatar }) });
      oznaciOnboardingZavrsen();
      void goto('/red');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Spremanje avatara nije uspjelo.';
      slanjeUTijeku = false;
    }
  }
</script>

<main class="dobrodoslica">
  {#if korak === 'ime'}
    <div class="korak">
      <h1>Dobrodošao/la u Kaladont!</h1>
      <p class="uvod">
        Čini se da prvi put igraš ovu igru? Trenutno igraš kao gost — ako već imaš račun, prijavi se.
        Statistika ti neće biti spremljena dugoročno, ali u bilo kojem trenutku možeš se registrirati
        i sve će biti sačuvano. Za početak nam reci svoje ime.
      </p>
      <form onsubmit={posaljiIme}>
        <input
          bind:this={imeInput}
          type="text"
          bind:value={ime}
          autocomplete="off"
          maxlength={20}
          placeholder="Tvoje ime"
          aria-label="Tvoje ime"
          disabled={slanjeUTijeku}
        />
        <button type="submit" disabled={ime.trim().length < 2 || slanjeUTijeku}>
          {slanjeUTijeku ? 'Spremanje...' : 'Dalje'}
        </button>
      </form>
    </div>
  {:else}
    <div class="korak">
      <h1>Izaberi svoj avatar</h1>
      <div class="avatar-grid">
        {#each AVATARI as avatar (avatar.id)}
          <button
            type="button"
            class="avatar-opcija"
            class:odabran={odabraniAvatar === avatar.id}
            aria-label={`Odaberi ${avatar.naziv}`}
            disabled={slanjeUTijeku}
            onclick={() => (odabraniAvatar = avatar.id)}
          >
            <Avatar avatarId={avatar.id} velicina={84} />
          </button>
        {/each}
      </div>
      <button type="button" class="igraj-gumb" disabled={odabraniAvatar === null || slanjeUTijeku} onclick={potvrdiAvatar}>
        {slanjeUTijeku ? 'Spremanje...' : 'Igraj'}
      </button>
    </div>
  {/if}

  {#if greska}
    <p role="alert" class="greska">{greska}</p>
  {/if}
</main>

<style>
  .dobrodoslica {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }

  .korak {
    max-width: 420px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  h1 {
    font-family: var(--font-naslov);
  }

  .uvod {
    color: var(--boja-tekst-sekundarni);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  input {
    font-size: 20px;
    text-align: center;
    padding: 14px;
    border-radius: var(--radijus-kartica);
    border: 2px solid #e5ddc8;
  }

  button {
    font-family: var(--font-naslov);
    font-weight: 700;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 14px 32px;
    background: var(--boja-pozadina-primarna);
    color: white;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .avatar-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .avatar-opcija {
    background: none;
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 2px;
  }

  .avatar-opcija.odabran {
    border-color: var(--boja-pozadina-primarna);
  }

  .igraj-gumb {
    margin-top: 8px;
  }

  .greska {
    color: #c0392b;
    margin-top: 16px;
  }
</style>
