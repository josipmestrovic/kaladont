<script lang="ts">
  import { page } from '$app/stores';
  import { ucitajAseteProfila } from '$lib/asetovi-core.js';
  import ProfileView from '$lib/komponente/profil/ProfileView.svelte';
  import { onMount } from 'svelte';

  const prikazujePostavke = $derived($page.url.searchParams.get('tab') === 'postavke');

  onMount(() => {
    ucitajAseteProfila();
  });
</script>

<svelte:head>
  <title>Profil | Kaladont</title>
</svelte:head>

<ProfileView nacin="vlastiti" {prikazujePostavke} />
