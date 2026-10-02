<script lang="ts">
  import type { KaladontCvDto } from 'zajednicko';

  let { cv }: { cv: KaladontCvDto | null } = $props();
</script>

{#if cv}
  <section class="cv-sazetak" aria-label="Biografija Kaladont igrača">
    <h2>O igraču</h2>
    <div class="cv-biografija">
      {#each cv.biografija.recenice as recenica}
        <p>{recenica}</p>
      {/each}
    </div>
  </section>
{/if}

<style>
  .cv-sazetak { min-width: 0; margin-top: 20px; }
  h2 { margin: 0 0 4px; color: var(--boja-mint-tamni); font-family: var(--font-naslov); font-size: var(--tekst-sitni); }
  .cv-biografija { display: grid; gap: 4px; min-width: 0; }
  .cv-biografija p { margin: 0; color: var(--boja-tekst-osnovni); line-height: 1.55; overflow-wrap: anywhere; }
</style>