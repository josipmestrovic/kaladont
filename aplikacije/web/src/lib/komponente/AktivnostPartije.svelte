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
  let ucitavanje = $state(false);
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

<section class="aktivnost-sekcija" aria-labelledby="aktivnost-naslov">
  <Podizbornik
    stavke={[{ kljuc: 'dva_igraca', naziv: '2 igrača' }, { kljuc: 'cetiri_igraca', naziv: '4 igrača' }]}
    aktivna={mod}
    ariaLabel="Način igre"
    promijeni={(kljuc) => promijeniMod(kljuc as 'cetiri_igraca' | 'dva_igraca')}
  />
  <div class="aktivnost-zaglavlje">
    <div>
      <h2 id="aktivnost-naslov">Aktivnost</h2>
      <p class="aktivnost-opis">Prikazane su samo javne partije. Privatne partije se ne računaju.</p>
    </div>
  </div>

  {#if greska}
    <p class="aktivnost-greska" role="alert">{greska}</p>
  {:else if stavke.length === 0 && !ucitavanje}
    <p class="aktivnost-prazno">Još nema javnih partija u ovom načinu igre.</p>
  {:else}
    <div class="aktivnost-tablica-omotac">
      <table class="aktivnost-tablica">
        <thead><tr><th>Datum</th><th>Mod</th><th>Plasman</th><th>Bodovi</th><th></th></tr></thead>
        <tbody>
          {#each stavke as stavka (stavka.partijaId)}
            <tr>
              <td>{formatirajDatum(stavka.kraj)}</td>
              <td>{stavka.mod === 'dva_igraca' ? '2 igrača' : '4 igrača'}</td>
              <td>{stavka.plasman}. mjesto</td>
              <td>{stavka.bodovi}</td>
              <td><a href={`/partija/arhiva/${stavka.partijaId}`}>Vidi igru</a></td>
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
  .aktivnost-sekcija { margin-top: 24px; }
  .aktivnost-zaglavlje { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; }
  .aktivnost-zaglavlje h2 { margin: 0; }
  .aktivnost-opis { margin: 6px 0 0; color: #5d625f; }
  .aktivnost-sekcija > :global(.podizbornik) { margin-bottom: 18px; }
  .aktivnost-tablica-omotac { overflow-x: auto; margin-top: 16px; }
  .aktivnost-tablica { width: 100%; border-collapse: collapse; }
  .aktivnost-tablica th, .aktivnost-tablica td { padding: 11px 10px; border-bottom: 1px solid #e3e3dc; text-align: left; white-space: nowrap; }
  .aktivnost-tablica th { color: #5d625f; font-size: 0.86rem; }
  .aktivnost-tablica a { color: #1c5c4a; font-weight: 700; }
  .aktivnost-paginacija { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
  .aktivnost-paginacija button { border-color: #d8d8d2; background: #fff; }
  .aktivnost-paginacija button:disabled { cursor: not-allowed; opacity: 0.45; }
  .aktivnost-greska { color: #a33d32; }
  .aktivnost-prazno { color: #5d625f; }
</style>
