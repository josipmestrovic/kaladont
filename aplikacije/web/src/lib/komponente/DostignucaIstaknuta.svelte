<script lang="ts">
  import { tick } from 'svelte';
  import { odaberiIstaknutaDostignuca, type DefinicijaDostignuca } from 'zajednicko';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  interface Dostignuce extends DefinicijaDostignuca {
    razina: number;
    vrijednost: number;
    sljedeciPrag: number | null;
  }

  let { dostignuca }: { dostignuca: readonly Dostignuce[] } = $props();
  let otvorenoId = $state<string | null>(null);
  let omotac = $state<HTMLDivElement | undefined>();
  let pozicijaPojasnjenja = $state('');
  const istaknuta = $derived(odaberiIstaknutaDostignuca(dostignuca, 6));

  async function preklopi(dogadaj: MouseEvent, id: string, tooltipId: string) {
    dogadaj.stopPropagation();
    if (otvorenoId === id) {
      otvorenoId = null;
      return;
    }

    const sidro = dogadaj.currentTarget as HTMLButtonElement;
    otvorenoId = id;
    await tick();

    const pojasnjenje = document.getElementById(tooltipId);
    if (!pojasnjenje) {
      otvorenoId = null;
      return;
    }

    const okvirSidra = sidro.getBoundingClientRect();
    const okvirPojasnjenja = pojasnjenje.getBoundingClientRect();
    const rub = 12;
    const lijevo = Math.max(
      rub,
      Math.min(
        okvirSidra.left + okvirSidra.width / 2 - okvirPojasnjenja.width / 2,
        window.innerWidth - okvirPojasnjenja.width - rub,
      ),
    );
    let vrh = okvirSidra.bottom + 8;
    if (vrh + okvirPojasnjenja.height > window.innerHeight - rub) {
      vrh = okvirSidra.top - okvirPojasnjenja.height - 8;
    }
    vrh = Math.max(rub, Math.min(vrh, window.innerHeight - okvirPojasnjenja.height - rub));
    pozicijaPojasnjenja = `top: ${vrh}px; left: ${lijevo}px`;
  }

  function zatvoriIzvan(dogadaj: MouseEvent) {
    if (omotac && !omotac.contains(dogadaj.target as Node)) otvorenoId = null;
  }
</script>

<svelte:window
  onclick={zatvoriIzvan}
  onkeydown={(dogadaj) => dogadaj.key === 'Escape' && (otvorenoId = null)}
  onscroll={() => (otvorenoId = null)}
  onresize={() => (otvorenoId = null)}
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
            onclick={(dogadaj) => preklopi(dogadaj, dostignuce.id, tooltipId)}
          >
            <img class="ikona" src={ikonaDostignuca(dostignuce.id)} alt="" aria-hidden="true" />
            <span class="zvjezdice" aria-label={`${dostignuce.razina} od ${dostignuce.pragovi.length} zvjezdica`}>
              {#each dostignuce.pragovi as _, indeks}
                <img src={indeks < dostignuce.razina ? '/ikone/27-zvjezdica-puna.png' : '/ikone/26-zvjezdica-prazna.png'} alt="" aria-hidden="true" />
              {/each}
            </span>
          </button>
          {#if otvorenoId === dostignuce.id}
            <div id={tooltipId} class="pojasnjenje" style={pozicijaPojasnjenja} role="tooltip">
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
  .pojasnjenje { position: fixed; z-index: 30; width: min(280px, calc(100vw - 32px)); max-height: calc(100vh - 24px); overflow-y: auto; padding: 12px 14px; border: 1px solid var(--boja-obrub-jaci); border-radius: 8px; background: var(--boja-povrsina-2); box-shadow: var(--sjena-modal); color: var(--boja-tekst-osnovni); font-size: var(--tekst-sitni); line-height: 1.45; text-align: left; }
  .pojasnjenje strong { display: block; margin-bottom: 4px; color: var(--boja-tekst-naslov); }
  .pojasnjenje p { margin: 4px 0 0; }

  @media (max-width: 499px) {
    .dostignuca-istaknuta { width: max-content; max-width: 100%; margin-left: auto; }
    .popis { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
    .ikona { width: 41.6px; height: 41.6px; }
    .zvjezdice { gap: 0.8px; }
    .zvjezdice img { width: 9.6px; height: 9.6px; }
  }
</style>