<script lang="ts">
  import type { DefinicijaDostignuca } from 'zajednicko';

  interface Dostignuce extends DefinicijaDostignuca {
    razina: number;
    vrijednost: number;
    sljedeciPrag: number | null;
    novo?: boolean;
  }

  let { dostignuce }: { dostignuce: Dostignuce } = $props();
  const postotak = $derived(
    dostignuce.sljedeciPrag === null
      ? 100
      : Math.min(100, dostignuce.vrijednost / dostignuce.sljedeciPrag * 100),
  );
  const oznaka = $derived(dostignuce.naziv.slice(0, 1));
</script>

<article class:otkljucano={dostignuce.razina > 0} class:novo={Boolean(dostignuce.novo)} class="dostignuce-kartica">
  <div class="medaljon" aria-hidden="true"><span>{oznaka}</span></div>
  <div class="sadrzaj">
    <header>
      <div>
        <h2>{dostignuce.naziv}</h2>
      </div>
      <div class="zaglavlje-desno">
        {#if dostignuce.novo}
          <span class="badge-novo">Novo</span>
        {/if}
        <strong class="razina">{dostignuce.razina} / {dostignuce.pragovi.length}</strong>
      </div>
    </header>
    <div class="zvjezdice" aria-label={`${dostignuce.razina} od ${dostignuce.pragovi.length} razina`}>
      {#each dostignuce.pragovi as _, indeks}
        <span class:ispunjena={indeks < dostignuce.razina}>★</span>
      {/each}
    </div>
    <p class="opis">{dostignuce.opis}</p>
    {#if dostignuce.sljedeciPrag === null}
      <p class="cilj">Maksimum dosegnut · {dostignuce.vrijednost}</p>
    {:else}
      <p class="cilj">Sljedeći cilj: {dostignuce.id === 'iskusnjara' ? `LVL ${dostignuce.sljedeciPrag}` : dostignuce.sljedeciPrag} <span>({dostignuce.id === 'iskusnjara' ? `LVL ${dostignuce.vrijednost} / LVL ${dostignuce.sljedeciPrag}` : `${dostignuce.vrijednost} / ${dostignuce.sljedeciPrag}`})</span></p>
      <div class="traka" aria-hidden="true"><span style={`width: ${postotak}%`}></span></div>
    {/if}
  </div>
</article>

<style>
  .dostignuce-kartica {
    display: flex;
    gap: 16px;
    min-width: 0;
    padding: 18px;
    border: 1px solid var(--boja-obrub, #e5ddc8);
    border-radius: 8px;
    background: var(--boja-pozadina-kartica, #fffdf5);
    box-shadow: var(--sjena-suptilna);
  }

  .medaljon {
    display: grid;
    width: 68px;
    height: 68px;
    flex: 0 0 68px;
    place-items: center;
    border: 4px solid #d9a441;
    border-radius: 50%;
    background: #f4d88e;
    color: #704d14;
    box-shadow: inset 0 0 0 4px #ffe9a9, 0 3px 0 #b98227;
    font-family: var(--font-naslov);
    font-size: 28px;
    font-weight: 700;
  }

  .sadrzaj { min-width: 0; flex: 1; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .zaglavlje-desno { display: flex; align-items: center; gap: 8px; }
  .badge-novo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 7px;
    border: 1px solid #f2b14a;
    border-radius: 999px;
    background: #fff1d8;
    color: #9b5700;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  h2 { margin: 0; font-family: var(--font-naslov); font-size: 1.25rem; }
  .razina { white-space: nowrap; color: var(--boja-mint); font-variant-numeric: tabular-nums; }
  .zvjezdice { display: flex; gap: 3px; margin: 10px 0 7px; color: #d7d1c0; font-size: 1.1rem; letter-spacing: 0; }
  .zvjezdice .ispunjena { color: #d9a441; }
  .opis, .cilj { margin: 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .cilj { margin-top: 10px; color: var(--boja-tekst-osnovni); font-weight: 700; }
  .cilj span { color: var(--boja-tekst-sekundarni); font-weight: 400; }
  .traka { height: 6px; margin-top: 7px; overflow: hidden; border-radius: 3px; background: #e5ddc8; }
  .traka span { display: block; height: 100%; background: var(--boja-mint); transition: width 300ms ease; }
  .dostignuce-kartica.novo {
    border-color: #f2b14a;
    background: linear-gradient(135deg, #fffaf1 0%, #fff3d9 100%);
  }
  .dostignuce-kartica:not(.otkljucano) .medaljon { filter: grayscale(0.8); opacity: 0.6; }

  @media (max-width: 420px) {
    .dostignuce-kartica { gap: 12px; padding: 14px; }
    .medaljon { width: 56px; height: 56px; flex-basis: 56px; font-size: 23px; }
  }

  @media (prefers-reduced-motion: reduce) { .traka span { transition: none; } }
</style>