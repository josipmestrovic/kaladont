<script lang="ts">
  import AvatarReferenca from '$lib/komponente/AvatarReferenca.svelte';
</script>

<svelte:head>
  <title>Avatar renderer dokaz | Kaladont</title>
</svelte:head>

<main class="dokaz">
  <h1>Avatar renderer dokaz</h1>
  <p>Referentni avatar iz Figma SVG izvoza na koordinatnom sustavu 380 × 380.</p>
  <AvatarReferenca velicina={380} rang="Lektor" />
</main>

<style>
  .dokaz {
    display: grid;
    justify-items: center;
    gap: 16px;
    padding: 32px 0 64px;
    text-align: center;
  }

  h1 { margin: 0; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); }
  p { margin: 0; color: var(--boja-tekst-sekundarni); }
</style>
