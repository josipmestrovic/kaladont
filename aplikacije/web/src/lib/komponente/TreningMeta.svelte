<script lang="ts">
  import type { PravilnikPartije, ProfilBotaIzazova } from 'zajednicko';
  import { NAZIVI_PROFILA_BOTA } from 'zajednicko';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';
  import { TEKSTOVI_PRAVILNIKA } from '$lib/igraj-rute.js';

  let {
    pravila = null,
    profileId = null,
  }: {
    pravila?: PravilnikPartije | null;
    profileId?: ProfilBotaIzazova | null;
  } = $props();

  const tekstPravila = $derived(pravila ? TEKSTOVI_PRAVILNIKA[pravila] : null);
  const nazivTezine = $derived(profileId ? NAZIVI_PROFILA_BOTA[profileId] : null);
</script>

{#if tekstPravila || nazivTezine}
  <aside class="trening-meta" aria-label="Postavke treninga" data-testid="trening-meta">
    {#if nazivTezine}
      <span class="stavka">
        <span class="oznaka">Težina</span>
        <strong>{nazivTezine}</strong>
      </span>
    {/if}
    {#if tekstPravila && pravila}
      <span class="stavka pravila">
        <span class="oznaka">Pravila</span>
        <PojamPomoc
          tekst={tekstPravila.naziv}
          opis={tekstPravila.opis}
          id={`trening-pravila-${pravila}`}
          pozicioniranje="uz-okidac"
        />
      </span>
    {/if}
  </aside>
{/if}

<style>
  .trening-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    width: 100vw;
    margin: 0 0 10px;
    margin-left: calc(50% - 50vw);
    padding: 10px max(16px, calc(50vw - 50%));
    border: 1px solid var(--boja-obrub);
    border-bottom: none;
    border-radius: 0 0 8px 8px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
    line-height: 1.35;
    overflow: visible;
    box-sizing: border-box;
  }

  .stavka {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  .oznaka {
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }

  .stavka strong {
    color: var(--boja-tekst-osnovni);
    font-weight: 800;
  }

  .pravila :global(.pojam-gumb) {
    font-weight: 800;
    color: var(--boja-tekst-osnovni);
  }
</style>
