<script lang="ts">
  import { page } from '$app/stores';
  import ProfileView from '$lib/komponente/profil/ProfileView.svelte';

  const igracId = $derived($page.params.igracId ?? '');
</script>

<svelte:head>
  <title>Profil igrača | Kaladont</title>
</svelte:head>

{#key igracId}
  <ProfileView nacin="javni" {igracId} />
{/key}
