<script lang="ts">
  import type { AgregatBotova } from '../tipovi.js';
  import { formatSekundi, nazivKonteksta, nazivModa, nazivPravila, postotak, wilsonTekst } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  let {
    botovi,
    ucitava,
    greska,
  }: {
    botovi: AgregatBotova | null;
    ucitava: boolean;
    greska: string | null;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if botovi}
  <section aria-labelledby="botovi-naslov">
    <h2 id="botovi-naslov">Botovi i balans</h2>
    <p class="meta">
      Zona: {botovi.vremenskaZona} · {botovi.od} – {botovi.do}
      · kohorta po početku igre
      {#if botovi.kontekst}
        · kontekst: {nazivKonteksta(botovi.kontekst)}
      {/if}
    </p>
    <p class="meta">{botovi.napomena}</p>
    <AnalitikaKpi>
      <div><dt>Završene vs botovi</dt><dd>{botovi.uspjesnost.ukupno.zavrseneProtivBotova}</dd></div>
      <div>
        <dt>Pobjede ljudi</dt>
        <dd>{botovi.uspjesnost.ukupno.pobjedeLjudi} ({postotak(botovi.uspjesnost.ukupno.udioPobjedaLjudi)})</dd>
      </div>
      <div>
        <dt>Pobjede botova</dt>
        <dd>{botovi.uspjesnost.ukupno.pobjedeBotova} ({postotak(botovi.uspjesnost.ukupno.udioPobjedaBotova)})</dd>
      </div>
      <div><dt>Wilson ljudi</dt><dd>{wilsonTekst(botovi.uspjesnost.ukupno.wilsonLjudi)}</dd></div>
      <div><dt>Pokrivenost sastava</dt><dd>{postotak(botovi.pokrivenost.sastav.postotak)}</dd></div>
      <div><dt>Pokrivenost profila</dt><dd>{postotak(botovi.pokrivenost.profil.postotak)}</dd></div>
    </AnalitikaKpi>
    {#if botovi.uspjesnost.ukupno.maliUzorak}
      <p class="meta"><strong>Mali uzorak</strong> (&lt;30 završenih s poznatim pobjednikom)</p>
    {/if}

    <h3>Uspješnost po profilu</h3>
    {#if botovi.uspjesnost.poProfilu.length === 0}
      <p>Nema završenih igara protiv botova u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Profil</th>
            <th>Završene</th>
            <th>Ljudi</th>
            <th>Botovi</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.uspjesnost.poProfilu as red (red.profil)}
            <tr>
              <td>{red.profil}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Uspješnost po formatu</h3>
    {#if botovi.uspjesnost.poFormatu.length === 0}
      <p>Nema završenih igara protiv botova po formatu.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Format</th>
            <th>Završene</th>
            <th>Ljudi</th>
            <th>Botovi</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.uspjesnost.poFormatu as red (red.mod)}
            <tr>
              <td>{nazivModa(red.mod)}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Uspješnost po pravilima</h3>
    {#if botovi.uspjesnost.poPravilima.length === 0}
      <p>Nema završenih igara protiv botova po pravilima.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Pravilnik</th>
            <th>Završene</th>
            <th>Ljudi</th>
            <th>Botovi</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.uspjesnost.poPravilima as red (red.pravila)}
            <tr>
              <td>{nazivPravila(red.pravila)}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Sastav javnih stolova</h3>
    {#if botovi.sastavJavnih.length === 0}
      <p>Nema javnih igara s poznatim sastavom.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Sastav</th>
            <th>Igre</th>
            <th>Udio</th>
            <th>Pobjede ljudi</th>
            <th>Pobjede botova</th>
            <th>Udio ljudi</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.sastavJavnih as red (red.sastav)}
            <tr>
              <td>{red.sastav}</td>
              <td>{red.brojIgara}</td>
              <td>{postotak(red.udio)}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Eliminacije</h3>
    <table>
      <thead>
        <tr>
          <th>Razlog</th>
          <th>Ljudi</th>
          <th>Udio ljudi</th>
          <th>Botovi</th>
          <th>Udio botova</th>
        </tr>
      </thead>
      <tbody>
        {#each botovi.eliminacije.ljudi as red, indeks (red.razlog)}
          <tr>
            <td>{red.razlog}</td>
            <td>{red.broj}</td>
            <td>{postotak(red.postotak)}</td>
            <td>{botovi.eliminacije.botovi[indeks]?.broj ?? 0}</td>
            <td>{postotak(botovi.eliminacije.botovi[indeks]?.postotak ?? null)}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Trajanje po profilu</h3>
    {#if botovi.trajanje.poProfilu.length === 0}
      <p>Nema uzorka trajanja.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Profil</th>
            <th>Prosjek</th>
            <th>Medijan</th>
            <th>P90</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.trajanje.poProfilu as red (red.profil)}
            <tr>
              <td>{red.profil}</td>
              <td>{formatSekundi(red.prosjekSekundi)}</td>
              <td>{formatSekundi(red.medijanSekundi)}</td>
              <td>{formatSekundi(red.p90Sekundi)}</td>
              <td>{red.uzorak}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Trajanje po formatu</h3>
    {#if botovi.trajanje.poFormatu.length === 0}
      <p>Nema uzorka trajanja po formatu.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Format</th>
            <th>Prosjek</th>
            <th>Medijan</th>
            <th>P90</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.trajanje.poFormatu as red (red.mod)}
            <tr>
              <td>{nazivModa(red.mod)}</td>
              <td>{formatSekundi(red.prosjekSekundi)}</td>
              <td>{formatSekundi(red.medijanSekundi)}</td>
              <td>{formatSekundi(red.p90Sekundi)}</td>
              <td>{red.uzorak}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Trajanje po pravilima</h3>
    {#if botovi.trajanje.poPravilima.length === 0}
      <p>Nema uzorka trajanja po pravilima.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Pravilnik</th>
            <th>Prosjek</th>
            <th>Medijan</th>
            <th>P90</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.trajanje.poPravilima as red (red.pravila)}
            <tr>
              <td>{nazivPravila(red.pravila)}</td>
              <td>{formatSekundi(red.prosjekSekundi)}</td>
              <td>{formatSekundi(red.medijanSekundi)}</td>
              <td>{formatSekundi(red.p90Sekundi)}</td>
              <td>{red.uzorak}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Verzije i pokrivenost</h3>
    <p class="meta">
      Pokrivenost: sastav {postotak(botovi.pokrivenost.sastav.postotak)},
      profil {postotak(botovi.pokrivenost.profil.postotak)},
      pobjednik {postotak(botovi.pokrivenost.pobjednik.postotak)},
      eliminacije {postotak(botovi.pokrivenost.eliminacije.postotak)}
      od {botovi.pokrivenost.zapocete} započetih.
    </p>
    {#if botovi.uspjesnost.poVerziji.length > 0}
      <table>
        <thead>
          <tr>
            <th>Verzija (politika/profil)</th>
            <th>Završene</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botovi.uspjesnost.poVerziji as red (red.verzija)}
            <tr>
              <td>{red.verzija}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}