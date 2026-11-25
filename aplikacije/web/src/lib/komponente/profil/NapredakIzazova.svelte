<script lang="ts">
  import { Trophy } from 'lucide-svelte';
  import type { NapredakIzazovaProfil } from './tipovi.js';

  let { napredak }: { napredak: NapredakIzazovaProfil } = $props();

  const postotak = $derived(
    napredak.napredakDoSljedeceg && napredak.napredakDoSljedeceg.ukupno > 0
      ? Math.min(100, (100 * napredak.napredakDoSljedeceg.zavrseno) / napredak.napredakDoSljedeceg.ukupno)
      : napredak.napredakDoSljedeceg === null ? 100 : 0,
  );
</script>

<section class="napredak-izazova" aria-labelledby="napredak-izazova-naslov">
  <h2 id="napredak-izazova-naslov">
    <Trophy size={18} strokeWidth={2.2} aria-hidden="true" />
    Napredak u izazovima
  </h2>
  <div class="metrike">
    <div>
      <strong class="lvl">LVL {napredak.trenutniLevel}</strong>
      <span>Trenutni LVL</span>
    </div>
    <div>
      <strong>{napredak.zavrseniIzazovi}</strong>
      <span>Završeni izazovi</span>
    </div>
    <div>
      <strong>{napredak.zvjezdice}</strong>
      <span>Zvjezdice</span>
    </div>
  </div>
  {#if napredak.napredakDoSljedeceg}
    <p class="opis">
      Napredak prema sljedećem LVL-u:
      {napredak.napredakDoSljedeceg.zavrseno} / {napredak.napredakDoSljedeceg.ukupno}
    </p>
    <div
      class="traka"
      aria-label={`Napredak: ${napredak.napredakDoSljedeceg.zavrseno} od ${napredak.napredakDoSljedeceg.ukupno}`}
    >
      <span style={`width: ${postotak}%`}></span>
    </div>
  {:else}
    <p class="opis">Sve razine izazova su završene.</p>
  {/if}
</section>

<style>
  .napredak-izazova {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica, 8px);
    background: var(--boja-povrsina-2);
  }
  h2 {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-naslov);
    font-size: 1.25rem;
  }
  .metrike {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .metrike div { display: grid; gap: 4px; }
  .metrike strong {
    font-family: var(--font-naslov);
    font-size: 1.45rem;
    line-height: 1.1;
  }
  .lvl { color: var(--boja-isticanje-tekst); }
  .metrike span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .opis { margin: 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .traka {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--boja-obrub);
  }
  .traka span {
    display: block;
    height: 100%;
    background: var(--boja-isticanje-slova);
  }
</style>
