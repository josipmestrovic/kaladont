<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  interface Prijava {
    id: number;
    partijaId: string;
    potezId: number | null;
    poruka: string;
    status: 'nova' | 'pregledana' | 'rijesena';
    vrijeme: string;
  }

  interface PrijavaIgraca {
    id: number;
    partijaId: string;
    prijaviteljId: string;
    prijavljeniIgracId: string;
    razlog: string;
    poruka: string;
    status: 'nova' | 'pregledana' | 'rijesena';
    vrijeme: string;
  }

  interface IzmjenaRjecnika {
    id: number;
    rijec: string;
    akcija: string;
    razlog: string;
    adminId: string | null;
    vrijeme: string;
  }

  interface DetaljiRijeci {
    ok: boolean;
    rijec: {
      rijec: string;
      prvaDva: string;
      zadnjaDva: string;
      aktivna: boolean;
    } | null;
    nastavci: Array<any>;
    prethodnici: Array<any>;
    izmjene: IzmjenaRjecnika[];
  }

  let prijave = $state<Prijava[]>([]);
  let prijaveIgraca = $state<PrijavaIgraca[]>([]);
  let rucnoDodane = $state<IzmjenaRjecnika[]>([]);
  let greska = $state<string | null>(null);
  let novaRijec = $state('');
  let razlogRijeci = $state('');
  let porukaRjecnik = $state<string | null>(null);
  let testRijec = $state('');
  let detaljiRijeci = $state<DetaljiRijeci | null>(null);
  let testiranjeGreska = $state<string | null>(null);
  let odabranaPartija = $state<string | null>(null);
  let odabraniPotezi = $state<any[]>([]);

  interface StatistikaCekanja {
    dani: number;
    poDanu: {
      dan: string; mod: 'cetiri_igraca' | 'dva_igraca'; partije: number;
      prosjekCekanjaMs: number | null; medijanCekanjaMs: number | null; p95CekanjaMs: number | null;
      partijeBezBotova: number; partijeSJednimBotom: number; partijeSDvaBota: number; partijeSTriBota: number;
    }[];
    pobjedePoSastavu: { mod: 'cetiri_igraca' | 'dva_igraca'; brojBotova: number; partije: number; pobjedeLjudi: number; udioPobjedaLjudi: number | null }[];
    eliminacijeBotova: { nacinIspadanja: string; broj: number }[];
    zivo: {
      fond: { ukupno: number; slobodni: number; rezervirani: number; uPartiji: number; iscrpljenja: number };
      bot: { planirano: number; odigranihRijeci: number; namjernihPropusta: number; bezRijeci: number; zastarjelo: number; tehnickeGreske: number };
      trening: { aktivni: number; zapoceti: number; odbijeni: number; neuspjeli: number };
      zastavice: { trening: boolean; botoviDvoboj: boolean; botoviCetveroboj: boolean };
    } | null;
  }

  let statistika = $state<StatistikaCekanja | null>(null);
  let daniStatistike = $state(7);
  let greskaStatistike = $state<string | null>(null);
  const nazivModa = (mod: 'cetiri_igraca' | 'dva_igraca') => (mod === 'dva_igraca' ? 'Dvoboj' : 'Četveroboj');
  const sekunde = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);

  async function ucitajStatistiku() {
    greskaStatistike = null;
    try {
      statistika = await api<StatistikaCekanja>(`/admin/statistike/cekanje?dani=${daniStatistike}`);
    } catch (e) {
      greskaStatistike = e instanceof Error ? e.message : 'Statistika nije dostupna.';
    }
  }

  async function ucitaj() {
    try {
      const odgovori = await Promise.all([
        api<{ prijave: Prijava[] }>('/admin/prijave'),
        api<{ prijave: PrijavaIgraca[] }>('/admin/prijave-igraca'),
        api<{ izmjene: IzmjenaRjecnika[] }>('/admin/rjecnik/rucno-dodano'),
      ]);
      prijave = odgovori[0].prijave;
      prijaveIgraca = odgovori[1].prijave;
      rucnoDodane = odgovori[2].izmjene;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Nemaš pristup admin stranici.';
    }
  }

  onMount(() => {
    void ucitaj();
    void ucitajStatistiku();

    // Admin sucelje ima vlastitu paletu i uvijek se prikazuje u svijetloj temi.
    const prethodnaTema = document.documentElement.getAttribute('data-tema');
    document.documentElement.setAttribute('data-tema', 'svijetla');
    return () => {
      if (prethodnaTema) document.documentElement.setAttribute('data-tema', prethodnaTema);
      else document.documentElement.removeAttribute('data-tema');
    };
  });

  async function rijesi(id: number, status: 'pregledana' | 'rijesena') {
    await api(`/admin/prijave/${id}/rijesi`, { method: 'POST', body: JSON.stringify({ status }) });
    await ucitaj();
  }

  async function rijesiIgraca(id: number, status: 'pregledana' | 'rijesena') {
    await api(`/admin/prijave-igraca/${id}/rijesi`, { method: 'POST', body: JSON.stringify({ status }) });
    await ucitaj();
  }

  async function dodajRijec(e: SubmitEvent) {
    e.preventDefault();
    porukaRjecnik = null;
    try {
      await api('/admin/rjecnik/dodaj', {
        method: 'POST',
        body: JSON.stringify({ rijec: novaRijec, razlog: razlogRijeci }),
      });
      porukaRjecnik = `Riječ "${novaRijec}" dodana.`;
      novaRijec = '';
      razlogRijeci = '';
    } catch (e) {
      porukaRjecnik = e instanceof Error ? e.message : 'Neuspjelo dodavanje riječi.';
    }
  }

  async function testRijeci_f() {
    if (!testRijec.trim()) return;
    testiranjeGreska = null;
    try {
      detaljiRijeci = await api<DetaljiRijeci>(`/admin/rjecnik/rijec/${encodeURIComponent(testRijec.toLowerCase())}`);
    } catch (e) {
      testiranjeGreska = e instanceof Error ? e.message : 'Greška pri testiranju riječi.';
      detaljiRijeci = null;
    }
  }

  async function otvoriPartiju(partijaId: string) {
    odabranaPartija = partijaId;
    const odgovor = await api<{ potezi: any[] }>(`/partije/${partijaId}/potezi`);
    odabraniPotezi = odgovor.potezi;
  }
</script>

<svelte:head>
  <title>Administracija | Kaladont</title>
</svelte:head>

<h1>Admin</h1>

{#if greska}
  <p role="alert">{greska}</p>
{:else}
  <h2 id="statistika-cekanja">Statistika čekanja i botova</h2>
  <p class="opis-statistike">Čekanje se mjeri samo ljudima (najdulje čekanje za stolom). Broj botova je broj mjesta koja je popunio bot. Služi podeavanju pragova i fonda prema ADR-017.</p>
  <label class="izbor-razdoblja">Razdoblje
    <select bind:value={daniStatistike} onchange={() => void ucitajStatistiku()}>
      <option value={1}>1 dan</option>
      <option value={7}>7 dana</option>
      <option value={30}>30 dana</option>
      <option value={90}>90 dana</option>
    </select>
  </label>
  {#if greskaStatistike}
    <p role="alert">{greskaStatistike}</p>
  {:else if statistika}
    {#if statistika.zivo}
      <dl class="zivo-stanje">
        <dt>Zastavice</dt>
        <dd>Trening {statistika.zivo.zastavice.trening ? 'uključen' : 'isključen'} · Dvoboj botovi {statistika.zivo.zastavice.botoviDvoboj ? 'uključeni' : 'isključeni'} · Četveroboj botovi {statistika.zivo.zastavice.botoviCetveroboj ? 'uključeni' : 'isključeni'}</dd>
        <dt>Fond botova</dt>
        <dd>{statistika.zivo.fond.slobodni} slobodnih / {statistika.zivo.fond.rezervirani} rezerviranih / {statistika.zivo.fond.uPartiji} u partiji od {statistika.zivo.fond.ukupno}; iscrpljenja od pokretanja: {statistika.zivo.fond.iscrpljenja}</dd>
        <dt>Botovi od pokretanja</dt>
        <dd>{statistika.zivo.bot.odigranihRijeci} riječi · {statistika.zivo.bot.namjernihPropusta} namjernih propusta · {statistika.zivo.bot.bezRijeci} bez riječi · {statistika.zivo.bot.zastarjelo} zastarjelih · {statistika.zivo.bot.tehnickeGreske} tehničkih grešaka</dd>
        <dt>Zagrijavanje</dt>
        <dd>{statistika.zivo.trening.aktivni} aktivnih · {statistika.zivo.trening.zapoceti} započetih · {statistika.zivo.trening.odbijeni} odbijenih · {statistika.zivo.trening.neuspjeli} neuspjelih</dd>
      </dl>
    {/if}
    {#if statistika.poDanu.length === 0}
      <p>Nema završenih javnih partija u odabranom razdoblju.</p>
    {:else}
      <table class="tablica tablica-mobilni-retci">
        <thead>
          <tr>
            <th scope="col">Dan</th>
            <th scope="col">Mod</th>
            <th scope="col">Partije</th>
            <th scope="col">Prosjek čekanja</th>
            <th scope="col">Medijan</th>
            <th scope="col">P95</th>
            <th scope="col">0 botova</th>
            <th scope="col">1 bot</th>
            <th scope="col">2 bota</th>
            <th scope="col">3 bota</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.poDanu as redak (`${redak.dan}-${redak.mod}`)}
            <tr>
              <td>{redak.dan}</td>
              <td data-label="Mod">{nazivModa(redak.mod)}</td>
              <td data-label="Partije">{redak.partije}</td>
              <td data-label="Prosjek čekanja">{sekunde(redak.prosjekCekanjaMs)}</td>
              <td data-label="Medijan čekanja">{sekunde(redak.medijanCekanjaMs)}</td>
              <td data-label="P95 čekanja">{sekunde(redak.p95CekanjaMs)}</td>
              <td data-label="Partije bez botova">{redak.partijeBezBotova}</td>
              <td data-label="Partije s jednim botom">{redak.partijeSJednimBotom}</td>
              <td data-label="Partije s dva bota">{redak.partijeSDvaBota}</td>
              <td data-label="Partije s tri bota">{redak.partijeSTriBota}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if statistika.pobjedePoSastavu.length > 0}
      <h3>Pobjede ljudi po sastavu stola</h3>
      <table class="tablica tablica-mobilni-retci">
        <thead>
          <tr>
            <th scope="col">Mod</th>
            <th scope="col">Botova za stolom</th>
            <th scope="col">Partije</th>
            <th scope="col">Pobjede ljudi</th>
            <th scope="col">Udio</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.pobjedePoSastavu as redak (`${redak.mod}-${redak.brojBotova}`)}
            <tr>
              <td>{nazivModa(redak.mod)}</td>
              <td data-label="Botova za stolom">{redak.brojBotova}</td>
              <td data-label="Partije">{redak.partije}</td>
              <td data-label="Pobjede ljudi">{redak.pobjedeLjudi}</td>
              <td data-label="Udio pobjeda ljudi">{redak.udioPobjedaLjudi === null ? '–' : `${Math.round(redak.udioPobjedaLjudi * 100)} %`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if statistika.eliminacijeBotova.length > 0}
      <h3>Kako botovi ispadaju</h3>
      <table class="tablica">
        <thead>
          <tr>
            <th scope="col">Način</th>
            <th scope="col">Broj</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.eliminacijeBotova as redak (redak.nacinIspadanja)}
            <tr>
              <td>{redak.nacinIspadanja}</td>
              <td>{redak.broj}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}

  <h2 id="rjecnik">Rječnik - ručno dodavanje</h2>
  <form onsubmit={dodajRijec}>
    <label>Riječ <input type="text" bind:value={novaRijec} required /></label>
    <label>Razlog <input type="text" bind:value={razlogRijeci} required /></label>
    <button type="submit">Dodaj</button>
  </form>
  {#if porukaRjecnik}<p class="poruka">{porukaRjecnik}</p>{/if}

  <h2>Ručno dodane riječi</h2>
  {#if rucnoDodane.length === 0}
    <p>Nema ručno dodanih riječi.</p>
  {:else}
    <table class="tablica">
      <thead>
        <tr>
          <th>Riječ</th>
          <th>Akcija</th>
          <th>Razlog</th>
          <th>Vrijeme</th>
        </tr>
      </thead>
      <tbody>
        {#each rucnoDodane as izmjena (izmjena.id)}
          <tr>
            <td class="rijec">{izmjena.rijec}</td>
            <td class="akcija">{izmjena.akcija}</td>
            <td>{izmjena.razlog}</td>
            <td class="vrijeme">{new Date(izmjena.vrijeme).toLocaleString('hr-HR')}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h2>Test riječi (mini-tester)</h2>
  <div class="test-rijeci">
    <form onsubmit={(e) => { e.preventDefault(); testRijeci_f(); }}>
      <input type="text" bind:value={testRijec} placeholder="Unesi riječ za testiranje..." />
      <button type="submit">Test</button>
    </form>
    {#if testiranjeGreska}
      <p class="greska">{testiranjeGreska}</p>
    {/if}
    {#if detaljiRijeci}
      {#if detaljiRijeci.rijec}
        <div class="rezultati">
          <h3>{detaljiRijeci.rijec.rijec}</h3>
          <p>Prva dva: <strong>{detaljiRijeci.rijec.prvaDva}</strong></p>
          <p>Zadnja dva: <strong>{detaljiRijeci.rijec.zadnjaDva}</strong></p>
          <p>Status: <strong>{detaljiRijeci.rijec.aktivna ? 'Aktivna' : 'Deaktivna'}</strong></p>

          {#if detaljiRijeci.nastavci.length > 0}
            <h4>Mogući nastavci ({detaljiRijeci.nastavci.length})</h4>
            <p class="lista">{detaljiRijeci.nastavci.map((r: any) => r.rijec).join(', ')}</p>
          {/if}

          {#if detaljiRijeci.prethodnici.length > 0}
            <h4>Mogući prethodnici ({detaljiRijeci.prethodnici.length})</h4>
            <p class="lista">{detaljiRijeci.prethodnici.map((r: any) => r.rijec).join(', ')}</p>
          {/if}

          {#if detaljiRijeci.izmjene.length > 0}
            <h4>Istorija izmjena</h4>
            <ul class="izmjene">
              {#each detaljiRijeci.izmjene as izmjena (izmjena.id)}
                <li>{izmjena.akcija}: {izmjena.razlog} ({new Date(izmjena.vrijeme).toLocaleString('hr-HR')})</li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else}
        <p class="info">Riječ nije pronađena u bazi.</p>
      {/if}
    {/if}
  </div>

  <h2 id="prijave">Prijave grešaka</h2>
  {#if prijave.length === 0}
    <p>Nema prijava.</p>
  {:else}
    <ul>
      {#each prijave as prijava (prijava.id)}
        <li>
          #{prijava.id} [{prijava.status}] {prijava.poruka}
          <button type="button" onclick={() => otvoriPartiju(prijava.partijaId)}>Vidi cijelu partiju</button>
          {#if prijava.status !== 'rijesena'}
            <button onclick={() => rijesi(prijava.id, 'pregledana')}>Označi pregledano</button>
            <button onclick={() => rijesi(prijava.id, 'rijesena')}>Riješi</button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if odabranaPartija}
      <section class="detalji-partije">
        <h3>Igra {odabranaPartija}</h3>
        <ol>
          {#each odabraniPotezi as potez (potez.id)}
            <li>{potez.igracId ?? 'Sustav'}: {potez.rijec ?? potez.vrsta}</li>
          {/each}
        </ol>
      </section>
    {/if}
  {/if}

  <h2>Prijave igrača</h2>
  {#if prijaveIgraca.length === 0}
    <p>Nema prijava igrača.</p>
  {:else}
    <ul>
      {#each prijaveIgraca as prijava (prijava.id)}
        <li>
          #{prijava.id} [{prijava.status}] {prijava.razlog}: {prijava.poruka}
          <small>Partija: {prijava.partijaId} · Prijavitelj: {prijava.prijaviteljId} · Igrač: {prijava.prijavljeniIgracId}</small>
          {#if prijava.status !== 'rijesena'}
            <button type="button" onclick={() => rijesiIgraca(prijava.id, 'pregledana')}>Označi pregledano</button>
            <button type="button" onclick={() => rijesiIgraca(prijava.id, 'rijesena')}>Riješi</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .opis-statistike {
    color: #555;
    font-size: var(--tekst-mali);
  }

  .izbor-razdoblja {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }

  .zivo-stanje {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 12px 0;
    font-size: var(--tekst-sitni);
  }

  .zivo-stanje dt {
    font-weight: bold;
  }

  .zivo-stanje dd {
    margin: 0;
  }

  @media (max-width: 480px) {
    .zivo-stanje {
      grid-template-columns: 1fr;
    }
  }

  .tablica {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: var(--tekst-sitni);
  }

  .tablica th {
    background: #f5f5f5;
    padding: 12px;
    text-align: left;
    font-weight: bold;
    border-bottom: 2px solid #ddd;
  }

  .tablica td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
  }

  .tablica tr:hover {
    background: #fafafa;
  }

  .rijec {
    font-weight: bold;
    font-family: monospace;
  }

  .akcija {
    text-transform: uppercase;
    font-size: var(--tekst-mikro);
    color: #666;
  }

  .vrijeme {
    font-size: var(--tekst-mikro);
    color: #999;
  }

  .test-rijeci {
    border: 1px solid #ddd;
    padding: 16px;
    border-radius: 6px;
    background: #f9f9f9;
    margin: 16px 0;
  }

  .test-rijeci form {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .test-rijeci input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: var(--tekst-sitni);
  }

  .test-rijeci button {
    padding: 8px 16px;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .test-rijeci button:hover {
    background: #0052a3;
  }

  .rezultati {
    background: white;
    padding: 16px;
    border-radius: 4px;
    margin-top: 12px;
  }

  .rezultati h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 18px;
  }

  .rezultati h4 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 14px;
    color: #666;
  }

  .lista {
    font-size: var(--tekst-mikro);
    color: #666;
    word-break: break-word;
  }

  .izmjene {
    margin: 0;
    padding-left: 20px;
    font-size: var(--tekst-mikro);
    color: #666;
  }

  .poruka {
    padding: 8px 12px;
    background: #d4edda;
    color: #155724;
    border-radius: 4px;
    margin: 12px 0;
  }

  .greska {
    padding: 8px 12px;
    background: #f8d7da;
    color: #721c24;
    border-radius: 4px;
    margin: 12px 0;
  }

  .info {
    padding: 8px 12px;
    background: #d1ecf1;
    color: #0c5460;
    border-radius: 4px;
    margin: 12px 0;
  }
</style>
