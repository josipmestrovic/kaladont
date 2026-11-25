<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    formatirajOdbrojavanje,
    grafemi,
    METRIKE_LJESTVICA,
    RAZDOBLJA_LJESTVICA,
    type MetrikaLjestvice,
    type OdgovorLjestvice,
    type OdgovorNajopasnijihRijeci,
    type PozicijaNaLjestvici,
    type RazdobljeLjestvice,
    type RedakLjestvice,
    type StavkaNajopasnijeRijeci,
  } from 'zajednicko';
  import { apiUrl } from '$lib/api-url.js';
  import { dohvatiAuthToken } from '$lib/identitet.js';
  import { putanjaBrzeIgre } from '$lib/igraj-rute.js';
  import { oblikEliminacija, oblikTroboja } from '$lib/naslovnica-ljestvice.js';
  import { osigurajProfil, stanjeProfila } from '$lib/stanje-profila.svelte.js';
  import Avatar from '$lib/komponente/Avatar.svelte';

  type Kategorija = 'igraci' | 'najopasnije';

  const NAZIVI_RAZDOBLJA: Record<RazdobljeLjestvice, string> = {
    dnevno: 'Dnevna',
    tjedno: 'Tjedna',
    mjesecno: 'Mjesečna',
    godisnje: 'Godišnja',
    svih_vremena: 'Svih vremena',
  };
  const OBUHVAT_RAZDOBLJA: Record<RazdobljeLjestvice, string> = {
    dnevno: 'dnevni',
    tjedno: 'tjedni',
    mjesecno: 'mjesečni',
    godisnje: 'godišnji',
    svih_vremena: 'ukupni',
  };

  const url = $derived($page.url);
  const kategorija = $derived<Kategorija>(
    url.searchParams.get('kategorija') === 'najopasnije' || url.searchParams.get('kategorija') === 'rijeci'
      ? 'najopasnije'
      : 'igraci',
  );
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

  let podaci = $state<OdgovorLjestvice | null>(null);
  let ucitava = $state(false);
  let greska = $state<string | null>(null);
  let najopasnije = $state<StavkaNajopasnijeRijeci[]>([]);
  let imaJosRijeci = $state(false);
  let ucitavaRijeci = $state(false);
  let greskaRijeci = $state(false);
  let prosirenoRijeci = $state(false);
  let pomakSataMs = 0;
  let sadaMs = $state(Date.now());
  let zadnjiZahtjev = 0;
  let zadnjiZahtjevRijeci = 0;
  let osvjezenoNaKraju = '';
  let prikaziPravila = $state(false);
  let zadnjiPoslaniKljuc = '';
  let rijeciZatrazene = false;

  const mojaPozicija = $derived(podaci?.mojaPozicija ?? null);
  const mojRedak = $derived(podaci?.mojRedak ?? null);
  const prikaziVlastitiIspod = $derived(
    !!mojRedak && mojRedak.mjesto > 10 && !(podaci?.redci.some((r) => r.jeJa) ?? false),
  );
  const jeGost = $derived(
    stanjeProfila.status === 'spreman' && stanjeProfila.profil?.vrsta === 'gost',
  );
  const prikaziCtaRegistracije = $derived(jeGost && mojaPozicija?.status === 'rangiran');

  function nazivMetrike(me: MetrikaLjestvice, kratko = false): string {
    if (me === 'niz_pobjeda') return kratko ? 'Niz' : 'Niz pobjeda';
    return kratko ? 'Bod.' : 'Prosjek bodova';
  }

  function promijeni(izmjene: Record<string, string>) {
    const novi = new URL(url);
    for (const [kljuc, vrijednost] of Object.entries(izmjene)) novi.searchParams.set(kljuc, vrijednost);
    if (izmjene.kategorija === 'igraci') novi.searchParams.delete('prikaz');
    goto(`${novi.pathname}${novi.search}`, { noScroll: true, keepFocus: true });
  }

  async function ucitajLjestvicu(me: MetrikaLjestvice, r: RazdobljeLjestvice) {
    const idZahtjeva = ++zadnjiZahtjev;
    ucitava = true;
    greska = null;
    prikaziPravila = false;
    try {
      const odgovor = await fetch(
        apiUrl(`/ljestvice?mod=tri_igraca&metrika=${me}&razdoblje=${r}&prikaz=top`),
        { headers: { authorization: `Bearer ${dohvatiAuthToken()}` } },
      );
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      const tijelo = (await odgovor.json()) as OdgovorLjestvice;
      if (idZahtjeva !== zadnjiZahtjev) return;
      pomakSataMs = new Date(tijelo.izracunatoU).getTime() - Date.now();
      podaci = tijelo;
    } catch {
      if (idZahtjeva === zadnjiZahtjev) greska = 'Ljestvicu trenutno nije moguće učitati.';
    } finally {
      if (idZahtjeva === zadnjiZahtjev) ucitava = false;
    }
  }

  async function ucitajNajopasnije(limit: 10 | 100) {
    const idZahtjeva = ++zadnjiZahtjevRijeci;
    ucitavaRijeci = true;
    greskaRijeci = false;
    try {
      const odgovor = await fetch(apiUrl(`/rijeci/najopasnije?limit=${limit}`));
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      const tijelo = (await odgovor.json()) as OdgovorNajopasnijihRijeci;
      if (idZahtjeva !== zadnjiZahtjevRijeci) return;
      najopasnije = tijelo.rijeci;
      imaJosRijeci = tijelo.imaJos;
      if (limit === 100) prosirenoRijeci = true;
    } catch {
      if (idZahtjeva === zadnjiZahtjevRijeci) greskaRijeci = true;
    } finally {
      if (idZahtjeva === zadnjiZahtjevRijeci) ucitavaRijeci = false;
    }
  }

  $effect(() => {
    if (kategorija === 'igraci') {
      const kljuc = `igraci|${metrika}|${razdoblje}`;
      if (kljuc === zadnjiPoslaniKljuc) return;
      zadnjiPoslaniKljuc = kljuc;
      void ucitajLjestvicu(metrika, razdoblje);
      return;
    }
    const kljuc = 'najopasnije';
    if (kljuc === zadnjiPoslaniKljuc && rijeciZatrazene) return;
    zadnjiPoslaniKljuc = kljuc;
    rijeciZatrazene = true;
    prosirenoRijeci = false;
    void ucitajNajopasnije(10);
  });

  onMount(() => {
    void osigurajProfil();
    const stariMod = url.searchParams.get('mod');
    const stariPrikaz = url.searchParams.get('prikaz');
    const staraKategorija = url.searchParams.get('kategorija');
    if (stariMod && stariMod !== 'tri_igraca' || stariPrikaz === 'oko_mene' || staraKategorija === 'rijeci') {
      const novi = new URL(url);
      novi.searchParams.set('mod', 'tri_igraca');
      novi.searchParams.delete('prikaz');
      if (staraKategorija === 'rijeci') novi.searchParams.set('kategorija', 'najopasnije');
      void goto(`${novi.pathname}${novi.search}`, { replaceState: true, noScroll: true });
    }
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
      void ucitajLjestvicu(metrika, razdoblje);
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

  function vrijednostRetka(redak: RedakLjestvice): string {
    if (redak.vrijednost.vrsta === 'niz_pobjeda') return String(redak.vrijednost.broj);
    return new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      redak.vrijednost.prosjek,
    );
  }

  function dijeloviRijeci(rijec: string): { ostatak: string; nastavak: string } {
    const dijelovi = grafemi(rijec);
    if (dijelovi.length <= 2) return { ostatak: '', nastavak: dijelovi.join('') };
    return {
      ostatak: dijelovi.slice(0, -2).join(''),
      nastavak: dijelovi.slice(-2).join(''),
    };
  }

  function udioNapretka(pozicija: PozicijaNaLjestvici): number {
    const odigrane = pozicija.odigraneIgre ?? 0;
    const minimum = Math.max(1, pozicija.minimumIgara);
    return Math.max(0, Math.min(100, (odigrane / minimum) * 100));
  }

  const prvaRijec = $derived(najopasnije[0] ?? null);
  const naslovListeRijeci = $derived(
    prosirenoRijeci ? `Top ${najopasnije.length} riječi` : 'Top 10 riječi',
  );
</script>

<svelte:head>
  <title>Ljestvice | Kaladont</title>
</svelte:head>

<h1>Ljestvice</h1>

<div class="tabovi" role="tablist" aria-label="Kategorija">
  <button
    type="button"
    role="tab"
    aria-selected={kategorija === 'igraci'}
    class:aktivan={kategorija === 'igraci'}
    onclick={() => promijeni({ kategorija: 'igraci' })}
  >
    Igrači
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={kategorija === 'najopasnije'}
    class:aktivan={kategorija === 'najopasnije'}
    onclick={() => promijeni({ kategorija: 'najopasnije' })}
  >
    Najopasnije riječi
  </button>
</div>

{#if kategorija === 'igraci'}
  <div class="metrike" role="group" aria-label="Ljestvica">
    {#each METRIKE_LJESTVICA as m (m)}
      <button
        type="button"
        class="metrika-gumb"
        aria-pressed={metrika === m}
        class:aktivan={metrika === m}
        onclick={() => promijeni({ metrika: m })}
      >
        {nazivMetrike(m)}
      </button>
    {/each}
  </div>

  <div class="razdoblja" role="tablist" aria-label="Razdoblje">
    {#each RAZDOBLJA_LJESTVICA as r (r)}
      <button
        type="button"
        role="tab"
        class="razdoblje"
        aria-selected={razdoblje === r}
        class:aktivan={razdoblje === r}
        onclick={() => promijeni({ razdoblje: r })}
      >
        {NAZIVI_RAZDOBLJA[r]}
      </button>
    {/each}
  </div>

  {#if greska}
    <div class="obavijest greska" role="alert">
      <p>{greska}</p>
      <button type="button" class="akcija-gumb" onclick={() => ucitajLjestvicu(metrika, razdoblje)}>
        Pokušaj ponovno
      </button>
    </div>
  {:else if ucitava || !podaci}
    <p class="ucitavanje">Učitavanje…</p>
  {:else if podaci.razdoblje.stanje === 'zakljucano'}
    <p class="zakljucano">
      Ljestvica svih vremena stiže {podaci.razdoblje.otkljucavaSe
        ? godinaIzIso(podaci.razdoblje.otkljucavaSe)
        : godinaIzIso(podaci.svihVremenaOtkljucavaSe)}.
    </p>
  {:else}
    {#if mojaPozicija?.status === 'rangiran' && mojRedak}
      <section class="osobna-kartica" aria-label="Tvoja pozicija">
        <p class="osobna-oznaka">Tvoja pozicija</p>
        <p class="osobna-mjesto">{mojRedak.mjesto}. mjesto</p>
        <p class="osobna-detalji">
          {nazivMetrike(podaci.metrika)}: {vrijednostRetka(mojRedak)}
          <span aria-hidden="true"> · </span>
          {mojRedak.odigraneIgre} {oblikIgre(mojRedak.odigraneIgre)}
        </p>
        {#if razdoblje !== 'godisnje' && razdoblje !== 'svih_vremena' && preostaloMs !== null}
          <p class="odbrojavanje" aria-live="off">
            Reset poretka za {formatirajOdbrojavanje(preostaloMs)}
          </p>
        {/if}
      </section>
    {:else if mojaPozicija?.status === 'nedovoljan_broj_igara' || mojaPozicija?.status === 'nije_igrano'}
      <section class="osobna-kartica napredak" aria-label="Napredak do poretka">
        <p class="osobna-mjesto">
          Još {mojaPozicija.nedostajeIgara} {oblikTroboja(mojaPozicija.nedostajeIgara ?? 0)} do poretka!
        </p>
        <div
          class="traka"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={mojaPozicija.minimumIgara}
          aria-valuenow={mojaPozicija.odigraneIgre ?? 0}
          aria-label="Napredak do ulaska u poredak"
        >
          <span class="traka-ispuna" style:width="{udioNapretka(mojaPozicija)}%"></span>
        </div>
        <p class="osobna-detalji">
          {mojaPozicija.odigraneIgre ?? 0}/{mojaPozicija.minimumIgara}
        </p>
        {#if razdoblje !== 'godisnje' && razdoblje !== 'svih_vremena' && preostaloMs !== null}
          <p class="odbrojavanje" aria-live="off">
            Reset poretka za {formatirajOdbrojavanje(preostaloMs)}
          </p>
        {/if}
      </section>
    {:else if mojaPozicija?.status === 'nema_rezultata'}
      <p class="osobni-napredak">
        {metrika === 'niz_pobjeda' ? 'Za prvi niz treba ti jedna pobjeda.' : 'Još nema rezultata.'}
      </p>
    {:else if mojaPozicija?.status === 'podaci_nepotpuni'}
      <p class="osobni-napredak">Rezultat još nije dostupan.</p>
    {:else if mojaPozicija?.status === 'prijava_potrebna'}
      <p class="osobni-napredak">Prijavi se za svoju poziciju.</p>
    {/if}

    <h2 class="naslov-tablice">Top 10 igrača</h2>

    {#if podaci.redci.length === 0}
      <div class="prazno-stanje">
        <p class="prazno-naslov">Prvo mjesto čeka na tebe!</p>
        <p>Još nitko nije ušao u {OBUHVAT_RAZDOBLJA[razdoblje]} poredak.</p>
        <a class="akcija-gumb istaknut" href={putanjaBrzeIgre()}>Odigraj brzu igru</a>
      </div>
    {:else}
      <table class="tablica-mobilni-retci tablica-ljestvice">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Igrač</th>
            <th scope="col">
              <span class="stupac-pun">{nazivMetrike(podaci.metrika)}</span>
              <span class="stupac-kratki">{nazivMetrike(podaci.metrika, true)}</span>
            </th>
            <th scope="col">Igre</th>
          </tr>
        </thead>
        <tbody>
          {#each podaci.redci as redak (redak.igracId)}
            <tr class:moj-redak={redak.jeJa} class:medalja-1={redak.mjesto === 1} class:medalja-2={redak.mjesto === 2} class:medalja-3={redak.mjesto === 3}>
              <td data-label="#">
                <span class="mjesto" aria-label="{redak.mjesto}. mjesto">{redak.mjesto}.</span>
              </td>
              <th scope="row">
                <span class="igrac-celija">
                  <Avatar
                    avatarId={redak.avatarId}
                    avatarConfig={redak.avatarConfig}
                    gost={!redak.jeJavanProfil}
                    velicina={36}
                    prikaziRangBorder={false}
                  />
                  <span class="igrac-tekst">
                    {#if redak.jeJavanProfil}
                      <a href={`/profil/javni/${redak.igracId}`}>{redak.nadimak}</a>
                    {:else}
                      <span class="nadimak">{redak.nadimak}</span>
                    {/if}
                    {#if redak.jeJa}<span class="oznaka-ti">Ovo si ti</span>{/if}
                  </span>
                </span>
              </th>
              <td data-label={nazivMetrike(podaci.metrika)}>{vrijednostRetka(redak)}</td>
              <td data-label="Igre">{redak.odigraneIgre}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if prikaziVlastitiIspod && mojRedak}
        {#if mojRedak.mjesto >= 12}
          <p class="razdjelnik" aria-hidden="true">···</p>
        {/if}
        <h3 class="naslov-vlastiti">Tvoja pozicija</h3>
        <table class="tablica-mobilni-retci tablica-ljestvice vlastiti-ispod">
          <tbody>
            <tr class="moj-redak">
              <td data-label="#">{mojRedak.mjesto}.</td>
              <th scope="row">
                <span class="igrac-celija">
                  <Avatar
                    avatarId={mojRedak.avatarId}
                    avatarConfig={mojRedak.avatarConfig}
                    gost={!mojRedak.jeJavanProfil}
                    velicina={36}
                    prikaziRangBorder={false}
                  />
                  <span class="igrac-tekst">
                    <span class="nadimak">{mojRedak.nadimak}</span>
                    <span class="oznaka-ti">Ovo si ti</span>
                  </span>
                </span>
              </th>
              <td data-label={nazivMetrike(podaci.metrika)}>{vrijednostRetka(mojRedak)}</td>
              <td data-label="Igre">{mojRedak.odigraneIgre}</td>
            </tr>
          </tbody>
        </table>
      {/if}
    {/if}

    {#if prikaziCtaRegistracije}
      <aside class="cta-gost">
        <p class="cta-gost-naslov">Sačuvaj svoje mjesto na ljestvici!</p>
        <p>Registriraj se i zadrži svoje rezultate i dosadašnji napredak.</p>
        <a class="veza-registracija" href="/registracija">Registriraj se</a>
      </aside>
    {/if}

    <div class="ispod-tablice">
      <button
        type="button"
        class="veza-pravila"
        aria-expanded={prikaziPravila}
        onclick={() => {
          prikaziPravila = !prikaziPravila;
        }}
      >
        Kako funkcioniraju ljestvice?
      </button>
      {#if prikaziPravila}
        <div class="pravila-sadrzaj">
          <p>
            Ljestvica igrača prati javni Troboj (Brza igra). Prosjek bodova i niz pobjeda računaju se
            samo iz završenih javnih igara u odabranom razdoblju.
          </p>
          <p>
            Za ulazak treba {podaci.minimumIgara} {oblikIgre(podaci.minimumIgara)}. Kod jednakog
            rezultata prednost ima igrač s više odigranih igara; ako je i broj igara isti, ranije
            ostvaren rezultat.
          </p>
          <p>
            Dnevni poredak se resetira u ponoć, tjedni u ponedjeljak, mjesečni prvog dana u mjesecu.
            Gosti i registrirani igrači ulaze pod istim pravilima.
          </p>
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <p class="uvod-rijeci desktop-uvod">
    Otkrij riječi na kojima igrači najčešće ispadaju i iskoristi ih u sljedećoj igri.
  </p>
  <p class="uvod-rijeci mobilni-uvod">Nauči riječi na kojima igrači najčešće ispadaju.</p>

  {#if greskaRijeci}
    <div class="obavijest greska" role="alert">
      <p>Najopasnije riječi trenutno nije moguće učitati.</p>
      <button type="button" class="akcija-gumb" onclick={() => ucitajNajopasnije(prosirenoRijeci ? 100 : 10)}>
        Pokušaj ponovno
      </button>
    </div>
  {:else if ucitavaRijeci && najopasnije.length === 0}
    <p class="ucitavanje">Učitavanje…</p>
  {:else if najopasnije.length === 0}
    <p>Još nema riječi s najmanje 3 eliminacije.</p>
  {:else}
    {#if prvaRijec}
      {@const dijelovi = dijeloviRijeci(prvaRijec.rijec)}
      <section class="najopasnija-kartica" aria-label="Najopasnija riječ">
        <p class="najopasnija-oznaka">
          <span class="desktop-uvod">Najopasnija riječ Kaladonta</span>
          <span class="mobilni-uvod">Najopasnija riječ</span>
        </p>
        <div class="najopasnija-red">
          <p class="najopasnija-rijec">
            <span>{dijelovi.ostatak}</span><span class="nastavak">{dijelovi.nastavak}</span>
          </p>
          <p class="najopasnija-broj">
            <strong>{prvaRijec.brojEliminacija}</strong>
            <span>{oblikEliminacija(prvaRijec.brojEliminacija)}</span>
          </p>
        </div>
        <p class="najopasnija-opis">Riječ na kojoj su igrači najviše puta ispali.</p>
      </section>
    {/if}

    <h2 class="naslov-tablice">{naslovListeRijeci}</h2>
    <table class="tablica-mobilni-retci tablica-rijeci" aria-busy={ucitavaRijeci}>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Riječ</th>
          <th scope="col">Eliminacije</th>
        </tr>
      </thead>
      <tbody>
        {#each najopasnije as stavka (stavka.mjesto)}
          {@const dijelovi = dijeloviRijeci(stavka.rijec)}
          <tr>
            <td data-label="#">{stavka.mjesto}.</td>
            <th scope="row">
              <span>{dijelovi.ostatak}</span><span class="nastavak">{dijelovi.nastavak}</span>
            </th>
            <td data-label="Eliminacije">{stavka.brojEliminacija}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if !prosirenoRijeci && imaJosRijeci}
      <button
        type="button"
        class="akcija-gumb"
        onclick={() => ucitajNajopasnije(100)}
        disabled={ucitavaRijeci}
      >
        {ucitavaRijeci ? 'Učitavanje…' : 'Prikaži sve'}
      </button>
    {/if}
    <p class="fusnota">Na ljestvici su riječi koje su uzrokovale najmanje 3 eliminacije.</p>
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

  .osobna-kartica {
    margin: 0 0 18px;
    padding: 14px 16px;
    border-radius: var(--radijus-kartica, 12px);
    background: color-mix(in srgb, var(--boja-povrsina-2) 88%, black 12%);
    border: 1px solid var(--boja-obrub);
  }

  .osobna-oznaka {
    margin: 0 0 4px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    font-weight: 600;
  }

  .osobna-mjesto {
    margin: 0;
    color: var(--boja-isticanje-tekst);
    font-size: 1.35rem;
    font-weight: 800;
  }

  .osobna-detalji,
  .odbrojavanje,
  .osobni-napredak {
    margin: 6px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  .traka {
    margin-top: 10px;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--boja-obrub) 70%, transparent);
    overflow: hidden;
  }

  .traka-ispuna {
    display: block;
    height: 100%;
    background: var(--boja-isticanje-slova);
  }

  .naslov-tablice,
  .naslov-vlastiti {
    margin: 0 0 10px;
    font-size: 1.05rem;
  }

  .naslov-vlastiti {
    margin-top: 8px;
    color: var(--boja-tekst-sekundarni);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: var(--tekst-sitni);
  }

  .tablica-ljestvice,
  .tablica-rijeci {
    width: 100%;
    border-collapse: collapse;
  }

  .igrac-celija {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }

  .igrac-tekst {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .nadimak,
  .igrac-tekst a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oznaka-ti {
    color: var(--boja-isticanje-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 700;
  }

  .moj-redak {
    outline: 2px solid var(--boja-isticanje-slova);
    outline-offset: -2px;
  }

  .razdjelnik {
    margin: 8px 0;
    text-align: center;
    color: var(--boja-tekst-sekundarni);
    letter-spacing: 0.35em;
  }

  .prazno-stanje {
    margin: 12px 0 20px;
    padding: 20px 16px;
    text-align: center;
    border: 1px dashed var(--boja-obrub);
    border-radius: var(--radijus-kartica, 12px);
  }

  .prazno-naslov {
    margin: 0 0 6px;
    font-weight: 800;
    color: var(--boja-isticanje-tekst);
  }

  .akcija-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 12px;
    padding: 10px 16px;
    border-radius: var(--radijus-pill);
    border: 1px solid var(--boja-obrub);
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .akcija-gumb.istaknut {
    background: var(--boja-isticanje-slova);
    border-color: transparent;
    color: var(--boja-pozadina, #0f2a1f);
  }

  .cta-gost {
    margin: 18px 0;
    padding: 14px 16px;
    border-radius: var(--radijus-kartica, 12px);
    border: 1px solid var(--boja-obrub);
  }

  .cta-gost-naslov {
    margin: 0 0 4px;
    font-weight: 800;
  }

  .veza-registracija {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }

  .ispod-tablice {
    margin-top: 16px;
    padding-bottom: 72px;
  }

  .veza-pravila {
    background: none;
    border: none;
    padding: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    cursor: pointer;
  }

  .pravila-sadrzaj {
    margin-top: 10px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  .pravila-sadrzaj p {
    margin: 0 0 8px;
  }

  .uvod-rijeci {
    margin: 0 0 16px;
    color: var(--boja-tekst-sekundarni);
  }

  .najopasnija-kartica {
    margin: 0 0 18px;
    padding: 16px;
    border-radius: var(--radijus-kartica, 12px);
    border: 2px solid var(--boja-isticanje-slova);
    background: color-mix(in srgb, var(--boja-povrsina-2) 85%, black 15%);
  }

  .najopasnija-oznaka {
    margin: 0 0 8px;
    color: var(--boja-isticanje-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .najopasnija-red {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .najopasnija-rijec {
    margin: 0;
    font-size: clamp(1.6rem, 6vw, 2.2rem);
    font-weight: 800;
    word-break: break-word;
  }

  .najopasnija-broj {
    margin: 0;
    text-align: right;
    color: var(--boja-tekst-sekundarni);
  }

  .najopasnija-broj strong {
    display: block;
    color: var(--boja-isticanje-tekst);
    font-size: 1.6rem;
  }

  .najopasnija-opis,
  .fusnota {
    margin: 10px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .nastavak {
    color: var(--boja-isticanje-slova);
  }

  .stupac-kratki {
    display: none;
  }

  .obavijest.greska {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--boja-obrub);
  }

  .ucitavanje,
  .zakljucano {
    color: var(--boja-tekst-sekundarni);
  }

  .mobilni-uvod {
    display: none;
  }

  @media (max-width: 999px) {
    .desktop-uvod {
      display: none;
    }

    .mobilni-uvod {
      display: inline;
    }

    .stupac-pun {
      display: none;
    }

    .stupac-kratki {
      display: inline;
    }
  }
</style>
