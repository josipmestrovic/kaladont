<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { spremiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import { AVATARI } from '$lib/avatari.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import UnosLozinke from '$lib/komponente/UnosLozinke.svelte';

  let korak = $state<1 | 2>(1);
  let nadimak = $state('');
  let email = $state('');
  let lozinka = $state('');
  let odabraniAvatar = $state<number | null>(null);
  let slanjeUTijeku = $state(false);
  let poruka = $state<string | null>(null);

  function daljeKorak(e: SubmitEvent) {
    e.preventDefault();
    if (nadimak.trim().length >= 2) {
      poruka = null;
      korak = 2;
    }
  }

  async function dovrsiregistraciju(e: SubmitEvent) {
    e.preventDefault();
    if (odabraniAvatar === null || slanjeUTijeku) return;
    slanjeUTijeku = true;
    poruka = null;
    try {
      const odgovor = await api<{ sesijskiToken: string }>('/racuni/registracija', {
        method: 'POST',
        body: JSON.stringify({
          email,
          lozinka,
          nadimak: nadimak.trim(),
          avatarId: odabraniAvatar,
        }),
      });
      spremiSesijskiToken(odgovor.sesijskiToken);
      await osvjeziSocketIdentitet();
      void goto('/');
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Registracija nije uspjela.';
    } finally {
      slanjeUTijeku = false;
    }
  }
</script>

<main class="registracija">
  <h1>Registriraj se u Kaladontu</h1>

  {#if korak === 1}
    <div class="uvod">
      <p>
        Kada se registriraš, statistika će biti trajno pohranjena i moći ćeš pristupiti svom računu s bilo kojeg uređaja.
      </p>
      <p>
        Ako već imaš račun, <a href="/prijava">prijavi se</a>.
      </p>
      <p>
        Za početak nam reci svoj nadimak koji ćeš koristiti u igri (ovo ostali igrači vide).
      </p>
    </div>

    <form onsubmit={daljeKorak}>
      <input
        type="text"
        bind:value={nadimak}
        maxlength={12}
        placeholder="Tvoj nadimak"
        aria-label="Tvoj nadimak"
        required
      />
      <button type="submit" disabled={nadimak.trim().length < 2}>
        Dalje
      </button>
    </form>
  {:else}
    <p class="napomena">
      Na tvoju email adresu nećemo slati nikakve obavijesti, isključivo je koristimo kako bi ti omogućili pristup računu ako zaboraviš lozinku.
    </p>

    <form onsubmit={dovrsiregistraciju}>
      <label class="labela">
        Email
        <input type="email" bind:value={email} required placeholder="tvoj@email.com" />
      </label>

      <UnosLozinke bind:vrijednost={lozinka} oznaka="Lozinka (min. 8 znakova)" najmanjaDuljina={8} />

      <div class="avatar-sekcija">
        <h2>Izaberi svoj avatar</h2>
        <div class="avatar-grid">
          {#each AVATARI as avatar (avatar.id)}
            <button
              type="button"
              class="avatar-opcija"
              class:odabran={odabraniAvatar === avatar.id}
              aria-label={`Odaberi ${avatar.naziv}`}
              onclick={() => (odabraniAvatar = avatar.id)}
            >
              <Avatar avatarId={avatar.id} velicina={72} />
            </button>
          {/each}
        </div>
      </div>

      <button type="submit" class="glavni-gumb" disabled={!email || lozinka.length < 8 || odabraniAvatar === null || slanjeUTijeku}>
        {slanjeUTijeku ? 'Spremanje...' : 'Registriraj se'}
      </button>
    </form>
  {/if}

  {#if poruka}
    <p role="alert" class="greska">{poruka}</p>
  {/if}
</main>

<style>
  .registracija {
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

  h2 {
    font-size: var(--naslov-3);
    margin: 8px 0 12px;
  }

  .uvod {
    color: var(--boja-tekst-sekundarni);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .uvod p, .napomena {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }

  .uvod a {
    color: var(--boja-tekst-naslov);
    text-decoration: underline;
    font-weight: 700;
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
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .avatar-sekcija {
    display: flex;
    flex-direction: column;
    width: 100%;
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
  }

  .avatar-opcija.odabran {
    border-color: var(--boja-pozadina-primarna);
  }

  .greska {
    color: #c0392b;
    margin: 0;
    font-weight: 600;
  }
</style>
