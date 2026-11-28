<script lang="ts">
  import type { AgregatIgraca, Dnevno } from '../tipovi.js';
  import { postotak, retencijaTekst } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  let {
    igraci,
    dnevno,
    ucitava,
    greska,
  }: {
    igraci: AgregatIgraca | null;
    dnevno: Dnevno | null;
    ucitava: boolean;
    greska: string | null;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else}
  {#if igraci}
    <section aria-labelledby="igraci-naslov">
      <h2 id="igraci-naslov">Igrači i rast</h2>
      <p class="meta">
        Zona: {igraci.vremenskaZona} · {igraci.od} – {igraci.do}
        · referentni dan {igraci.referentniDan}
        · mjerenje od {igraci.mjerenjeOd ?? '—'}
        {#if igraci.kontekst}
          · kontekst: {igraci.kontekst} (aktivnost filtrirana; registracije uvijek globalne)
        {/if}
      </p>
      {#if igraci.referentniDanNezavrsen}
        <p class="meta" role="status">Referentni dan još nije završen — DAU/WAU/MAU su djelomični.</p>
      {/if}
      <p class="meta">{igraci.napomena}</p>
      <AnalitikaKpi>
        <div><dt>DAU</dt><dd>{igraci.kpi.dau}</dd></div>
        <div><dt>WAU</dt><dd>{igraci.kpi.wau}</dd></div>
        <div><dt>MAU</dt><dd>{igraci.kpi.mau}</dd></div>
        <div><dt>DAU/MAU</dt><dd>{postotak(igraci.kpi.dauMau)}</dd></div>
        <div><dt>Registracije (raspon)</dt><dd>{igraci.kpi.registracijeRaspon}</dd></div>
        <div>
          <dt>Konverzija 30d</dt>
          <dd>
            {#if igraci.kpi.konverzija30d.postotak === null && igraci.kpi.konverzija30d.gosti === 0}
              Još nema dovoljno podataka
            {:else}
              {igraci.kpi.konverzija30d.konvertirani} / {igraci.kpi.konverzija30d.gosti}
              ({postotak(igraci.kpi.konverzija30d.postotak)})
            {/if}
          </dd>
        </div>
        <div>
          <dt>D1 retencija</dt>
          <dd>{retencijaTekst(igraci.retencijaUkupno.d1.postotak, igraci.retencijaUkupno.d1.povratnici, igraci.retencijaUkupno.d1.kohorta)}</dd>
        </div>
        <div>
          <dt>D7 retencija</dt>
          <dd>{retencijaTekst(igraci.retencijaUkupno.d7.postotak, igraci.retencijaUkupno.d7.povratnici, igraci.retencijaUkupno.d7.kohorta)}</dd>
        </div>
        <div>
          <dt>D30 retencija</dt>
          <dd>{retencijaTekst(igraci.retencijaUkupno.d30.postotak, igraci.retencijaUkupno.d30.povratnici, igraci.retencijaUkupno.d30.kohorta)}</dd>
        </div>
      </AnalitikaKpi>
      {#if igraci.kpi.konverzijaDosadNezrele.gosti > 0}
        <p class="meta">
          Konverzija dosad (nezrele kohorte):
          {igraci.kpi.konverzijaDosadNezrele.konvertirani} / {igraci.kpi.konverzijaDosadNezrele.gosti}
          ({postotak(igraci.kpi.konverzijaDosadNezrele.postotak)})
        </p>
      {/if}
      <table>
        <thead>
          <tr><th>Dan</th><th>DAU</th><th>Novi</th><th>Povratni</th><th>Registracije</th></tr>
        </thead>
        <tbody>
          {#each igraci.dani as red (red.dan)}
            <tr>
              <td>{red.dan}</td>
              <td>{red.dau}</td>
              <td>{red.novi}</td>
              <td>{red.povratni}</td>
              <td>{red.registracije}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}

  {#if dnevno}
    <section aria-labelledby="dnevno-naslov">
      <h2 id="dnevno-naslov">Dnevno igranje</h2>
      <AnalitikaKpi>
        <div><dt>Gost sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakGost)}</dd></div>
        <div><dt>Registrirani sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakRegistriran)}</dd></div>
        {#each dnevno.ljudi.ponavljanja as p (p.prag)}
          <div><dt>Igrači s {p.prag}+ igrama</dt><dd>{p.broj} / {dnevno.ljudi.igraci} ({postotak(p.postotak)})</dd></div>
        {/each}
      </AnalitikaKpi>
      <table>
        <thead>
          <tr><th>Dan</th><th>Započete</th><th>Završene</th></tr>
        </thead>
        <tbody>
          {#each dnevno.dani as red (red.dan)}
            <tr>
              <td>{red.dan}</td>
              <td>{red.zapocete}</td>
              <td>{red.zavrsene}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
{/if}