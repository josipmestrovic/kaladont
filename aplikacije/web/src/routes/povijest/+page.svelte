<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    void goto('/profil');
  });
</script>

<svelte:head>
  <title>Povijest partija | Kaladont</title>
</svelte:head>

<p>Preusmjeravanje na profil...</p>
