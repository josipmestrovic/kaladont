<script lang="ts">
  import type { AgregatIzazova } from '../tipovi.js';
  import { formatMs, postotak, wilsonTekst } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  let {
    izazovi,
    ucitava,
    greska,
    onPreuzmiCsv,
  }: {
    izazovi: AgregatIzazova | null;
    ucitava: boolean;
    greska: string | null;
    onPreuzmiCsv: () => void;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if izazovi}
  <section aria-labelledby="izazovi-naslov">
    <h2 id="izazovi-naslov">Izazovi</h2>
    <p class="meta">
      Zona: {izazovi.vremenskaZona} · {izazovi.od} – {izazovi.do}
      · kohorta po startedAt · verzije odvojene
      {#if izazovi.ukupno.maliUzorak}
        · <strong>mali uzorak</strong> (&lt;30 unique igrača)
      {/if}
    </p>
    <AnalitikaKpi>
      <div><dt>Pokrenuti</dt><dd>{izazovi.ukupno.started}</dd></div>
      <div><dt>Aktivni</dt><dd>{izazovi.ukupno.aktivni}</dd></div>
      <div><dt>Tehnički</dt><dd>{izazovi.ukupno.tehnicki}</dd></div>
      <div><dt>Uspjesi / neuspjesi</dt><dd>{izazovi.ukupno.uspjesi} / {izazovi.ukupno.neuspjesi}</dd></div>
      <div>
        <dt>Unique uspjeh</dt>
        <dd>
          {izazovi.ukupno.uniqueSuccess} / {izazovi.ukupno.uniqueStarted}
          ({postotak(izazovi.ukupno.uniqueSuccessRate)})
        </dd>
      </div>
      <div><dt>Wilson 95%</dt><dd>{wilsonTekst(izazovi.ukupno.uniqueSuccessWilson)}</dd></div>
    </AnalitikaKpi>
    <p class="meta">
      <button type="button" onclick={() => onPreuzmiCsv()}>Preuzmi CSV</button>
      (bez osobnih podataka)
    </p>
    {#if izazovi.redovi.length === 0}
      <p>Nema pokušaja Izazova u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Izazov</th>
            <th>Verzija</th>
            <th>Timer</th>
            <th>Started</th>
            <th>Uspjeh pokušaja</th>
            <th>gameWon</th>
            <th>Unique</th>
            <th>First-try</th>
            <th>Do 1. uspjeha</th>
            <th>Trajanje med/p90</th>
            <th>Razlozi</th>
          </tr>
        </thead>
        <tbody>
          {#each izazovi.redovi as red (`${red.challengeId}-${red.definitionVersion}-${red.botProfileVersion}-${red.turnDurationMs}`)}
            <tr>
              <td>
                {red.challengeId}
                {#if red.maliUzorak}<span class="meta"> · mali</span>{/if}
              </td>
              <td>d{red.definitionVersion}{#if red.botProfileVersion != null}/b{red.botProfileVersion}{/if}</td>
              <td>{red.turnDurationMs != null ? `${red.turnDurationMs / 1000}s` : '—'}</td>
              <td>{red.started} <span class="meta">(akt {red.aktivni}, teh {red.tehnicki})</span></td>
              <td>
                {red.attemptSuccessBrojnik}/{red.attemptSuccessNazivnik}
                ({postotak(red.attemptSuccessRate)})
              </td>
              <td>{red.gameWon}/{red.igrackiZavrseni} ({postotak(red.gameWonRate)})</td>
              <td>
                {red.uniqueSuccess}/{red.uniqueStarted} ({postotak(red.uniqueSuccessRate)})
                <span class="meta">W {wilsonTekst(red.uniqueSuccessWilson)}</span>
              </td>
              <td>{red.firstTrySuccess}/{red.firstTryPlayers} ({postotak(red.firstTryRate)})</td>
              <td>{red.attemptsToFirstSuccessMedian ?? '—'}</td>
              <td>{formatMs(red.trajanjeMedianMs)} / {formatMs(red.trajanjeP90Ms)}</td>
              <td class="meta">
                {#each Object.entries(red.reasons) as [razlog, broj]}
                  {razlog}:{broj}
                  {' '}
                {:else}
                  —
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}