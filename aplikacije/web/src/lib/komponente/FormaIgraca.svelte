<script lang="ts">
  import type { FormaIgraca as FormaPodaci, RazinaVatre } from 'zajednicko';

  interface Props {
    forma: FormaPodaci & { trenutniNiz: number; najboljiNiz: number; razinaVatre: RazinaVatre; sljedeciBonusPostotak: number };
    mod: 'cetiri_igraca' | 'dva_igraca';
  }

  let { forma, mod }: Props = $props();

  function formatirajDatum(datum: string): string {
    return new Date(datum).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  function opisRezultata(plasman: number, bodovi: number, eliminacije: number): string {
    if (mod === 'dva_igraca') return plasman === 1 ? 'Pobjeda' : 'Poraz';
    return `${plasman}. mjesto · ${bodovi} bodova · ${eliminacije} elim.`;
  }
</script>

<section class="forma-igraca" aria-labelledby="forma-naslov">
  <div class="forma-zaglavlje">
    <div>
      <h3 id="forma-naslov">Forma igrača</h3>
      {#if forma.naziv}
        <strong>{forma.naziv}</strong>
      {:else if forma.status === 'nema_podataka'}
        <span>Forma se još zagrijava.</span>
      {:else if forma.status === 'prikupljanje'}
        <span>Još {5 - forma.brojPartija} {5 - forma.brojPartija === 1 ? 'igra' : 'igara'} do prve procjene.</span>
      {:else}
        <span>Početna procjena · {forma.brojPartija} igara</span>
      {/if}
    </div>
    {#if forma.naziv}
      <span class="forma-uzorak">{forma.brojPobjeda} pobjeda / {forma.brojPartija} igara</span>
    {/if}
  </div>

  {#if forma.trend}
    <p class="forma-trend" class:gore={forma.trend.smjer === 'gore'} class:dolje={forma.trend.smjer === 'dolje'}>
      {forma.trend.smjer === 'gore' ? '↑' : forma.trend.smjer === 'dolje' ? '↓' : '→'}
      {forma.trend.smjer === 'isto' ? 'Jednako kao u prethodnih 10.' : forma.trend.smjer === 'gore' ? 'Bolje nego u prethodnih 10.' : 'Slabije nego u prethodnih 10.'}
    </p>
  {/if}

  <div class="forma-statistike">
    <span>Niz pobjeda: <strong>{forma.trenutniNiz}</strong></span>
    <span>Najbolji niz: <strong>{forma.najboljiNiz}</strong></span>
    {#if forma.trenutniNiz > 0}
      <span>Sljedeća pobjeda: <strong>+{forma.sljedeciBonusPostotak}% XP</strong></span>
    {/if}
  </div>

  {#if forma.rezultati.length > 0}
    <div class="mini-povijest" aria-label="Nedavni rezultati">
      <strong>Zadnjih {forma.rezultati.length} igara</strong>
      <div class="rezultati">
        {#each [...forma.rezultati].reverse() as rezultat}
          <span
            class:pobjeda={rezultat.plasman === 1}
            class:poraz={rezultat.plasman !== 1}
            title={`${opisRezultata(rezultat.plasman, rezultat.bodovi, rezultat.eliminacije)} · ${formatirajDatum(rezultat.kraj)}`}
            aria-label={`${opisRezultata(rezultat.plasman, rezultat.bodovi, rezultat.eliminacije)} · ${formatirajDatum(rezultat.kraj)}`}
          >{mod === 'dva_igraca' ? (rezultat.plasman === 1 ? '✓' : '×') : rezultat.plasman}</span>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .forma-igraca { display: grid; gap: 12px; margin-top: 18px; padding: 16px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fffdf5; }
  .forma-zaglavlje { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h3 { margin: 0 0 4px; }
  .forma-zaglavlje strong { color: var(--boja-pozadina-primarna); font-family: var(--font-naslov); font-size: 1.35rem; }
  .forma-uzorak { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .forma-trend { margin: 0; color: var(--boja-tekst-sekundarni); }
  .forma-trend.gore { color: var(--boja-mint-tamni); }
  .forma-trend.dolje { color: var(--boja-akcent); }
  .forma-statistike { display: flex; flex-wrap: wrap; gap: 12px 18px; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .forma-statistike strong { color: var(--boja-tekst-naslov); }
  .mini-povijest { display: grid; gap: 8px; }
  .rezultati { display: flex; flex-wrap: wrap; gap: 6px; }
  .rezultati span { display: grid; width: 28px; height: 28px; place-items: center; border: 2px solid transparent; border-radius: 50%; font-weight: 800; }
  .rezultati .pobjeda { background: #dcefe2; color: #176342; }
  .rezultati .poraz { background: #f8dfd8; color: #a33d32; }
  @media (max-width: 520px) { .forma-zaglavlje { flex-direction: column; } }
</style>
