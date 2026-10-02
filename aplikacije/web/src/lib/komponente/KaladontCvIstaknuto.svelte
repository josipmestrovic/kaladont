<script lang="ts">
  let { stavke }: { stavke: readonly string[] } = $props();
</script>

{#if stavke.length >= 2}
  <section class="cv-istaknuto" aria-label="Ističe se po">
    <h2>Ističe se po:</h2>
    <ul>
      {#each stavke.slice(0, 3) as stavka}
        <li>{stavka}</li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .cv-istaknuto { width: min(100%, 320px); min-width: 0; text-align: left; }
  .cv-istaknuto h2 { margin: 0 0 4px; color: var(--boja-mint); font-family: var(--font-naslov); font-size: var(--tekst-mali); }
  .cv-istaknuto ul { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
  .cv-istaknuto li { color: var(--boja-tekst-osnovni); font-size: var(--tekst-sitni); line-height: 1.35; overflow-wrap: anywhere; }
</style>