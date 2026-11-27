<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    formatirajOdbrojavanje,
    grafemi,
    jeMetrikaLjestvice,
    jeNapredakMetrika,
    jeVremenskaMetrika,
    METRIKE_NAPRETKA_LJESTVICA,
    METRIKE_VREMENSKE_LJESTVICA,
    RAZDOBLJA_LJESTVICA,
    REGISTAR_METRIKA_LJESTVICA,
    type MetrikaLjestvice,
    type OdgovorLjestvice,
    type OdgovorNajopasnijihRijeci,
    type OdgovorVremenskeLjestvice,
    type PozicijaNaLjestvici,
    type RazdobljeLjestvice,
    type RedakLjestvice,
    type StavkaNajopasnijeRijeci,
    type VrijednostLjestvice,
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
  const IKONE_METRIKA: Record<MetrikaLjestvice, string> = {
    prosjek_bodova: '/ikone/06-trofej.webp',
    niz_pobjeda: '/ikone/19-vatra.webp',
    najbrzi_igraci: '/ikone/33-dnk-brzina.webp',
    niz_rijeci: '/ikone/42-jezik-u-plamenu.webp',
    iskustvo: '/ikone/39-iskusnjara.webp',
    kolekcija: '/ikone/21-kolekcija.webp',
    izazovi: '/ikone/06-trofej.webp',
    dostignuca: '/ikone/27-zvjezdica-puna.webp',
  };

  const url = $derived($page.url);
  const kategorija = $derived<Kategorija>(
    url.searchParams.get('kategorija') === 'najopasnije' || url.searchParams.get('kategorija') === 'rijeci'
      ? 'najopasnije'
      : 'igraci',
  );
  const metrika = $derived<MetrikaLjestvice>(
    jeMetrikaLjestvice(url.searchParams.get('metrika'))
      ? (url.searchParams.get('metrika') as MetrikaLjestvice)
      : 'prosjek_bodova',
  );
  const razdoblje = $derived<RazdobljeLjestvice>(
    (RAZDOBLJA_LJESTVICA as readonly string[]).includes(url.searchParams.get('razdoblje') ?? '')
      ? (url.searchParams.get('razdoblje') as RazdobljeLjestvice)
      : 'dnevno',
  );
  const jeVremenska = $derived(jeVremenskaMetrika(metrika));
  const opisMetrike = $derived(REGISTAR_METRIKA_LJESTVICA[metrika]);

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
  /** Zadnji valjani vremenski odabir u sesiji (za povratak s napretka). */
  let zadnjeVremenskoRazdoblje: RazdobljeLjestvice = 'dnevno';

  const vremenski = $derived<OdgovorVremenskeLjestvice | null>(
    podaci?.vrstaOdgovora === 'vremenska' ? podaci : null,
  );
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
    const opis = REGISTAR_METRIKA_LJESTVICA[me];
    return kratko ? opis.kratkiNaziv : opis.naziv;
  }

  function promijeni(izmjene: Record<string, string | null>) {
    const novi = new URL(url);
    for (const [kljuc, vrijednost] of Object.entries(izmjene)) {
      if (vrijednost === null) novi.searchParams.delete(kljuc);
      else novi.searchParams.set(kljuc, vrijednost);
    }
    if (izmjene.kategorija === 'igraci') novi.searchParams.delete('prikaz');
    goto(`${novi.pathname}${novi.search}`, { noScroll: true, keepFocus: true });
  }

  function odaberiMetriku(me: MetrikaLjestvice) {
    if (jeVremenskaMetrika(me)) {
      promijeni({
        kategorija: 'igraci',
        metrika: me,
        razdoblje: zadnjeVremenskoRazdoblje,
      });
      return;
    }
    if (jeVremenskaMetrika(metrika)) zadnjeVremenskoRazdoblje = razdoblje;
    promijeni({ kategorija: 'igraci', metrika: me, razdoblje: null });
  }

  async function ucitajLjestvicu(me: MetrikaLjestvice, r: RazdobljeLjestvice | null) {
    const idZahtjeva = ++zadnjiZahtjev;
    ucitava = true;
    greska = null;
    prikaziPravila = false;
    podaci = null;
    try {
      const params = new URLSearchParams({ metrika: me, prikaz: 'top' });
      if (jeVremenskaMetrika(me)) {
        params.set('mod', 'tri_igraca');
        params.set('razdoblje', r ?? 'dnevno');
      }
      const odgovor = await fetch(apiUrl(`/ljestvice?${params}`), {
        headers: { authorization: `Bearer ${dohvatiAuthToken()}` },
      });
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
      if (jeVremenskaMetrika(metrika)) zadnjeVremenskoRazdoblje = razdoblje;
      const kljuc = jeVremenskaMetrika(metrika)
        ? `igraci|${metrika}|${razdoblje}`
        : `igraci|${metrika}|napredak`;
      if (kljuc === zadnjiPoslaniKljuc) return;
      zadnjiPoslaniKljuc = kljuc;
      void ucitajLjestvicu(metrika, jeVremenskaMetrika(metrika) ? razdoblje : null);
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
    const novi = new URL(url);
    let trebaZamjena = false;
    if (novi.searchParams.get('kategorija') === 'rijeci') {
      novi.searchParams.set('kategorija', 'najopasnije');
      trebaZamjena = true;
    }
    const stariMod = novi.searchParams.get('mod');
    if (stariMod && stariMod !== 'tri_igraca') {
      novi.searchParams.set('mod', 'tri_igraca');
      trebaZamjena = true;
    }
    if (novi.searchParams.get('prikaz') === 'oko_mene') {
      novi.searchParams.delete('prikaz');
      trebaZamjena = true;
    }
    const me = novi.searchParams.get('metrika');
    if (jeMetrikaLjestvice(me) && jeNapredakMetrika(me) && novi.searchParams.has('razdoblje')) {
      novi.searchParams.delete('razdoblje');
      trebaZamjena = true;
    }
    if (trebaZamjena) {
      void goto(`${novi.pathname}${novi.search}`, { replaceState: true, noScroll: true });
    }
    const tik = setInterval(() => {
      sadaMs = Date.now();
    }, 1000);
    return () => clearInterval(tik);
  });

  const preostaloMs = $derived(
    vremenski?.razdoblje.do
      ? new Date(vremenski.razdoblje.do).getTime() - (sadaMs + pomakSataMs)
      : null,
  );

  $effect(() => {
    const kraj = vremenski?.razdoblje.do;
    if (
      kraj
      && preostaloMs !== null
      && preostaloMs <= 0
      && osvjezenoNaKraju !== kraj
      && kategorija === 'igraci'
      && jeVremenska
    ) {
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

  function oblikRijeci(broj: number): string {
    const zadnjeDvije = broj % 100;
    const zadnja = broj % 10;
    if (zadnja === 1 && zadnjeDvije !== 11) return 'riječ';
    if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'riječi';
    return 'riječi';
  }

  function oblikZvjezdica(broj: number): string {
    const zadnjeDvije = broj % 100;
    const zadnja = broj % 10;
    if (zadnja === 1 && zadnjeDvije !== 11) return 'zvjezdica';
    if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'zvjezdice';
    return 'zvjezdica';
  }

  function godinaIzIso(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zagreb', year: 'numeric' }).format(new Date(iso));
  }

  function formatirajVrijednost(vrijednost: VrijednostLjestvice): string {
    if (vrijednost.vrsta === 'prosjek_bodova') {
      return new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        vrijednost.prosjek,
      );
    }
    if (vrijednost.vrsta === 'niz_pobjeda' || vrijednost.vrsta === 'niz_rijeci') {
      return String(vrijednost.broj);
    }
    if (vrijednost.vrsta === 'prosjek_brzine') {
      return `${new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(vrijednost.prosjekMs / 1000)} s`;
    }
    if (vrijednost.vrsta === 'iskustvo') {
      return `${new Intl.NumberFormat('hr-HR').format(vrijednost.iskustvoUkupno)} XP`;
    }
    if (vrijednost.vrsta === 'kolekcija') {
      return `${new Intl.NumberFormat('hr-HR').format(vrijednost.broj)} ${oblikRijeci(vrijednost.broj)}`;
    }
    if (vrijednost.vrsta === 'izazovi') {
      return `${vrijednost.zavrseno}/${vrijednost.ukupno}`;
    }
    return `${vrijednost.zvjezdice}`;
  }

  function sekundarniTekst(vrijednost: VrijednostLjestvice, odigraneIgre: number): string | null {
    if (vrijednost.vrsta === 'prosjek_brzine') {
      return `${new Intl.NumberFormat('hr-HR').format(vrijednost.prihvaceniPotezi)} prihvaćenih poteza`;
    }
    if (vrijednost.vrsta === 'iskustvo') return `Razina ${vrijednost.razina}`;
    if (vrijednost.vrsta === 'izazovi') {
      if (vrijednost.zavrseno >= vrijednost.ukupno) return 'Svi izazovi završeni';
      return vrijednost.nazivLevela;
    }
    if (vrijednost.vrsta === 'dostignuca') {
      return `${vrijednost.otkljucano} otključana dostignuća`;
    }
    if (vrijednost.vrsta === 'niz_rijeci') return 'riječi zaredom';
    if (vrijednost.vrsta === 'prosjek_bodova' || vrijednost.vrsta === 'niz_pobjeda') {
      return `${odigraneIgre} ${oblikIgre(odigraneIgre)}`;
    }
    return null;
  }

  function udioNapretka(pozicija: PozicijaNaLjestvici): number {
    const odigrane = pozicija.odigraneIgre ?? 0;
    const minimum = Math.max(1, pozicija.minimumIgara);
    return Math.max(0, Math.min(100, (odigrane / minimum) * 100));
  }

  function praznoStanjeNaslov(me: MetrikaLjestvice): string {
    if (me === 'niz_pobjeda') return 'Za prvi niz treba ti jedna pobjeda.';
    if (me === 'najbrzi_igraci') return 'Još nema dovoljno prihvaćenih poteza.';
    if (me === 'niz_rijeci') return 'Još nema zabilježenog niza riječi.';
    if (me === 'iskustvo') return 'Još nema osvojenog iskustva.';
    if (me === 'kolekcija') return 'Još nitko nije otključao riječi u kolekciji.';
    if (me === 'izazovi') return 'Još nitko nije završio izazov.';
    if (me === 'dostignuca') return 'Još nema osvojenih zvjezdica.';
    return 'Još nema rezultata.';
  }

  const prvaRijec = $derived(najopasnije[0] ?? null);
  const naslovListeRijeci = $derived(
    prosirenoRijeci ? `Top ${najopasnije.length} riječi` : 'Top 10 riječi',
  );

  function dijeloviRijeci(rijec: string): { ostatak: string; nastavak: string } {
    const dijelovi = grafemi(rijec);
    if (dijelovi.length <= 2) return { ostatak: '', nastavak: dijelovi.join('') };
    return {
      ostatak: dijelovi.slice(0, -2).join(''),
      nastavak: dijelovi.slice(-2).join(''),
    };
  }
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
  <div class="raspored-igraci">
    <aside class="odabir-metrika" aria-label="Odabir ljestvice">
      <section class="grupa-metrika">
        <h2 class="grupa-naslov">Brza igra</h2>
        <div class="metrike-grid" role="group" aria-label="Brza igra">
          {#each METRIKE_VREMENSKE_LJESTVICA as m (m)}
            <button
              type="button"
              class="metrika-kartica"
              aria-pressed={metrika === m}
              class:aktivan={metrika === m}
              onclick={() => odaberiMetriku(m)}
            >
              <img class="metrika-ikona" src={IKONE_METRIKA[m]} alt="" width="28" height="28" />
              <span class="metrika-naziv">{nazivMetrike(m)}</span>
            </button>
          {/each}
        </div>
      </section>
      <section class="grupa-metrika">
        <h2 class="grupa-naslov">Ukupni napredak</h2>
        <div class="metrike-grid" role="group" aria-label="Ukupni napredak">
          {#each METRIKE_NAPRETKA_LJESTVICA as m (m)}
            <button
              type="button"
              class="metrika-kartica"
              aria-pressed={metrika === m}
              class:aktivan={metrika === m}
              onclick={() => odaberiMetriku(m)}
            >
              <img class="metrika-ikona" src={IKONE_METRIKA[m]} alt="" width="28" height="28" />
              <span class="metrika-naziv">{nazivMetrike(m)}</span>
            </button>
          {/each}
        </div>
      </section>
    </aside>

    <div class="poredak-stupac">
      <header class="poredak-zaglavlje">
        <h2 class="poredak-naslov">{opisMetrike.naziv}</h2>
      </header>

      {#if jeVremenska}
        <div class="razdoblja" role="tablist" aria-label="Razdoblje">
          {#each RAZDOBLJA_LJESTVICA as r (r)}
            <button
              type="button"
              role="tab"
              class="razdoblje"
              aria-selected={razdoblje === r}
              class:aktivan={razdoblje === r}
              onclick={() => {
                zadnjeVremenskoRazdoblje = r;
                promijeni({ razdoblje: r });
              }}
            >
              {NAZIVI_RAZDOBLJA[r]}
            </button>
          {/each}
        </div>
      {/if}

      {#if greska}
        <div class="obavijest greska" role="alert">
          <p>{greska}</p>
          <button
            type="button"
            class="akcija-gumb"
            onclick={() => ucitajLjestvicu(metrika, jeVremenska ? razdoblje : null)}
          >
            Pokušaj ponovno
          </button>
        </div>
      {:else if ucitava || !podaci}
        <p class="ucitavanje">Učitavanje…</p>
      {:else if vremenski?.razdoblje.stanje === 'zakljucano'}
        <p class="zakljucano">
          Ljestvica svih vremena stiže {vremenski.razdoblje.otkljucavaSe
            ? godinaIzIso(vremenski.razdoblje.otkljucavaSe)
            : godinaIzIso(vremenski.svihVremenaOtkljucavaSe)}.
        </p>
      {:else}
        {#if mojaPozicija?.status === 'rangiran' && mojRedak}
          <section class="osobna-kartica" aria-label="Tvoja pozicija">
            <p class="osobna-oznaka">Tvoja pozicija</p>
            <p class="osobna-mjesto">{mojRedak.mjesto}. mjesto</p>
            <p class="osobna-detalji">
              {nazivMetrike(metrika)}: {formatirajVrijednost(mojRedak.vrijednost)}
              {#if sekundarniTekst(mojRedak.vrijednost, mojRedak.odigraneIgre)}
                <span aria-hidden="true"> · </span>
                {sekundarniTekst(mojRedak.vrijednost, mojRedak.odigraneIgre)}
              {/if}
            </p>
            {#if vremenski && razdoblje !== 'godisnje' && razdoblje !== 'svih_vremena' && preostaloMs !== null}
              <p class="odbrojavanje" aria-live="off">
                Reset poretka za {formatirajOdbrojavanje(preostaloMs)}
              </p>
            {/if}
            {#if metrika === 'prosjek_bodova'}
              <p class="objasnjenje-bodovanja">
                Bodovanje Brze igre: 1. mjesto 2 boda (+1 za pobjedu), 2. mjesto 1 bod, 3. mjesto 0;
                +1 bod za svaku eliminaciju koju izazoveš. Najviše 5 bodova po igri. Ova ljestvica
                rangira prosjek tih bodova.
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
            {#if metrika === 'prosjek_bodova'}
              <p class="objasnjenje-bodovanja">
                Bodovanje Brze igre: 1. mjesto 2 boda (+1 za pobjedu), 2. mjesto 1 bod, 3. mjesto 0;
                +1 bod za svaku eliminaciju koju izazoveš. Najviše 5 bodova po igri. Ova ljestvica
                rangira prosjek tih bodova.
              </p>
            {/if}
          </section>
        {:else if mojaPozicija?.status === 'nedovoljan_broj_poteza'}
          <section class="osobna-kartica napredak" aria-label="Napredak do poretka">
            <p class="osobna-mjesto">
              Još {mojaPozicija.nedostajePoteza ?? 0} prihvaćenih poteza do poretka.
            </p>
            <p class="osobna-detalji">
              {mojaPozicija.prihvaceniPotezi ?? 0}/{mojaPozicija.minimumPoteza ?? 0} poteza
            </p>
          </section>
        {:else if mojaPozicija?.status === 'nema_rezultata'}
          <p class="osobni-napredak">{praznoStanjeNaslov(metrika)}</p>
        {:else if mojaPozicija?.status === 'podaci_nepotpuni'}
          <p class="osobni-napredak">Rezultat još nije dostupan.</p>
        {:else if mojaPozicija?.status === 'prijava_potrebna'}
          <p class="osobni-napredak">Prijavi se za svoju poziciju.</p>
        {/if}

        <h3 class="naslov-tablice">Top 10</h3>

        {#if podaci.redci.length === 0}
          <div class="prazno-stanje">
            <p class="prazno-naslov">{praznoStanjeNaslov(metrika)}</p>
            {#if jeVremenska}
              <p>Još nitko nije ušao u {OBUHVAT_RAZDOBLJA[razdoblje]} poredak.</p>
              <a class="akcija-gumb istaknut" href={putanjaBrzeIgre()}>Odigraj brzu igru</a>
            {/if}
          </div>
        {:else}
          <table class="tablica-mobilni-retci tablica-ljestvice">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Igrač</th>
                <th scope="col">
                  <span class="stupac-pun">{nazivMetrike(metrika)}</span>
                  <span class="stupac-kratki">{nazivMetrike(metrika, true)}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {#each podaci.redci as redak (redak.igracId)}
                {@const sekundarno = sekundarniTekst(redak.vrijednost, redak.odigraneIgre)}
                <tr class:moj-redak={redak.jeJa} class:medalja-1={redak.mjesto === 1}>
                  <td data-label="#">
                    <span class="mjesto" aria-label="{redak.mjesto}. mjesto">{redak.mjesto}.</span>
                  </td>
                  <th scope="row">
                    <span class="igrac-celija">
                      <Avatar
                        avatarId={redak.avatarId}
                        avatarConfig={redak.avatarConfig}
                        avatarSlikaHash={redak.avatarSlikaHash}
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
                        {#if sekundarno}
                          <span class="sekundarno">{sekundarno}</span>
                        {/if}
                      </span>
                    </span>
                  </th>
                  <td class="vrijednost" data-label={nazivMetrike(metrika)}>
                    {formatirajVrijednost(redak.vrijednost)}
                    {#if redak.vrijednost.vrsta === 'dostignuca'}
                      <span class="sr-only">{oblikZvjezdica(redak.vrijednost.zvjezdice)}</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if prikaziVlastitiIspod && mojRedak}
            {@const sekundarnoVlastiti = sekundarniTekst(mojRedak.vrijednost, mojRedak.odigraneIgre)}
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
                        avatarSlikaHash={mojRedak.avatarSlikaHash}
                        gost={!mojRedak.jeJavanProfil}
                        velicina={36}
                        prikaziRangBorder={false}
                      />
                      <span class="igrac-tekst">
                        <span class="nadimak">{mojRedak.nadimak}</span>
                        <span class="oznaka-ti">Ovo si ti</span>
                        {#if sekundarnoVlastiti}
                          <span class="sekundarno">{sekundarnoVlastiti}</span>
                        {/if}
                      </span>
                    </span>
                  </th>
                  <td class="vrijednost" data-label={nazivMetrike(metrika)}>
                    {formatirajVrijednost(mojRedak.vrijednost)}
                  </td>
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
              {#if jeVremenska}
                <p>
                  Ovo je ljestvica Brze igre. Privatne sobe, trening i izazovi ne ulaze.
                </p>
                <p>
                  Za ulazak treba: dnevna 5 brzih igara; tjedna, mjesečna, godišnja i svih vremena 10
                  brzih igara
                  {#if metrika === 'najbrzi_igraci'}
                    (te još 30 prihvaćenih poteza dnevno, odnosno 50 na duljim ljestvicama)
                  {/if}.
                </p>
              {:else}
                <p>
                  Ovo je ljestvica ukupnog napretka (trenutno stanje računa). Nema minimalnog broja
                  Brzih igara ni vremenskog filtera.
                </p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
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

  .raspored-igraci {
    display: grid;
    gap: 20px;
  }

  @media (min-width: 1000px) {
    .raspored-igraci {
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
      align-items: start;
      gap: 28px;
    }
  }

  .grupa-naslov {
    margin: 0 0 8px;
    font-size: var(--tekst-sitni);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--boja-tekst-sekundarni);
    font-weight: 700;
  }

  .grupa-metrika + .grupa-metrika {
    margin-top: 16px;
  }

  .metrike-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .metrika-kartica {
    display: grid;
    justify-items: start;
    gap: 4px;
    text-align: left;
    padding: 10px;
    border-radius: var(--radijus-kartica, 12px);
    border: 1px solid var(--boja-obrub);
    background: color-mix(in srgb, var(--boja-povrsina-2) 90%, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
  }

  .metrika-kartica.aktivan {
    border-color: var(--boja-isticanje-slova);
    outline: 1px solid var(--boja-isticanje-slova);
  }

  .metrika-ikona {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .metrika-naziv {
    font-weight: 700;
    font-size: var(--tekst-mali);
  }

  /* Desktop: 1 gumb po redu, ikona + tekst u istom redu */
  @media (min-width: 1000px) {
    .metrike-grid {
      grid-template-columns: 1fr;
    }

    .metrika-kartica {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }

  .poredak-naslov {
    margin: 0 0 12px;
    font-size: 1.25rem;
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
  .osobni-napredak,
  .objasnjenje-bodovanja {
    margin: 6px 0 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  .objasnjenje-bodovanja {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--boja-obrub);
    line-height: 1.4;
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

  .tablica-ljestvice th,
  .tablica-ljestvice td,
  .tablica-rijeci th,
  .tablica-rijeci td {
    padding: 10px 8px;
    vertical-align: middle;
    text-align: left;
  }

  /* Broj mjesta uz avatar — stupac se sužava na sadržaj */
  .tablica-ljestvice th:first-child,
  .tablica-ljestvice td:first-child,
  .tablica-rijeci th:first-child,
  .tablica-rijeci td:first-child {
    width: 1%;
    white-space: nowrap;
    padding-right: 6px;
    font-variant-numeric: tabular-nums;
  }

  .tablica-ljestvice th:nth-child(2),
  .tablica-ljestvice td:nth-child(2),
  .tablica-ljestvice th[scope='row'],
  .tablica-rijeci th:nth-child(2),
  .tablica-rijeci td:nth-child(2) {
    padding-left: 0;
  }

  .vrijednost {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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

  .sekundarno {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    font-weight: 500;
  }

  .oznaka-ti {
    color: var(--boja-isticanje-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 700;
  }

  @media (min-width: 1000px) {
    .igrac-tekst {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 8px;
    }

    .oznaka-ti::before,
    .sekundarno::before {
      content: '·';
      margin-right: 8px;
      color: var(--boja-tekst-sekundarni);
      font-weight: 500;
    }
  }

  .moj-redak {
    outline: 2px solid var(--boja-isticanje-slova);
    outline-offset: -2px;
  }

  .medalja-1 .mjesto {
    color: var(--boja-isticanje-tekst);
    font-weight: 800;
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
    border-radius: var(--radijus-kontrola);
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
