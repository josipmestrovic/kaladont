<script lang="ts">
  import { api } from '$lib/api.js';

  let email = $state('');
  let poslano = $state(false);
  let poruka = $state<string | null>(null);

  async function posalji(event: SubmitEvent) {
    event.preventDefault();
    poruka = null;
    try {
      await api('/racuni/zaboravljena-lozinka', { method: 'POST', body: JSON.stringify({ email }) });
      poslano = true;
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Zahtjev nije uspio.';
    }
  }
</script>

<main>
  <h1>Reset lozinke</h1>
  {#if poslano}
    <p>Ako račun postoji, poslali smo upute na unesenu email adresu.</p>
    <p>Nemaš račun? <a href="/registracija">Registriraj se</a>.</p>
  {:else}
    <form onsubmit={posalji}>
      <label>Email <input type="email" bind:value={email} required placeholder="tvoj@email.com" /></label>
      <button type="submit">Pošalji upute</button>
    </form>
  {/if}
  {#if poruka}<p role="alert">{poruka}</p>{/if}
</main>