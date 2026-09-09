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

  async function ucitaj() {
    try {
      const odgovori = await Promise.all([
        api<{ prijave: Prijava[] }>('/admin/prijave'),
        api<{ izmjene: IzmjenaRjecnika[] }>('/admin/rjecnik/rucno-dodano'),
      ]);
      prijave = odgovori[0].prijave;
      rucnoDodane = odgovori[1].izmjene;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Nemaš pristup admin stranici.';
    }
  }

  onMount(ucitaj);

  async function rijesi(id: number, status: 'pregledana' | 'rijesena') {
    await api(`/admin/prijave/${id}/rijesi`, { method: 'POST', body: JSON.stringify({ status }) });
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

<h1>Admin</h1>

{#if greska}
  <p role="alert">{greska}</p>
{:else}
  <h2>Rječnik - ručno dodavanje</h2>
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

  <h2>Prijave grešaka</h2>
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
        <h3>Partija {odabranaPartija}</h3>
        <ol>
          {#each odabraniPotezi as potez (potez.id)}
            <li>{potez.igracId ?? 'Sustav'}: {potez.rijec ?? potez.vrsta}</li>
          {/each}
        </ol>
      </section>
    {/if}
  {/if}
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
