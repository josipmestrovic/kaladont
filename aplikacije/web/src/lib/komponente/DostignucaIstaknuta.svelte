<script lang="ts">
  import { odaberiTopTriDostignuca, type DefinicijaDostignuca } from 'zajednicko';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  interface Dostignuce extends DefinicijaDostignuca {
    razina: number;
    vrijednost: number;
    sljedeciPrag: number | null;
  }

  let { dostignuca }: { dostignuca: readonly Dostignuce[] } = $props();
  let otvorenoId = $state<string | null>(null);
  let omotac = $state<HTMLDivElement | undefined>();
  const istaknuta = $derived(odaberiTopTriDostignuca(dostignuca));

  function preklopi(dogadaj: MouseEvent, id: string) {
    dogadaj.stopPropagation();
    otvorenoId = otvorenoId === id ? null : id;
  }

  function zatvoriIzvan(dogadaj: MouseEvent) {
    if (omotac && !omotac.contains(dogadaj.target as Node)) otvorenoId = null;
  }
</script>

<svelte:window
  onclick={zatvoriIzvan}
  onkeydown={(dogadaj) => dogadaj.key === 'Escape' && (otvorenoId = null)}
/>

{#if istaknuta.length > 0}
  <section class="dostignuca-istaknuta" aria-label="Istaknuta dostignuća">
    <div class="popis" bind:this={omotac}>
      {#each istaknuta as dostignuce (dostignuce.id)}
        {@const tooltipId = `opis-dostignuca-${dostignuce.id}`}
        <div class="stavka">
          <button
            type="button"
            aria-label={`${dostignuce.naziv}, ${dostignuce.razina} od ${dostignuce.pragovi.length} zvjezdica`}
            aria-expanded={otvorenoId === dostignuce.id}
            aria-controls={tooltipId}
            aria-describedby={otvorenoId === dostignuce.id ? tooltipId : undefined}
            onclick={(dogadaj) => preklopi(dogadaj, dostignuce.id)}
          >
            <img class="ikona" src={ikonaDostignuca(dostignuce.id)} alt="" aria-hidden="true" />
            <span class="zvjezdice" aria-label={`${dostignuce.razina} od ${dostignuce.pragovi.length} zvjezdica`}>
              {#each dostignuce.pragovi as _, indeks}
                <img src={indeks < dostignuce.razina ? '/ikone/27-zvjezdica-puna.png' : '/ikone/26-zvjezdica-prazna.png'} alt="" aria-hidden="true" />
              {/each}
            </span>
          </button>
          {#if otvorenoId === dostignuce.id}
            <div id={tooltipId} class="pojasnjenje" role="tooltip">
              <strong>{dostignuce.naziv}</strong>
              <p>{dostignuce.opis}</p>
              {#if dostignuce.sljedeciPrag === null}
                <p>Maksimum dosegnut · {dostignuce.vrijednost}</p>
              {:else}
                <p>Napredak do sljedeće zvjezdice: {dostignuce.vrijednost} / {dostignuce.sljedeciPrag}</p>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .dostignuca-istaknuta { width: 90%; min-width: 0; }
  .popis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .stavka { position: relative; display: grid; justify-items: center; }
  .stavka button { display: grid; justify-items: center; gap: 3px; padding: 2px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
  .stavka button:focus-visible { outline: 2px solid var(--boja-fokus); outline-offset: 2px; }
  .ikona { width: 52px; height: 52px; object-fit: contain; }
  .zvjezdice { display: flex; gap: 1px; }
  .zvjezdice img { width: 12px; height: 12px; object-fit: contain; }
  .pojasnjenje { position: absolute; z-index: 30; top: calc(100% + 8px); left: 0; width: min(280px, calc(100vw - 32px)); padding: 12px 14px; border: 1px solid var(--boja-obrub-jaci); border-radius: 8px; background: var(--boja-povrsina-2); box-shadow: var(--sjena-modal); color: var(--boja-tekst-osnovni); font-size: var(--tekst-sitni); line-height: 1.45; text-align: left; }
  .stavka:nth-child(2) .pojasnjenje { left: 50%; transform: translateX(-50%); }
  .stavka:last-child .pojasnjenje { right: 0; left: auto; transform: none; }
  .pojasnjenje strong { display: block; margin-bottom: 4px; color: var(--boja-tekst-naslov); }
  .pojasnjenje p { margin: 4px 0 0; }

  @media (max-width: 999px) {
    .pojasnjenje { position: fixed; inset: auto 16px 16px; width: auto; transform: none !important; }
  }
</style>