<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { spremiSesijskiToken } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';
  import UnosLozinke from '$lib/komponente/UnosLozinke.svelte';
  import { jeValjanNadimak, MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA, UZORAK_NADIMKA } from 'zajednicko';

  let korak = $state<1 | 2>(1);
  let nadimak = $state('');
  let email = $state('');
  let lozinka = $state('');
  let potvrdaDob16 = $state(false);
  let prihvacamUvjete = $state(false);
  let slanjeUTijeku = $state(false);
  let poruka = $state<string | null>(null);

  function daljeKorak(e: SubmitEvent) {
    e.preventDefault();
    if (jeValjanNadimak(nadimak)) {
      poruka = null;
      korak = 2;
    }
  }

  // Racun se stvara ovdje jer je editor avatara autenticirana ruta; avatar je zadnji korak tijeka.
  async function dovrsiregistraciju(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (slanjeUTijeku || !email || lozinka.length < 8 || !potvrdaDob16 || !prihvacamUvjete) return;
    slanjeUTijeku = true;
    poruka = null;
    try {
      const odgovor = await api<{ sesijskiToken: string }>('/racuni/registracija', {
        method: 'POST',
        body: JSON.stringify({
          email,
          lozinka,
          nadimak: nadimak.trim(),
          potvrdaDob16: true,
          prihvacamUvjete: true,
        }),
      });
      spremiSesijskiToken(odgovor.sesijskiToken);
      await osvjeziSocketIdentitet();
      window.dispatchEvent(new CustomEvent('kaladont:identitet-promijenjen'));
      void goto('/profil/avatar?registracija=1', { replaceState: true });
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Registracija nije uspjela.';
      slanjeUTijeku = false;
    }
  }
</script>

<svelte:head>
  <title>Registracija | Kaladont</title>
</svelte:head>

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
        minlength={MINIMALNA_DULJINA_NADIMKA}
        maxlength={MAKSIMALNA_DULJINA_NADIMKA}
        pattern={UZORAK_NADIMKA.source}
        title={PORUKA_NEVALJANOG_NADIMKA}
        placeholder="Tvoj nadimak"
        aria-label="Tvoj nadimak"
        required
      />
      <button type="submit" disabled={!jeValjanNadimak(nadimak)}>
        Dalje
      </button>
    </form>
  {:else}
    <p class="napomena">
      Email koristimo za potvrdu računa i oporavak lozinke. Obavijesti u igri (sandučic) ostaju unutar aplikacije — ne šaljemo marketinške emailove.
    </p>

    <form onsubmit={dovrsiregistraciju}>
      <label class="labela">
        Email
        <input type="email" bind:value={email} required placeholder="tvoj@email.com" />
      </label>

      <UnosLozinke bind:vrijednost={lozinka} oznaka="Lozinka (min. 8 znakova)" najmanjaDuljina={8} />

      <label class="checkbox-redak">
        <input type="checkbox" bind:checked={potvrdaDob16} />
        <span>Potvrđujem da imam najmanje 16 godina.</span>
      </label>
      <label class="checkbox-redak">
        <input type="checkbox" bind:checked={prihvacamUvjete} />
        <span>
          Pročitao/la sam i prihvaćam
          <a href="/uvjeti" target="_blank" rel="noopener noreferrer">Uvjete korištenja</a>.
        </span>
      </label>
      <p class="napomena-privatnost">
        <a href="/privatnost" target="_blank" rel="noopener noreferrer">Pravila privatnosti</a>
      </p>

      <button
        type="submit"
        class="glavni-gumb"
        disabled={!email || lozinka.length < 8 || !potvrdaDob16 || !prihvacamUvjete || slanjeUTijeku}
      >
        {slanjeUTijeku ? 'Stvaram račun…' : 'Dalje: stvori avatar'}
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
    border: 2px solid var(--boja-obrub);
    background: var(--boja-povrsina-3);
    color: var(--boja-tekst-osnovni);
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
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .greska {
    color: var(--boja-poraz-tekst);
    margin: 0;
    font-weight: 600;
  }

  .checkbox-redak {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    color: var(--boja-tekst-sekundarni);
    line-height: 1.4;
    cursor: pointer;
    font-weight: 500;
  }

  .checkbox-redak input {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .checkbox-redak a,
  .napomena-privatnost a {
    color: var(--boja-tekst-naslov);
    font-weight: 700;
  }

  .napomena-privatnost {
    margin: -4px 0 0;
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
  }
</style>
