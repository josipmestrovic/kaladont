<script lang="ts">
  import type { RazinaVatre } from 'zajednicko';

  interface Props {
    razina?: RazinaVatre;
    niz?: number;
  }

  let { razina = 0, niz = 0 }: Props = $props();
</script>

{#if razina > 0}
  <div class={`avatar-vatra razina-${razina}`} role="img" aria-label={`Pobjednički niz: ${niz} ${niz === 1 ? 'pobjeda' : 'pobjede'}`}>
    {#each Array(razina) as _}
      <img src="/ikone/19-vatra.png" alt="" aria-hidden="true" />
    {/each}
  </div>
{/if}

<style>
  .avatar-vatra {
    position: absolute;
    z-index: 0;
    inset: -10%;
    display: flex;
    align-items: center;
    justify-content: space-around;
    pointer-events: none;
    filter: drop-shadow(0 0 5px rgb(224 74 35 / 55%));
  }

  .avatar-vatra img {
    width: 44%;
    height: 44%;
    object-fit: contain;
    opacity: .55;
  }

  .avatar-vatra.razina-2 {
    inset: -15%;
    filter: drop-shadow(0 0 8px rgb(224 74 35 / 70%));
  }

  .avatar-vatra.razina-2 img {
    width: 46%;
    height: 46%;
    opacity: .72;
  }

  .avatar-vatra.razina-3 {
    inset: -20%;
    filter: drop-shadow(0 0 12px rgb(224 74 35 / 85%));
  }

  .avatar-vatra.razina-3 img {
    width: 48%;
    height: 48%;
    opacity: .9;
  }
</style>
