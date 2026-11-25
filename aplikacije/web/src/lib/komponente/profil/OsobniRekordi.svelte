<script lang="ts">
  import { Trophy, Flame, Ruler, Zap } from 'lucide-svelte';
  import type { OsobniRekordi } from './tipovi.js';
  import { formatirajTrajanjeMs } from './tipovi.js';

  let { rekordi }: { rekordi: OsobniRekordi } = $props();

  const stavke = $derived([
    {
      ikona: Trophy,
      vrijednost: String(rekordi.najboljiNizPobjeda),
      naziv: 'Najdulji niz pobjeda',
    },
    {
      ikona: Flame,
      vrijednost: String(rekordi.nizPrihvacenihRijeci),
      naziv: 'Niz prihvaćenih riječi',
    },
    {
      ikona: Ruler,
      vrijednost: rekordi.najduzaRijecGrafemi > 0
        ? `${rekordi.najduzaRijecGrafemi} ${rekordi.najduzaRijecGrafemi === 1 ? 'slovo' : 'slova'}`
        : '—',
      naziv: rekordi.najduzaRijec
        ? `Najdulja odigrana riječ · ${rekordi.najduzaRijec}`
        : 'Najdulja odigrana riječ',
    },
    {
      ikona: Zap,
      vrijednost: formatirajTrajanjeMs(rekordi.najbrziPrihvaceniPotezMs),
      naziv: 'Najbrži prihvaćeni potez',
    },
  ]);
</script>

<section class="osobni-rekordi" aria-labelledby="osobni-rekordi-naslov">
  <h2 id="osobni-rekordi-naslov">Osobni rekordi</h2>
  <div class="mreza">
    {#each stavke as stavka}
      {@const Ikona = stavka.ikona}
      <article class="kartica">
        <span class="ikona" aria-hidden="true"><Ikona size={18} strokeWidth={2.2} /></span>
        <strong class="vrijednost">{stavka.vrijednost}</strong>
        <span class="naziv">{stavka.naziv}</span>
      </article>
    {/each}
  </div>
</section>

<style>
  .osobni-rekordi { display: grid; gap: 12px; }
  h2 { margin: 0; font-family: var(--font-naslov); font-size: 1.35rem; }
  .mreza {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .kartica {
    display: grid;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica, 8px);
    background: var(--boja-povrsina-2);
  }
  .ikona { color: var(--boja-isticanje-tekst); }
  .vrijednost {
    font-family: var(--font-naslov);
    font-size: 1.55rem;
    line-height: 1.1;
    color: var(--boja-tekst-osnovni);
  }
  .naziv { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }

  @media (max-width: 999px) {
    .mreza { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
