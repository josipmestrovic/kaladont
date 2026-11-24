<script lang="ts">
  import type {
    GoalProgressIzazova,
    IdIzazova,
    KrajPartije,
    LevelIzazova,
    SettlementIzazovaDto,
  } from 'zajednicko';
  import { jeIdIzazova, pokusajDefinicijuIzazova, PRAG_DUGE_RIJECI_IZAZOVA } from 'zajednicko';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import {
    dohvatiKatalogIzazova,
    sljedeciDostupanIzazov,
    tekstRazlogaNeuspjeha,
  } from '$lib/izazovi-klijent.js';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  let {
    kraj,
    challengeId = null,
    goalProgress = null,
    terminalStatus = null,
    terminalReason = null,
    gameWon = null,
    odbijenaRijec = null,
  }: {
    kraj: KrajPartije;
    challengeId?: IdIzazova | null;
    goalProgress?: GoalProgressIzazova | null;
    terminalStatus?: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto' | string | null;
    terminalReason?: string | null;
    gameWon?: boolean | null;
    odbijenaRijec?: string | null;
  } = $props();

  const settlement = $derived(kraj.izazovSettlement ?? null);
  const uspjeh = $derived(terminalStatus === 'uspjeh');
  const pending = $derived(settlement?.settlementState === 'spremanje_u_tijeku');
  const pobjedaPartije = $derived(
    gameWon === true || uspjeh || terminalReason === 'cilj_neispunjen',
  );
  const gameWonBezCilja = $derived(
    !uspjeh && terminalReason === 'cilj_neispunjen',
  );

  const xpOdIgre = $derived(
    kraj.ukupnoIskustvo?.partijskiXpStvarno
      ?? kraj.mojeIskustvo?.osvojenoIskustvo
      ?? 0,
  );
  const prikaziXpIzazova = $derived(
    Boolean(
      settlement
        && (settlement.challengeXp.awarded > 0
          || (uspjeh && settlement.challengeXp.nominal > 0)),
    ),
  );
  const prikaziXpMisija = $derived(
    Boolean(
      settlement
        && (settlement.missionXp.awarded > 0 || settlement.missionXp.nominal > 0),
    ),
  );
  const imaNagrade = $derived(
    pending
      || Boolean(settlement)
      || xpOdIgre > 0
      || Boolean(kraj.ukupnoIskustvo)
      || Boolean(kraj.mojeIskustvo),
  );

  const levelOdigranog = $derived(((): LevelIzazova => {
    if (challengeId && jeIdIzazova(challengeId)) {
      return pokusajDefinicijuIzazova(challengeId)?.level ?? 1;
    }
    return 1;
  })());
  const mapaHref = $derived(`/izazovi?level=${levelOdigranog}`);
  let sljedeci = $state<{ id: IdIzazova; naziv: string; level: LevelIzazova } | null>(null);
  let navigacijaUTijeku = $state(false);

  $effect(() => {
    if (!uspjeh || !challengeId || !jeIdIzazova(challengeId)) {
      sljedeci = null;
      return;
    }
    const id = challengeId;
    // Optimistic: slotovi 1–4 su otvoreni zajedno — CTA odmah; finale čeka katalog.
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

  const naslov = $derived(
    terminalStatus === 'tehnicki_prekinuto'
      ? 'Tehnički prekid'
      : uspjeh
        ? 'Izazov uspješan!'
        : gameWonBezCilja
          ? 'Pobjeda bez cilja'
          : 'Izgubio si izazov',
  );

  function prikaziXp(dio: SettlementIzazovaDto['challengeXp'] | null | undefined): string {
    if (!dio) return '—';
    if (dio.awarded === 0 && dio.nominal > 0) return `0 / ${dio.nominal} XP`;
    return `+${dio.awarded} XP`;
  }

  function naNavigaciju() {
    navigacijaUTijeku = true;
  }
</script>

<section class="rezultat-izazova" aria-labelledby="rezultat-izazova-naslov" data-testid="rezultat-izazova">
  <header class="zaglavlje">
    <h2 id="rezultat-izazova-naslov">{naslov}</h2>
    {#if terminalStatus === 'tehnicki_prekinuto'}
      <p class="opis">Pokušaj je prekinut zbog tehničke greške. Možeš pokušati ponovno.</p>
    {:else if uspjeh}
      <p class="opis">Svi ciljevi su ispunjeni.</p>
    {:else if gameWonBezCilja}
      <p class="opis" data-testid="izazov-cilj-neispunjen">
        {tekstRazlogaNeuspjeha('cilj_neispunjen')}
      </p>
    {:else}
      <p class="opis">{tekstRazlogaNeuspjeha(terminalReason as never, odbijenaRijec)}</p>
    {/if}
  </header>

  {#if goalProgress}
    <div class="uvjeti" data-testid="izazov-uvjeti-prelazak">
      <h3 class="uvjeti-naslov">Uvjeti za prelazak izazova</h3>
      <ul class="podciljevi" aria-label="Uvjeti za prelazak izazova">
        <li
          class:met={pobjedaPartije}
          class:prekseno={!pobjedaPartije}
          data-testid="izazov-rezultat-pobjeda"
        >
          Pobjeda
        </li>
        {#if goalProgress.bezPogreske.required}
          <li
            class:met={goalProgress.bezPogreske.met}
            class:prekseno={!goalProgress.bezPogreske.met}
            data-testid="izazov-rezultat-bez-pogreske"
          >
            {#if goalProgress.bezPogreske.met}
              Bez pogreške
            {:else}
              Bez pogreške — pogriješio si
            {/if}
          </li>
        {/if}
        {#if goalProgress.bezZavrsavanjaNaKa?.required}
          <li
            class:met={goalProgress.bezZavrsavanjaNaKa.met}
            class:prekseno={!goalProgress.bezZavrsavanjaNaKa.met}
            data-testid="izazov-rezultat-bez-ka"
          >
            {#if goalProgress.bezZavrsavanjaNaKa.met}
              Ne završi na ka
            {:else}
              Ne završi na ka — završio si na ka
            {/if}
          </li>
        {/if}
        {#if goalProgress.dugeRijeci.required > 0}
          <li
            class:met={goalProgress.dugeRijeci.met}
            class:prekseno={!goalProgress.dugeRijeci.met}
            data-testid="izazov-rezultat-duge"
          >
            Duge (≥{PRAG_DUGE_RIJECI_IZAZOVA}) {goalProgress.dugeRijeci.current}/{goalProgress.dugeRijeci.required}
          </li>
        {/if}
        {#if goalProgress.rijetkeRijeci.required > 0}
          <li
            class:met={goalProgress.rijetkeRijeci.met}
            class:prekseno={!goalProgress.rijetkeRijeci.met}
          >
            Rijetke {goalProgress.rijetkeRijeci.current}/{goalProgress.rijetkeRijeci.required}
          </li>
        {/if}
        {#if goalProgress.uspjesanDokaz.required > 0}
          <li
            class:met={goalProgress.uspjesanDokaz.met}
            class:prekseno={!goalProgress.uspjesanDokaz.met}
          >
            Dokaz {goalProgress.uspjesanDokaz.current}/{goalProgress.uspjesanDokaz.required}
          </li>
        {/if}
      </ul>
    </div>
  {/if}

  {#if pending}
    <p class="pending" role="status" data-testid="izazov-settlement-pending">
      Nagrada se još sprema…
    </p>
  {:else if imaNagrade}
    <div class="nagrade" aria-label="Nagrade izazova">
      <p class="nagrada" data-testid="izazov-xp-igre">
        <span>XP od igre</span>
        <strong>+{xpOdIgre} XP</strong>
      </p>
      {#if prikaziXpIzazova && settlement}
        <p class="nagrada">
          <span>XP izazova</span>
          <strong data-testid="izazov-challenge-xp">{prikaziXp(settlement.challengeXp)}</strong>
        </p>
      {/if}
      {#if prikaziXpMisija && settlement}
        <p class="nagrada">
          <span>XP misija</span>
          <strong>{prikaziXp(settlement.missionXp)}</strong>
        </p>
      {/if}
      {#if kraj.ukupnoIskustvo}
        <p class="nagrada level" data-testid="izazov-level">
          <span>Razina</span>
          <strong>
            LVL {kraj.ukupnoIskustvo.poslije.razina}
            {#if kraj.ukupnoIskustvo.prije.razina !== kraj.ukupnoIskustvo.poslije.razina}
              <span class="level-up">
                ({kraj.ukupnoIskustvo.prije.razina} → {kraj.ukupnoIskustvo.poslije.razina})
              </span>
            {/if}
          </strong>
        </p>
      {:else if kraj.mojeIskustvo}
        <p class="nagrada level" data-testid="izazov-level">
          <span>Razina</span>
          <strong>
            LVL {kraj.mojeIskustvo.poslije.razina}
            {#if kraj.mojeIskustvo.prije.razina !== kraj.mojeIskustvo.poslije.razina}
              <span class="level-up">
                ({kraj.mojeIskustvo.prije.razina} → {kraj.mojeIskustvo.poslije.razina})
              </span>
            {/if}
          </strong>
        </p>
      {/if}
      {#if settlement?.izazivac.novaRazina}
        <p class="nagrada level-up-red">
          <span>Nova razina Izazivača</span>
          <strong>{settlement.izazivac.novaRazina}</strong>
        </p>
      {/if}
    </div>
  {/if}

  {#if settlement?.novaDostignuca && settlement.novaDostignuca.length > 0}
    <ul class="dostignuca" aria-label="Nova dostignuća">
      {#each settlement.novaDostignuca as d (d.id)}
        <li>
          <img src={ikonaDostignuca(d.id)} alt="" width="28" height="28" />
          <span>{d.id} · razina {d.novaRazina}/{d.maksimalnaRazina}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="akcije" class:ceka={navigacijaUTijeku}>
    {#if uspjeh && sljedeci}
      <a
        class="primarni"
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
        }}>Idi na sljedeći izazov</a
      >
      <a class="sporedni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Odaberi drugi izazov</a
      >
      {#if challengeId}
        <a
          class="tercijarni"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Igraj ovaj izazov ponovno</a
        >
      {/if}
    {:else if challengeId && !uspjeh}
      <a
        class="primarni"
        href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
        data-testid="izazov-ponovo"
        onclick={naNavigaciju}>Pokušaj ponovno</a
      >
      <a class="sporedni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Odaberi neki drugi izazov</a
      >
    {:else}
      <a class="primarni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Odaberi drugi izazov</a
      >
      {#if challengeId}
        <a
          class="sporedni"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Igraj ovaj izazov ponovno</a
        >
      {/if}
    {/if}
  </div>

  {#if !jeRegistriranKorisnik()}
    <div class="gost" data-testid="izazov-gost-cta">
      <p class="gost-cta">
        Registracijom novog računa zadržavaš napredak s ovog uređaja. Prijava na
        <strong>postojeći</strong> račun ne spaja gost progres.
      </p>
      <div class="gost-akcije">
        <a href="/registracija">Registriraj se</a>
        <a href="/prijava">Prijavi se</a>
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
  h2 {
    margin: 0;
    font-size: var(--naslov-3);
  }
  .opis {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .uvjeti {
    display: grid;
    gap: 10px;
  }
  .uvjeti-naslov {
    margin: 0;
    font-size: var(--tekst-baza);
    font-weight: 800;
  }
  .podciljevi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .podciljevi li {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--boja-obrub);
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
    background: var(--boja-povrsina-2);
  }
  .podciljevi li.met {
    border-color: var(--boja-uspjeh-tekst);
    color: var(--boja-uspjeh-tekst);
    background: var(--boja-uspjeh-pozadina);
    font-weight: 700;
  }
  .podciljevi li.prekseno {
    border-color: var(--boja-poraz-tekst);
    color: var(--boja-poraz-tekst);
    background: var(--boja-poraz-pozadina);
    font-weight: 700;
  }
  .pending {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .nagrade {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 12px;
    margin: 0;
    padding: 14px 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .nagrada {
    display: inline-flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin: 0;
    min-width: min(100%, 180px);
    flex: 1 1 180px;
    padding: 4px 0;
  }
  .nagrada strong {
    white-space: nowrap;
  }
  .level-up {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .level-up-red strong {
    color: var(--boja-isticanje-tekst);
  }
  .dostignuca {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .dostignuca li {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .akcije a {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    border-radius: var(--radijus-pill);
    font-weight: 700;
    text-decoration: none;
  }
  .primarni {
    background: var(--boja-pozadina-primarna);
    color: var(--boja-tekst-na-primarnoj, #fff);
  }
  .primarni.onesposobljen {
    opacity: 0.6;
    cursor: wait;
  }
  .sporedni {
    border: 1px solid var(--boja-obrub);
    color: inherit;
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
    gap: 16px;
  }
  @media (min-width: 720px) {
    .nagrade {
      align-items: center;
    }
    .nagrada {
      flex: 0 1 auto;
      min-width: 0;
      padding-right: 16px;
      border-right: 1px solid var(--boja-obrub);
    }
    .nagrada:last-child {
      border-right: 0;
      padding-right: 0;
    }
  }
</style>
