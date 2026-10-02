<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import Podizbornik from './Podizbornik.svelte';

  interface StavkaAktivnosti {
    partijaId: string;
    mod: 'cetiri_igraca' | 'dva_igraca';
    pocetak: string;
    kraj: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
  }

  interface Props {
    igracId: string;
  }

  let { igracId }: Props = $props();
  let mod = $state<'cetiri_igraca' | 'dva_igraca'>('dva_igraca');
  let stavke = $state<StavkaAktivnosti[]>([]);
  let cursor = $state<string | null>(null);
  let prethodniCursori = $state<string[]>([]);
  let imaJos = $state(false);
  let ucitavanje = $state(true);
  let greska = $state<string | null>(null);

  async function ucitaj(noviMod = mod, noviCursor: string | null = null) {
    ucitavanje = true;
    greska = null;
    try {
      const parametri = new URLSearchParams({ mod: noviMod, limit: '20' });
      if (noviCursor) parametri.set('cursor', noviCursor);
      const odgovor = await api<{ aktivnost: StavkaAktivnosti[]; imaJos: boolean; sljedeciCursor: string | null }>(
        `/aktivnost/${igracId}?${parametri.toString()}`,
      );
      mod = noviMod;
      stavke = odgovor.aktivnost;
      imaJos = odgovor.imaJos;
      cursor = odgovor.sljedeciCursor;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Aktivnost nije moguće učitati.';
    } finally {
      ucitavanje = false;
    }
  }

  function promijeniMod(noviMod: 'cetiri_igraca' | 'dva_igraca') {
    prethodniCursori = [];
    cursor = null;
    void ucitaj(noviMod);
  }

  function sljedecaStranica() {
    if (!cursor || ucitavanje) return;
    prethodniCursori = [...prethodniCursori, cursor];
    void ucitaj(mod, cursor);
  }

  function prethodnaStranica() {
    const prethodni = prethodniCursori.at(-2) ?? null;
    prethodniCursori = prethodniCursori.slice(0, -1);
    void ucitaj(mod, prethodni);
  }

  function formatirajDatum(datum: string): string {
    return new Date(datum).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  onMount(() => {
    void ucitaj();
  });
</script>

<section class="aktivnost-sekcija" aria-label="Aktivnost">
  <Podizbornik
    stavke={[{ kljuc: 'dva_igraca', naziv: 'Dvoboj' }, { kljuc: 'cetiri_igraca', naziv: 'Četveroboj' }]}
    aktivna={mod}
    ariaLabel="Način igre"
    promijeni={(kljuc) => promijeniMod(kljuc as 'cetiri_igraca' | 'dva_igraca')}
  />
  <div class="aktivnost-zaglavlje">
    <div>
      <p class="aktivnost-opis">Prikazane su samo javne igre. Privatne igre se ne računaju.</p>
    </div>
  </div>

  {#if greska}
    <p class="aktivnost-greska" role="alert">{greska}</p>
  {:else if stavke.length === 0 && ucitavanje}
    <div class="aktivnost-kostur" role="status" aria-label="Učitavanje aktivnosti" aria-busy="true">
      <div class="aktivnost-kostur-redak"></div>
      <div class="aktivnost-kostur-redak"></div>
      <div class="aktivnost-kostur-redak"></div>
      <div class="aktivnost-kostur-redak"></div>
      <div class="aktivnost-kostur-redak"></div>
    </div>
  {:else if stavke.length === 0 && !ucitavanje}
    <p class="aktivnost-prazno">Još nema javnih igara u ovom načinu igre.</p>
  {:else}
    <div class="aktivnost-tablica-omotac">
      <table class="aktivnost-tablica tablica-mobilni-retci">
        <thead><tr><th scope="col">Datum</th><th scope="col">Mod</th><th scope="col">Plasman</th><th scope="col">Bodovi</th><th scope="col">Povijest</th></tr></thead>
        <tbody>
          {#each stavke as stavka (stavka.partijaId)}
            <tr>
              <th scope="row">{formatirajDatum(stavka.kraj)}</th>
              <td data-label="Mod">{stavka.mod === 'dva_igraca' ? 'Dvoboj' : 'Četveroboj'}</td>
              <td data-label="Plasman">{stavka.plasman}. mjesto</td>
              <td data-label="Bodovi">{stavka.bodovi}</td>
              <td data-label="Povijest"><a href={`/partija/arhiva/${stavka.partijaId}`}>Vidi igru</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <nav class="aktivnost-paginacija" aria-label="Paginacija aktivnosti">
      <button type="button" onclick={prethodnaStranica} disabled={prethodniCursori.length === 0 || ucitavanje}>Prethodna</button>
      <span>Stranica {prethodniCursori.length + 1}</span>
      <button type="button" onclick={sljedecaStranica} disabled={!imaJos || ucitavanje}>Sljedeća</button>
    </nav>
  {/if}
</section>

<style>
  .aktivnost-zaglavlje { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; }
  .aktivnost-opis { margin: 6px 0 0; color: var(--boja-tekst-sekundarni); }
  .aktivnost-sekcija > :global(.podizbornik) { margin-bottom: 18px; }
  .aktivnost-kostur { display: grid; gap: 8px; min-height: 250px; margin-top: 16px; }
  .aktivnost-kostur-redak { min-height: 40px; border-bottom: 1px solid var(--boja-obrub); border-radius: 4px; background: var(--boja-povrsina-2); }
  .aktivnost-tablica-omotac { margin-top: 16px; }
  .aktivnost-tablica { width: 100%; border-collapse: collapse; }
  .aktivnost-tablica th, .aktivnost-tablica td { padding: 11px 10px; border-bottom: 1px solid var(--boja-obrub); text-align: left; }
  .aktivnost-tablica th { color: var(--boja-tekst-sekundarni); font-size: 0.86rem; }
  .aktivnost-tablica a { color: var(--boja-tekst-naslov); font-weight: 700; }
  @media (max-width: 999px) {
    .aktivnost-tablica tbody th, .aktivnost-tablica tbody td { padding: 5px 0; }
    .aktivnost-tablica tbody th { color: var(--boja-tekst-osnovni); font-size: var(--tekst-baza); }
  }
  .aktivnost-paginacija { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
  .aktivnost-paginacija button { border-color: var(--boja-obrub-jaci); background: var(--boja-povrsina); color: var(--boja-tekst-osnovni); }
  .aktivnost-paginacija button:disabled { cursor: not-allowed; opacity: 0.45; }
  .aktivnost-greska { color: var(--boja-poraz-tekst); }
  .aktivnost-prazno { color: #5d625f; }
</style>
