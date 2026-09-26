<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import DostignuceKartica from '$lib/komponente/DostignuceKartica.svelte';
  import KaladontDnkGraf from '$lib/komponente/KaladontDnkGraf.svelte';
  import FormaIgraca from '$lib/komponente/FormaIgraca.svelte';
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
  }

  interface JavniProfil {
    nadimak: string;
    avatarId: number;
    avatarConfig: AvatarConfigV1 | null;
    rang: string;
    odigrane: number;
    pobjede: number;
    bodoviUkupno: number;
    prosjekBodova: number;
    eliminacijeUkupno: number;
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
    kaladontCv: KaladontCvDto;
    forma: { cetiriIgraca: FormaProfil; dvaIgraca: FormaProfil };
    prosjecnaOcjenaIgre: number | null;
    iskustvo: { razina: number; ukupno: number; uRazini: number; doIduce: number | null };
    stilIgre: 'agresivan' | 'uravnotežen' | 'pacifist' | 'neodređen';
    statistikaRijeci: StatistikaRijeci | null;
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
    id: string; naziv: string; opis: string; kategorija: 'napredak' | 'rijeci' | 'vjestina' | 'kaladont' | 'igra';
    pragovi: readonly number[]; vrijediUPrivatnoj: boolean; brojac: BrojacDostignuca; razina: number; vrijednost: number; sljedeciPrag: number | null; novo?: boolean;
  }
  let profil = $state<JavniProfil | null>(null);
  let greska = $state<string | null>(null);
  let otvoreniPopup = $state<'duge' | 'rijetke' | null>(null);
  let rijeciPoKategoriji = $state<Record<string, string[]>>({});
  let ucitavanjeRijeci = $state(false);
  let aktivniTab = $state<'4p' | '1v1'>('1v1');
  let aktivniPogled = $state<'statistika' | 'dostignuca' | 'rijeci' | 'povijest'>('statistika');
  let velicinaAvatara = $state(240);

  onMount(() => {
    const prilagodiAvatar = () => {
      velicinaAvatara = window.innerWidth < 768 ? 136 : 240;
    };
    prilagodiAvatar();
    window.addEventListener('resize', prilagodiAvatar);
    void (async () => {
      try {
        profil = await api<JavniProfil>(`/profil/javni/${$page.params.igracId}`);
      } catch (e) {
        greska = e instanceof Error ? e.message : 'Profil nije moguće učitati.';
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
      const rezultati = await Promise.all(kategorije.map((kategorija) => api<{ rijeci: string[] }>(`/profil/javni/${$page.params.igracId}/rijeci?kategorija=${kategorija}&limit=50`)));
      rijeciPoKategoriji = Object.fromEntries(kategorije.map((kategorija, indeks) => [kategorija, rezultati[indeks]!.rijeci]));
    } finally {
      ucitavanjeRijeci = false;
    }
  }
</script>

<svelte:head>
  <title>Javni profil | Kaladont</title>
</svelte:head>

<main class="javni-profil">
  {#if greska}
    <p role="alert">{greska}</p>
  {:else if profil}
    <div class:ima-cv={profil.kaladontCv !== null} class="javni-zaglavlje-red">
      <header class="zaglavlje-profila">
        <Avatar
          avatarId={profil.avatarId}
          avatarConfig={profil.avatarConfig}
          rang={vratiVeciRang(profil.rang, profil.rang1v1)}
          velicina={velicinaAvatara}
          razinaVatre={aktivniTab === '4p' ? profil.forma.cetiriIgraca.razinaVatre : profil.forma.dvaIgraca.razinaVatre}
          nizPobjeda={aktivniTab === '4p' ? profil.forma.cetiriIgraca.trenutniNiz : profil.forma.dvaIgraca.trenutniNiz}
        />
        <div>
          <h1>{profil.nadimak}</h1>
          <p class="rang-oznaka">{vratiVeciRang(profil.rang, profil.rang1v1) ?? 'Piskaralo'} · {profil.odigrane + profil.odigrane1v1} odigranih igara</p>
          <p class="iskustvo"><strong>LVL {profil.iskustvo.razina}</strong>{profil.iskustvo.doIduce === null ? ' · MAX' : ` · ${profil.iskustvo.uRazini} / ${profil.iskustvo.doIduce} XP`}</p>
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
      </header>
      <KaladontCvSazetak
        cv={profil.kaladontCv}
      />
    </div>

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
    <section class="statistika-sekcija">
      <h2>Rezultati ({aktivniTab === '4p' ? '4 igrača' : '2 igrača'})</h2>
      <div class="mrezica-kartica">
        <div class="stat-kartica"><strong>{aktivniTab === '4p' ? profil.odigrane : profil.odigrane1v1}</strong><span>Odigrane igre</span></div>
        <div class="stat-kartica"><strong>{aktivniTab === '4p' ? profil.pobjede : profil.pobjede1v1}</strong><span>Pobjede</span></div>
        <div class="stat-kartica"><strong>{(aktivniTab === '4p' ? profil.prosjekBodova : profil.prosjekBodova1v1).toFixed(2)}</strong><span>Prosjek bodova</span></div>
        <div class="stat-kartica"><strong>{(aktivniTab === '4p' ? profil.dnk.cetiriIgraca.metrike : profil.dnk.dvaIgraca.metrike).eliminacijePoPartiji.toFixed(2)}</strong><span>Eliminacije po partiji</span></div>
      </div>
      <KaladontDnkGraf
        profil={aktivniTab === '4p' ? profil.dnk.cetiriIgraca : profil.dnk.dvaIgraca}
        naslov={aktivniTab === '4p' ? 'Kaladont DNK za 4 igrača' : 'Kaladont DNK za 2 igrača'}
      />
      <FormaIgraca
        forma={aktivniTab === '4p' ? profil.forma.cetiriIgraca : profil.forma.dvaIgraca}
        mod={aktivniTab === '4p' ? 'cetiri_igraca' : 'dva_igraca'}
      />
      <section class="ostalo-kartica">
        <h3>Ostalo</h3>
        <div class="mrezica-kartica">
        <div class="stat-kartica"><strong>{(aktivniTab === '4p' ? profil.dnk.cetiriIgraca.metrike : profil.dnk.dvaIgraca.metrike).nizPrihvacenihRijeci}</strong><span>Niz prihvaćenih riječi</span></div>
        <div class="stat-kartica"><strong>{((aktivniTab === '4p' ? profil.dnk.cetiriIgraca.metrike : profil.dnk.dvaIgraca.metrike).prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s</strong><span>Prosjek prihvaćenog poteza</span></div>
        <div class="stat-kartica"><strong>{(aktivniTab === '4p' ? profil.dnk.cetiriIgraca.metrike : profil.dnk.dvaIgraca.metrike).dugeRijeciPoPartiji.toFixed(2)}</strong><span>Duge riječi po partiji</span></div>
        <div class="stat-kartica"><strong>{(aktivniTab === '4p' ? profil.dnk.cetiriIgraca.metrike : profil.dnk.dvaIgraca.metrike).rijetkeRijeciPoPartiji.toFixed(2)}</strong><span>Rijetke riječi po partiji</span></div>
        </div>
      </section>
    </section>
    {:else if aktivniPogled === 'dostignuca'}
    <section class="statistika-sekcija">
      <div class="dostignuca-sažetak"><strong>{profil.dostignuca.ukupnoZvjezdica} / {profil.dostignuca.maksimalnoZvjezdica} zvjezdica</strong><span>{profil.dostignuca.ukupnoOtkljucanih} otključanih dostignuća</span></div>
      <div class="dostignuca-mrezica">{#each profil.dostignuca.dostignuca as dostignuce (dostignuce.id)}<DostignuceKartica {dostignuce} />{/each}</div>
    </section>
    {:else if aktivniPogled === 'rijeci'}
      <KolekcijaRijeci igracId={$page.params.igracId ?? ''} igracNaziv={profil.nadimak} javni />
    {:else}
      <AktivnostPartije igracId={$page.params.igracId ?? ''} />
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
  {:else}
    <p>Učitavanje profila…</p>
  {/if}
</main>

<style>
  .javni-zaglavlje-red { display: grid; gap: 20px; min-width: 0; }
  @media (min-width: 1000px) {
    .javni-zaglavlje-red.ima-cv { grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr); align-items: start; }
  }

  .javni-profil {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
  }
  .achievement-mrezica { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .statistika-sekcija > .mrezica-kartica { margin-bottom: 24px; }
  .ostalo-kartica { margin-top: 24px; padding: 20px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fff; box-shadow: var(--sjena-suptilna); }
  .ostalo-kartica h3 { margin: 0 0 14px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: var(--naslov-3); }
  .pogled-tabovi { display: flex; gap: 8px; overflow-x: auto; }
  .pogled-tabovi button { flex: 0 0 auto; padding: 9px 14px; border: 1px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .pogled-tabovi button.aktivan { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
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
  .rang-oznaka { margin: 6px 0 0; color: var(--boja-akcent); font-family: var(--font-naslov); font-size: 1.5rem; font-weight: 800; line-height: 1.1; }
  .dostignuca-sažetak { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .dostignuca-sažetak strong { color: var(--boja-mint); font-size: 1.25rem; }
  .dostignuca-sažetak span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .dostignuca-mrezica { display: grid; gap: 14px; }
  @media (min-width: 768px) { .dostignuca-mrezica { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .mod-tabovi { display: flex; gap: 10px; margin: 0 0 14px; }
  .mod-tabovi button { padding: 8px 18px; border: 2px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 600; cursor: pointer; }
  .mod-tabovi button.aktivan { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
  .ostalo-kartica { margin-top: 24px; padding: 20px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fff; box-shadow: var(--sjena-suptilna); }
  .ostalo-kartica h3 { margin: 0 0 14px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: var(--naslov-3); }
  .ostalo-kartica .stat-kartica { padding: 4px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .ostalo-kartica .stat-kartica strong { font-size: 1.15rem; }
  .iskustvo strong { color: var(--boja-mint); font-size: 1.35rem; }
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
  .achievement-polje > .napredak-broj { position: absolute; top: 16px; right: 16px; font-size: 1rem; white-space: nowrap; }
  .achievement-polje strong { font-size: 1.25rem; }
  .achievement-polje .napredak-broj { font-size: 1.2rem; }
  .achievement-polje span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .otkljucane-link { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--boja-mint); font: inherit; font-size: var(--tekst-mali); font-weight: 700; cursor: pointer; }
  .popup-pozadina { position: fixed; z-index: 200; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(26 24 21 / 42%); }
  .popup-rijeci { position: relative; width: min(640px, 100%); max-height: min(80vh, 720px); overflow: auto; padding: 24px; border-radius: 12px; background: var(--boja-krem); box-shadow: 0 12px 40px rgb(0 0 0 / 24%); }
  .popup-rijeci h2 { margin-top: 0; }
  .popup-zatvori { position: absolute; top: 12px; right: 16px; border: 0; background: none; font-size: 28px; cursor: pointer; }
  .popup-rijeci details { padding: 12px 0; border-top: 1px solid #e5ddc8; }
  .popup-rijeci summary { cursor: pointer; font-weight: 700; }
  .popis-rijeci { line-height: 1.7; color: var(--boja-tekst-sekundarni); }
  .tier-retci { display: flex; flex-direction: column; gap: 4px; }
  .tier-retci span { display: flex; justify-content: space-between; gap: 12px; }
  .rekord-rijeci { display: block; margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--boja-isticanje-slova); color: var(--boja-tekst-osnovni) !important; font-size: var(--tekst-baza) !important; }

  @media (max-width: 999px) {
    .mrezica-kartica.achievement-mrezica { grid-template-columns: 1fr; }
  }
  .zaglavlje-profila {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  @media (max-width: 767px) { .zaglavlje-profila { flex-direction: column; align-items: flex-start; gap: 12px; } }
  h1, h2 { font-family: var(--font-naslov); }
  h1 { margin: 0; }
  h2 { margin: 0 0 12px; }
  .zaglavlje-profila p { margin: 4px 0 0; color: var(--boja-tekst-sekundarni); }
  .mrezica-kartica {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .stat-kartica {
    display: flex;
    min-height: 76px;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 12px;
    border: 1px solid #e5ddc8;
    border-radius: 8px;
    background: white;
  }
  .stat-kartica strong { font-size: 1.25rem; }
  .stat-kartica span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
</style>
