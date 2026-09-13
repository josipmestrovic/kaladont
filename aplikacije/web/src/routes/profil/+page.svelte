<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import Avatar from '$lib/komponente/Avatar.svelte';

  interface Profil {
    igracId: string;
    nadimak: string;
    avatarId: number;
    email: string | null;
    emailPotvrdjen: boolean;
    odigrane: number;
    pobjede: number;
    eliminacijeUkupno: number;
    bodoviUkupno: number;
    prosjekBodova: number;
    rang: string;
    odigrane1v1: number;
    pobjede1v1: number;
    eliminacije1v1: number;
    bodovi1v1: number;
    prosjekBodova1v1: number;
    rang1v1: string;
  }

  interface Partija {
    partijaId: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
    pocetak: string;
  }

  let profil = $state<Profil | null>(null);
  let partije = $state<Partija[]>([]);
  let greska = $state<string | null>(null);
  let ucitavanjePartija = $state(false);
  let imaJosPartija = $state(true);
  let aktivniTab = $state<'4p' | '1v1'>('4p');

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
      if (profil) {
        await ucitajPartije(0);
      }
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profila.';
    }
  });

  async function ucitajPartije(offset: number) {
    if (!profil || ucitavanjePartija) return;
    ucitavanjePartija = true;
    try {
      const odgovor = await api<{ partije: Partija[] }>(
        `/povijest/${profil.igracId}?limit=10&offset=${offset}`
      );
      if (odgovor.partije.length < 10) {
        imaJosPartija = false;
      }
      if (offset === 0) {
        partije = odgovor.partije;
      } else {
        partije = [...partije, ...odgovor.partije];
      }
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje povijesti partija.';
    } finally {
      ucitavanjePartija = false;
    }
  }

  function ucitajJos() {
    void ucitajPartije(partije.length);
  }

  function formatirajDatum(datumStr: string): string {
    const d = new Date(datumStr);
    return d.toLocaleDateString('hr-HR', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatirajPlasman(plasman: number): string {
    switch (plasman) {
      case 1:
        return '🥇 1. mjesto';
      case 2:
        return '🥈 2. mjesto';
      case 3:
        return '🥉 3. mjesto';
      default:
        return `${plasman}. mjesto`;
    }
  }
</script>

<main class="profil-stranica">
  {#if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else if profil}
    {@const jeGost = !profil.email}

    <div class="zaglavlje-profila">
      <Avatar avatarId={profil.avatarId} rang={aktivniTab === '4p' ? profil.rang : profil.rang1v1} gost={jeGost} velicina={72} />
      <div class="info-profila">
        <h1>{profil.nadimak}</h1>
        <span class="rang-oznaka">
           {aktivniTab === '4p' ? (profil.rang ?? 'Početnik') : (profil.rang1v1 ?? 'Početnik')} ({aktivniTab === '4p' ? '4 igrača' : '2 igrača'})
        </span>
      </div>
    </div>

    {#if jeGost}
      <div class="gost-upozorenje">
        <div class="upozorenje-sadrzaj">
          <p>
            <strong>Igraš kao gost.</strong> Ovi podaci su privremeno spremljeni u ovom pregledniku i mogu biti izgubljeni brisanjem kolačića.
          </p>
          <a href="/registracija" class="cta-gumb">Sačuvaj statistiku — Registriraj se</a>
        </div>
      </div>
    {/if}

    <div class="mod-tabovi">
      <button
        type="button"
        class="mod-tab-gumb"
        class:aktivan={aktivniTab === '4p'}
        onclick={() => (aktivniTab = '4p')}
      >
          4 igrača
      </button>
      <button
        type="button"
        class="mod-tab-gumb"
        class:aktivan={aktivniTab === '1v1'}
        onclick={() => (aktivniTab = '1v1')}
      >
          2 igrača
      </button>
    </div>

    {#if aktivniTab === '4p'}
      <section class="statistika-sekcija">
        <h2>Statistika (4 igrača)</h2>
        <div class="mrezica-kartica">
          <div class="stat-kartica">
            <span class="stat-broj">{profil.odigrane}</span>
            <span class="stat-naziv">Odigrane partije</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.pobjede}</span>
            <span class="stat-naziv">Pobjede</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.bodoviUkupno}</span>
            <span class="stat-naziv">Ukupno bodova</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.prosjekBodova.toFixed(2)}</span>
            <span class="stat-naziv">Prosjek bodova</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.eliminacijeUkupno}</span>
            <span class="stat-naziv">Eliminacije</span>
          </div>
        </div>
      </section>
    {:else}
      <section class="statistika-sekcija">
        <h2>Statistika (2 igrača)</h2>
        <div class="mrezica-kartica">
          <div class="stat-kartica">
            <span class="stat-broj">{profil.odigrane1v1}</span>
            <span class="stat-naziv">Odigrane partije</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.pobjede1v1}</span>
            <span class="stat-naziv">Pobjede</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.bodovi1v1}</span>
            <span class="stat-naziv">Bodovi</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.prosjekBodova1v1.toFixed(2)}</span>
            <span class="stat-naziv">Prosjek bodova</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.eliminacije1v1}</span>
            <span class="stat-naziv">Eliminacije</span>
          </div>
        </div>
      </section>
    {/if}

    <section class="povijest-sekcija">
      <h2>Povijest partija</h2>
      {#if partije.length === 0}
        <p class="prazno">Još nema odigranih partija.</p>
      {:else}
        <div class="tablica-omotač">
          <table class="povijest-tablica">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Plasman</th>
                <th>Bodovi</th>
                <th>Eliminacije</th>
              </tr>
            </thead>
            <tbody>
              {#each partije as p (p.partijaId)}
                <tr>
                  <td>{formatirajDatum(p.pocetak)}</td>
                  <td class="plasman-stupac">{formatirajPlasman(p.plasman)}</td>
                  <td class="broj-stupac">{p.bodovi}</td>
                  <td class="broj-stupac">{p.eliminacije}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if imaJosPartija}
          <button type="button" class="ucitaj-jos-gumb" disabled={ucitavanjePartija} onclick={ucitajJos}>
            {ucitavanjePartija ? 'Učitavanje...' : 'Učitaj još partija'}
          </button>
        {/if}
      {/if}
    </section>
  {:else}
    <p>Učitavanje...</p>
  {/if}
</main>

<style>
  .profil-stranica {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .zaglavlje-profila {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .info-profila h1 {
    margin: 0;
    font-family: var(--font-naslov);
    line-height: 1.1;
  }

  .rang-oznaka {
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }

  .gost-upozorenje {
    background: #fdf6e2;
    border: 2px solid #f4c95d;
    border-radius: var(--radijus-kartica);
    padding: 16px 20px;
  }

  .upozorenje-sadrzaj {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .upozorenje-sadrzaj p {
    margin: 0;
    color: #5c554a;
  }

  .cta-gumb {
    display: inline-block;
    background: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 700;
    text-decoration: none;
    padding: 10px 20px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
  }

  .mod-tabovi {
    display: flex;
    gap: 10px;
  }

  .mod-tab-gumb {
    background: #faf8f0;
    border: 2px solid #e5ddc8;
    color: var(--boja-tekst-osnovni);
    padding: 8px 18px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    cursor: pointer;
  }

  .mod-tab-gumb.aktivan {
    background: var(--boja-pozadina-primarna);
    border-color: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 700;
  }

  .statistika-sekcija h2, .povijest-sekcija h2 {
    font-size: var(--naslov-3);
    margin: 0 0 12px 0;
  }

  .mrezica-kartica {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }

  .stat-kartica {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-shadow: var(--sjena-suptilna);
  }

  .stat-broj {
    font-family: var(--font-naslov);
    font-size: 28px;
    font-weight: 700;
    color: var(--boja-tekst-naslov);
    line-height: 1.1;
  }

  .stat-naziv {
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
    margin-top: 4px;
  }

  .tablica-omotač {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    overflow: hidden;
    box-shadow: var(--sjena-suptilna);
  }

  .povijest-tablica {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: var(--tekst-sitni);
  }

  .povijest-tablica th {
    background: #faf8f0;
    padding: 12px 16px;
    color: var(--boja-tekst-naslov);
    border-bottom: 1px solid #e5ddc8;
    font-weight: 700;
  }

  .povijest-tablica td {
    padding: 12px 16px;
    border-bottom: 1px solid #f0eadd;
  }

  .povijest-tablica tr:last-child td {
    border-bottom: none;
  }

  .plasman-stupac {
    font-weight: 600;
  }

  .broj-stupac {
    font-weight: 700;
    color: var(--boja-tekst-naslov);
  }

  .ucitaj-jos-gumb {
    margin-top: 12px;
    background: white;
    border: 2px solid var(--boja-pozadina-primarna);
    color: var(--boja-pozadina-primarna);
    font-family: var(--font-naslov);
    font-weight: 700;
    font-size: 16px;
    padding: 10px 24px;
    border-radius: var(--radijus-pill);
    cursor: pointer;
  }

  .ucitaj-jos-gumb:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .prazno {
    color: var(--boja-tekst-sekundarni);
  }

  .greska {
    color: #c0392b;
    font-weight: 600;
  }
</style>
