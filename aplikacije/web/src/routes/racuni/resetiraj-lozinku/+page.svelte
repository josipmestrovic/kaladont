<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import UnosLozinke from '$lib/komponente/UnosLozinke.svelte';

  const token = $derived($page.url.searchParams.get('token') ?? '');
  let lozinka = $state('');
  let poruka = $state<string | null>(null);
  let gotovo = $state(false);

  async function posalji(event: SubmitEvent) {
    event.preventDefault();
    poruka = null;
    try {
      await api('/racuni/resetiraj-lozinku', { method: 'POST', body: JSON.stringify({ token, novaLozinka: lozinka }) });
      gotovo = true;
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Reset lozinke nije uspio.';
    }
  }
</script>

<main>
  <h1>Postavi novu lozinku</h1>
  {#if !token}
    <p role="alert">Poveznica za reset nije ispravna.</p>
  {:else if gotovo}
    <p>Lozinka je promijenjena.</p>
    <button type="button" onclick={() => goto('/prijava')}>Prijavi se</button>
  {:else}
    <form onsubmit={posalji}>
      <UnosLozinke bind:vrijednost={lozinka} oznaka="Nova lozinka (min. 8 znakova)" najmanjaDuljina={8} />
      <button type="submit" disabled={lozinka.length < 8}>Spremi novu lozinku</button>
    </form>
  {/if}
  {#if poruka}<p role="alert">{poruka}</p>{/if}
</main>