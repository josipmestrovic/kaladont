<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { osvjeziSocketIdentitet } from '$lib/socket.js';

  const token = $derived($page.url.searchParams.get('token') ?? '');
  let poruka = $state('Potvrđujemo email adresu...');
  let uspjeh = $state(false);

  onMount(async () => {
    if (!token) {
      poruka = 'Poveznica za potvrdu nije ispravna.';
      return;
    }
    try {
      await api('/racuni/potvrdi-email', { method: 'POST', body: JSON.stringify({ token }) });
      if (jeRegistriranKorisnik()) await osvjeziSocketIdentitet().catch(() => {});
      uspjeh = true;
      poruka = 'Email adresa je potvrđena.';
    } catch (greska) {
      poruka = greska instanceof Error ? greska.message : 'Potvrda emaila nije uspjela.';
    }
  });
</script>

<svelte:head>
  <title>Potvrda emaila | Kaladont</title>
</svelte:head>

<main>
  <h1>Potvrda emaila</h1>
  <p role={uspjeh ? 'status' : 'alert'}>{poruka}</p>
  {#if uspjeh}<p><a href={jeRegistriranKorisnik() ? '/red' : '/prijava'}>{jeRegistriranKorisnik() ? 'Nastavi igrati' : 'Prijavi se za igru'}</a></p>{/if}
</main>