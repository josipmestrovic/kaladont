<script lang="ts">
  import { tick } from 'svelte';
  import { CircleHelp, X } from 'lucide-svelte';

  type StilIgre = 'agresivan' | 'uravnotežen' | 'dobrica' | 'neodređen';

  let { stilIgre, id }: { stilIgre: StilIgre; id: string } = $props();
  let otvoreno = $state(false);
  let omotac = $state<HTMLSpanElement | undefined>(undefined);
  let gumbStila = $state<HTMLButtonElement | undefined>(undefined);
  let prozorObjasnjenja = $state<HTMLDivElement | undefined>(undefined);
  let pozicijaObjasnjenja = $state('');

  const opisi: Record<StilIgre, string> = {
    agresivan: 'Uvijek traži priliku odigrati riječ koja će eliminirati sljedećeg igrača.',
    uravnotežen: 'Nekad eliminira druge, ali eliminacije mu nisu glavni prioritet.',
    dobrica: 'Ne voli kad drugi ispadaju zbog njegove riječi.',
    neodređen: 'Stil igre prikazat ćemo kad bude dovoljno podataka iz partija.',
  };

  async function preklopi(dogadaj: MouseEvent): Promise<void> {
    dogadaj.stopPropagation();
    if (otvoreno) {
      otvoreno = false;
      return;
    }

    otvoreno = true;
    await tick();
    if (!gumbStila || !prozorObjasnjenja) {
      otvoreno = false;
      return;
    }
    const sidro = gumbStila.getBoundingClientRect();
    const kutija = prozorObjasnjenja.getBoundingClientRect();
    const lijevo = Math.max(16, Math.min(sidro.right - kutija.width, window.innerWidth - kutija.width - 16));
    const vrh = Math.max(8, sidro.top - kutija.height - 8);
    pozicijaObjasnjenja = `top: ${vrh}px; left: ${lijevo}px`;
  }

  function zatvoriIzvan(dogadaj: MouseEvent): void {
    if (omotac && !omotac.contains(dogadaj.target as Node)) otvoreno = false;
  }

  function zatvoriNaEscape(dogadaj: KeyboardEvent): void {
    if (dogadaj.key === 'Escape') otvoreno = false;
  }
</script>

<svelte:window
  onclick={zatvoriIzvan}
  onkeydown={zatvoriNaEscape}
  onscroll={() => (otvoreno = false)}
  onresize={() => (otvoreno = false)}
/>

<span class="stil-omotac" class:otvoreno bind:this={omotac}>
  <span class="stil-natpis">Stil igre:</span>
  <button
    type="button"
    class="stil-naziv"
    class:agresivan={stilIgre === 'agresivan'}
    class:uravnotezen={stilIgre === 'uravnotežen'}
    class:dobrica={stilIgre === 'dobrica'}
    aria-expanded={otvoreno}
    aria-controls={id}
    aria-haspopup="dialog"
    onclick={preklopi}
    bind:this={gumbStila}
  >
    {stilIgre}
  </button>
  <button
    type="button"
    class="stil-pomoc"
    aria-label={`Objasni stil igre: ${stilIgre}`}
    aria-expanded={otvoreno}
    aria-controls={id}
    aria-haspopup="dialog"
    onclick={preklopi}
  >
    <CircleHelp size={16} strokeWidth={2} aria-hidden="true" />
  </button>
  {#if otvoreno}
    <div id={id} bind:this={prozorObjasnjenja} class="stil-objasnjenje" style={pozicijaObjasnjenja} role="dialog" aria-label={`Objašnjenje stila: ${stilIgre}`}>
      <button type="button" class="stil-zatvori" aria-label="Zatvori objašnjenje stila" onclick={() => (otvoreno = false)}>
        <X size={16} aria-hidden="true" />
      </button>
      <p>{opisi[stilIgre]}</p>
    </div>
  {/if}
</span>

<style>
  .stil-omotac { position: relative; display: inline-flex; max-width: 100%; align-items: center; gap: 5px; margin-top: 16px; color: var(--boja-tekst-osnovni); font-size: var(--tekst-mali); }
  .stil-omotac.otvoreno { z-index: 1000; }
  .stil-natpis { white-space: nowrap; }
  .stil-naziv, .stil-pomoc, .stil-zatvori { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .stil-naziv { min-width: 0; border-bottom: 1px dotted currentColor; font-family: var(--font-naslov); font-size: 1.05rem; font-weight: 800; text-transform: capitalize; overflow-wrap: anywhere; }
  .stil-naziv.agresivan { color: var(--boja-akcent-tekst); }
  .stil-naziv.uravnotezen { color: var(--boja-tekst-osnovni); }
  .stil-naziv.dobrica { color: var(--boja-isticanje-tekst); }
  .stil-pomoc { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; }
  .stil-pomoc:hover, .stil-zatvori:hover { background: var(--boja-obrub); }
  .stil-naziv:focus-visible, .stil-pomoc:focus-visible, .stil-zatvori:focus-visible { outline: 2px solid var(--boja-fokus); outline-offset: 3px; }
  .stil-objasnjenje { position: fixed; z-index: 1001; width: min(300px, calc(100vw - 32px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 14px 38px 14px 14px; border: 1px solid var(--boja-obrub-jaci); border-radius: 8px; background: var(--boja-povrsina-2); box-shadow: var(--sjena-modal); color: var(--boja-tekst-osnovni); font-size: var(--tekst-sitni); line-height: 1.5; }
  .stil-objasnjenje p { margin: 0; }
  .stil-zatvori { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; }

  @media (max-width: 999px) {
    .stil-omotac { margin-top: 8px; }
  }
</style>