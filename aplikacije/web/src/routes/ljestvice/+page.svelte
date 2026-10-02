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
    postotakPartija: number;
  }

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
  const NAZIVI_METRIKA: Record<MetrikaLjestvice, string> = {
    prosjek_bodova: 'Prosjek bodova',
    niz_pobjeda: 'Niz pobjeda',
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
      : 'dnevno',
  );
  const prikaz = $derived<PrikazLjestvice>(url.searchParams.get('prikaz') === 'oko_mene' ? 'oko_mene' : 'top');

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

  function promijeni(izmjene: Record<string, string>) {
    const novi = new URL(url);
    for (const [kljuc, vrijednost] of Object.entries(izmjene)) novi.searchParams.set(kljuc, vrijednost);
    goto(`${novi.pathname}${novi.search}`, { noScroll: true, keepFocus: true });
  }

  async function ucitajLjestvicu(m: Mod, me: MetrikaLjestvice, r: RazdobljeLjestvice, p: PrikazLjestvice) {
    const idZahtjeva = ++zadnjiZahtjev;
    ucitava = true;
    greska = null;
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
      if (idZahtjeva === zadnjiZahtjev) greska = 'Ljestvicu trenutno nije moguće učitati.';
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
    if (kategorija === 'igraci') void ucitajLjestvicu(mod, metrika, razdoblje, prikaz);
    else if (!rijeciZatrazene) {
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

  function datum(iso: string): string {
    const dijelovi = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zagreb', day: 'numeric', month: 'numeric', year: 'numeric' })
        .formatToParts(new Date(iso))
        .map((d) => [d.type, d.value]),
    );
    return `${Number(dijelovi.day)}. ${Number(dijelovi.month)}. ${dijelovi.year}.`;
  }

  function kratkiStatus(pozicija: PozicijaNaLjestvici, r: RazdobljeLjestvice): string {
    switch (pozicija.status) {
      case 'rangiran': return `Tvoja pozicija: ${pozicija.mjesto}`;
      case 'nije_igrano': return `Nije odigrano ${OBUHVAT_RAZDOBLJA[r]}`;
      case 'nedovoljan_broj_igara': return `Još ${pozicija.nedostajeIgara} ${oblikIgre(pozicija.nedostajeIgara ?? 0)} do poretka`;
      case 'nema_rezultata': return metrika === 'niz_pobjeda' ? `Još nema pobjede ${OBUHVAT_RAZDOBLJA[r]}` : 'Još nema rezultata';
      case 'podaci_nepotpuni': return 'Rezultat još nije dostupan';
      case 'zakljucano': return podaci ? `Dostupno od ${datum(podaci.svihVremenaOtkljucavaSe)}` : 'Zaključano';
      case 'prijava_potrebna': return 'Prijavi se za svoju poziciju';
    }
  }

  function opisKriterija(me: MetrikaLjestvice, minimum: number, r: RazdobljeLjestvice): string {
    const uvjet = `Za ulazak treba ${minimum} ${oblikIgre(minimum)} ${OBUHVAT_RAZDOBLJA[r] === 'dosad' ? 'ukupno' : OBUHVAT_RAZDOBLJA[r]}.`;
    return me === 'prosjek_bodova'
      ? `Poredak prema prosjeku bodova po završenoj javnoj igri. ${uvjet} Veći prosjek je bolji.`
      : `Najduži niz uzastopnih pobjeda unutar razdoblja; pobjede izvan razdoblja se ne pribrajaju, a igre se slažu redom kojim si u njih ulazio. ${uvjet} Dulji niz je bolji.`;
  }

  function vrijednostRetka(redak: RedakLjestvice): string {
    return redak.vrijednost.vrsta === 'prosjek_bodova'
      ? new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(redak.vrijednost.prosjek)
      : String(redak.vrijednost.broj);
  }

  const mojaPozicija = $derived(podaci?.mojaPozicija ?? null);
  const okoMeneNedostupno = $derived(prikaz === 'oko_mene' && mojaPozicija !== null && mojaPozicija.status !== 'rangiran');
  const pocetakNakonKalendara = $derived(
    podaci && podaci.razdoblje.od === podaci.razdoblje.podaciOd && podaci.razdoblje.vrsta !== 'svih_vremena',
  );
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
    Riječi
  </button>
</div>

{#if kategorija === 'igraci'}
  <div class="pod-tabovi" role="group" aria-label="Način igre">
    <button type="button" class="pod-tab-gumb" aria-pressed={mod === 'cetiri_igraca'} class:aktivan={mod === 'cetiri_igraca'} onclick={() => promijeni({ mod: 'cetiri_igraca' })}>Četveroboj</button>
    <button type="button" class="pod-tab-gumb" aria-pressed={mod === 'dva_igraca'} class:aktivan={mod === 'dva_igraca'} onclick={() => promijeni({ mod: 'dva_igraca' })}>Dvoboj</button>
  </div>

  <div class="pod-tabovi" role="group" aria-label="Ljestvica">
    {#each METRIKE_LJESTVICA as m (m)}
      <button type="button" class="pod-tab-gumb" aria-pressed={metrika === m} class:aktivan={metrika === m} onclick={() => promijeni({ metrika: m })}>{NAZIVI_METRIKA[m]}</button>
    {/each}
  </div>

  <div class="razdoblja" role="tablist" aria-label="Razdoblje">
    {#each RAZDOBLJA_LJESTVICA as r (r)}
      {@const pozicija = podaci?.pozicijePoRazdobljima[r]}
      <button type="button" role="tab" class="razdoblje" aria-selected={razdoblje === r} class:aktivan={razdoblje === r} onclick={() => promijeni({ razdoblje: r })}>
        <span class="naziv-razdoblja">{NAZIVI_RAZDOBLJA[r]}</span>
        <span class="status-razdoblja">{pozicija ? kratkiStatus(pozicija, r) : '…'}</span>
      </button>
    {/each}
  </div>

  {#if podaci}
    <section class="pravila" aria-label="Pravila ljestvice">
      {#if podaci.razdoblje.stanje === 'zakljucano'}
        <p><strong>Ljestvicu svih vremena otključavamo nakon prve godine javnog igranja.</strong> Dostupna od {podaci.razdoblje.otkljucavaSe ? datum(podaci.razdoblje.otkljucavaSe) : '—'}</p>
      {:else}
        <p>{opisKriterija(metrika, podaci.minimumIgara, razdoblje)}</p>
        <p>Kod jednakog rezultata prednost ima igrač s više odigranih igara u ovom razdoblju. Ako je i broj igara isti, prednost ima ranije ostvaren rezultat.</p>
        <p class="sitno">Svi rezultati odnose se na završene javne igre. Dan završava u ponoć po hrvatskom vremenu, a igra pripada danu u kojem je završila.{#if pocetakNakonKalendara} Rezultati od {datum(podaci.razdoblje.podaciOd)}{/if}</p>
        {#if preostaloMs !== null}
          <p class="odbrojavanje" aria-live="off">
            {razdoblje === 'godisnje' ? 'Zaključava se za' : 'Resetira se za'} <strong>{formatirajOdbrojavanje(preostaloMs)}</strong>
          </p>
        {/if}
      {/if}
    </section>
  {/if}

  {#if podaci?.razdoblje.stanje !== 'zakljucano'}
    <div class="pod-tabovi" role="group" aria-label="Prikaz">
      <button type="button" class="pod-tab-gumb" aria-pressed={prikaz === 'top'} class:aktivan={prikaz === 'top'} onclick={() => promijeni({ prikaz: 'top' })}>Top 10</button>
      <button type="button" class="pod-tab-gumb" aria-pressed={prikaz === 'oko_mene'} class:aktivan={prikaz === 'oko_mene'} onclick={() => promijeni({ prikaz: 'oko_mene' })}>Oko mene</button>
    </div>

    {#if okoMeneNedostupno && mojaPozicija && podaci}
      <p class="obavijest">Prikaz „Oko mene" dostupan je kad uđeš na ovu ljestvicu ({kratkiStatus(mojaPozicija, razdoblje).toLowerCase()}). Prikazujemo Top 10.</p>
    {/if}

    {#if greska}
      <div class="obavijest greska" role="alert">
        <p>{greska}</p>
        <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajLjestvicu(mod, metrika, razdoblje, prikaz)}>Pokušaj ponovno</button>
      </div>
    {:else if !podaci && ucitava}
      <p>Učitavanje…</p>
    {:else if podaci && podaci.redci.length === 0}
      <p>Još nitko nije ušao na ovu ljestvicu. Odigraj {podaci.minimumIgara} {oblikIgre(podaci.minimumIgara)} {OBUHVAT_RAZDOBLJA[razdoblje]} i budi prvi.</p>
    {:else if podaci}
      <table class="tablica-mobilni-retci tablica-ljestvice" aria-busy={ucitava}>
        <thead>
          <tr>
            <th scope="col">Mjesto</th>
            <th scope="col">Igrač</th>
            <th scope="col">{NAZIVI_METRIKA[podaci.metrika]}</th>
            <th scope="col">Odigrane igre</th>
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
              <td data-label={NAZIVI_METRIKA[podaci.metrika]}>{vrijednostRetka(redak)}</td>
              <td data-label="Odigrane igre">{redak.odigraneIgre}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
{:else}
  <p>Najčešće riječi: Top {prosirenoRijeci ? '100' : '10'} najčešće odigranih riječi u svim igrama.</p>

  {#if greskaRijeci}
    <div class="obavijest greska" role="alert">
      <p>Riječi trenutno nije moguće učitati.</p>
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajRijeci(10)}>Pokušaj ponovno</button>
    </div>
  {:else if topRijeci.length === 0 && !ucitavaRijeci}
    <p>Još nema dovoljno odigranih igara.</p>
  {:else}
    <table class="tablica-mobilni-retci tablica-rijeci">
      <thead>
        <tr><th scope="col">Mjesto</th><th scope="col">Riječ</th><th scope="col">Broj upotreba</th><th scope="col">% igara</th></tr>
      </thead>
      <tbody>
        {#each topRijeci as stavka (stavka.mjesto)}
          <tr>
            <td data-label="Mjesto">{stavka.mjesto}.</td>
            <th scope="row">{stavka.rijec}</th>
            <td data-label="Broj upotreba">{stavka.brojUpotreba}</td>
            <td data-label="% igara">{stavka.postotakPartija.toFixed(0)}%</td>
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
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--boja-obrub);
  }

  .tabovi button {
    background: none;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--tekst-baza);
    color: var(--boja-tekst-sekundarni);
    border-bottom: 2px solid transparent;
  }

  .tabovi button.aktivan {
    color: var(--boja-isticanje-tekst);
    font-weight: bold;
    border-bottom-color: var(--boja-isticanje-slova);
  }

  .pod-tabovi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }

  .pod-tab-gumb {
    background: var(--boja-povrsina-2);
    border: 1px solid var(--boja-obrub);
    color: var(--boja-tekst-osnovni);
    padding: 6px 14px;
    border-radius: var(--radijus-pill);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    cursor: pointer;
  }

  .pod-tab-gumb.aktivan {
    background: var(--boja-cta-pozadina);
    border-color: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font-weight: 700;
  }

  .razdoblja {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    margin: 12px 0;
  }

  .razdoblje {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    background: var(--boja-povrsina-2);
    border: 1px solid var(--boja-obrub);
    color: var(--boja-tekst-osnovni);
    padding: 8px 12px;
    border-radius: var(--radijus-kartica);
    cursor: pointer;
    text-align: left;
  }

  .razdoblje.aktivan {
    border-color: var(--boja-isticanje-slova);
    box-shadow: inset 0 0 0 1px var(--boja-isticanje-slova);
  }

  .naziv-razdoblja { font-weight: 700; font-size: var(--tekst-baza); }
  .status-razdoblja { font-size: var(--tekst-sitni); color: var(--boja-tekst-sekundarni); }

  .pravila {
    background: var(--boja-povrsina);
    border-radius: var(--radijus-kartica);
    padding: 8px 14px;
    margin: 12px 0;
    font-size: var(--tekst-mali);
  }

  .pravila p { margin: 6px 0; }
  .sitno { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }

  .odbrojavanje strong {
    font-variant-numeric: tabular-nums;
    color: var(--boja-isticanje-tekst);
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
    .tablica-ljestvice tr, .tablica-rijeci tr { display: grid; grid-template-columns: auto minmax(0, 1fr); }
    .tablica-ljestvice tbody th, .tablica-rijeci tbody th { align-self: center; }
    .tablica-ljestvice td:not(:first-child), .tablica-rijeci td:not(:first-child) { grid-column: 1 / -1; }
    .tablica-ljestvice td:first-child, .tablica-rijeci td:first-child { align-self: center; padding-right: 12px; font-weight: 700; }
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
