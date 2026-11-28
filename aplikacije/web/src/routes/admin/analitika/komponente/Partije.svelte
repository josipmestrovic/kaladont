<script lang="ts">
  import type { AgregatPartija } from '../tipovi.js';
  import { formatSekundi, nazivKonteksta, nazivModa, nazivPravila, postotak } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  let {
    partije,
    ucitava,
    greska,
  }: {
    partije: AgregatPartija | null;
    ucitava: boolean;
    greska: string | null;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if partije}
  <section aria-labelledby="partije-naslov">
    <h2 id="partije-naslov">Partije i načini igranja</h2>
    <p class="meta">
      Zona: {partije.vremenskaZona} · {partije.od} – {partije.do}
      · kohorta po početku igre
      {#if partije.kontekst}
        · kontekst: {nazivKonteksta(partije.kontekst)}
      {/if}
    </p>
    <p class="meta">{partije.napomena}</p>
    <AnalitikaKpi>
      <div><dt>Započete</dt><dd>{partije.sazetak.zapocete}</dd></div>
      <div><dt>Završene</dt><dd>{partije.sazetak.zavrsene}</dd></div>
      <div><dt>Stopa završavanja</dt><dd>{postotak(partije.sazetak.stopaZavrsavanja)}</dd></div>
      <div><dt>Prosječno trajanje</dt><dd>{formatSekundi(partije.sazetak.trajanje.prosjekSekundi)}</dd></div>
      <div><dt>Jedinstveni igrači</dt><dd>{partije.sazetak.jedinstveniIgraci}</dd></div>
      <div><dt>Pokrivenost pravila</dt><dd>{postotak(partije.sazetak.pokrivenostPravila)}</dd></div>
    </AnalitikaKpi>
    <h3>Načini igranja</h3>
    <table>
      <thead>
        <tr>
          <th>Način</th>
          <th>Započete</th>
          <th>Završene</th>
          <th>Prekinute</th>
          <th>Bez ishoda</th>
          <th>Udio</th>
          <th>Stopa</th>
          <th>Igrači</th>
          <th>Prosjek / medijan / P90</th>
        </tr>
      </thead>
      <tbody>
        {#each partije.nacini as red (red.kontekst)}
          <tr>
            <td>{nazivKonteksta(red.kontekst)}</td>
            <td>{red.zapocete}</td>
            <td>{red.zavrsene}</td>
            <td>{red.prekinute}</td>
            <td>{red.bezIshoda}</td>
            <td>{postotak(red.udioZapocetih)}</td>
            <td>{postotak(red.stopaZavrsavanja)}</td>
            <td>{red.jedinstveniIgraci}</td>
            <td>
              {formatSekundi(red.trajanje.prosjekSekundi)}
              / {formatSekundi(red.trajanje.medijanSekundi)}
              / {formatSekundi(red.trajanje.p90Sekundi)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <h3>Formati</h3>
    {#if partije.formati.length === 0}
      <p>Nema zapisa formata u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Kontekst</th>
            <th>Format</th>
            <th>Započete</th>
            <th>Završene</th>
            <th>Udio</th>
            <th>Stopa</th>
            <th>Prosjek / medijan / P90</th>
          </tr>
        </thead>
        <tbody>
          {#each partije.formati as red (`${red.kontekst}-${red.mod}`)}
            <tr>
              <td>{red.kontekst ? nazivKonteksta(red.kontekst) : '—'}</td>
              <td>{nazivModa(red.mod)}</td>
              <td>{red.zapocete}</td>
              <td>{red.zavrsene}</td>
              <td>{postotak(red.udioZapocetih)}</td>
              <td>{postotak(red.stopaZavrsavanja)}</td>
              <td>
                {formatSekundi(red.trajanje.prosjekSekundi)}
                / {formatSekundi(red.trajanje.medijanSekundi)}
                / {formatSekundi(red.trajanje.p90Sekundi)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <h3>Pravila</h3>
    <table>
      <thead>
        <tr>
          <th>Pravilnik</th>
          <th>Započete</th>
          <th>Završene</th>
          <th>Udio</th>
          <th>Stopa</th>
          <th>Prosjek / medijan / P90</th>
        </tr>
      </thead>
      <tbody>
        {#each partije.pravila as red (red.pravila)}
          <tr>
            <td>{nazivPravila(red.pravila)}</td>
            <td>{red.zapocete}</td>
            <td>{red.zavrsene}</td>
            <td>{postotak(red.udioZapocetih)}</td>
            <td>{postotak(red.stopaZavrsavanja)}</td>
            <td>
              {formatSekundi(red.trajanje.prosjekSekundi)}
              / {formatSekundi(red.trajanje.medijanSekundi)}
              / {formatSekundi(red.trajanje.p90Sekundi)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="meta">
      Ishodi ukupno: završene {partije.sazetak.zavrsene},
      prekinute {partije.sazetak.prekinute},
      nepotpuno {partije.sazetak.nepotpuno},
      bez ishoda {partije.sazetak.bezIshoda}
      · pokrivenost terminalnih {postotak(partije.sazetak.pokrivenostTerminalnih)}
      · trajanje uzorak {partije.sazetak.trajanje.uzorak}
      (medijan {formatSekundi(partije.sazetak.trajanje.medijanSekundi)},
      P90 {formatSekundi(partije.sazetak.trajanje.p90Sekundi)})
    </p>
  </section>
{/if}