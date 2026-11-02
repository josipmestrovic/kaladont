<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw, RotateCcw, Save } from 'lucide-svelte';
  import { api } from '$lib/api.js';

  type Raspon = [number, number];
  interface Postavke {
    verzija: number;
    pragFrekvencije: { uobicajena: number; srednja: number };
    marginaRokaMs: number;
    vjerojatnostOstavljanjaKa: number;
    vjerojatnostPropustaKa: number;
    vjerojatnostNeznanjaPoSudjelovanju: number;
    vjerojatnostIzostankaPoSudjelovanju: number;
    treningRazmisljanjeMinMs: number;
    treningRazmisljanjeMaksMs: number;
    brziRazvoj: boolean;
    udioBrzih: number;
    udioUobicajenih: number;
    rasponBrzih: Raspon;
    rasponUobicajenih: Raspon;
    rasponSporih: Raspon;
    rasponPotezaIzostanka: Raspon;
    rasponTeskogPotezaNeznanja: Raspon;
    odstupanjaPopuneMs: { dva_igraca: [number]; cetiri_igraca: [number, number, number] };
    pragoviPopuneMs: { dva_igraca: [number]; cetiri_igraca: [number, number, number] };
    treningOmogucen: boolean;
    botoviDvoboj: boolean;
    botoviCetveroboj: boolean;
    treningUpozorenjeNeaktivnostiMs: number;
    treningZatvaranjeNeaktivnostiMs: number;
    udioImenica: number;
    skalaLogFrekvencije: number;
    ponderDuljinePoGrafemu: number;
    koeficijentTempaMin: number;
    koeficijentTempaMaks: number;
    korekcijaDuljinePoGrafemu: number;
    maksimalnaKorekcijaDuljine: number;
    korekcijaRijetkosti: number;
    korekcijaTeskogPrefiksa: number;
    minimalniUdioPoteza: number;
    maksimalniUdioPoteza: number;
    maksimalnoAktivnihBotova: number;
    maksimalnoOporavakaBota: number;
    odmaciOporavkaBotaMs: number[];
    pokusajiOsvjezavanjaProfila: number;
    odmakOsvjezavanjaProfilaMs: number;
    brojNedavnihProtivnika: number;
    vijekNedavnihProtivnikaMs: number;
    maksimalnoZapisaProtivnika: number;
    odmaciPonovnogPokretanjaRedaMs: number[];
  }
  interface Zapis { revizija: number; konfiguracija: Postavke; azurirano: string | null; azuriraoId: string | null; zadano: Postavke; brziRazvojDopusten: boolean; }
  interface Plan { vrsta: string | null; izvrsitiUMs: number | null; istekPotezaMs: number | null; }
  interface Bot {
    igracId: string; kljucSeeda: string | null; nadimak: string; tip: 'imenovani' | 'gost'; aktivan: boolean; profilAktualan: boolean; greskaProfila: boolean;
    osvjezavanjeUTijeku: boolean; status: string; zadnjaAktivnostMs: number | null; stanjeOdMs: number | null;
    dovrsavaPrijeDeaktivacije: boolean; rezervacija: { generacija: number; stanje: string; grupaId: string; rezerviranoU: number; stanjeOd: number } | null;
    igra: { partijaId: string; mod: string; kontekst: string; pocetakPartijeMs: number; aktivan: boolean; naPotezu: boolean } | null; plan: Plan | null;
    greska: { broj: number; posljednja: string; vrijemeMs: number } | null;
  }
  interface Pregled { vrijemeIso: string; revizijaPostavki: number; fond: { ukupno: number; slobodni: number; rezervirani: number; uPartiji: number; iscrpljenja: number }; botovi: Bot[]; }

  let tab = $state<'postavke' | 'pregled'>('postavke');
  let zapis = $state<Zapis | null>(null);
  let nacrt = $state<Postavke | null>(null);
  let pregled = $state<Pregled | null>(null);
  let greska = $state<string | null>(null);
  let poruka = $state<string | null>(null);
  let ucitavanje = $state(false);
  let spremanje = $state(false);
  let stvaranje = $state(false);
  let tipNovogBota = $state<'imenovani' | 'gost'>('imenovani');
  let brojNovihBotova = $state(1);
  let filterStatus = $state('sve');
  let filterTip = $state('sve');
  let filterMod = $state('sve');
  let pretragaBota = $state('');
  let sortiranjeBotova = $state<'noviji' | 'stariji'>('noviji');
  let izmjeneAktivacije = $state<Set<string>>(new Set());
  let aktivan = true;
  let sada = $state(Date.now());
  const postotak = (vrijednost: number) => `${(vrijednost * 100).toLocaleString('hr-HR', { maximumFractionDigits: 2 })} %`;
  const datum = (vrijednost: number | string | null) => vrijednost === null ? 'Nije dostupno' : new Date(vrijednost).toLocaleString('hr-HR');
  const sekunde = (ms: number | null) => ms === null ? 'Nije planirano' : `${Math.max(0, (ms - sada) / 1000).toFixed(1)} s`;
  const trajanje = (ms: number | null) => ms === null ? '—' : `${Math.floor(Math.max(0, sada - ms) / 60_000)} min`;
  const kopija = (postavke: Postavke) => structuredClone(postavke);
  const pregledZastario = $derived(!pregled || sada - Date.parse(pregled.vrijemeIso) > 10_000);
  const promjenePostavki = $derived(nacrt && zapis
    ? (Object.keys(nacrt) as (keyof Postavke)[]).filter((kljuc) => JSON.stringify(nacrt?.[kljuc]) !== JSON.stringify(zapis?.konfiguracija[kljuc])).map((kljuc) => ({ kljuc, prije: zapis!.konfiguracija[kljuc], poslije: nacrt![kljuc] }))
    : []);
  const filtriraniBotovi = $derived((pregled?.botovi ?? [])
    .filter((bot) => filterStatus === 'sve' || bot.status === filterStatus)
    .filter((bot) => filterTip === 'sve' || bot.tip === filterTip)
    .filter((bot) => filterMod === 'sve' || bot.igra?.mod === filterMod)
    .filter((bot) => !pretragaBota.trim() || `${bot.nadimak} ${bot.kljucSeeda ?? ''} ${bot.igracId} ${bot.igra?.partijaId ?? ''}`.toLocaleLowerCase('hr-HR').includes(pretragaBota.trim().toLocaleLowerCase('hr-HR')))
    .sort((a, b) => sortiranjeBotova === 'noviji' ? (b.zadnjaAktivnostMs ?? 0) - (a.zadnjaAktivnostMs ?? 0) : (a.zadnjaAktivnostMs ?? 0) - (b.zadnjaAktivnostMs ?? 0)));

  async function ucitajPostavke() {
    try {
      const odgovor = await api<Zapis>('/admin/botovi/postavke');
      if (!aktivan) return;
      zapis = odgovor;
      nacrt = kopija(odgovor.konfiguracija);
      greska = null;
    } catch (pogreska) { if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Postavke botova nisu dostupne.'; }
  }

  async function ucitajPregled() {
    if (ucitavanje || !aktivan || document.hidden) return;
    ucitavanje = true;
    try {
      const odgovor = await api<Pregled>('/admin/botovi/pregled');
      if (aktivan) { pregled = odgovor; greska = null; }
    } catch (pogreska) { if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Živi pregled nije dostupan.'; }
    finally { if (aktivan) ucitavanje = false; }
  }

  async function spremi() {
    if (!zapis || !nacrt || spremanje) return;
    spremanje = true;
    greska = null;
    poruka = null;
    try {
      const odgovor = await api<Zapis>('/admin/botovi/postavke', {
        method: 'PUT',
        body: JSON.stringify({ revizija: zapis.revizija, konfiguracija: nacrt }),
      });
      if (!aktivan) return;
      zapis = odgovor;
      nacrt = kopija(odgovor.konfiguracija);
      poruka = `Spremljena revizija ${odgovor.revizija}. Nove postavke vrijede za nove partije i epizode reda.`;
    } catch (pogreska) { if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Spremanje nije uspjelo.'; }
    finally { if (aktivan) spremanje = false; }
  }

  function vratiZadane() {
    if (zapis) nacrt = kopija(zapis.zadano);
    poruka = 'Prikazane su zadane vrijednosti. Klikni „Spremi postavke” da ih primijeniš.';
  }

  async function promijeniAktivacijuBota(bot: Bot) {
    if (izmjeneAktivacije.has(bot.igracId)) return;
    izmjeneAktivacije = new Set(izmjeneAktivacije).add(bot.igracId);
    greska = null;
    poruka = null;
    try {
      const odgovor = await api<{ aktivan: boolean; dovrsavaIgru: boolean }>(`/admin/botovi/${encodeURIComponent(bot.igracId)}/aktivacija`, {
        method: 'PUT',
        body: JSON.stringify({ aktivan: !bot.aktivan }),
      });
      if (!aktivan) return;
      poruka = odgovor.dovrsavaIgru ? 'Bot je deaktiviran za nove rezervacije i dovršit će aktivnu partiju.' : `Bot je ${odgovor.aktivan ? 'aktiviran' : 'deaktiviran'}.`;
      await ucitajPregled();
    } catch (pogreska) { if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Promjena aktivacije nije uspjela.'; }
    finally {
      if (aktivan) {
        const nove = new Set(izmjeneAktivacije);
        nove.delete(bot.igracId);
        izmjeneAktivacije = nove;
      }
    }
  }

  async function stvoriBotove() {
    if (stvaranje) return;
    stvaranje = true;
    greska = null;
    poruka = null;
    try {
      const odgovor = await api<{ stvoreno: { nadimak: string; tip: 'imenovani' | 'gost' }[]; aktivnoPoslije: number }>('/admin/botovi', {
        method: 'POST',
        body: JSON.stringify({ broj: brojNovihBotova, tip: tipNovogBota }),
      });
      if (!aktivan) return;
      poruka = `Stvoreno ${odgovor.stvoreno.length} ${tipNovogBota === 'gost' ? 'botova prikazanih kao Gost' : 'imenovanih botova'}. Aktivnih ukupno: ${odgovor.aktivnoPoslije}.`;
      tab = 'pregled';
      await ucitajPregled();
    } catch (pogreska) { if (aktivan) greska = pogreska instanceof Error ? pogreska.message : 'Stvaranje botova nije uspjelo.'; }
    finally { if (aktivan) stvaranje = false; }
  }

  onMount(() => {
    void ucitajPostavke();
    void ucitajPregled();
    const priVidljivosti = () => { if (!document.hidden) void ucitajPregled(); };
    document.addEventListener('visibilitychange', priVidljivosti);
    const timer = setInterval(() => {
      sada = Date.now();
      if (tab === 'pregled') void ucitajPregled();
    }, 4_000);
    return () => { aktivan = false; clearInterval(timer); document.removeEventListener('visibilitychange', priVidljivosti); };
  });
</script>

<section class="botovi" aria-labelledby="botovi-naslov">
  <header class="zaglavlje">
    <div><h2 id="botovi-naslov">Botovi</h2><p>Konfiguracija, fond i trenutačna aktivnost</p></div>
    {#if tab === 'pregled'}<button class="alat" type="button" aria-label="Osvježi pregled botova" title="Osvježi pregled" onclick={() => void ucitajPregled()} disabled={ucitavanje}><RefreshCw size={18} /></button>{/if}
  </header>
  <div class="tabovi" role="tablist" aria-label="Upravljanje botovima">
    <button type="button" role="tab" aria-selected={tab === 'postavke'} class:odabran={tab === 'postavke'} onclick={() => (tab = 'postavke')}>Postavke</button>
    <button type="button" role="tab" aria-selected={tab === 'pregled'} class:odabran={tab === 'pregled'} onclick={() => { tab = 'pregled'; void ucitajPregled(); }}>Živi pregled</button>
  </div>
  {#if greska}<p class="greska" role="alert">{greska}</p>{/if}
  {#if poruka}<p class="poruka" role="status">{poruka}</p>{/if}

  {#if tab === 'postavke'}
    {#if nacrt && zapis}
      <form onsubmit={(event) => { event.preventDefault(); void spremi(); }}>
        <p class="revizija">Revizija {zapis.revizija} · zadnja promjena {datum(zapis.azurirano)} · ID administratora {zapis.azuriraoId ?? '—'}</p>
        <fieldset><legend>Uključivanje</legend>
          <label><input type="checkbox" bind:checked={nacrt.treningOmogucen} /> Zagrijavanje</label>
          <label><input type="checkbox" bind:checked={nacrt.botoviDvoboj} /> Botovi u Dvoboju</label>
          <label><input type="checkbox" bind:checked={nacrt.botoviCetveroboj} /> Botovi u Četveroboju</label>
          {#if zapis.brziRazvojDopusten}<label><input type="checkbox" bind:checked={nacrt.brziRazvoj} /> Brzi lokalni razvoj</label>{/if}
        </fieldset>
        <fieldset><legend>Javni tempo</legend>
          <div class="polja">
            <label>Brzi odgovori<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.udioBrzih} /><span>{postotak(nacrt.udioBrzih)}</span></label>
            <label>Uobičajeni odgovori<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.udioUobicajenih} /><span>{postotak(nacrt.udioUobicajenih)}</span></label>
            <label>Spori odgovori<input readonly value={postotak(Math.max(0, 1 - nacrt.udioBrzih - nacrt.udioUobicajenih))} /></label>
            <label>Brzi raspon poteza<input type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponBrzih[0]} /><input aria-label="Brzi raspon do" type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponBrzih[1]} /></label>
            <label>Uobičajeni raspon poteza<input type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponUobicajenih[0]} /><input aria-label="Uobičajeni raspon do" type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponUobicajenih[1]} /></label>
            <label>Spori raspon poteza<input type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponSporih[0]} /><input aria-label="Spori raspon do" type="number" min="0.08" max="0.85" step="0.01" bind:value={nacrt.rasponSporih[1]} /></label>
            <label>Trening odgovor min. (ms)<input type="number" min="100" max="30000" step="100" bind:value={nacrt.treningRazmisljanjeMinMs} /></label>
            <label>Trening odgovor maks. (ms)<input type="number" min="100" max="30000" step="100" bind:value={nacrt.treningRazmisljanjeMaksMs} /></label>
            <label>Sigurnosna margina (ms)<input type="number" min="150" max="1500" step="50" bind:value={nacrt.marginaRokaMs} /></label>
            <label>Osobni tempo od<input type="number" min="0.5" max="1.5" step="0.01" bind:value={nacrt.koeficijentTempaMin} /></label>
            <label>Osobni tempo do<input type="number" min="0.5" max="1.5" step="0.01" bind:value={nacrt.koeficijentTempaMaks} /></label>
            <label>Najmanji udio poteza<input type="number" min="0.01" max="0.99" step="0.01" bind:value={nacrt.minimalniUdioPoteza} /></label>
            <label>Najveći udio poteza<input type="number" min="0.01" max="0.99" step="0.01" bind:value={nacrt.maksimalniUdioPoteza} /></label>
          </div>
        </fieldset>
        <fieldset><legend>Izbor riječi i prilike</legend>
          <div class="polja">
            <label>Uobičajena frekvencija<input type="number" min="0" max="2000000000" bind:value={nacrt.pragFrekvencije.uobicajena} /></label>
            <label>Srednja frekvencija<input type="number" min="0" max="2000000000" bind:value={nacrt.pragFrekvencije.srednja} /></label>
            <label>Udio imenica<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.udioImenica} /><span>{postotak(nacrt.udioImenica)}</span></label>
            <label>Skala log frekvencije<input type="number" min="0" max="10" step="0.1" bind:value={nacrt.skalaLogFrekvencije} /></label>
            <label>Ponder duljine po grafemu<input type="number" min="0" max="2" step="0.01" bind:value={nacrt.ponderDuljinePoGrafemu} /></label>
            <label>Korekcija duljine po grafemu<input type="number" min="0" max="0.02" step="0.001" bind:value={nacrt.korekcijaDuljinePoGrafemu} /></label>
            <label>Najveća korekcija duljine<input type="number" min="0" max="0.15" step="0.01" bind:value={nacrt.maksimalnaKorekcijaDuljine} /></label>
            <label>Korekcija rijetke riječi<input type="number" min="0" max="0.15" step="0.01" bind:value={nacrt.korekcijaRijetkosti} /></label>
            <label>Korekcija teškog prefiksa<input type="number" min="0" max="0.15" step="0.005" bind:value={nacrt.korekcijaTeskogPrefiksa} /></label>
            <label>Dobrovoljni KA<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.vjerojatnostOstavljanjaKa} /><span>{postotak(nacrt.vjerojatnostOstavljanjaKa)}</span></label>
            <label>Propust tuđeg KA<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.vjerojatnostPropustaKa} /><span>{postotak(nacrt.vjerojatnostPropustaKa)}</span></label>
            <label>Prilika „Ne znam” po sudjelovanju<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.vjerojatnostNeznanjaPoSudjelovanju} /><span>{postotak(nacrt.vjerojatnostNeznanjaPoSudjelovanju)}</span></label>
            <label>Prilika izostanka po sudjelovanju<input type="number" min="0" max="1" step="0.01" bind:value={nacrt.vjerojatnostIzostankaPoSudjelovanju} /><span>{postotak(nacrt.vjerojatnostIzostankaPoSudjelovanju)}</span></label>
            <label>Teški potez za „Ne znam” od<input type="number" min="1" max="100" bind:value={nacrt.rasponTeskogPotezaNeznanja[0]} /><input aria-label="Teški potez za ne znam do" type="number" min="1" max="100" bind:value={nacrt.rasponTeskogPotezaNeznanja[1]} /></label>
            <label>Vlastiti potez za izostanak od<input type="number" min="1" max="100" bind:value={nacrt.rasponPotezaIzostanka[0]} /><input aria-label="Vlastiti potez za izostanak do" type="number" min="1" max="100" bind:value={nacrt.rasponPotezaIzostanka[1]} /></label>
          </div>
        </fieldset>
        <fieldset><legend>Popuna javnog reda</legend>
          <div class="polja">
            <label>Dvoboj: cilj popune (ms)<input type="number" min="0" max="300000" step="1000" bind:value={nacrt.pragoviPopuneMs.dva_igraca[0]} /></label>
            <label>Dvoboj: odstupanje (ms)<input type="number" min="0" max="300000" step="1000" bind:value={nacrt.odstupanjaPopuneMs.dva_igraca[0]} /></label>
            {#each [0, 1, 2] as mjesto}
              <label>Četveroboj: bot {mjesto + 1} cilj (ms)<input type="number" min="0" max="300000" step="1000" bind:value={nacrt.pragoviPopuneMs.cetiri_igraca[mjesto]} /></label>
              <label>Četveroboj: bot {mjesto + 1} odstupanje (ms)<input type="number" min="0" max="300000" step="1000" bind:value={nacrt.odstupanjaPopuneMs.cetiri_igraca[mjesto]} /></label>
            {/each}
          </div>
        </fieldset>
        <fieldset><legend>Neaktivnost treninga</legend>
          <div class="polja">
            <label>Upozorenje nakon (ms)<input type="number" min="60000" max="86400000" step="10000" bind:value={nacrt.treningUpozorenjeNeaktivnostiMs} /></label>
            <label>Zatvaranje nakon (ms)<input type="number" min="60000" max="86400000" step="10000" bind:value={nacrt.treningZatvaranjeNeaktivnostiMs} /></label>
          </div>
        </fieldset>
        <fieldset><legend>Kapacitet, oporavak i povijest</legend>
          <div class="polja">
            <label>Maksimalno aktivnih botova<input type="number" min="1" max="100" bind:value={nacrt.maksimalnoAktivnihBotova} /></label>
            <label>Broj oporavaka naredbe<input type="number" min="0" max="2" bind:value={nacrt.maksimalnoOporavakaBota} /></label>
            <label>Odmaci oporavka prvi/drugi (ms)<input type="number" min="10" max="5000" bind:value={nacrt.odmaciOporavkaBotaMs[0]} /><input aria-label="Odmor drugog oporavka u milisekundama" type="number" min="10" max="5000" bind:value={nacrt.odmaciOporavkaBotaMs[1]} /></label>
            <label>Pokušaji osvježavanja profila<input type="number" min="1" max="10" bind:value={nacrt.pokusajiOsvjezavanjaProfila} /></label>
            <label>Osnovni odmak osvježavanja (ms)<input type="number" min="100" max="30000" step="100" bind:value={nacrt.odmakOsvjezavanjaProfilaMs} /></label>
            <label>Posljednjih različitih botova<input type="number" min="0" max="10" bind:value={nacrt.brojNedavnihProtivnika} /></label>
            <label>Trajanje povijesti protivnika (ms)<input type="number" min="60000" max="604800000" step="3600000" bind:value={nacrt.vijekNedavnihProtivnikaMs} /></label>
            <label>Najviše zapisa povijesti<input type="number" min="0" max="100000" step="1000" bind:value={nacrt.maksimalnoZapisaProtivnika} /></label>
            {#each [0, 1, 2, 3] as indeks}
              <label>Odmor neuspjelog početka {indeks + 1} (ms)<input type="number" min="100" max="60000" step="100" bind:value={nacrt.odmaciPonovnogPokretanjaRedaMs[indeks]} /></label>
            {/each}
          </div>
        </fieldset>
        {#if promjenePostavki.length > 0}
          <details class="diff"><summary>Pregled promjena ({promjenePostavki.length})</summary><p>Nove vrijednosti primjenjuju se na nove partije, redne epizode i treninge. Aktivne odluke i rokovi ostaju nepromijenjeni.</p>
            <dl>{#each promjenePostavki as promjena (promjena.kljuc)}<div><dt>{promjena.kljuc}</dt><dd><code>{JSON.stringify(promjena.prije)}</code><span aria-hidden="true"> → </span><code>{JSON.stringify(promjena.poslije)}</code></dd></div>{/each}</dl>
          </details>
        {/if}
        <div class="akcije"><button type="button" onclick={vratiZadane}><RotateCcw size={16} /> Vrati zadane</button><button type="submit" class="primarno" disabled={spremanje || promjenePostavki.length === 0}><Save size={16} />{spremanje ? 'Spremanje…' : 'Spremi postavke'}</button></div>
      </form>
    {:else}<p role="status">Učitavanje postavki…</p>{/if}
  {:else if pregled}
    <p class="revizija" class:zastario={pregledZastario}>Snimka {datum(pregled.vrijemeIso)} · {pregledZastario ? 'Zastarjelo' : 'Aktualno'} · revizija postavki {pregled.revizijaPostavki}</p>
    <dl class="fond"><div><dt>Aktivni fond</dt><dd>{pregled.fond.ukupno}</dd></div><div><dt>Slobodni</dt><dd>{pregled.fond.slobodni}</dd></div><div><dt>Rezervirani</dt><dd>{pregled.fond.rezervirani}</dd></div><div><dt>U partiji</dt><dd>{pregled.fond.uPartiji}</dd></div><div><dt>Iscrpljenja</dt><dd>{pregled.fond.iscrpljenja}</dd></div></dl>
    <form class="stvori" onsubmit={(event) => { event.preventDefault(); void stvoriBotove(); }}>
      <label>Tip računalnog protivnika<select bind:value={tipNovogBota}><option value="imenovani">Imenovani bot</option><option value="gost">Bot prikazan kao Gost</option></select></label>
      <label>Broj<input type="number" min="1" max="30" bind:value={brojNovihBotova} /></label>
      <button type="submit" disabled={stvaranje}><Save size={16} />{stvaranje ? 'Stvaranje…' : 'Stvori botove'}</button>
    </form>
    <div class="filtri" aria-label="Filtriraj botove">
      <label>Stanje<select bind:value={filterStatus}><option value="sve">Sva stanja</option><option value="slobodan">Slobodan</option><option value="rezerviran">Rezerviran</option><option value="pokretanje">Pokretanje</option><option value="izbor_rijeci">Izbor riječi</option><option value="u_partiji">U partiji</option><option value="spremanje_rezultata">Spremanje rezultata</option><option value="osvjezavanje_profila">Osvježavanje profila</option><option value="tehnicki_kvar">Tehnički kvar</option><option value="deaktiviran">Deaktiviran</option></select></label>
      <label>Tip<select bind:value={filterTip}><option value="sve">Svi tipovi</option><option value="imenovani">Imenovani</option><option value="gost">Gost</option></select></label>
      <label>Mod<select bind:value={filterMod}><option value="sve">Svi modovi</option><option value="dva_igraca">Dvoboj</option><option value="cetiri_igraca">Četveroboj</option></select></label>
      <label>Traži<input type="search" bind:value={pretragaBota} placeholder="Nadimak, ključ ili ID" /></label>
      <label>Sortiraj<select bind:value={sortiranjeBotova}><option value="noviji">Aktivnost: novija</option><option value="stariji">Aktivnost: starija</option></select></label>
      <span>{filtriraniBotovi.length} / {pregled.botovi.length}</span>
    </div>
    <div class="tablica-omot"><table><thead><tr><th>Bot</th><th>Status</th><th>Trajanje / aktivnost</th><th>Partija / mjesto</th><th>Na redu</th><th>Plan</th><th>Profil</th><th>Tehničke pogreške</th><th>Aktivacija</th></tr></thead><tbody>
      {#each filtriraniBotovi as bot (bot.igracId)}
        <tr><td data-label="Bot"><strong>{bot.tip === 'gost' ? 'Gost' : bot.nadimak}</strong><small>{bot.kljucSeeda ?? bot.igracId}</small><small>{bot.igracId}</small></td><td data-label="Status">{bot.status}{bot.dovrsavaPrijeDeaktivacije ? ' · dovršava' : ''}</td><td data-label="Trajanje / aktivnost">{trajanje(bot.stanjeOdMs)}<small>{datum(bot.zadnjaAktivnostMs)}</small></td><td data-label="Partija / mjesto">{bot.igra ? `${bot.igra.mod} · ${bot.igra.partijaId}` : bot.rezervacija ? `${bot.rezervacija.grupaId} · gen. ${bot.rezervacija.generacija}` : '—'}</td><td data-label="Na redu">{bot.igra?.naPotezu ? 'Da' : 'Ne'}</td><td data-label="Plan">{bot.plan ? `${bot.plan.vrsta ?? 'akcija'} · ${sekunde(bot.plan.izvrsitiUMs)}` : '—'}</td><td data-label="Profil">{bot.greskaProfila ? 'Pogreška' : bot.osvjezavanjeUTijeku ? 'Osvježava se' : bot.profilAktualan ? 'Aktualan' : 'Zastario'}</td><td data-label="Tehničke pogreške">{bot.greska ? `${bot.greska.broj} · ${bot.greska.posljednja}` : '—'}</td><td data-label="Aktivacija"><button type="button" disabled={izmjeneAktivacije.has(bot.igracId)} onclick={() => void promijeniAktivacijuBota(bot)}>{izmjeneAktivacije.has(bot.igracId) ? 'Spremanje…' : bot.aktivan ? 'Deaktiviraj' : 'Aktiviraj'}</button></td></tr>
      {/each}
    </tbody></table></div>
  {:else}<p role="status">Učitavanje živog pregleda…</p>{/if}
</section>

<style>
  .botovi { border-bottom: 1px solid #ddd; padding: 0 0 24px; margin: 24px 0; color: #252525; }
  .zaglavlje { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  h2 { font-size:24px; margin:16px 0 4px; }
  .zaglavlje p,.revizija { color:#666; font-size:13px; margin:0 0 16px; }
  .revizija.zastario { color:#a03020; }
  .alat { width:36px; height:36px; display:grid; place-items:center; }
  .tabovi { display:flex; gap:8px; border-bottom:1px solid #ddd; margin:16px 0; }
  button { min-height:38px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:7px 11px; border:1px solid #bbb; border-radius:4px; background:#fff; color:#252525; font:inherit; cursor:pointer; }
  button:disabled { opacity:.55; cursor:default; }
  .tabovi .odabran { border-color:#24735e; box-shadow:inset 0 -2px #24735e; }
  fieldset { margin:16px 0; padding:14px; border:1px solid #ddd; border-radius:4px; }
  legend { padding:0 6px; font-weight:700; }
  fieldset > label { display:inline-flex; align-items:center; gap:8px; margin:4px 18px 4px 0; }
  .polja { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .polja label { min-width:0; display:flex; flex-direction:column; gap:5px; font-size:13px; color:#454545; }
  input[type=number] { width:100%; min-width:0; box-sizing:border-box; min-height:36px; padding:6px 8px; border:1px solid #bbb; border-radius:4px; font:inherit; }
  label:has(input[type=number][aria-label]) { display:grid; grid-template-columns:1fr 1fr; }
  label:has(input[type=number][aria-label]) input:first-of-type { grid-column:1/-1; }
  .akcije { display:flex; justify-content:flex-end; gap:8px; }
  .primarno { background:#e5f1ed; border-color:#24735e; font-weight:700; }
  .diff { margin:16px 0; border-block:1px solid #ddd; padding:10px 0; }
  .diff summary { cursor:pointer; font-weight:700; }
  .diff p { color:#666; font-size:13px; }
  .diff dl { margin:0; }
  .diff dl div { display:grid; grid-template-columns:minmax(150px,1fr) 2fr; gap:12px; padding:8px 0; border-top:1px solid #eee; }
  .diff dd { margin:0; overflow-wrap:anywhere; }
  .diff code { white-space:pre-wrap; }
  .greska { color:#a03020; }
  .poruka { padding:10px 12px; background:#eef6f2; border-left:3px solid #24735e; }
  .fond { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin:16px 0; }
  .fond div { padding:10px 12px; background:#f5f6f5; border-radius:4px; }
  .fond dt { color:#666; font-size:12px; }
  .fond dd { margin:4px 0 0; font-size:20px; font-weight:700; }
  .stvori { display:flex; flex-wrap:wrap; align-items:end; gap:12px; margin:16px 0; padding:12px; border-block:1px solid #ddd; }
  .stvori label { display:flex; flex-direction:column; gap:5px; min-width:160px; font-size:13px; }
  .stvori input,.stvori select { min-height:36px; padding:6px 8px; border:1px solid #bbb; border-radius:4px; background:#fff; font:inherit; }
  .filtri { display:flex; flex-wrap:wrap; align-items:end; gap:10px; margin:16px 0 8px; }
  .filtri label { display:flex; flex-direction:column; gap:4px; min-width:135px; font-size:12px; color:#555; }
  .filtri input,.filtri select { min-height:34px; max-width:240px; padding:5px 7px; border:1px solid #bbb; border-radius:4px; background:#fff; font:inherit; color:#252525; }
  .filtri span { padding:8px 0; font-size:13px; color:#666; }
  .tablica-omot { width:100%; overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { padding:9px 8px; border-bottom:1px solid #e3e3e3; text-align:left; vertical-align:top; }
  th { background:#f4f5f4; }
  td small { display:block; color:#777; overflow-wrap:anywhere; }
  @media(max-width:800px) { .polja { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media(max-width:560px) {
    .polja,.fond { grid-template-columns:1fr; }
    .tablica-omot { overflow:visible; }
    table,tbody,tr,td { display:block; width:100%; box-sizing:border-box; }
    thead { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); }
    tr { padding:8px 0; border-bottom:1px solid #bbb; }
    td { display:grid; grid-template-columns:minmax(105px,35%) minmax(0,1fr); gap:8px; border:0; padding:5px 4px; overflow-wrap:anywhere; }
    td::before { content:attr(data-label); font-weight:700; color:#666; }
    .akcije { flex-wrap:wrap; }
  }
</style>