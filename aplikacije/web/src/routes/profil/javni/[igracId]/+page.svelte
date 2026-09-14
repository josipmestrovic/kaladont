<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
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
  }

  interface JavniProfil {
    nadimak: string;
    avatarId: number;
    rang: string;
    odigrane: number;
    pobjede: number;
    bodoviUkupno: number;
    prosjekBodova: number;
    eliminacijeUkupno: number;
    statistikaRijeci: StatistikaRijeci | null;
    ciljeviRijeci: { rijetke: { ukupno: number }; duge: { ukupno: number } };
    otkljucaneRijeci: { duge: string[]; srednjeDuge: string[]; jakoDuge: string[]; rijetke: string[]; srednjeRijetke: string[]; jakoRijetke: string[] };
  }

  let profil = $state<JavniProfil | null>(null);
  let greska = $state<string | null>(null);
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
      profil = await api<JavniProfil>(`/profil/javni/${$page.params.igracId}`);
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Profil nije moguće učitati.';
    }
  });
</script>

<main class="javni-profil">
  {#if greska}
    <p role="alert">{greska}</p>
  {:else if profil}
    <header class="zaglavlje-profila">
      <Avatar avatarId={profil.avatarId} rang={profil.rang} velicina={240} />
      <div>
        <h1>{profil.nadimak}</h1>
        <p>{profil.rang} · {profil.odigrane} odigranih partija</p>
      </div>
    </header>

    <section class="statistika-sekcija">
      <h2>Rezultati</h2>
      <div class="mrezica-kartica">
        <div class="stat-kartica"><strong>{profil.pobjede}</strong><span>Pobjede</span></div>
        <div class="stat-kartica"><strong>{profil.bodoviUkupno}</strong><span>Ukupno bodova</span></div>
        <div class="stat-kartica"><strong>{profil.prosjekBodova.toFixed(2)}</strong><span>Prosjek bodova</span></div>
        <div class="stat-kartica"><strong>{profil.eliminacijeUkupno}</strong><span>Eliminacije</span></div>
      </div>
    </section>

    {#if profil.statistikaRijeci}
      {@const statistika = profil.statistikaRijeci}
      <section class="statistika-sekcija">
        <h2>Riječi i streak</h2>
        <div class="mrezica-kartica achievement-mrezica">
            <div class="achievement-polje"><h3>Duge riječi</h3><strong class="napredak-broj">{Math.min(statistika.upisaneDugeRijeci + statistika.upisaneSrednjeDugeRijeci + statistika.upisaneJakoDugeRijeci, profil.ciljeviRijeci.duge.ukupno)} / {profil.ciljeviRijeci.duge.ukupno}</strong><div class="tier-retci"><span>Duge (10–11 slova): <strong>{statistika.upisaneDugeRijeci}</strong></span><span>Srednje duge (12–14 slova): <strong>{statistika.upisaneSrednjeDugeRijeci}</strong></span><span>Jako duge (15+ slova): <strong>{statistika.upisaneJakoDugeRijeci}</strong></span></div><strong class="rekord-rijeci">Najduža riječ: {statistika.najduzaRijec ?? '—'}</strong><button class="otkljucane-link" type="button" onclick={() => (otvoreniPopup = 'duge')}>Vidi otkrivene riječi →</button></div>
            <div class="achievement-polje"><h3>Rijetke riječi</h3><strong class="napredak-broj">{Math.min(statistika.otkriveneJakoRijetkeGrupe + statistika.otkriveneSrednjeRijetkeGrupe + statistika.otkriveneRijetkeGrupe, profil.ciljeviRijeci.rijetke.ukupno)} / {profil.ciljeviRijeci.rijetke.ukupno}</strong><div class="tier-retci"><span>Rijetke: <strong>{statistika.otkriveneRijetkeGrupe}</strong></span><span>Srednje rijetke: <strong>{statistika.otkriveneSrednjeRijetkeGrupe}</strong></span><span>Jako rijetke: <strong>{statistika.otkriveneJakoRijetkeGrupe}</strong></span></div><strong class="rekord-rijeci">Najrjeđa riječ: {statistika.najrjedaRijec ?? '—'}</strong><button class="otkljucane-link" type="button" onclick={() => (otvoreniPopup = 'rijetke')}>Vidi otkrivene riječi →</button></div>
            <div class="achievement-polje"><h3>Streak</h3><strong>{#each Array(brojVatri(statistika.najduziStreak)) as _}🔥{/each} {statistika.najduziStreak}</strong><span>Najduži niz uzastopno prihvaćenih riječi bez odbijanja</span></div>
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
  {:else}
    <p>Učitavanje profila…</p>
  {/if}
</main>

<style>
  .javni-profil {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
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
