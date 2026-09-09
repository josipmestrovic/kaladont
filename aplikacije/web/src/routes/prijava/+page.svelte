<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { spremiSesijskiToken } from '$lib/identitet.js';

  let email = $state('');
  let lozinka = $state('');
  let poruka = $state<string | null>(null);

  async function posalji(e: SubmitEvent) {
    e.preventDefault();
    poruka = null;
    try {
      const odgovor = await api<{ sesijskiToken: string }>('/racuni/prijava', {
        method: 'POST',
        body: JSON.stringify({ email, lozinka }),
      });
      spremiSesijskiToken(odgovor.sesijskiToken);
      goto('/profil');
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Prijava nije uspjela.';
    }
  }
</script>

<h1>Prijava</h1>

<form onsubmit={posalji}>
  <label>Email <input type="email" bind:value={email} required /></label>
  <label>Lozinka <input type="password" bind:value={lozinka} required /></label>
  <button type="submit">Prijavi se</button>
</form>

{#if poruka}
  <p role="alert">{poruka}</p>
{/if}

<p><a href="/registracija">Nemaš račun? Registriraj se</a></p>
