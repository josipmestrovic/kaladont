<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { dohvatiGostToken, spremiSesijskiToken } from '$lib/identitet.js';

  let email = $state('');
  let lozinka = $state('');
  let nadimak = $state('');
  let poruka = $state<string | null>(null);

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    poruka = null;
    try {
      const odgovor = await api<{ sesijskiToken: string }>('/racuni/registracija', {
        method: 'POST',
        body: JSON.stringify({
          gostToken: dohvatiGostToken(),
          email,
          lozinka,
          nadimak: nadimak || undefined,
        }),
      });
      spremiSesijskiToken(odgovor.sesijskiToken);
      goto('/profil');
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Registracija nije uspjela.';
    }
  }
</script>

<h1>Registracija</h1>
<p>Tvoja dosadašnja statistika (ako si igrao/igrala kao gost) ostaje sačuvana.</p>

<form onsubmit={posalji}>
  <label>Email <input type="email" bind:value={email} required /></label>
  <p class="email-napomena">Email koristimo isključivo za pristup računu (npr. zaboravljena lozinka) — nema newslettera, nema reklamnih poruka.</p>
  <label>Lozinka (min. 8 znakova) <input type="password" bind:value={lozinka} minlength="8" required /></label>
  <label>Nadimak (opcionalno) <input type="text" bind:value={nadimak} /></label>
  <button type="submit">Registriraj se</button>
</form>

{#if poruka}
  <p role="alert">{poruka}</p>
{/if}

<p><a href="/prijava">Već imaš račun? Prijavi se</a></p>

<style>
  .email-napomena {
    font-size: var(--tekst-sitni);
    color: #7a7264;
    margin: 4px 0 12px;
  }
</style>
