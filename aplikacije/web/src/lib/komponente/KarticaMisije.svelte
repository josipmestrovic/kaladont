<script lang="ts">
  import type { MisijaDto } from 'zajednicko';
  import { Check, RefreshCw } from 'lucide-svelte';
  import { formatirajXp, oznakaVrsteMisije } from '$lib/misije-prikaz.js';

  let {
    misija,
    zamjenaBlokirana = false,
    onZamijeni,
  }: {
    misija: MisijaDto;
    zamjenaBlokirana?: boolean;
    onZamijeni?: (misija: MisijaDto) => void;
  } = $props();

  const dovrsena = $derived(misija.status === 'dovrsena');
  const uTijeku = $derived(!dovrsena && misija.napredak > 0);
  const postotak = $derived(
    misija.cilj <= 0 ? 100 : Math.min(100, (misija.napredak / misija.cilj) * 100),
  );
  const zamjenaDostupna = $derived(!dovrsena && misija.zamjena.dopustena && !zamjenaBlokirana);
  const nagradaPotvrdjena = $derived(dovrsena && misija.nagrada !== null);
  const xpIznos = $derived(
    nagradaPotvrdjena
      ? formatirajXp(misija.nagrada!.xpStvarnoDodijeljeno)
      : formatirajXp(misija.xpNagrada),
  );

  function tekstNapretka(m: MisijaDto): string {
    if (m.metrika === 'niz_max') return `Najdulji niz u jednoj igri: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'partije_s_nizom') return `Igre s traženim nizom: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'partije_s_rijecima') return `Igre s dovoljno riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'razliciti_poceci') return `Različiti počeci riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'dani') return `Različiti dani s javnom igrom: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'duge_i_rijetke') return `Takve riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'pobjede' || m.metrika === 'trening_pobjede') {
      return `Pobjede: ${m.napredak} / ${m.cilj}`;
    }
    if (m.metrika === 'partije') return `Igre: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'rijeci' || m.metrika === 'rijeci_u_partiji_max') {
      return `Riječi: ${m.napredak} / ${m.cilj}`;
    }
    if (m.metrika === 'partije_s_dokazom') return `Igre s uspješnim dokazom: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'kaladont_sljedeci') {
      return `Igre s kaladontom na sljedećeg: ${m.napredak} / ${m.cilj}`;
    }
    return `${m.napredak} / ${m.cilj}`;
  }
</script>

<article
  class="kartica-misije"
  class:dovrsena
  class:u-tijeku={uTijeku}
  data-dodjela-id={misija.dodjelaId}
  data-slot={misija.slot}
  aria-label={`${misija.naziv}${dovrsena ? ', završeno' : ''}`}
>
  <header class="zaglavlje">
    <span class="oznaka">{oznakaVrsteMisije(misija.vrsta)}</span>
    <div class="akcije">
      {#if !dovrsena}
        <button
          type="button"
          class="gumb-akcija"
          aria-label={`Zamijeni misiju: ${misija.naziv}`}
          title={misija.zamjena.razlog ?? 'Zamijeni misiju'}
          disabled={!zamjenaDostupna || !onZamijeni}
          onclick={() => onZamijeni?.(misija)}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      {:else}
        <span class="zavrseno-ikona" aria-hidden="true"><Check size={18} /></span>
      {/if}
    </div>
  </header>

  <h3>{misija.naziv}</h3>
  <p class="opis">{misija.opis}</p>

  <div class="napredak-red">
    <span>{dovrsena ? 'Završeno' : 'Napredak'}</span>
    <span class="napredak-broj">{misija.napredak} / {misija.cilj}</span>
  </div>
  <p class="napredak-tekst sr-only">{tekstNapretka(misija)}</p>

  <div
    class="traka"
    class:puna={dovrsena || postotak >= 100}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={misija.cilj}
    aria-valuenow={misija.napredak}
    aria-label={`Napredak: ${misija.napredak} od ${misija.cilj}`}
  >
    <span style={`width: ${postotak}%`}></span>
  </div>

  {#if misija.podciljevi && misija.podciljevi.length > 0}
    <ul class="podciljevi">
      {#each misija.podciljevi as pod (pod.kljuc)}
        <li>{pod.naziv}: {pod.napredak} / {pod.cilj}</li>
      {/each}
    </ul>
  {/if}

  <div class="nagrada-red">
    <p class="xp">+{xpIznos} XP</p>
    {#if nagradaPotvrdjena}
      <p class="osvojeno">Osvojeno</p>
    {/if}
  </div>
</article>

<style>
  .kartica-misije {
    display: grid;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
    min-width: 0;
    height: 100%;
    align-content: start;
  }
  .kartica-misije.u-tijeku {
    border-color: color-mix(in srgb, var(--boja-zuta-krema) 55%, var(--boja-obrub));
  }
  .kartica-misije.dovrsena {
    border-color: color-mix(in srgb, var(--boja-mint) 45%, var(--boja-obrub));
  }
  .zaglavlje {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .oznaka {
    font-size: 0.8rem;
    color: var(--boja-tekst-sekundarni);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
  }
  .akcije {
    display: flex;
    gap: 4px;
  }
  .gumb-akcija {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina);
    color: var(--boja-tekst);
    cursor: pointer;
  }
  .gumb-akcija:hover:not(:disabled) {
    border-color: var(--boja-isticanje-tekst);
    color: var(--boja-isticanje-tekst);
  }
  .gumb-akcija:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .zavrseno-ikona {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    color: var(--boja-mint);
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--boja-tekst);
  }
  .opis,
  .napredak-tekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .napredak-red {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--boja-tekst-sekundarni);
    font-size: 0.95rem;
  }
  .napredak-broj {
    font-variant-numeric: tabular-nums;
    color: var(--boja-tekst);
    font-weight: 600;
  }
  .traka {
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: color-mix(in srgb, var(--boja-obrub) 55%, transparent);
  }
  .traka span {
    display: block;
    height: 100%;
    width: 0;
    background: var(--boja-zuta-krema);
    transition: width 0.35s ease;
  }
  .traka.puna span {
    background: var(--boja-mint);
  }
  @media (prefers-reduced-motion: reduce) {
    .traka span {
      transition: none;
    }
  }
  .podciljevi {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 4px;
    color: var(--boja-tekst-sekundarni);
    font-size: 0.95rem;
  }
  .nagrada-red {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
  }
  .xp {
    margin: 0;
    font-weight: 700;
    color: var(--boja-isticanje-tekst);
  }
  .osvojeno {
    margin: 0;
    font-weight: 700;
    color: var(--boja-mint);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
