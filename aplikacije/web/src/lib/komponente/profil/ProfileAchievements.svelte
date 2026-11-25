<script lang="ts">
  import DostignuceKartica from '$lib/komponente/DostignuceKartica.svelte';
  import type { Dostignuce, JavniDioProfila } from './tipovi.js';

  type Filter = 'sva' | 'otkljucana' | 'zakljucana';

  let {
    profil,
    vlasnik = false,
  }: {
    profil: JavniDioProfila;
    vlasnik?: boolean;
  } = $props();

  let filter = $state<Filter>('sva');

  const popis = $derived.by(() => {
    const sva = profil.dostignuca.dostignuca;
    if (filter === 'otkljucana') return sva.filter((d) => d.razina > 0);
    if (filter === 'zakljucana') return sva.filter((d) => d.razina <= 0);
    return sva;
  });

  const postotakZvjezdica = $derived(
    profil.dostignuca.maksimalnoZvjezdica > 0
      ? Math.min(100, (100 * profil.dostignuca.ukupnoZvjezdica) / profil.dostignuca.maksimalnoZvjezdica)
      : 0,
  );

  function trenutniNiz(dostignuce: Dostignuce): number | null {
    if (dostignuce.id !== 'stalno_si_tu') return null;
    const aktivnost = (profil as { aktivnostDana?: { trenutniNiz: number } }).aktivnostDana;
    return aktivnost?.trenutniNiz ?? null;
  }
</script>

<section id="dostignuca" class="dostignuca" aria-labelledby="dostignuca-naslov">
  <h2 id="dostignuca-naslov" class="sr-only">Dostignuća</h2>
  <div class="sazetak">
    <div>
      <strong>{profil.dostignuca.ukupnoZvjezdica} / {profil.dostignuca.maksimalnoZvjezdica}</strong>
      <span>Osvojene zvjezdice</span>
    </div>
    <div>
      <strong>{profil.dostignuca.ukupnoOtkljucanih} / {profil.dostignuca.dostignuca.length}</strong>
      <span>Otključana dostignuća</span>
    </div>
  </div>
  <div
    class="traka"
    aria-label={`Zvjezdice: ${profil.dostignuca.ukupnoZvjezdica} od ${profil.dostignuca.maksimalnoZvjezdica}`}
  >
    <span style={`width: ${postotakZvjezdica}%`}></span>
  </div>

  <div class="filteri" role="group" aria-label="Filter dostignuća">
    <button type="button" class:aktivan={filter === 'sva'} onclick={() => (filter = 'sva')}>Sva</button>
    <button type="button" class:aktivan={filter === 'otkljucana'} onclick={() => (filter = 'otkljucana')}>Otključana</button>
    <button type="button" class:aktivan={filter === 'zakljucana'} onclick={() => (filter = 'zakljucana')}>Zaključana</button>
  </div>

  {#if popis.length === 0}
    <p class="prazno">Nema dostignuća u ovom filteru.</p>
  {:else}
    <div class="mreza">
      {#each popis as dostignuce (dostignuce.id)}
        <DostignuceKartica
          {dostignuce}
          trenutniNiz={trenutniNiz(dostignuce)}
          prikaziNovo={vlasnik}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .dostignuca { display: grid; gap: 14px; }
  .sazetak {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .sazetak div { display: grid; gap: 4px; }
  .sazetak strong { font-family: var(--font-naslov); font-size: 1.35rem; color: var(--boja-isticanje-tekst); }
  .sazetak span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .traka {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--boja-obrub);
  }
  .traka span { display: block; height: 100%; background: var(--boja-isticanje-slova); }
  .filteri { display: flex; flex-wrap: wrap; gap: 8px; }
  .filteri button {
    padding: 8px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 999px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    cursor: pointer;
  }
  .filteri button.aktivan {
    background: var(--boja-povrsina);
    border-color: var(--boja-obrub-jaci, var(--boja-obrub));
    font-weight: 700;
  }
  .mreza {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .prazno { margin: 0; color: var(--boja-tekst-sekundarni); }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  @media (max-width: 999px) {
    .mreza { grid-template-columns: 1fr; }
  }
</style>
