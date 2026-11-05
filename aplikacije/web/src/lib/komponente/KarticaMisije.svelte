<script lang="ts">
  import type { MisijaDto } from 'zajednicko';
  import { Check, Play, RefreshCw } from 'lucide-svelte';

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
  const postotak = $derived(misija.cilj <= 0 ? 100 : Math.min(100, (misija.napredak / misija.cilj) * 100));
  const zamjenaDostupna = $derived(!dovrsena && misija.zamjena.dopustena && !zamjenaBlokirana);
  const xpPrikaz = $derived(
    dovrsena && misija.nagrada
      ? `+${formatirajXp(misija.nagrada.xpStvarnoDodijeljeno)} XP`
      : `${formatirajXp(misija.xpNagrada)} XP`,
  );

  function formatirajXp(n: number): string {
    return n.toLocaleString('hr-HR');
  }

  function oznakaKonteksta(m: MisijaDto): string {
    if (m.kontekst === 'trening') return 'Zagrijavanje';
    if (m.mod === 'dva_igraca') return 'Dvoboj';
    if (m.mod === 'cetiri_igraca') return 'Četveroboj';
    return 'Javna igra';
  }

  function putanjaIgre(m: MisijaDto): string {
    if (m.kontekst === 'trening') return '/zagrijavanje';
    if (m.mod === 'dva_igraca') return '/red?mod=dva_igraca';
    if (m.mod === 'cetiri_igraca') return '/red?mod=cetiri_igraca';
    return '/?igraj=1';
  }

  function tekstNapretka(m: MisijaDto): string {
    if (m.metrika === 'niz_max') return `Najdulji niz u jednoj partiji: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'partije_s_nizom') return `Partije s traženim nizom: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'partije_s_rijecima') return `Partije s dovoljno riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'razliciti_poceci') return `Različiti počeci riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'dani') return `Različiti dani s javnom partijom: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'duge_i_rijetke') return `Takve riječi: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'pobjede' || m.metrika === 'trening_pobjede') return `Pobjede: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'partije') return `Partije: ${m.napredak} / ${m.cilj}`;
    if (m.metrika === 'rijeci' || m.metrika === 'rijeci_u_partiji_max') return `Riječi: ${m.napredak} / ${m.cilj}`;
    return `${m.napredak} / ${m.cilj}`;
  }
</script>

<article
  class="kartica-misije"
  class:dovrsena
  data-dodjela-id={misija.dodjelaId}
  data-slot={misija.slot}
  aria-label={`${misija.naziv}${dovrsena ? ', završeno' : ''}`}
>
  <header class="zaglavlje">
    <span class="oznaka">{oznakaKonteksta(misija)}</span>
    <div class="akcije">
      {#if !dovrsena}
        <a
          class="gumb-akcija"
          href={putanjaIgre(misija)}
          aria-label={`Odmah igraj: ${misija.naziv}`}
          title="Odmah igraj"
        >
          <Play size={18} aria-hidden="true" />
        </a>
      {/if}
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

  {#if dovrsena}
    <p class="status">Završeno</p>
  {:else}
    <p class="napredak-tekst">{tekstNapretka(misija)}</p>
  {/if}

  <div
    class="traka"
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

  <p class="xp" class:dodijeljeno={dovrsena && misija.nagrada !== null}>
    {#if dovrsena && misija.nagrada}
      Dodijeljeno {xpPrikaz}
    {:else}
      {xpPrikaz}
    {/if}
  </p>
</article>

<style>
  .kartica-misije {
    display: grid;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
    min-width: 0;
  }
  .kartica-misije.dovrsena {
    opacity: 0.92;
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
    text-decoration: none;
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
    color: var(--boja-isticanje-tekst);
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--boja-tekst);
  }
  .opis,
  .napredak-tekst,
  .status {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .status {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .traka {
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--boja-krem);
  }
  .traka span {
    display: block;
    height: 100%;
    background: var(--boja-isticanje-tekst);
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
  .xp {
    margin: 0;
    font-weight: 700;
    color: var(--boja-isticanje-tekst);
  }
</style>
