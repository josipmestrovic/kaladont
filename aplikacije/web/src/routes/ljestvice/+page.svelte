<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    formatirajOdbrojavanje,
    METRIKE_LJESTVICA,
    RAZDOBLJA_LJESTVICA,
    type MetrikaLjestvice,
    type OdgovorLjestvice,
    type PozicijaNaLjestvici,
    type PrikazLjestvice,
    type RazdobljeLjestvice,
    type RedakLjestvice,
  } from 'zajednicko';
  import { apiUrl } from '$lib/api-url.js';
  import { dohvatiAuthToken } from '$lib/identitet.js';

  type Mod = 'cetiri_igraca' | 'dva_igraca';
  type Kategorija = 'igraci' | 'rijeci';

  interface StavkaRijeci {
    mjesto: number;
    rijec: string;
    brojUpotreba: number;
  }

  const PRAVILA_BODOVANJA: Record<Mod, string> = {
    cetiri_igraca:
      'Plasman: 1. mjesto 3 boda, 2. mjesto 2, 3. mjesto 1, 4. mjesto 0. Uz to +1 za pobjedu i +1 po eliminaciji (najviše 3). Maksimum je 7 bodova po igri.',
    dva_igraca: 'Pobjednik dobiva 1 bod, poraženi 0. Eliminacije ne dodaju bodove.',
  };

  const NAZIVI_RAZDOBLJA: Record<RazdobljeLjestvice, string> = {
    dnevno: 'Dnevna',
    tjedno: 'Tjedna',
    mjesecno: 'Mjesečna',
    godisnje: 'Godišnja',
    svih_vremena: 'Svih vremena',
  };
  const OBUHVAT_RAZDOBLJA: Record<RazdobljeLjestvice, string> = {
    dnevno: 'danas',
    tjedno: 'ovaj tjedan',
    mjesecno: 'ovaj mjesec',
    godisnje: 'ove godine',
    svih_vremena: 'dosad',
  };
  const RESET_RAZDOBLJA: Record<RazdobljeLjestvice, string> = {
    dnevno: 'Reset u ponoć u 00:00.',
    tjedno: 'Reset u ponedjeljak u 00:00.',
    mjesecno: 'Reset prvog dana u mjesecu u 00:00.',
    godisnje: 'Novi poredak 1. siječnja.',
    svih_vremena: '',
  };

  const url = $derived($page.url);
  const kategorija = $derived<Kategorija>(url.searchParams.get('kategorija') === 'rijeci' ? 'rijeci' : 'igraci');
  const mod = $derived<Mod>(url.searchParams.get('mod') === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca');
  const metrika = $derived<MetrikaLjestvice>(
    (METRIKE_LJESTVICA as readonly string[]).includes(url.searchParams.get('metrika') ?? '')
      ? (url.searchParams.get('metrika') as MetrikaLjestvice)
      : 'prosjek_bodova',
  );
  const razdoblje = $derived<RazdobljeLjestvice>(
    (RAZDOBLJA_LJESTVICA as readonly string[]).includes(url.searchParams.get('razdoblje') ?? '')
      ? (url.searchParams.get('razdoblje') as RazdobljeLjestvice)
      : 'tjedno',
  );
  const prikazUrl = $derived<PrikazLjestvice>(url.searchParams.get('prikaz') === 'oko_mene' ? 'oko_mene' : 'top');

  let podaci = $state<OdgovorLjestvice | null>(null);
  let ucitava = $state(false);
  let greska = $state<string | null>(null);
  let topRijeci = $state<StavkaRijeci[]>([]);
  let ucitavaRijeci = $state(false);
  let greskaRijeci = $state(false);
  let prosirenoRijeci = $state(false);
  let pomakSataMs = 0;
  let sadaMs = $state(Date.now());
  let zadnjiZahtjev = 0;
  let osvjezenoNaKraju = '';
  let rijeciZatrazene = false;
  let prikaziBodovanje = $state(false);
  let prikaziIzjednacenje = $state(false);
  // Filtriraj ključ da pri promjeni moda/metrike/razdoblja prvo učitamo Top 10
  // (dok još ne znamo smije li „Oko mene”), pa tek onda eventualno oko mene.
  let filterKljuc = $state('');

  const mojaPozicija = $derived(podaci?.mojaPozicija ?? null);
  // Oko mene samo kad si rangiran izvan Top 10; u Top 10 si već vidiš svoj redak.
  const mozeOkoMene = $derived(
    mojaPozicija?.status === 'rangiran' && mojaPozicija.mjesto !== null && mojaPozicija.mjesto > 10,
  );
  // Stari ?prikaz=oko_mene bez potrebe prikazuje Top 10; normalizirani prikaz ide u API.
  const prikaz = $derived<PrikazLjestvice>(prikazUrl === 'oko_mene' && mozeOkoMene ? 'oko_mene' : 'top');

  function nazivMetrike(me: MetrikaLjestvice, m: Mod = mod): string {
    if (me === 'niz_pobjeda') return 'Niz pobjeda';
    return m === 'dva_igraca' ? 'Udio pobjeda' : 'Prosjek bodova';
  }

  function promijeni(izmjene: Record<string, string>) {
    const novi = new URL(url);
    for (const [kljuc, vrijednost] of Object.entries(izmjene)) novi.searchParams.set(kljuc, vrijednost);
    goto(`${novi.pathname}${novi.search}`, { noScroll: true, keepFocus: true });
  }

  async function ucitajLjestvicu(m: Mod, me: MetrikaLjestvice, r: RazdobljeLjestvice, p: PrikazLjestvice) {
    const idZahtjeva = ++zadnjiZahtjev;
    ucitava = true;
    greska = null;
    // Ne briši podaci tijekom učitavanja — inače mozeOkoMene padne na false i effect uđe u petlju top↔oko_mene.
    prikaziBodovanje = false;
    prikaziIzjednacenje = false;
    try {
      const odgovor = await fetch(apiUrl(`/ljestvice?mod=${m}&metrika=${me}&razdoblje=${r}&prikaz=${p}`), {
        headers: { authorization: `Bearer ${dohvatiAuthToken()}` },
      });
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      const tijelo = (await odgovor.json()) as OdgovorLjestvice;
      // Zastarjeli odgovor ne smije prepisati noviji odabir.
      if (idZahtjeva !== zadnjiZahtjev) return;
      pomakSataMs = new Date(tijelo.izracunatoU).getTime() - Date.now();
      podaci = tijelo;
    } catch {
      if (idZahtjeva === zadnjiZahtjev) {
        greska = 'Ljestvicu trenutno nije moguće učitati.';
        podaci = null;
      }
    } finally {
      if (idZahtjeva === zadnjiZahtjev) ucitava = false;
    }
  }

  async function ucitajRijeci(limit: 10 | 100) {
    ucitavaRijeci = true;
    greskaRijeci = false;
    try {
      const odgovor = await fetch(apiUrl(`/rijeci/top?limit=${limit}`));
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      topRijeci = ((await odgovor.json()) as { rijeci: StavkaRijeci[] }).rijeci;
      if (limit === 100) prosirenoRijeci = true;
    } catch {
      greskaRijeci = true;
    } finally {
      ucitavaRijeci = false;
    }
  }

  $effect(() => {
    if (kategorija === 'igraci') {
      const noviKljuc = `${mod}|${metrika}|${razdoblje}`;
      if (noviKljuc !== filterKljuc) {
        filterKljuc = noviKljuc;
        podaci = null;
      }
      // Normalizirani prikaz: prvo top dok ne znamo rang; drugi zahtjev samo ako je oko mene dopušteno.
      void ucitajLjestvicu(mod, metrika, razdoblje, prikaz);
    } else if (!rijeciZatrazene) {
      rijeciZatrazene = true;
      void ucitajRijeci(10);
    }
  });

  onMount(() => {
    const tik = setInterval(() => {
      sadaMs = Date.now();
    }, 1000);
    return () => clearInterval(tik);
  });

  const preostaloMs = $derived(
    podaci?.razdoblje.do ? new Date(podaci.razdoblje.do).getTime() - (sadaMs + pomakSataMs) : null,
  );

  $effect(() => {
    const kraj = podaci?.razdoblje.do;
    if (kraj && preostaloMs !== null && preostaloMs <= 0 && osvjezenoNaKraju !== kraj && kategorija === 'igraci') {
      osvjezenoNaKraju = kraj;
      void ucitajLjestvicu(mod, metrika, razdoblje, prikaz);
    }
  });

  function oblikIgre(broj: number): string {
    const zadnjeDvije = broj % 100;
    const zadnja = broj % 10;
    if (zadnja === 1 && zadnjeDvije !== 11) return 'igra';
    if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'igre';
    return 'igara';
  }

  function godinaIzIso(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zagreb', year: 'numeric' }).format(new Date(iso));
  }

  function osobniNapredak(pozicija: PozicijaNaLjestvici, me: MetrikaLjestvice): string | null {
    switch (pozicija.status) {
      case 'nedovoljan_broj_igara':
        return `Još ${pozicija.nedostajeIgara} ${oblikIgre(pozicija.nedostajeIgara ?? 0)} do poretka.`;
      case 'nema_rezultata':
        return me === 'niz_pobjeda' ? 'Za prvi niz treba ti jedna pobjeda.' : 'Još nema rezultata.';
      case 'podaci_nepotpuni':
        return 'Rezultat još nije dostupan.';
      case 'nije_igrano':
        return null;
      case 'prijava_potrebna':
        return 'Prijavi se za svoju poziciju.';
      default:
        return null;
    }
  }

  function vrijednostRetka(redak: RedakLjestvice, m: Mod, me: MetrikaLjestvice): string {
    if (redak.vrijednost.vrsta === 'niz_pobjeda') return String(redak.vrijednost.broj);
    if (m === 'dva_igraca' && me === 'prosjek_bodova') {
      return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(redak.vrijednost.prosjek * 100)} %`;
    }
    return new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(redak.vrijednost.prosjek);
  }

  const redakUlaska = $derived(
    podaci && podaci.razdoblje.stanje !== 'zakljucano'
      ? `Za ulazak treba ${podaci.minimumIgara} javnih ${oblikIgre(podaci.minimumIgara)}. ${RESET_RAZDOBLJA[razdoblje]}`.trim()
      : null,
  );
  const osobniRedak = $derived(mojaPozicija ? osobniNapredak(mojaPozicija, metrika) : null);
</script>

<svelte:head>
  <title>Ljestvice | Kaladont</title>
</svelte:head>

<h1>Ljestvice</h1>

<div class="tabovi" role="tablist" aria-label="Kategorija">
  <button type="button" role="tab" aria-selected={kategorija === 'igraci'} class:aktivan={kategorija === 'igraci'} onclick={() => promijeni({ kategorija: 'igraci' })}>
    Igrači
  </button>
  <button type="button" role="tab" aria-selected={kategorija === 'rijeci'} class:aktivan={kategorija === 'rijeci'} onclick={() => promijeni({ kategorija: 'rijeci' })}>
    Najčešće riječi
  </button>
</div>

{#if kategorija === 'igraci'}
  <div class="modovi" role="group" aria-label="Način igre">
    <button type="button" class="mod-gumb" aria-pressed={mod === 'cetiri_igraca'} class:aktivan={mod === 'cetiri_igraca'} onclick={() => promijeni({ mod: 'cetiri_igraca' })}>Četveroboj</button>
    <button type="button" class="mod-gumb" aria-pressed={mod === 'dva_igraca'} class:aktivan={mod === 'dva_igraca'} onclick={() => promijeni({ mod: 'dva_igraca' })}>Dvoboj</button>
  </div>

  <div class="metrike" role="group" aria-label="Ljestvica">
    {#each METRIKE_LJESTVICA as m (m)}
      <button type="button" class="metrika-gumb" aria-pressed={metrika === m} class:aktivan={metrika === m} onclick={() => promijeni({ metrika: m })}>{nazivMetrike(m)}</button>
    {/each}
  </div>

  <div class="razdoblja" role="tablist" aria-label="Razdoblje">
    {#each RAZDOBLJA_LJESTVICA as r (r)}
      <button type="button" role="tab" class="razdoblje" aria-selected={razdoblje === r} class:aktivan={razdoblje === r} onclick={() => promijeni({ razdoblje: r })}>
        {NAZIVI_RAZDOBLJA[r]}
      </button>
    {/each}
  </div>

  {#if greska}
    <div class="obavijest greska" role="alert">
      <p>{greska}</p>
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajLjestvicu(mod, metrika, razdoblje, prikaz)}>Pokušaj ponovno</button>
    </div>
  {:else if ucitava || !podaci}
    <p class="ucitavanje">Učitavanje…</p>
  {:else if podaci.razdoblje.stanje === 'zakljucano'}
    <p class="zakljucano">
      Ljestvica svih vremena stiže {podaci.razdoblje.otkljucavaSe ? godinaIzIso(podaci.razdoblje.otkljucavaSe) : godinaIzIso(podaci.svihVremenaOtkljucavaSe)}.
    </p>
  {:else}
    <div class="status-redak">
      {#if osobniRedak}
        <p class="osobni-napredak">{osobniRedak}</p>
      {/if}
      {#if razdoblje !== 'godisnje' && preostaloMs !== null}
        <p class="odbrojavanje" aria-live="off">
          Resetira se za <strong>{formatirajOdbrojavanje(preostaloMs)}</strong>
        </p>
      {/if}
    </div>

    {#if mozeOkoMene}
      <div class="prikazi" role="group" aria-label="Prikaz">
        <button type="button" class="prikaz-gumb" aria-pressed={prikaz === 'top'} class:aktivan={prikaz === 'top'} onclick={() => promijeni({ prikaz: 'top' })}>Top 10</button>
        <button type="button" class="prikaz-gumb" aria-pressed={prikaz === 'oko_mene'} class:aktivan={prikaz === 'oko_mene'} onclick={() => promijeni({ prikaz: 'oko_mene' })}>Oko mene</button>
      </div>
    {:else}
      <h2 class="naslov-tablice">Top 10</h2>
    {/if}

    {#if podaci.redci.length === 0}
      <p>Još nitko nije ušao na ovu ljestvicu. Odigraj {podaci.minimumIgara} {oblikIgre(podaci.minimumIgara)} {OBUHVAT_RAZDOBLJA[razdoblje]} i budi prvi.</p>
    {:else}
      <table class="tablica-mobilni-retci tablica-ljestvice">
        <thead>
          <tr>
            <th scope="col">Mjesto</th>
            <th scope="col">Igrač</th>
            <th scope="col">{nazivMetrike(podaci.metrika, podaci.mod)}</th>
            <th scope="col">Igre</th>
          </tr>
        </thead>
        <tbody>
          {#each podaci.redci as redak (redak.igracId)}
            <tr class:moj-redak={redak.jeJa}>
              <td data-label="Mjesto">{redak.mjesto}.</td>
              <th scope="row">
                {#if redak.jeJavanProfil}
                  <a href={`/profil/javni/${redak.igracId}`}>{redak.nadimak}</a>
                {:else}
                  {redak.nadimak}
                {/if}
                {#if redak.jeJa}<span class="oznaka-ti">Ovo si ti</span>{/if}
              </th>
              <td data-label={nazivMetrike(podaci.metrika, podaci.mod)}>{vrijednostRetka(redak, podaci.mod, podaci.metrika)}</td>
              <td data-label="Igre">{redak.odigraneIgre}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <div class="ispod-tablice">
      <button type="button" class="veza-pravila" aria-expanded={prikaziBodovanje} onclick={() => { prikaziBodovanje = !prikaziBodovanje; }}>
        {prikaziBodovanje ? 'Sakrij pravila bodovanja' : 'Pravila bodovanja'}
      </button>
      {#if prikaziBodovanje}
        <p class="sitno">{PRAVILA_BODOVANJA[mod]}</p>
      {/if}
      <button type="button" class="veza-pravila" aria-expanded={prikaziIzjednacenje} onclick={() => { prikaziIzjednacenje = !prikaziIzjednacenje; }}>
        {prikaziIzjednacenje ? 'Sakrij pravila izjednačenja' : 'Pravila izjednačenja'}
      </button>
      {#if prikaziIzjednacenje}
        <p class="sitno">Kod jednakog rezultata prednost ima igrač s više odigranih igara u ovom razdoblju. Ako je i broj igara isti, prednost ima ranije ostvaren rezultat.</p>
      {/if}
      {#if redakUlaska}
        <p class="ulazak">{redakUlaska}</p>
      {/if}
    </div>
  {/if}
{:else}
  {#if greskaRijeci}
    <div class="obavijest greska" role="alert">
      <p>Riječi trenutno nije moguće učitati.</p>
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajRijeci(10)}>Pokušaj ponovno</button>
    </div>
  {:else if ucitavaRijeci && topRijeci.length === 0}
    <p class="ucitavanje">Učitavanje…</p>
  {:else if topRijeci.length === 0}
    <p>Još nema dovoljno odigranih igara.</p>
  {:else}
    <table class="tablica-mobilni-retci tablica-rijeci" aria-busy={ucitavaRijeci}>
      <thead>
        <tr><th scope="col">Riječ</th><th scope="col">Broj ponavljanja</th></tr>
      </thead>
      <tbody>
        {#each topRijeci as stavka (stavka.mjesto)}
          <tr>
            <th scope="row">{stavka.rijec}</th>
            <td data-label="Broj ponavljanja">{stavka.brojUpotreba}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if !prosirenoRijeci}
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajRijeci(100)} disabled={ucitavaRijeci}>
        {ucitavaRijeci ? 'Učitavanje…' : 'Učitaj do 100'}
      </button>
    {/if}
  {/if}
{/if}

<style>
  .tabovi {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--boja-obrub);
  }

  .tabovi button {
    background: none;
    border: none;
    padding: 10px 4px 12px;
    cursor: pointer;
    font-size: 1.15rem;
    color: var(--boja-tekst-sekundarni);
    border-bottom: 3px solid transparent;
  }

  .tabovi button.aktivan {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
    border-bottom-color: var(--boja-isticanje-slova);
  }

  .modovi {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 8px 0 16px;
  }

  .mod-gumb {
    background: transparent;
    border: 2px solid var(--boja-tekst-osnovni);
    color: var(--boja-tekst-osnovni);
    padding: 10px 20px;
    border-radius: var(--radijus-pill);
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }

  .mod-gumb.aktivan {
    background: var(--boja-tekst-osnovni);
    color: var(--boja-pozadina, #0f2a1f);
  }

  .metrike {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 14px;
  }

  .metrika-gumb {
    background: transparent;
    border: 1px solid transparent;
    color: var(--boja-tekst-sekundarni);
    padding: 6px 12px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    cursor: pointer;
  }

  .metrika-gumb.aktivan {
    background: color-mix(in srgb, var(--boja-povrsina-2) 80%, white 20%);
    border-color: var(--boja-obrub);
    color: var(--boja-tekst-osnovni);
  }

  .razdoblja {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0 0 16px;
    border-bottom: 1px solid var(--boja-obrub);
  }

  .razdoblje {
    background: none;
    border: none;
    color: var(--boja-tekst-sekundarni);
    padding: 8px 2px 10px;
    cursor: pointer;
    font-size: var(--tekst-mali);
    border-bottom: 2px solid transparent;
  }

  .razdoblje.aktivan {
    color: var(--boja-tekst-osnovni);
    font-weight: 600;
    border-bottom-color: var(--boja-tekst-osnovni);
  }

  .status-redak {
    margin: 0 0 16px;
    font-size: var(--tekst-mali);
  }

  .status-redak p { margin: 0 0 6px; }

  .osobni-napredak {
    color: var(--boja-isticanje-tekst);
    font-weight: 600;
  }

  .ispod-tablice {
    margin-top: 16px;
    padding-bottom: 72px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    font-size: var(--tekst-mali);
  }

  .veza-pravila {
    background: none;
    border: none;
    padding: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    text-decoration: underline;
    cursor: pointer;
  }

  .sitno { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); margin: 0; }

  .ulazak {
    margin: 8px 0 0;
    color: var(--boja-tekst-sekundarni);
  }

  .odbrojavanje strong {
    font-variant-numeric: tabular-nums;
    color: var(--boja-isticanje-tekst);
  }

  .zakljucano {
    margin: 24px 0;
    font-size: 1.05rem;
  }

  .ucitavanje { margin: 24px 0; color: var(--boja-tekst-sekundarni); }

  .naslov-tablice {
    margin: 0 0 12px;
    font-size: 1.1rem;
  }

  .prikazi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 12px;
  }

  .prikaz-gumb {
    background: var(--boja-povrsina-2);
    border: 1px solid var(--boja-obrub);
    color: var(--boja-tekst-osnovni);
    padding: 6px 14px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    cursor: pointer;
  }

  .prikaz-gumb.aktivan {
    background: var(--boja-cta-pozadina);
    border-color: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font-weight: 700;
  }

  .obavijest {
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--boja-povrsina-2);
    font-size: var(--tekst-mali);
  }

  .obavijest.greska { background: var(--boja-poraz-pozadina); color: var(--boja-poraz-tekst); }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--boja-povrsina);
    border-radius: var(--radijus-kartica);
    overflow: hidden;
  }

  th {
    text-align: left;
    padding: 10px 12px;
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
    border-bottom: 1px solid var(--boja-obrub);
  }

  tbody th { padding: 10px 12px; color: var(--boja-tekst-osnovni); font-size: var(--tekst-baza); overflow-wrap: anywhere; }

  td {
    padding: 10px 12px;
    font-size: var(--tekst-baza);
    overflow-wrap: anywhere;
  }

  tbody tr:nth-child(odd) {
    background: var(--boja-povrsina-2);
  }

  tbody tr.moj-redak {
    background: var(--boja-zlato-pozadina);
    outline: 2px solid var(--boja-zlato-obrub);
    outline-offset: -2px;
  }

  .oznaka-ti {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: var(--radijus-pill);
    background: var(--boja-zlato-obrub);
    color: #1a1815;
    font-size: var(--tekst-sitni);
    font-weight: 700;
  }

  @media (max-width: 999px) {
    .tablica-ljestvice tr { display: grid; grid-template-columns: auto minmax(0, 1fr); }
    .tablica-ljestvice tbody th { align-self: center; }
    .tablica-ljestvice td:not(:first-child) { grid-column: 1 / -1; }
    .tablica-ljestvice td:first-child { align-self: center; padding-right: 12px; font-weight: 700; }
    .tablica-rijeci tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .tablica-rijeci tbody th, .tablica-rijeci td { align-self: center; }

    .razdoblja {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
    }

    .razdoblje {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--boja-obrub);
    }

    .razdoblje.aktivan {
      border-bottom-color: var(--boja-tekst-osnovni);
    }
  }

  .ucitaj-vise-gumb {
    display: block;
    margin: 16px auto 0;
    background: none;
    border: 1px solid var(--boja-obrub-jaci);
    color: var(--boja-tekst-osnovni);
    padding: 8px 24px;
    border-radius: var(--radijus-pill);
    cursor: pointer;
  }

  .ucitaj-vise-gumb:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
