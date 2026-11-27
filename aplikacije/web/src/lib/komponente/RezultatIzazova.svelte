<script lang="ts">
  import type {
    GoalProgressIzazova,
    IdIzazova,
    KrajPartije,
    LevelIzazova,
    PlasmanPartije,
    PravilnikPartije,
  } from 'zajednicko';
  import {
    dohvatiDefinicijuDostignuca,
    jeIdIzazova,
    NAZIVI_FORMATA_IZAZOVA,
    pokusajDefinicijuIzazova,
    PRAG_DUGE_RIJECI_IZAZOVA,
    tekstZavrsnogSazetka,
  } from 'zajednicko';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import {
    dohvatiKatalogIzazova,
    sljedeciDostupanIzazov,
    tekstRazlogaNeuspjeha,
  } from '$lib/izazovi-klijent.js';
  import { izazovXpPrikaz } from '$lib/izazov-xp-prikaz.js';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';
  import IskustvoPartije from '$lib/komponente/IskustvoPartije.svelte';
  import NadimakBota from '$lib/komponente/NadimakBota.svelte';
  import NapredakMisijaPartije from '$lib/komponente/NapredakMisijaPartije.svelte';

  let {
    kraj,
    challengeId = null,
    goalProgress = null,
    terminalStatus = null,
    terminalReason = null,
    gameWon = null,
    odbijenaRijec = null,
    mojIgracId = null,
    brojSanducicSazetka = 0,
  }: {
    kraj: KrajPartije;
    challengeId?: IdIzazova | null;
    goalProgress?: GoalProgressIzazova | null;
    terminalStatus?: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto' | string | null;
    terminalReason?: string | null;
    gameWon?: boolean | null;
    odbijenaRijec?: string | null;
    mojIgracId?: string | null;
    brojSanducicSazetka?: number;
  } = $props();

  let naslovEl: HTMLHeadingElement | null = $state(null);
  let scrollZaPartijuId: string | null = $state(null);

  const settlement = $derived(kraj.izazovSettlement ?? null);
  const uspjeh = $derived(terminalStatus === 'uspjeh');
  const tehnicki = $derived(terminalStatus === 'tehnicki_prekinuto');
  const xp = $derived(izazovXpPrikaz(kraj));
  const pobjedaPartije = $derived(
    gameWon === true || uspjeh || terminalReason === 'cilj_neispunjen',
  );
  const gameWonBezCilja = $derived(!uspjeh && terminalReason === 'cilj_neispunjen');
  const raniIliPrisilni = $derived(
    tehnicki
      || terminalReason === 'odustao'
      || terminalReason === 'prekid_veze'
      || (terminalReason === 'eliminiran' && gameWon !== true),
  );

  const definicija = $derived(
    challengeId && jeIdIzazova(challengeId) ? pokusajDefinicijuIzazova(challengeId) : null,
  );
  const levelOdigranog = $derived(((): LevelIzazova | null => definicija?.level ?? null)());
  const mapaHref = $derived(
    levelOdigranog != null ? `/izazovi?level=${levelOdigranog}` : '/izazovi',
  );

  const metaLinija = $derived((() => {
    if (!definicija) return null;
    const dijelovi = [
      NAZIVI_FORMATA_IZAZOVA[definicija.format],
      nazivPravilnika(definicija.pravila),
    ];
    if (definicija.turnDurationMs > 0 && definicija.turnDurationMs !== 30_000) {
      dijelovi.push(`${definicija.turnDurationMs / 1000} s po potezu`);
    }
    return dijelovi.join(' · ');
  })());

  const sortPlasmani = $derived(
    [...(kraj.plasmani ?? [])].sort((a, b) => a.plasman - b.plasman),
  );
  /** Pun poredak samo kad je ishod partije pouzdan (ne sintetički bot-raspored). */
  const prikaziPuniPoredak = $derived(
    (gameWon === true || uspjeh) && sortPlasmani.length > 0,
  );

  const naslov = $derived((() => {
    if (!terminalStatus) return 'Rezultat izazova';
    if (tehnicki) return 'Izazov je prekinut';
    if (uspjeh) {
      if (xp.firstCompletion === true) return 'Izazov uspješno odrađen!';
      if (xp.firstCompletion === false) return 'Izazov ponovno uspješno odigran!';
      return 'Izazov uspješno odrađen!';
    }
    if (terminalReason === 'prekid_veze') return 'Izazov je prekinut';
    return 'Izazov nije završen';
  })());

  const opis = $derived((() => {
    if (!terminalStatus) return 'Dohvaćanje ishoda izazova…';
    if (tehnicki) return 'Pokušaj je prekinut zbog tehničke greške.';
    if (uspjeh) {
      if (xp.firstCompletion === true) return 'Pobijedio si i ispunio sve uvjete.';
      if (xp.firstCompletion === false) {
        return 'Svi uvjeti su ispunjeni. Nagrada za prvi prelazak već je ostvarena.';
      }
      return 'Svi uvjeti su ispunjeni.';
    }
    if (terminalReason === 'cilj_neispunjen') {
      return 'Pobijedio si u partiji, ali nisi ispunio sve uvjete.';
    }
    if (terminalReason === 'eliminiran') return 'Ispao si prije pobjede.';
    if (terminalReason === 'nevaljana_rijec') {
      const r = odbijenaRijec?.normalize('NFC').trim();
      return r
        ? `Riječ „${r}” nije prihvaćena, a izazov ne dopušta pogreške.`
        : tekstRazlogaNeuspjeha('nevaljana_rijec');
    }
    if (terminalReason === 'zavrsio_na_ka') {
      return 'Završio si riječ na KA, što ovaj izazov ne dopušta.';
    }
    if (terminalReason === 'odustao') return 'Odustao si od izazova.';
    if (terminalReason === 'prekid_veze') return 'Veza je prekinuta tijekom izazova.';
    return tekstRazlogaNeuspjeha(terminalReason as never, odbijenaRijec);
  })());

  const sazetakPartije = $derived((() => {
    if (tehnicki || terminalReason === 'prekid_veze') return 'Partija je prekinuta.';
    if (terminalReason === 'odustao') return 'Odustao si od igre.';
    if (terminalReason === 'nevaljana_rijec' || terminalReason === 'zavrsio_na_ka') {
      return 'Uvjet izazova nije ispunjen.';
    }
    if (terminalReason === 'eliminiran' || gameWon === false) return 'Ispao si iz igre.';
    if (gameWonBezCilja) return 'Pobijedio si u partiji.';
    return 'Rezultat partije.';
  })());

  let sljedeci = $state<{ id: IdIzazova; naziv: string; level: LevelIzazova } | null>(null);
  let navigacijaUTijeku = $state(false);

  $effect(() => {
    if (!uspjeh || !challengeId || !jeIdIzazova(challengeId)) {
      sljedeci = null;
      return;
    }
    const id = challengeId;
    const optimistic = sljedeciDostupanIzazov(id);
    const optDef = optimistic ? pokusajDefinicijuIzazova(optimistic.id) : null;
    sljedeci = optDef && optDef.redoslijedUFormatu < 5 ? optimistic : null;
    let otkazano = false;
    void dohvatiKatalogIzazova()
      .then((odgovor) => {
        if (otkazano) return;
        sljedeci = sljedeciDostupanIzazov(id, odgovor.katalog);
      })
      .catch(() => {
        /* zadrži optimistic (bez finala) */
      });
    return () => {
      otkazano = true;
    };
  });

  $effect(() => {
    const id = kraj.partijaId;
    if (!id || !naslovEl || scrollZaPartijuId === id) return;
    scrollZaPartijuId = id;
    naslovEl.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });

  const novaDostignuca = $derived((() => {
    const primarni = kraj.novaDostignuca ?? [];
    if (primarni.length > 0) return dedupDostignuca(primarni);
    return dedupDostignuca(settlement?.novaDostignuca ?? []);
  })());

  const imaKolekciju = $derived(
    Boolean(kraj.kolekcija && kraj.kolekcija.dodaneKategorije.length > 0),
  );
  const bogatiXp = $derived(
    xp.ukupno > 0 || Boolean(xp.konacno) || Boolean(kraj.mojeIskustvo) || Boolean(kraj.ukupnoIskustvo),
  );

  function nazivPravilnika(pravila: PravilnikPartije): string {
    if (pravila === 'klasicni') return 'Klasična pravila';
    if (pravila === 'ka_zna') return 'KA-ZNA';
    if (pravila === 'dokazi_nastavak') return 'Dokaži nastavak';
    return pravila;
  }

  function dedupDostignuca(
    lista: { id: string; novaRazina: number; maksimalnaRazina: number }[],
  ) {
    const mapa = new Map<string, { id: string; novaRazina: number; maksimalnaRazina: number }>();
    for (const d of lista) {
      const postojeci = mapa.get(d.id);
      if (!postojeci || d.novaRazina >= postojeci.novaRazina) mapa.set(d.id, d);
    }
    return [...mapa.values()];
  }

  function opisDostignuca(id: string): { naziv: string; opis: string } {
    const def = dohvatiDefinicijuDostignuca(id);
    return def ? { naziv: def.naziv, opis: def.opis } : { naziv: id, opis: 'Novo dostignuće.' };
  }

  /** Status uvjeta: met / prekseno / nije_ispunjeno */
  function statusUvjeta(met: boolean, prekseno: boolean): 'met' | 'prekseno' | 'nije' {
    if (met) return 'met';
    if (prekseno && !raniIliPrisilni) return 'prekseno';
    return 'nije';
  }

  function oznakaStatusa(s: 'met' | 'prekseno' | 'nije'): string {
    if (s === 'met') return 'Ispunjeno';
    // I „prekršeno” i „nije” prikazuju isti tekst — bez riječi „prekršeno”.
    return 'Nije ispunjeno';
  }

  function postotakTrake(current: number, required: number): number {
    if (required <= 0) return 0;
    return Math.min(100, Math.max(0, (current / required) * 100));
  }

  function naNavigaciju() {
    navigacijaUTijeku = true;
  }

  function jeTi(p: PlasmanPartije): boolean {
    return Boolean(mojIgracId && p.igracId === mojIgracId);
  }
</script>

<section class="rezultat-izazova" aria-labelledby="rezultat-izazova-naslov" data-testid="rezultat-izazova">
  <header class="zaglavlje">
    {#if definicija}
      <p class="identitet" data-testid="izazov-identitet">IZAZOVI · LVL {definicija.level}</p>
      <p class="naziv-izazova">{definicija.naziv}</p>
      {#if metaLinija}
        <p class="meta">{metaLinija}</p>
      {/if}
    {:else}
      <p class="identitet">IZAZOVI</p>
    {/if}
    <h2 id="rezultat-izazova-naslov" tabindex="-1" bind:this={naslovEl}>{naslov}</h2>
    <p
      class="opis"
      class:cilj-neispunjen={gameWonBezCilja}
      data-testid={gameWonBezCilja ? 'izazov-cilj-neispunjen' : undefined}
    >
      {opis}
    </p>
  </header>

  {#if prikaziPuniPoredak}
    <section class="poredak" aria-labelledby="izazov-poredak-naslov" data-testid="izazov-zavrsni-poredak">
      <h3 id="izazov-poredak-naslov">Završni poredak</h3>
      <ol class="plasmani-lista">
        {#each sortPlasmani as igrac (igrac.igracId)}
          <li class:pobjednik={igrac.plasman === 1}>
            <span class="plasman-broj">{igrac.plasman}.</span>
            <span class="plasman-ime">
              <span class="plasman-ime-redak">
                {#if jeTi(igrac)}
                  <a href="/profil" class="nadimak">{igrac.nadimak}</a>
                  <span class="oznaka-ti" aria-label="To si ti">TI</span>
                {:else if igrac.jeBot}
                  <span class="nadimak"><NadimakBota nadimak={igrac.nadimak} /></span>
                {:else}
                  <span class="nadimak">{igrac.nadimak}</span>
                {/if}
                {#if igrac.jeBot}
                  <span class="oznaka-statusa">Bot</span>
                {/if}
              </span>
            </span>
            <span class="plasman-bodovi">{igrac.plasman === 1 ? 'Pobjeda' : 'Poraz'}</span>
          </li>
        {/each}
      </ol>
    </section>
  {:else}
    <section class="sazetak-partije" aria-label="Rezultat partije" data-testid="izazov-rezultat-partije">
      <h3>Rezultat partije</h3>
      <p>{sazetakPartije}</p>
    </section>
  {/if}

  {#if goalProgress}
    <div class="uvjeti" data-testid="izazov-uvjeti-prelazak">
      <h3 class="uvjeti-naslov">Uvjeti za prelazak izazova</h3>
      <ul class="uvjeti-lista" aria-label="Uvjeti za prelazak izazova">
        <li
          class:met={statusUvjeta(pobjedaPartije, !pobjedaPartije) === 'met'}
          class:prekseno={statusUvjeta(pobjedaPartije, !pobjedaPartije) === 'prekseno'}
          class:nije={statusUvjeta(pobjedaPartije, !pobjedaPartije) === 'nije'}
          data-testid="izazov-rezultat-pobjeda"
        >
          <span class="uvjet-oznaka" aria-hidden="true">{statusUvjeta(pobjedaPartije, !pobjedaPartije) === 'met' ? '✓' : statusUvjeta(pobjedaPartije, !pobjedaPartije) === 'prekseno' ? '✗' : '○'}</span>
          <span class="uvjet-tekst">
            <strong>Pobjeda</strong>
            <span class="uvjet-status">{oznakaStatusa(statusUvjeta(pobjedaPartije, !pobjedaPartije))}</span>
          </span>
        </li>
        {#if goalProgress.bezPogreske.required}
          {@const st = statusUvjeta(goalProgress.bezPogreske.met, !goalProgress.bezPogreske.met)}
          <li class:met={st === 'met'} class:prekseno={st === 'prekseno'} class:nije={st === 'nije'} data-testid="izazov-rezultat-bez-pogreske">
            <span class="uvjet-oznaka" aria-hidden="true">{st === 'met' ? '✓' : st === 'prekseno' ? '✗' : '○'}</span>
            <span class="uvjet-tekst">
              <strong>Bez pogrešne riječi</strong>
              <span class="uvjet-status">{oznakaStatusa(st)}</span>
            </span>
          </li>
        {/if}
        {#if goalProgress.bezZavrsavanjaNaKa?.required}
          {@const st = statusUvjeta(goalProgress.bezZavrsavanjaNaKa.met, !goalProgress.bezZavrsavanjaNaKa.met)}
          <li class:met={st === 'met'} class:prekseno={st === 'prekseno'} class:nije={st === 'nije'} data-testid="izazov-rezultat-bez-ka">
            <span class="uvjet-oznaka" aria-hidden="true">{st === 'met' ? '✓' : st === 'prekseno' ? '✗' : '○'}</span>
            <span class="uvjet-tekst">
              <strong>Ne završi na KA</strong>
              <span class="uvjet-status">{oznakaStatusa(st)}</span>
            </span>
          </li>
        {/if}
        {#if goalProgress.dugeRijeci.required > 0}
          {@const st = statusUvjeta(goalProgress.dugeRijeci.met, false)}
          <li class:met={st === 'met'} class:prekseno={st === 'prekseno'} class:nije={st === 'nije'} data-testid="izazov-rezultat-duge">
            <span class="uvjet-oznaka" aria-hidden="true">{st === 'met' ? '✓' : '○'}</span>
            <span class="uvjet-tekst">
              <strong>Duge riječi (≥{PRAG_DUGE_RIJECI_IZAZOVA})</strong>
              <span class="uvjet-broj">{goalProgress.dugeRijeci.current}/{goalProgress.dugeRijeci.required}</span>
              <span class="uvjet-status">{oznakaStatusa(st)}</span>
            </span>
            <span class="uvjet-traka" aria-hidden="true"
              ><span style={`width: ${postotakTrake(goalProgress.dugeRijeci.current, goalProgress.dugeRijeci.required)}%`}></span></span
            >
          </li>
        {/if}
        {#if goalProgress.rijetkeRijeci.required > 0}
          {@const st = statusUvjeta(goalProgress.rijetkeRijeci.met, false)}
          <li class:met={st === 'met'} class:prekseno={st === 'prekseno'} class:nije={st === 'nije'}>
            <span class="uvjet-oznaka" aria-hidden="true">{st === 'met' ? '✓' : '○'}</span>
            <span class="uvjet-tekst">
              <strong>Rijetke riječi</strong>
              <span class="uvjet-broj">{goalProgress.rijetkeRijeci.current}/{goalProgress.rijetkeRijeci.required}</span>
              <span class="uvjet-status">{oznakaStatusa(st)}</span>
            </span>
            <span class="uvjet-traka" aria-hidden="true"
              ><span style={`width: ${postotakTrake(goalProgress.rijetkeRijeci.current, goalProgress.rijetkeRijeci.required)}%`}></span></span
            >
          </li>
        {/if}
        {#if goalProgress.uspjesanDokaz.required > 0}
          {@const st = statusUvjeta(goalProgress.uspjesanDokaz.met, false)}
          <li class:met={st === 'met'} class:prekseno={st === 'prekseno'} class:nije={st === 'nije'}>
            <span class="uvjet-oznaka" aria-hidden="true">{st === 'met' ? '✓' : '○'}</span>
            <span class="uvjet-tekst">
              <strong>Uspješan dokaz</strong>
              <span class="uvjet-broj">{goalProgress.uspjesanDokaz.current}/{goalProgress.uspjesanDokaz.required}</span>
              <span class="uvjet-status">{oznakaStatusa(st)}</span>
            </span>
            <span class="uvjet-traka" aria-hidden="true"
              ><span style={`width: ${postotakTrake(goalProgress.uspjesanDokaz.current, goalProgress.uspjesanDokaz.required)}%`}></span></span
            >
          </li>
        {/if}
      </ul>
    </div>
  {:else if terminalStatus}
    <p class="uvjeti-nedostupni" role="status">Rezultat uvjeta nije dostupan.</p>
  {/if}

  {#if xp.pending}
    <p class="pending" role="status" data-testid="izazov-settlement-pending">
      Nagrada se još sprema…
    </p>
  {:else}
    {#if bogatiXp}
      <IskustvoPartije
        obracun={kraj.mojeIskustvo}
        ukupnoIskustvo={kraj.ukupnoIskustvo ?? null}
        kampanjskiXp={settlement ? xp.xpIzazova : null}
        kampanjskiXpNominal={settlement ? xp.xpIzazovaNominal : null}
        konacnoStanje={xp.konacno}
        prijeStanje={xp.prije}
        forsirajUkupno={xp.ukupno}
      />
    {/if}
    <!-- Vidljiv za gosta/+0; sr-only kad IskustvoPartije već prikazuje XP (E2E hook ostaje). -->
    <p
      class="nagrada-jednostavna"
      class:sr-only={bogatiXp}
      data-testid="izazov-xp-igre"
    >
      <span>XP od igre</span>
      <strong>+{xp.xpIgre} XP</strong>
    </p>
    {#if uspjeh && xp.firstCompletion === false && xp.xpIzazova === 0 && xp.xpIzazovaNominal > 0}
      <p class="ponavljanje-napomena">Nagrada za prvi prelazak već je ostvarena.</p>
    {/if}
    {#if settlement && (xp.xpIzazova > 0 || (uspjeh && xp.xpIzazovaNominal > 0))}
      <span class="sr-only" data-testid="izazov-challenge-xp"
        >{#if xp.xpIzazova === 0 && xp.xpIzazovaNominal > 0}0 / {xp.xpIzazovaNominal} XP{:else}+{xp.xpIzazova} XP{/if}</span
      >
    {/if}
    {#if xp.konacno || kraj.mojeIskustvo}
      <span class="sr-only" data-testid="izazov-level"
        >LVL {xp.konacno?.razina ?? kraj.mojeIskustvo?.poslije.razina ?? '—'}</span
      >
    {/if}
  {/if}

  {#if kraj.promjeneMisija && kraj.promjeneMisija.length > 0}
    <NapredakMisijaPartije promjene={kraj.promjeneMisija} />
  {/if}

  {#if novaDostignuca.length > 0}
    <section class="zavrsna-dostignuca" aria-labelledby="izazov-dostignuca-naslov">
      <h3 id="izazov-dostignuca-naslov">Nova dostignuća</h3>
      <div class="zavrsna-dostignuca-mrezica">
        {#each novaDostignuca as dostignuce (dostignuce.id)}
          {@const detalji = opisDostignuca(dostignuce.id)}
          <article class="zavrsno-dostignuce" aria-label={`${detalji.naziv}: novo otključano dostignuće`}>
            <span class="zavrsno-dostignuce-ikona" aria-hidden="true"
              ><img src={ikonaDostignuca(dostignuce.id)} alt="" /></span
            >
            <div class="zavrsno-dostignuce-sadrzaj">
              <div class="zavrsno-dostignuce-zaglavlje">
                <strong>{detalji.naziv}</strong>
                <span class="zavrsno-dostignuce-status">Otključano</span>
              </div>
              <p>{detalji.opis}</p>
              <small>Razina {dostignuce.novaRazina} / {dostignuce.maksimalnaRazina}</small>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if imaKolekciju && kraj.kolekcija}
    {@const kolekcija = kraj.kolekcija}
    <section class="zavrsna-kolekcija" aria-labelledby="izazov-kolekcija-naslov">
      <h3 id="izazov-kolekcija-naslov">Kolekcija riječi</h3>
      <div class="zavrsna-kolekcija-napredak">
        <div>
          <span>Trenutna razina</span>
          <strong>{kolekcija.trenutnaRazina}</strong>
        </div>
        <div>
          <span>Ukupno otključanih riječi</span>
          <strong>{kolekcija.ukupnoOtkljucano} / {kolekcija.ukupnoDostupno}</strong>
        </div>
      </div>
      {#if kolekcija.sljedecaRazina}
        <p class="zavrsna-kolekcija-sljedeca">
          Nakon dodavanja {kolekcija.doSljedece} riječi u kolekciju, otključat ćeš kolekcijsku razinu {kolekcija.sljedecaRazina}.
        </p>
      {/if}
    </section>
  {/if}

  {#if brojSanducicSazetka > 0}
    <p class="sanducic-zavrsni-sazetak">
      <img src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="28" height="28" />
      <span>{tekstZavrsnogSazetka(brojSanducicSazetka)}</span>
      <a href="/obavijesti">Otvori</a>
    </p>
  {/if}

  <div class="akcije kraj-akcije" class:ceka={navigacijaUTijeku}>
    {#if uspjeh && sljedeci}
      <a
        class="igraj-opet-gumb"
        class:onesposobljen={navigacijaUTijeku}
        href={`/izazovi?zapocni=${sljedeci.id}&level=${sljedeci.level}`}
        data-testid="izazov-sljedeci"
        aria-disabled={navigacijaUTijeku}
        tabindex={navigacijaUTijeku ? -1 : undefined}
        onclick={(e) => {
          if (navigacijaUTijeku) {
            e.preventDefault();
            return;
          }
          naNavigaciju();
        }}
      >
        Igraj sljedeći izazov
        <span class="podtekst">{sljedeci.naziv}</span>
      </a>
      <a class="sporedni-gumb" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Svi izazovi</a
      >
      {#if challengeId && levelOdigranog != null}
        <a
          class="tercijarni"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Igraj ponovno</a
        >
      {/if}
    {:else if challengeId && levelOdigranog != null && !uspjeh}
      <a
        class="igraj-opet-gumb"
        href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
        data-testid="izazov-ponovo"
        onclick={naNavigaciju}>Pokušaj ponovno</a
      >
      <a class="sporedni-gumb" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Svi izazovi</a
      >
    {:else}
      <a class="igraj-opet-gumb" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Svi izazovi</a
      >
      {#if challengeId && levelOdigranog != null}
        <a
          class="sporedni-gumb"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Igraj ponovno</a
        >
      {/if}
    {/if}
  </div>

  {#if !jeRegistriranKorisnik()}
    <div class="gost" data-testid="izazov-gost-cta">
      <p class="gost-cta">
        Registriraj se i sačuvaj napredak izazova s ovog uređaja. Prijava na
        <strong>postojeći</strong> račun ne spaja gost progres.
      </p>
      <div class="gost-akcije">
        <a class="igraj-opet-gumb" href="/registracija">Registriraj se</a>
        <a class="sporedni-gumb" href="/prijava">Prijavi se</a>
      </div>
    </div>
  {/if}
</section>

<style>
  .rezultat-izazova {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 8px 0 24px;
    display: grid;
    gap: 20px;
  }
  .zaglavlje {
    display: grid;
    gap: 6px;
  }
  .identitet {
    margin: 0;
    font-size: var(--tekst-mali);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--boja-tekst-sekundarni);
  }
  .naziv-izazova {
    margin: 0;
    font-weight: 700;
    font-size: var(--tekst-baza);
  }
  .meta {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
  h2 {
    margin: 4px 0 0;
    font-family: var(--font-naslov);
    font-size: var(--naslov-2);
    color: var(--boja-tekst-naslov);
  }
  h2:focus {
    outline: none;
  }
  .opis {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .poredak h3,
  .sazetak-partije h3,
  .uvjeti-naslov,
  .zavrsna-dostignuca h3 {
    margin: 0 0 10px;
    font-size: var(--tekst-baza);
    font-weight: 800;
  }
  .zavrsna-kolekcija {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 18px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kontrola);
    background: var(--boja-povrsina-2);
  }
  .zavrsna-kolekcija h3 {
    margin: 0 0 12px;
    font-size: var(--tekst-baza);
    font-weight: 800;
    color: var(--boja-tekst);
  }
  .sazetak-partije {
    padding: 14px 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .sazetak-partije p {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .plasmani-lista {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .plasmani-lista li {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--boja-povrsina);
    border-radius: var(--radijus-kartica);
    padding: 12px 16px;
    margin-bottom: 8px;
  }
  .plasmani-lista li.pobjednik {
    background: var(--boja-isticanje-slova);
    color: #1a1815;
    font-weight: bold;
  }
  .plasmani-lista li.pobjednik .oznaka-ti {
    background: #1a1815;
    border-color: #1a1815;
    color: var(--boja-isticanje-slova);
  }
  .plasman-broj {
    font-family: var(--font-naslov);
    font-size: 18px;
    width: 24px;
  }
  .plasman-ime {
    display: inline-flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .plasman-ime-redak {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .plasman-ime-redak .nadimak {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .plasman-ime-redak a.nadimak {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .oznaka-ti,
  .oznaka-statusa {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--boja-obrub);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .plasman-bodovi {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    white-space: nowrap;
  }
  .plasmani-lista li.pobjednik .plasman-bodovi {
    color: inherit;
  }
  .uvjeti {
    display: grid;
    gap: 10px;
  }
  .uvjeti-lista {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .uvjeti-lista li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 10px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .uvjet-oznaka {
    font-weight: 800;
    width: 1.2em;
    text-align: center;
  }
  .uvjet-tekst {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    min-width: 0;
  }
  .uvjet-status,
  .uvjet-broj {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }
  .uvjeti-lista li.met {
    border-color: var(--boja-uspjeh-tekst);
  }
  .uvjeti-lista li.met .uvjet-oznaka,
  .uvjeti-lista li.met .uvjet-status {
    color: var(--boja-uspjeh-tekst);
    font-weight: 700;
  }
  .uvjeti-lista li.prekseno {
    border-color: var(--boja-poraz-tekst);
  }
  .uvjeti-lista li.prekseno .uvjet-oznaka,
  .uvjeti-lista li.prekseno .uvjet-status {
    color: var(--boja-poraz-tekst);
    font-weight: 700;
  }
  .uvjet-traka {
    grid-column: 2;
    height: 6px;
    background: var(--boja-obrub);
    border-radius: 999px;
    overflow: hidden;
  }
  .uvjet-traka span {
    display: block;
    height: 100%;
    background: var(--boja-pozadina-primarna);
  }
  .uvjeti-nedostupni,
  .pending,
  .ponavljanje-napomena {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .nagrada-jednostavna {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    padding: 10px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .zavrsna-dostignuca-mrezica {
    display: grid;
    gap: 10px;
  }
  .zavrsno-dostignuce {
    display: flex;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .zavrsno-dostignuce-ikona img {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
  .zavrsno-dostignuce-sadrzaj {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .zavrsno-dostignuce-zaglavlje {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .zavrsno-dostignuce-status {
    font-size: var(--tekst-mali);
    font-weight: 700;
    color: var(--boja-uspjeh-tekst);
  }
  .zavrsno-dostignuce p,
  .zavrsno-dostignuce small {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .zavrsna-kolekcija-napredak {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .zavrsna-kolekcija-napredak div {
    display: grid;
    gap: 4px;
  }
  .zavrsna-kolekcija-napredak span,
  .zavrsna-kolekcija-sljedeca {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }
  .zavrsna-kolekcija-napredak strong {
    color: var(--boja-isticanje-tekst);
    font-size: 1.2rem;
  }
  .zavrsna-kolekcija-sljedeca {
    margin: 14px 0 0;
  }
  @media (max-width: 520px) {
    .zavrsna-kolekcija {
      padding: 14px;
    }
    .zavrsna-kolekcija-napredak {
      grid-template-columns: 1fr;
      gap: 10px;
    }
  }
  .sanducic-zavrsni-sazetak {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
  }
  .akcije.ceka {
    pointer-events: none;
    opacity: 0.72;
  }
  .igraj-opet-gumb,
  .sporedni-gumb {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 20px;
    border-radius: var(--radijus-kontrola);
    font-weight: 700;
    text-decoration: none;
  }
  .igraj-opet-gumb {
    background: var(--boja-pozadina-primarna);
    color: var(--boja-tekst-na-primarnoj, #fff);
  }
  .igraj-opet-gumb.onesposobljen {
    opacity: 0.6;
    cursor: wait;
  }
  .sporedni-gumb {
    border: 1px solid var(--boja-obrub);
    color: inherit;
    background: transparent;
  }
  .podtekst {
    font-size: var(--tekst-mali);
    font-weight: 600;
    opacity: 0.9;
  }
  .tercijarni {
    padding: 8px 4px;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .gost {
    display: grid;
    gap: 10px;
    padding-top: 4px;
    border-top: 1px solid var(--boja-obrub);
  }
  .gost-cta {
    margin: 0;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }
  .gost-akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (max-width: 999px) {
    .plasmani-lista li {
      flex-wrap: wrap;
      gap: 6px 10px;
    }
    .plasman-ime {
      flex: 1 1 calc(100% - 44px);
    }
    .plasman-bodovi {
      flex-basis: 100%;
      padding-left: 34px;
    }
    .akcije {
      flex-direction: column;
      align-items: stretch;
    }
    .igraj-opet-gumb,
    .sporedni-gumb {
      align-items: center;
      text-align: center;
    }
  }
</style>
