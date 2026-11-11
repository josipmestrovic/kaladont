<script lang="ts">
  import { onMount } from 'svelte';
  import {
    grafemi,
    iskustvoZaDuljinu,
    iskustvoZaRijetkost,
    nazivOznakeDuljine,
    nazivOznakeRijetkosti,
    tierDuljineIskustva,
    tierRijetkostiIskustva,
  } from 'zajednicko';
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

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
      frekvencija: number;
      vrste: string[];
      grupe: string[];
      napomena?: string | null;
    } | null;
    nastavci: Array<{ rijec: string }>;
    prethodnici: Array<{ rijec: string }>;
    izmjene: IzmjenaRjecnika[];
  }

  interface NstandardnaRijec {
    rijec: string;
    frekvencija: number;
  }

  interface SigurnaRijecRedak {
    rijec: string;
    dodanaU: string;
    dodaoAdminId: string | null;
  }

  type TabRjecnik = 'rucno' | 'izmjene' | 'test' | 'sigurni' | 'ciscenje';
  type AkcijaRjecnik = 'dodaj' | 'deaktiviraj' | 'vrati' | 'ciscenje' | 'sigurni' | null;
  type TierRijetkostiRucno = 'ucestala' | 'rijetka' | 'srednje_rijetka' | 'jako_rijetka';

  let tab = $state<TabRjecnik>('rucno');
  let rucnoDodane = $state<IzmjenaRjecnika[]>([]);
  let greska = $state<string | null>(null);
  let novaRijec = $state('');
  let vrstaRijeci = $state('imenica');
  let tierRijetkosti = $state<TierRijetkostiRucno>('ucestala');
  let porukaRjecnik = $state<string | null>(null);
  let testRijec = $state('');
  let detaljiRijeci = $state<DetaljiRijeci | null>(null);
  let testiranjeGreska = $state<string | null>(null);
  let akcijaUTijeku = $state<AkcijaRjecnik>(null);
  let nstandardne = $state<NstandardnaRijec[]>([]);
  let nstandardneUkupno = $state(0);
  let ciscenjeGreska = $state<string | null>(null);
  let ciscenjeUcitavanje = $state(false);
  let sigurne = $state<SigurnaRijecRedak[]>([]);
  let sigurneUkupno = $state(0);
  let novaSigurna = $state('');
  let sigurneGreska = $state<string | null>(null);
  let sigurneUcitavanje = $state(false);

  const VRSTE_RIJECI = [
    'imenica', 'glagol', 'pridjev', 'prilog', 'zamjenica', 'broj',
    'prijedlog', 'veznik', 'cestica', 'uzvik', 'vlastito_ime',
  ] as const;

  const TIERI_RIJETKOSTI: { vrijednost: TierRijetkostiRucno; oznaka: string }[] = [
    { vrijednost: 'ucestala', oznaka: 'Učestala / obična (0 EXP)' },
    { vrijednost: 'rijetka', oznaka: 'Rijetka (15 EXP)' },
    { vrijednost: 'srednje_rijetka', oznaka: 'Srednje rijetka (30 EXP)' },
    { vrijednost: 'jako_rijetka', oznaka: 'Jako rijetka (50 EXP)' },
  ];

  function oznakaVrste(vrsta: string): string {
    return vrsta === 'vlastito_ime' ? 'vlastito ime' : vrsta.replaceAll('_', ' ');
  }

  function metaRijetkosti(rijec: string, frekvencija: number) {
    const broj = grafemi(rijec).length;
    const tier = tierRijetkostiIskustva(frekvencija, broj);
    return {
      tier,
      naziv: nazivOznakeRijetkosti(tier) ?? 'Učestala / obična',
      exp: iskustvoZaRijetkost(tier),
    };
  }

  function metaDuljine(rijec: string) {
    const tier = tierDuljineIskustva(rijec);
    return {
      tier,
      naziv: nazivOznakeDuljine(tier) ?? 'Obična duljina',
      exp: iskustvoZaDuljinu(tier),
    };
  }

  async function ucitaj() {
    try {
      const odgovor = await api<{ izmjene: IzmjenaRjecnika[] }>('/admin/rjecnik/rucno-dodano');
      rucnoDodane = odgovor.izmjene;
      greska = null;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Nemaš pristup admin stranici.';
    }
  }

  async function ucitajCiscenje() {
    ciscenjeUcitavanje = true;
    ciscenjeGreska = null;
    try {
      const odgovor = await api<{ ukupno: number; rijeci: NstandardnaRijec[] }>(
        '/admin/rjecnik/ciscenje-nstandardnih',
      );
      nstandardneUkupno = odgovor.ukupno;
      nstandardne = odgovor.rijeci;
    } catch (e) {
      ciscenjeGreska = e instanceof Error ? e.message : 'Čišćenje se ne može učitati.';
    } finally {
      ciscenjeUcitavanje = false;
    }
  }

  async function ucitajSigurniSkup() {
    sigurneUcitavanje = true;
    sigurneGreska = null;
    try {
      const odgovor = await api<{ ukupno: number; rijeci: SigurnaRijecRedak[] }>(
        '/admin/rjecnik/sigurni-skup',
      );
      sigurneUkupno = odgovor.ukupno;
      sigurne = odgovor.rijeci;
    } catch (e) {
      sigurneGreska = e instanceof Error ? e.message : 'Sigurni skup se ne može učitati.';
    } finally {
      sigurneUcitavanje = false;
    }
  }

  function odaberiTab(novi: TabRjecnik) {
    tab = novi;
    if (novi === 'ciscenje') void ucitajCiscenje();
    if (novi === 'izmjene') void ucitaj();
    if (novi === 'sigurni') void ucitajSigurniSkup();
  }

  onMount(() => {
    void ucitaj();
  });

  async function dodajRijec(e: SubmitEvent) {
    e.preventDefault();
    if (akcijaUTijeku !== null) return;
    akcijaUTijeku = 'dodaj';
    porukaRjecnik = null;
    const rijec = novaRijec;
    const vrsta = vrstaRijeci;
    const tier = tierRijetkosti;
    pokaziUspjeh(`Riječ „${rijec}” dodana.`);
    novaRijec = '';
    try {
      await api('/admin/rjecnik/dodaj', {
        method: 'POST',
        body: JSON.stringify({ rijec, vrsta, tierRijetkosti: tier }),
      });
      void ucitaj();
    } catch (err) {
      novaRijec = rijec;
      vrstaRijeci = vrsta;
      tierRijetkosti = tier;
      porukaRjecnik = err instanceof Error ? err.message : 'Neuspjelo dodavanje riječi.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function dodajSigurnu(e: SubmitEvent) {
    e.preventDefault();
    if (akcijaUTijeku !== null || !novaSigurna.trim()) return;
    akcijaUTijeku = 'sigurni';
    sigurneGreska = null;
    const rijec = novaSigurna;
    try {
      await api('/admin/rjecnik/sigurni-skup', {
        method: 'POST',
        body: JSON.stringify({ rijec }),
      });
      pokaziUspjeh(`„${rijec}” dodana u sigurni skup.`);
      novaSigurna = '';
      await ucitajSigurniSkup();
    } catch (err) {
      sigurneGreska = err instanceof Error ? err.message : 'Dodavanje u sigurni skup nije uspjelo.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function izbaciSigurnu(rijec: string) {
    if (akcijaUTijeku !== null) return;
    if (!confirm(`Izbaciti „${rijec}” iz sigurnog skupa?`)) return;
    akcijaUTijeku = 'sigurni';
    sigurneGreska = null;
    try {
      await api(`/admin/rjecnik/sigurni-skup/${encodeURIComponent(rijec)}`, { method: 'DELETE' });
      pokaziUspjeh(`„${rijec}” izbačena iz sigurnog skupa.`);
      await ucitajSigurniSkup();
    } catch (err) {
      sigurneGreska = err instanceof Error ? err.message : 'Izbacivanje nije uspjelo.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function deaktivirajTrenutnu() {
    if (!detaljiRijeci?.rijec || akcijaUTijeku !== null) return;
    akcijaUTijeku = 'deaktiviraj';
    porukaRjecnik = null;
    const rijec = detaljiRijeci.rijec.rijec;
    const prethodno = detaljiRijeci;
    if (detaljiRijeci.rijec) detaljiRijeci = { ...detaljiRijeci, rijec: { ...detaljiRijeci.rijec, aktivna: false } };
    pokaziUspjeh(`Riječ „${rijec}” deaktivirana.`);
    try {
      await api('/admin/rjecnik/deaktiviraj', {
        method: 'POST',
        body: JSON.stringify({ rijec, razlog: 'Ručna deaktivacija iz admina' }),
      });
      void testRijeci_f();
      void ucitaj();
    } catch (err) {
      detaljiRijeci = prethodno;
      porukaRjecnik = err instanceof Error ? err.message : 'Deaktivacija nije uspjela.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function vratiTrenutnu() {
    if (!detaljiRijeci?.rijec || akcijaUTijeku !== null) return;
    akcijaUTijeku = 'vrati';
    porukaRjecnik = null;
    const rijec = detaljiRijeci.rijec.rijec;
    const prethodno = detaljiRijeci;
    if (detaljiRijeci.rijec) detaljiRijeci = { ...detaljiRijeci, rijec: { ...detaljiRijeci.rijec, aktivna: true } };
    pokaziUspjeh(`Riječ „${rijec}” vraćena.`);
    try {
      await api('/admin/rjecnik/vrati', {
        method: 'POST',
        body: JSON.stringify({ rijec, razlog: 'Ručno vraćanje iz admina' }),
      });
      void testRijeci_f();
      void ucitaj();
    } catch (err) {
      detaljiRijeci = prethodno;
      porukaRjecnik = err instanceof Error ? err.message : 'Vraćanje nije uspjelo.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function potvrdiCiscenje() {
    if (akcijaUTijeku !== null || nstandardneUkupno === 0) return;
    akcijaUTijeku = 'ciscenje';
    ciscenjeGreska = null;
    try {
      const odgovor = await api<{ deaktivirano: number }>('/admin/rjecnik/ciscenje-nstandardnih', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      pokaziUspjeh(`Deaktivirano ${odgovor.deaktivirano} nstandardnih riječi.`);
      await Promise.all([ucitajCiscenje(), ucitaj()]);
    } catch (err) {
      ciscenjeGreska = err instanceof Error ? err.message : 'Čišćenje nije uspjelo.';
    } finally {
      akcijaUTijeku = null;
    }
  }

  async function testRijeci_f() {
    if (!testRijec.trim()) return;
    testiranjeGreska = null;
    try {
      detaljiRijeci = await api<DetaljiRijeci>(`/admin/rjecnik/rijec/${encodeURIComponent(testRijec.toLowerCase())}`);
    } catch (err) {
      testiranjeGreska = err instanceof Error ? err.message : 'Greška pri testiranju riječi.';
      detaljiRijeci = null;
    }
  }
</script>

<svelte:head>
  <title>Rječnik | Admin | Kaladont</title>
</svelte:head>

<h1>Rječnik</h1>

{#if greska}
  <p class="greska" role="alert">{greska}</p>
{:else}
  <div class="tabovi" role="tablist" aria-label="Administracija rječnika">
    <button type="button" role="tab" aria-selected={tab === 'rucno'} class:odabran={tab === 'rucno'} onclick={() => odaberiTab('rucno')}>Ručno</button>
    <button type="button" role="tab" aria-selected={tab === 'izmjene'} class:odabran={tab === 'izmjene'} onclick={() => odaberiTab('izmjene')}>Izmjene</button>
    <button type="button" role="tab" aria-selected={tab === 'test'} class:odabran={tab === 'test'} onclick={() => odaberiTab('test')}>Test</button>
    <button type="button" role="tab" aria-selected={tab === 'sigurni'} class:odabran={tab === 'sigurni'} onclick={() => odaberiTab('sigurni')}>Sigurni skup</button>
    <button type="button" role="tab" aria-selected={tab === 'ciscenje'} class:odabran={tab === 'ciscenje'} onclick={() => odaberiTab('ciscenje')}>Čišćenje</button>
  </div>

  {#if tab === 'rucno'}
    <h2>Ručno dodavanje</h2>
    <form class="forma-rjecnik" onsubmit={dodajRijec}>
      <label>Riječ <input type="text" bind:value={novaRijec} required disabled={akcijaUTijeku !== null} /></label>
      <label>Vrsta
        <select bind:value={vrstaRijeci} required disabled={akcijaUTijeku !== null}>
          {#each VRSTE_RIJECI as vrsta (vrsta)}
            <option value={vrsta}>{oznakaVrste(vrsta)}</option>
          {/each}
        </select>
      </label>
      <label>Rijetkost
        <select bind:value={tierRijetkosti} required disabled={akcijaUTijeku !== null}>
          {#each TIERI_RIJETKOSTI as tier (tier.vrijednost)}
            <option value={tier.vrijednost}>{tier.oznaka}</option>
          {/each}
        </select>
      </label>
      <button type="submit" disabled={akcijaUTijeku !== null}>{akcijaUTijeku === 'dodaj' ? 'Radim…' : 'Dodaj riječ'}</button>
    </form>
    {#if porukaRjecnik}<p class="greska" role="alert">{porukaRjecnik}</p>{/if}
  {/if}

  {#if tab === 'izmjene'}
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
  {/if}

  {#if tab === 'test'}
    <h2>Test riječi</h2>
    <div class="test-rijeci">
      <form onsubmit={(e) => { e.preventDefault(); void testRijeci_f(); }}>
        <input type="text" bind:value={testRijec} placeholder="Unesi riječ za testiranje..." />
        <button type="submit">Test</button>
      </form>
      {#if testiranjeGreska}
        <p class="greska">{testiranjeGreska}</p>
      {/if}
      {#if porukaRjecnik}<p class="greska" role="alert">{porukaRjecnik}</p>{/if}
      {#if detaljiRijeci}
        {#if detaljiRijeci.rijec}
          {@const rijetkost = metaRijetkosti(detaljiRijeci.rijec.rijec, detaljiRijeci.rijec.frekvencija)}
          {@const duljina = metaDuljine(detaljiRijeci.rijec.rijec)}
          <div class="rezultati">
            <h3>{detaljiRijeci.rijec.rijec}</h3>
            <p>Prva dva: <strong>{detaljiRijeci.rijec.prvaDva}</strong></p>
            <p>Zadnja dva: <strong>{detaljiRijeci.rijec.zadnjaDva}</strong></p>
            <p>Status: <strong>{detaljiRijeci.rijec.aktivna ? 'Aktivna' : 'Deaktivna'}</strong></p>
            <p>Frekvencija: <strong>{detaljiRijeci.rijec.frekvencija}</strong></p>
            <p>Rijetkost: <strong>{rijetkost.naziv}</strong> ({rijetkost.exp} EXP)</p>
            <p>Duljina: <strong>{duljina.naziv}</strong> ({duljina.exp} EXP)</p>
            <p>Vrste: <strong>{detaljiRijeci.rijec.vrste.map(oznakaVrste).join(', ') || '—'}</strong></p>
            <p>Grupe: <strong>{detaljiRijeci.rijec.grupe.join(', ') || '—'}</strong></p>
            <div class="akcije-rijeci">
              {#if detaljiRijeci.rijec.aktivna}
                <button type="button" disabled={akcijaUTijeku !== null} onclick={() => void deaktivirajTrenutnu()}>
                  {akcijaUTijeku === 'deaktiviraj' ? 'Radim…' : 'Deaktiviraj'}
                </button>
              {:else}
                <button type="button" disabled={akcijaUTijeku !== null} onclick={() => void vratiTrenutnu()}>
                  {akcijaUTijeku === 'vrati' ? 'Radim…' : 'Vrati u igru'}
                </button>
              {/if}
            </div>
            {#if detaljiRijeci.nastavci.length > 0}
              <h4>Mogući nastavci ({detaljiRijeci.nastavci.length})</h4>
              <p class="lista">{detaljiRijeci.nastavci.map((r) => r.rijec).join(', ')}</p>
            {/if}
            {#if detaljiRijeci.prethodnici.length > 0}
              <h4>Mogući prethodnici ({detaljiRijeci.prethodnici.length})</h4>
              <p class="lista">{detaljiRijeci.prethodnici.map((r) => r.rijec).join(', ')}</p>
            {/if}
            {#if detaljiRijeci.izmjene.length > 0}
              <h4>Povijest izmjena</h4>
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
  {/if}

  {#if tab === 'sigurni'}
    <h2>Sigurni skup</h2>
    <p class="opis-ciscenja">
      Odobrene početne riječi za otvaranje runde. Odabir i dalje radi 2-ply provjeru u trenutku partije
      (nastavak + nastavak svakog odgovora).
    </p>
    <form class="forma-rjecnik" onsubmit={dodajSigurnu}>
      <label>Riječ <input type="text" bind:value={novaSigurna} required disabled={akcijaUTijeku !== null} /></label>
      <button type="submit" disabled={akcijaUTijeku !== null}>{akcijaUTijeku === 'sigurni' ? 'Radim…' : 'Dodaj u skup'}</button>
    </form>
    {#if sigurneGreska}<p class="greska" role="alert">{sigurneGreska}</p>{/if}
    {#if sigurneUcitavanje}
      <p>Učitavam skup…</p>
    {:else}
      <p><strong>{sigurneUkupno}</strong> riječi u skupu</p>
      {#if sigurne.length === 0}
        <p class="info">Skup je prazan.</p>
      {:else}
        <table class="tablica">
          <thead>
            <tr>
              <th>Riječ</th>
              <th>Dodana</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each sigurne as stavka (stavka.rijec)}
              <tr>
                <td class="rijec">{stavka.rijec}</td>
                <td class="vrijeme">{new Date(stavka.dodanaU).toLocaleString('hr-HR')}</td>
                <td>
                  <button type="button" disabled={akcijaUTijeku !== null} onclick={() => void izbaciSigurnu(stavka.rijec)}>
                    Izbaci
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  {/if}

  {#if tab === 'ciscenje'}
    <h2>Automatsko čišćenje</h2>
    <p class="opis-ciscenja">
      Aktivne riječi koje sadrže znakove izvan hrvatske abecede (uključujući q/w/x/y).
      Potvrda ih soft-deaktivira; više nisu igrive.
    </p>
    {#if ciscenjeGreska}
      <p class="greska" role="alert">{ciscenjeGreska}</p>
    {/if}
    {#if ciscenjeUcitavanje}
      <p>Učitavam kandidate…</p>
    {:else if nstandardneUkupno === 0}
      <p class="info">Nema aktivnih nstandardnih riječi.</p>
    {:else}
      <p><strong>{nstandardneUkupno}</strong> aktivnih kandidata</p>
      <button
        type="button"
        class="gumb-ciscenje"
        disabled={akcijaUTijeku !== null}
        onclick={() => void potvrdiCiscenje()}
      >
        {akcijaUTijeku === 'ciscenje' ? 'Radim…' : 'Deaktiviraj sve'}
      </button>
      <table class="tablica">
        <thead>
          <tr>
            <th>Riječ</th>
            <th>Frekvencija</th>
          </tr>
        </thead>
        <tbody>
          {#each nstandardne as stavka (stavka.rijec)}
            <tr>
              <td class="rijec">{stavka.rijec}</td>
              <td>{stavka.frekvencija}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
{/if}

<style>
  .tabovi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 20px;
  }

  .tabovi button {
    padding: 8px 14px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f5f5f5;
    cursor: pointer;
  }

  .tabovi button.odabran {
    background: #0066cc;
    border-color: #0066cc;
    color: white;
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
  }

  .test-rijeci button {
    padding: 8px 16px;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .rezultati {
    background: white;
    padding: 16px;
    border-radius: 4px;
    margin-top: 12px;
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

  .forma-rjecnik {
    display: grid;
    gap: 10px;
    max-width: 420px;
    margin: 12px 0;
  }

  .forma-rjecnik label {
    display: grid;
    gap: 4px;
  }

  .akcije-rijeci {
    display: flex;
    gap: 8px;
    margin: 10px 0;
  }

  .opis-ciscenja {
    color: #555;
    max-width: 52rem;
  }

  .gumb-ciscenje {
    padding: 8px 16px;
    background: #b33;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin: 8px 0;
  }

  .gumb-ciscenje:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
