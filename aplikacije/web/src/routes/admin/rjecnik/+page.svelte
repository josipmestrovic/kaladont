<script lang="ts">
  import { onMount } from 'svelte';
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
    } | null;
    nastavci: Array<{ rijec: string }>;
    prethodnici: Array<{ rijec: string }>;
    izmjene: IzmjenaRjecnika[];
  }

  type AkcijaRjecnik = 'dodaj' | 'deaktiviraj' | 'vrati' | null;

  let rucnoDodane = $state<IzmjenaRjecnika[]>([]);
  let greska = $state<string | null>(null);
  let novaRijec = $state('');
  let razlogRijeci = $state('');
  let vrstaRijeci = $state('imenica');
  let porukaRjecnik = $state<string | null>(null);
  let testRijec = $state('');
  let detaljiRijeci = $state<DetaljiRijeci | null>(null);
  let testiranjeGreska = $state<string | null>(null);
  let akcijaUTijeku = $state<AkcijaRjecnik>(null);

  const VRSTE_RIJECI = [
    'imenica', 'glagol', 'pridjev', 'prilog', 'zamjenica', 'broj',
    'prijedlog', 'veznik', 'cestica', 'uzvik', 'vlastito_ime',
  ] as const;

  async function ucitaj() {
    try {
      const odgovor = await api<{ izmjene: IzmjenaRjecnika[] }>('/admin/rjecnik/rucno-dodano');
      rucnoDodane = odgovor.izmjene;
      greska = null;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Nemaš pristup admin stranici.';
    }
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
    const razlog = razlogRijeci;
    const vrsta = vrstaRijeci;
    pokaziUspjeh(`Riječ „${rijec}” dodana.`);
    novaRijec = '';
    razlogRijeci = '';
    try {
      await api('/admin/rjecnik/dodaj', {
        method: 'POST',
        body: JSON.stringify({ rijec, razlog, vrsta }),
      });
      void ucitaj();
    } catch (err) {
      novaRijec = rijec;
      razlogRijeci = razlog;
      vrstaRijeci = vrsta;
      porukaRjecnik = err instanceof Error ? err.message : 'Neuspjelo dodavanje riječi.';
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
  <h2>Ručno dodavanje</h2>
  <form class="forma-rjecnik" onsubmit={dodajRijec}>
    <label>Riječ <input type="text" bind:value={novaRijec} required disabled={akcijaUTijeku !== null} /></label>
    <label>Vrsta
      <select bind:value={vrstaRijeci} required disabled={akcijaUTijeku !== null}>
        {#each VRSTE_RIJECI as vrsta (vrsta)}
          <option value={vrsta}>{vrsta}</option>
        {/each}
      </select>
    </label>
    <label>Razlog <input type="text" bind:value={razlogRijeci} required disabled={akcijaUTijeku !== null} /></label>
    <button type="submit" disabled={akcijaUTijeku !== null}>{akcijaUTijeku === 'dodaj' ? 'Radim…' : 'Dodaj riječ'}</button>
  </form>
  {#if porukaRjecnik}<p class="greska" role="alert">{porukaRjecnik}</p>{/if}

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

  <h2>Test riječi</h2>
  <div class="test-rijeci">
    <form onsubmit={(e) => { e.preventDefault(); void testRijeci_f(); }}>
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

<style>
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
</style>
