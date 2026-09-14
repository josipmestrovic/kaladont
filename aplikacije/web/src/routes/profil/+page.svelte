<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import { PRAGOVI_DULJINE } from 'zajednicko';

    interface StatistikaRijeci {
      najduziStreak: number;
      otkriveneJakoRijetkeGrupe: number;
      otkriveneSrednjeRijetkeGrupe: number;
      otkriveneRijetkeGrupe: number;
      upisaneDugeRijeci: number;
      upisaneSrednjeDugeRijeci: number;
      upisaneJakoDugeRijeci: number;
      najduzaRijec: string | null;
      najduzaRijecGrafemi: number;
      najrjedaRijec: string | null;
      najrjedaRijecFrekvencija: number | null;
    }

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
    statistikaRijeci: StatistikaRijeci | null;
    ciljeviRijeci: { rijetke: { ukupno: number }; duge: { ukupno: number } };
    otkljucaneRijeci: { duge: string[]; srednjeDuge: string[]; jakoDuge: string[]; rijetke: string[]; srednjeRijetke: string[]; jakoRijetke: string[] };
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
  let otvoreniPopup = $state<'duge' | 'rijetke' | null>(null);

  function brojVatri(streak: number): number {
    if (streak > 100) return 100;
    if (streak >= 50) return 5;
    if (streak >= 20) return 4;
    if (streak >= 10) return 3;
    if (streak >= 5) return 2;
    return streak > 0 ? 1 : 0;
  }

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
      <Avatar avatarId={profil.avatarId} rang={aktivniTab === '4p' ? profil.rang : profil.rang1v1} gost={jeGost} velicina={216} />
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

    {#if profil.statistikaRijeci}
      {@const statistika = profil.statistikaRijeci}
      <section class="statistika-sekcija gamifikacija-sekcija">
        <h2>Riječi i streak</h2>
        <div class="mrezica-kartica achievement-mrezica">
          <div class="achievement-polje">
            <h3>Duge riječi</h3>
            <p class="napredak-broj">{Math.min(statistika.upisaneDugeRijeci + statistika.upisaneSrednjeDugeRijeci + statistika.upisaneJakoDugeRijeci, profil.ciljeviRijeci.duge.ukupno)} / {profil.ciljeviRijeci.duge.ukupno}</p>
            <div class="tier-retci">
              <span>Duge (10–11 slova): <strong>{statistika.upisaneDugeRijeci}</strong></span>
              <span>Srednje duge (12–14 slova): <strong>{statistika.upisaneSrednjeDugeRijeci}</strong></span>
              <span>Jako duge (15+ slova): <strong>{statistika.upisaneJakoDugeRijeci}</strong></span>
            </div>
            <button class="otkljucane-link" type="button" onclick={() => (otvoreniPopup = 'duge')}>Vidi otkrivene riječi →</button>
            <strong class="rekord-rijeci">Najduža riječ: {statistika.najduzaRijec ?? '—'}</strong>
          </div>
          <div class="achievement-polje">
            <h3>Rijetke riječi</h3>
            <p class="napredak-broj">{Math.min(statistika.otkriveneJakoRijetkeGrupe + statistika.otkriveneSrednjeRijetkeGrupe + statistika.otkriveneRijetkeGrupe, profil.ciljeviRijeci.rijetke.ukupno)} / {profil.ciljeviRijeci.rijetke.ukupno}</p>
            <div class="tier-retci">
              <span>Rijetke: <strong>{statistika.otkriveneRijetkeGrupe}</strong></span>
              <span>Srednje rijetke: <strong>{statistika.otkriveneSrednjeRijetkeGrupe}</strong></span>
              <span>Jako rijetke: <strong>{statistika.otkriveneJakoRijetkeGrupe}</strong></span>
            </div>
            <button class="otkljucane-link" type="button" onclick={() => (otvoreniPopup = 'rijetke')}>Vidi otkrivene riječi →</button>
            <strong class="rekord-rijeci">Najrjeđa riječ: {statistika.najrjedaRijec ?? '—'}</strong>
          </div>
          <div class="achievement-polje streak-polje">
            <h3>Streak</h3>
            <p>{#each Array(brojVatri(statistika.najduziStreak)) as _}🔥{/each} {statistika.najduziStreak}</p>
            <span>Najduži niz uzastopno prihvaćenih riječi bez odbijanja</span>
          </div>
        </div>
      </section>
    {/if}

    {#if otvoreniPopup}
      <div class="popup-pozadina" role="presentation" onclick={() => (otvoreniPopup = null)}>
        <div class="popup-rijeci" role="dialog" aria-modal="true" aria-label="Otključane riječi" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && (otvoreniPopup = null)}>
          <button class="popup-zatvori" type="button" onclick={() => (otvoreniPopup = null)} aria-label="Zatvori">×</button>
          {#if otvoreniPopup === 'duge'}
            <h2>Duge riječi</h2>
            <details open><summary>Jako duge riječi ({profil?.otkljucaneRijeci.jakoDuge.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.jakoDuge.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
            <details open><summary>Srednje duge riječi ({profil?.otkljucaneRijeci.srednjeDuge.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.srednjeDuge.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
            <details open><summary>Duge riječi ({profil?.otkljucaneRijeci.duge.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.duge.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
          {:else}
            <h2>Rijetke riječi</h2>
            <details open><summary>Jako rijetke riječi ({profil?.otkljucaneRijeci.jakoRijetke.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.jakoRijetke.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
            <details open><summary>Srednje rijetke riječi ({profil?.otkljucaneRijeci.srednjeRijetke.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.srednjeRijetke.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
            <details open><summary>Rijetke riječi ({profil?.otkljucaneRijeci.rijetke.length})</summary><p class="popis-rijeci">{profil?.otkljucaneRijeci.rijetke.join(', ') || 'Još nema otkrivenih riječi.'}</p></details>
          {/if}
        </div>
      </div>
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

  .achievement-mrezica { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .achievement-polje {
    display: flex;
    min-height: 150px;
    flex-direction: column;
    justify-content: flex-start;
    gap: 6px;
    padding: 16px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: white;
  }
  .achievement-polje { position: relative; }
  .achievement-polje h3 { margin: 0; font-family: var(--font-naslov); font-size: 20px; padding-right: 96px; }
  .achievement-polje > .napredak-broj { position: absolute; top: 16px; right: 16px; margin: 0; color: var(--boja-tekst-naslov); font-size: 1rem; font-weight: 700; white-space: nowrap; }
  .achievement-polje p { margin: 0; font-size: 1.25rem; font-weight: 700; }
  .achievement-polje span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .tier-retci { display: flex; flex-direction: column; gap: 4px; }
  .tier-retci span { display: flex; justify-content: space-between; gap: 12px; }
  .rekord-rijeci { display: block; margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--boja-isticanje-slova); color: var(--boja-tekst-osnovni) !important; font-size: var(--tekst-baza) !important; }

  @media (max-width: 999px) {
    .mrezica-kartica.achievement-mrezica { grid-template-columns: 1fr; }
  }
  .otkljucane-link { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--boja-mint); font: inherit; font-size: var(--tekst-mali); font-weight: 700; cursor: pointer; }
  .popup-pozadina { position: fixed; z-index: 200; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(26 24 21 / 42%); }
  .popup-rijeci { position: relative; width: min(640px, 100%); max-height: min(80vh, 720px); overflow: auto; padding: 24px; border-radius: 12px; background: var(--boja-krem); box-shadow: 0 12px 40px rgb(0 0 0 / 24%); }
  .popup-rijeci h2 { margin-top: 0; }
  .popup-zatvori { position: absolute; top: 12px; right: 16px; border: 0; background: none; font-size: 28px; cursor: pointer; }
  .popup-rijeci details { padding: 12px 0; border-top: 1px solid #e5ddc8; }
  .popup-rijeci summary { cursor: pointer; font-weight: 700; }
  .popis-rijeci { line-height: 1.7; color: var(--boja-tekst-sekundarni); }

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
