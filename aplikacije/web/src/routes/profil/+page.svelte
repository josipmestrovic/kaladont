<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import DostignuceKartica from '$lib/komponente/DostignuceKartica.svelte';
  import KaladontDnkGraf from '$lib/komponente/KaladontDnkGraf.svelte';
  import FormaIgraca from '$lib/komponente/FormaIgraca.svelte';
  import PostavkeProfila from '$lib/komponente/PostavkeProfila.svelte';
  import AktivnostPartije from '$lib/komponente/AktivnostPartije.svelte';
  import KaladontCvSazetak from '$lib/komponente/KaladontCvSazetak.svelte';
  import KolekcijaRijeci from '$lib/komponente/KolekcijaRijeci.svelte';
  import Podizbornik from '$lib/komponente/Podizbornik.svelte';
  import { PRAGOVI_DULJINE, vratiVeciRang, type AvatarConfigV1, type BrojacDostignuca, type DnkProfil, type KaladontCvDto } from 'zajednicko';

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
    avatarConfig: AvatarConfigV1 | null;
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
    dnk: {
      cetiriIgraca: DnkProfil & { metrike: DnkMetrike };
      dvaIgraca: DnkProfil & { metrike: DnkMetrike };
    };
    forma: { cetiriIgraca: FormaProfil; dvaIgraca: FormaProfil };
    prosjecnaOcjenaIgre: number | null;
    iskustvo: { razina: number; ukupno: number; uRazini: number; doIduce: number | null };
    stilIgre: 'agresivan' | 'uravnotežen' | 'pacifist' | 'neodređen';
    statistikaRijeci: StatistikaRijeci | null;
    kaladontCv: KaladontCvDto | null;
    ciljeviRijeci: { rijetke: { ukupno: number }; duge: { ukupno: number } };
    dostignuca: { ukupnoZvjezdica: number; maksimalnoZvjezdica: number; ukupnoOtkljucanih: number; dostignuca: Dostignuce[] };
  }

  interface DnkMetrike {
    eliminacijePoPartiji: number;
    nizPrihvacenihRijeci: number;
    prosjekPrihvacenogPotezaMs: number;
    dugeRijeciPoPartiji: number;
    rijetkeRijeciPoPartiji: number;
  }

  interface FormaProfil {
    status: 'nema_podataka' | 'prikupljanje' | 'pocetna_procjena' | 'puna_procjena';
    naziv: string | null;
    razina: number | null;
    vrijednost: number | null;
    brojPobjeda: number;
    brojPartija: number;
    trend: { smjer: 'gore' | 'dolje' | 'isto'; razlika: number; prethodnaVrijednost: number } | null;
    rezultati: { partijaId: string; kraj: string; plasman: number; bodovi: number; eliminacije: number }[];
    trenutniNiz: number;
    najboljiNiz: number;
    razinaVatre: 0 | 1 | 2 | 3;
    sljedeciBonusPostotak: number;
  }

  interface Dostignuce {
    id: string;
    naziv: string;
    opis: string;
    kategorija: 'napredak' | 'rijeci' | 'vjestina' | 'kaladont' | 'igra';
    pragovi: readonly number[];
    vrijediUPrivatnoj: boolean;
    brojac: BrojacDostignuca;
    razina: number;
    vrijednost: number;
    sljedeciPrag: number | null;
    novo?: boolean;
  }

  let profil = $state<Profil | null>(null);
  let greska = $state<string | null>(null);
  let aktivniTab = $state<'4p' | '1v1'>('1v1');
  let otvoreniPopup = $state<'duge' | 'rijetke' | null>(null);
  let rijeciPoKategoriji = $state<Record<string, string[]>>({});
  let ucitavanjeRijeci = $state(false);
  let aktivniPogled = $state<'statistika' | 'dostignuca' | 'rijeci' | 'povijest'>('statistika');
  let velicinaAvatara = $state(216);
  const prikazujePostavke = $derived($page.url.searchParams.get('tab') === 'postavke');

  onMount(() => {
    const prilagodiAvatar = () => {
      velicinaAvatara = window.innerWidth < 768 ? 160 : 248;
    };
    prilagodiAvatar();
    window.addEventListener('resize', prilagodiAvatar);
    void (async () => {
      try {
        profil = await api<Profil>('/profil');
        if (profil) {
          if (window.location.hash === '#statistika') {
            await tick();
            document.getElementById('statistika')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      } catch (e) {
        greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profila.';
      }
    })();
    return () => window.removeEventListener('resize', prilagodiAvatar);
  });

  function listaRijeci(kategorija: string): string[] {
    return rijeciPoKategoriji[kategorija] ?? [];
  }

  async function otvoriPopup(vrsta: 'duge' | 'rijetke'): Promise<void> {
    otvoreniPopup = vrsta;
    if (ucitavanjeRijeci || Object.keys(rijeciPoKategoriji).length > 0) return;
    ucitavanjeRijeci = true;
    const kategorije = vrsta === 'duge'
      ? ['jakoDuge', 'srednjeDuge', 'duge']
      : ['jakoRijetke', 'srednjeRijetke', 'rijetke'];
    try {
      const rezultati = await Promise.all(kategorije.map((kategorija) => api<{ rijeci: string[] }>(`/profil/rijeci?kategorija=${kategorija}&limit=50`)));
      rijeciPoKategoriji = Object.fromEntries(kategorije.map((kategorija, indeks) => [kategorija, rezultati[indeks]!.rijeci]));
    } finally {
      ucitavanjeRijeci = false;
    }
  }

</script>

<svelte:head>
  <title>Profil | Kaladont</title>
</svelte:head>

<main class="profil-stranica">
  {#if greska}
    <p role="alert" class="greska">{greska}</p>
  {:else if profil}
    {@const jeGost = !profil.email}

    <div class:ima-cv={!prikazujePostavke} class="profil-zaglavlje-red">
      <div class:postavke-aktivne={prikazujePostavke} class="zaglavlje-profila">
        <a class="avatar-uredivanje" href="/profil/avatar" aria-label="Uredi avatar">
          <Avatar
            avatarId={profil.avatarId}
            avatarConfig={profil.avatarConfig}
            rang={vratiVeciRang(profil.rang, profil.rang1v1)}
            gost={jeGost}
            velicina={velicinaAvatara}
            razinaVatre={aktivniTab === '4p' ? profil.forma.cetiriIgraca.razinaVatre : profil.forma.dvaIgraca.razinaVatre}
            nizPobjeda={aktivniTab === '4p' ? profil.forma.cetiriIgraca.trenutniNiz : profil.forma.dvaIgraca.trenutniNiz}
          />
          <span class="ikona-uredi" aria-hidden="true">✎</span>
        </a>
        <div class="info-profila">
          <h1>{profil.nadimak}</h1>
          <span class="rang-oznaka">
             {vratiVeciRang(profil.rang, profil.rang1v1) ?? 'Piskaralo'}
          </span>
          <div class="iskustvo-profila">
            <strong>LVL {profil.iskustvo.razina}</strong>
            {#if profil.iskustvo.doIduce === null}
              <span>MAX</span>
            {:else}
              <span>{profil.iskustvo.uRazini} / {profil.iskustvo.doIduce} XP</span>
              <div class="traka-iskustva" aria-label={`Napredak do sljedeće razine: ${profil.iskustvo.uRazini} od ${profil.iskustvo.doIduce} XP`}>
                <span style={`width: ${(profil.iskustvo.uRazini / profil.iskustvo.doIduce) * 100}%`}></span>
              </div>
            {/if}
          </div>
          <p class="stil-igre">Stil igre: <strong>{profil.stilIgre}</strong></p>
          {#if profil.prosjecnaOcjenaIgre !== null}
            {@const ocjena = Math.round(profil.prosjecnaOcjenaIgre)}
            <p class="ocjena-igre">Prosječna ocjena: <span class="ocjena-zvjezdice" aria-label={`Prosječna ocjena ${ocjena} od 5`}>
              {#each Array.from({ length: 5 }, (_, i) => i < ocjena) as jeIspunjena}
                <span class:ispunjena={jeIspunjena} class:neispunjena={!jeIspunjena}>{jeIspunjena ? '★' : '☆'}</span>
              {/each}
            </span></p>
          {/if}
        </div>
      </div>
      {#if !prikazujePostavke}
        <KaladontCvSazetak
          cv={profil.kaladontCv}
          gost={jeGost}
        />
      {/if}
    </div>

    {#if prikazujePostavke}
      <PostavkeProfila />
    {:else}
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

    <nav class="pogled-tabovi" aria-label="Sadržaj profila">
      <button type="button" class:aktivan={aktivniPogled === 'statistika'} onclick={() => (aktivniPogled = 'statistika')}>Statistika</button>
      <button type="button" class:aktivan={aktivniPogled === 'dostignuca'} onclick={() => (aktivniPogled = 'dostignuca')}>Dostignuća</button>
      <button type="button" class:aktivan={aktivniPogled === 'rijeci'} onclick={() => (aktivniPogled = 'rijeci')}>Kolekcija riječi</button>
      <button type="button" class:aktivan={aktivniPogled === 'povijest'} onclick={() => (aktivniPogled = 'povijest')}>Aktivnost</button>
    </nav>

    {#if aktivniPogled === 'statistika'}
      <Podizbornik
        stavke={[{ kljuc: '1v1', naziv: '2 igrača' }, { kljuc: '4p', naziv: '4 igrača' }]}
        aktivna={aktivniTab}
        ariaLabel="Način igre"
        promijeni={(kljuc) => (aktivniTab = kljuc as '4p' | '1v1')}
      />
    {/if}

    {#if aktivniPogled === 'statistika' && aktivniTab === '4p'}
      <section id="statistika" class="statistika-sekcija">
        <h2>Statistika (4 igrača)</h2>
        <div class="mrezica-kartica">
          <div class="stat-kartica">
            <span class="stat-broj">{profil.odigrane}</span>
            <span class="stat-naziv">Odigrane igre</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.pobjede}</span>
            <span class="stat-naziv">Pobjede</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.prosjekBodova.toFixed(2)}</span>
            <span class="stat-naziv">Prosjek bodova</span>
          </div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.cetiriIgraca.metrike.eliminacijePoPartiji.toFixed(2)}</span><span class="stat-naziv">Eliminacije po partiji</span></div>
        </div>
        <KaladontDnkGraf profil={profil.dnk.cetiriIgraca} naslov="Tvoj Kaladont DNK za 4 igrača" />
        <FormaIgraca forma={profil.forma.cetiriIgraca} mod="cetiri_igraca" />
        <section class="ostalo-kartica">
          <h3>Ostalo</h3>
          <div class="mrezica-kartica">
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.cetiriIgraca.metrike.nizPrihvacenihRijeci}</span><span class="stat-naziv">Niz prihvaćenih riječi</span></div>
          <div class="stat-kartica"><span class="stat-broj">{(profil.dnk.cetiriIgraca.metrike.prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s</span><span class="stat-naziv">Prosjek prihvaćenog poteza</span></div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.cetiriIgraca.metrike.dugeRijeciPoPartiji.toFixed(2)}</span><span class="stat-naziv">Duge riječi po partiji</span></div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.cetiriIgraca.metrike.rijetkeRijeciPoPartiji.toFixed(2)}</span><span class="stat-naziv">Rijetke riječi po partiji</span></div>
          </div>
        </section>
      </section>
    {:else if aktivniPogled === 'statistika'}
      <section class="statistika-sekcija">
        <h2>Statistika (2 igrača)</h2>
        <div class="mrezica-kartica">
          <div class="stat-kartica">
            <span class="stat-broj">{profil.odigrane1v1}</span>
            <span class="stat-naziv">Odigrane igre</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.pobjede1v1}</span>
            <span class="stat-naziv">Pobjede</span>
          </div>
          <div class="stat-kartica">
            <span class="stat-broj">{profil.prosjekBodova1v1.toFixed(2)}</span>
            <span class="stat-naziv">Prosjek bodova</span>
          </div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.dvaIgraca.metrike.eliminacijePoPartiji.toFixed(2)}</span><span class="stat-naziv">Eliminacije po partiji</span></div>
        </div>
        <KaladontDnkGraf profil={profil.dnk.dvaIgraca} naslov="Tvoj Kaladont DNK za 2 igrača" />
        <FormaIgraca forma={profil.forma.dvaIgraca} mod="dva_igraca" />
        <section class="ostalo-kartica">
          <h3>Ostalo</h3>
          <div class="mrezica-kartica">
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.dvaIgraca.metrike.nizPrihvacenihRijeci}</span><span class="stat-naziv">Niz prihvaćenih riječi</span></div>
          <div class="stat-kartica"><span class="stat-broj">{(profil.dnk.dvaIgraca.metrike.prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s</span><span class="stat-naziv">Prosjek prihvaćenog poteza</span></div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.dvaIgraca.metrike.dugeRijeciPoPartiji.toFixed(2)}</span><span class="stat-naziv">Duge riječi po partiji</span></div>
          <div class="stat-kartica"><span class="stat-broj">{profil.dnk.dvaIgraca.metrike.rijetkeRijeciPoPartiji.toFixed(2)}</span><span class="stat-naziv">Rijetke riječi po partiji</span></div>
          </div>
        </section>
      </section>
    {/if}

    {#if aktivniPogled === 'dostignuca'}
      <section class="statistika-sekcija">
        <div class="dostignuca-sažetak"><strong>{profil.dostignuca.ukupnoZvjezdica} / {profil.dostignuca.maksimalnoZvjezdica} zvjezdica</strong><span>{profil.dostignuca.ukupnoOtkljucanih} otključanih dostignuća</span></div>
        <div class="dostignuca-mrezica">
          {#each profil.dostignuca.dostignuca as dostignuce (dostignuce.id)}
            <DostignuceKartica {dostignuce} />
          {/each}
        </div>
      </section>
    {:else if aktivniPogled === 'rijeci'}
      <KolekcijaRijeci igracId={profil.igracId} igracNaziv={profil.nadimak} />
    {/if}

    {#if otvoreniPopup}
      <div class="popup-pozadina" role="presentation" onclick={() => (otvoreniPopup = null)}>
        <div class="popup-rijeci" role="dialog" aria-modal="true" aria-label="Otključane riječi" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && (otvoreniPopup = null)}>
          <button class="popup-zatvori" type="button" onclick={() => (otvoreniPopup = null)} aria-label="Zatvori">×</button>
          {#if otvoreniPopup === 'duge'}
            <h2>Duge riječi</h2>
            <details open><summary>Jako duge riječi ({listaRijeci('jakoDuge').length})</summary><p class="popis-rijeci">{listaRijeci('jakoDuge').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
            <details open><summary>Srednje duge riječi ({listaRijeci('srednjeDuge').length})</summary><p class="popis-rijeci">{listaRijeci('srednjeDuge').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
            <details open><summary>Duge riječi ({listaRijeci('duge').length})</summary><p class="popis-rijeci">{listaRijeci('duge').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
          {:else}
            <h2>Rijetke riječi</h2>
            <details open><summary>Jako rijetke riječi ({listaRijeci('jakoRijetke').length})</summary><p class="popis-rijeci">{listaRijeci('jakoRijetke').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
            <details open><summary>Srednje rijetke riječi ({listaRijeci('srednjeRijetke').length})</summary><p class="popis-rijeci">{listaRijeci('srednjeRijetke').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
            <details open><summary>Rijetke riječi ({listaRijeci('rijetke').length})</summary><p class="popis-rijeci">{listaRijeci('rijetke').join(', ') || (ucitavanjeRijeci ? 'Učitavanje...' : 'Još nema otkrivenih riječi.')}</p></details>
          {/if}
        </div>
      </div>
    {/if}

    {#if aktivniPogled === 'povijest'}
    <AktivnostPartije igracId={profil.igracId} />
    {/if}
    {/if}
  {:else}
    <p>Učitavanje...</p>
  {/if}
</main>

<style>
  .profil-zaglavlje-red { display: grid; gap: 20px; min-width: 0; }

  @media (min-width: 1000px) {
    .profil-zaglavlje-red.ima-cv { grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr); align-items: start; }
    .profil-zaglavlje-red > .zaglavlje-profila { padding-right: 0; }
  }

  .profil-stranica {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .stil-igre { margin: 8px 0 0; color: var(--boja-tekst-sekundarni); font-size: 0.95rem; }
  .stil-igre strong { color: var(--boja-akcent); font-family: var(--font-naslov); font-size: 1.1rem; text-transform: capitalize; }
  .ocjena-igre { margin: 8px 0 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .ocjena-zvjezdice {
    display: inline-flex;
    align-items: center;
    gap: 0.08em;
    margin-left: 0.3rem;
    font-family: var(--font-naslov);
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.06em;
    vertical-align: middle;
  }
  .ocjena-zvjezdice .ispunjena { color: var(--boja-zuta-krema); }
  .ocjena-zvjezdice .neispunjena { color: rgb(196 170 89 / 0.45); }
  .pogled-tabovi { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
  .pogled-tabovi button { flex: 0 0 auto; padding: 9px 14px; border: 1px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .pogled-tabovi button.aktivan { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
  .dostignuca-sažetak { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .dostignuca-sažetak strong { color: var(--boja-mint); font-size: 1.25rem; }
  .dostignuca-sažetak span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .dostignuca-mrezica { display: grid; gap: 14px; }
  @media (min-width: 768px) { .dostignuca-mrezica { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

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
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding-right: 150px;
  }

  .avatar-uredivanje { position: relative; display: block; flex: 0 0 auto; color: inherit; text-decoration: none; }
  .ikona-uredi { position: absolute; right: 2px; bottom: 8px; display: grid; width: 28px; height: 28px; place-items: center; border: 2px solid white; border-radius: 50%; background: var(--boja-pozadina-primarna); color: white; font-size: 17px; line-height: 1; }
  .profil-akcije { position: absolute; top: 0; right: 0; display: flex; min-width: 112px; flex-direction: column; align-items: flex-start; gap: 8px; }
  .profil-akcija { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: none; color: var(--boja-pozadina-primarna); font: inherit; font-size: var(--tekst-sitni); font-weight: 800; text-decoration: none; cursor: pointer; }
  .odjava-akcija { color: var(--boja-akcent); }


  @media (max-width: 767px) {
    .zaglavlje-profila {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding-right: 0;
    }
    .profil-akcije { position: absolute; top: 0; right: 0; transform: none; }
  }

  .info-profila h1 {
    margin: 0;
    font-family: var(--font-naslov);
    line-height: 1.1;
  }

  .rang-oznaka {
    display: block;
    margin-top: 4px;
    color: var(--boja-akcent);
    font-family: var(--font-naslov);
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.1;
  }

  .iskustvo-profila { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; font-size: var(--tekst-mali); }
  .iskustvo-profila strong { color: var(--boja-mint); font-size: 1.35rem; }
  .traka-iskustva { width: min(220px, 100%); height: 8px; overflow: hidden; border-radius: 4px; background: #e5ddc8; }
  .traka-iskustva span { display: block; height: 100%; background: var(--boja-mint); }

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
    margin: 0 0 14px;
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

  .statistika-sekcija > .mrezica-kartica { margin-bottom: 24px; }

  .ostalo-kartica {
    margin-top: 24px;
    padding: 20px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: #fff;
    box-shadow: var(--sjena-suptilna);
  }

  .ostalo-kartica h3 {
    margin: 0 0 14px;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: var(--naslov-3);
  }

  .ostalo-kartica .stat-kartica { padding: 4px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .ostalo-kartica .stat-broj { font-size: 1.15rem; }

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
