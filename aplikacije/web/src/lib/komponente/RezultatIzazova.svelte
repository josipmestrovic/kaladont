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
  import { sljedeciDostupanIzazov, tekstRazlogaNeuspjeha } from '$lib/izazovi-klijent.js';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  let {
    kraj,
    challengeId = null,
    goalProgress = null,
    terminalStatus = null,
    terminalReason = null,
    gameWon = null,
  }: {
    kraj: KrajPartije;
    challengeId?: IdIzazova | null;
    goalProgress?: GoalProgressIzazova | null;
    terminalStatus?: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto' | string | null;
    terminalReason?: string | null;
    gameWon?: boolean | null;
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

  const levelOdigranog = $derived(((): LevelIzazova => {
    if (challengeId && jeIdIzazova(challengeId)) {
      return pokusajDefinicijuIzazova(challengeId)?.level ?? 1;
    }
    return 1;
  })());
  const mapaHref = $derived(`/izazovi?level=${levelOdigranog}`);
  const sljedeci = $derived(
    uspjeh && challengeId && jeIdIzazova(challengeId)
      ? sljedeciDostupanIzazov(challengeId)
      : null,
  );
  let navigacijaUTijeku = $state(false);

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
  <h2 id="rezultat-izazova-naslov">{naslov}</h2>
  {#if challengeId}
    <p class="challenge-id">{challengeId}</p>
  {/if}

  {#if terminalStatus === 'tehnicki_prekinuto'}
    <p class="opis">Pokušaj je prekinut zbog tehničke greške. Možeš pokušati ponovno.</p>
  {:else if uspjeh}
    <p class="opis">Svi ciljevi su ispunjeni.</p>
  {:else if gameWonBezCilja}
    <p class="opis" data-testid="izazov-cilj-neispunjen">
      {tekstRazlogaNeuspjeha('cilj_neispunjen')}
    </p>
  {:else}
    <p class="opis">{tekstRazlogaNeuspjeha(terminalReason as never)}</p>
  {/if}

  {#if goalProgress}
    <ul class="podciljevi" aria-label="Podciljevi">
      <li class:met={pobjedaPartije}>Pobjeda</li>
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
        <li class:met={goalProgress.dugeRijeci.met} data-testid="izazov-rezultat-duge">
          Duge (≥{PRAG_DUGE_RIJECI_IZAZOVA}) {goalProgress.dugeRijeci.current}/{goalProgress.dugeRijeci.required}
        </li>
      {/if}
      {#if goalProgress.rijetkeRijeci.required > 0}
        <li class:met={goalProgress.rijetkeRijeci.met}>
          Rijetke {goalProgress.rijetkeRijeci.current}/{goalProgress.rijetkeRijeci.required}
        </li>
      {/if}
      {#if goalProgress.uspjesanDokaz.required > 0}
        <li class:met={goalProgress.uspjesanDokaz.met}>
          Dokaz {goalProgress.uspjesanDokaz.current}/{goalProgress.uspjesanDokaz.required}
        </li>
      {/if}
    </ul>
  {/if}

  {#if pending}
    <p class="pending" role="status" data-testid="izazov-settlement-pending">
      Nagrada se još sprema…
    </p>
  {:else if settlement}
    <div class="nagrade" aria-label="Nagrade izazova">
      <p>
        <span>XP izazova</span>
        <strong data-testid="izazov-challenge-xp">{prikaziXp(settlement.challengeXp)}</strong>
      </p>
      {#if settlement.missionXp.nominal > 0 || settlement.missionXp.awarded > 0}
        <p>
          <span>XP misija</span>
          <strong>{prikaziXp(settlement.missionXp)}</strong>
        </p>
      {/if}
      <p class="izazivac" aria-label={`Izazivač: ${settlement.izazivac.zvjezdice} zvjezdica`}>
        <span>Izazivač</span>
        <span class="zvjezdice">
          {#each Array.from({ length: 5 }, (_, i) => i < settlement.izazivac.zvjezdice) as puna}
            <img
              src={puna ? '/ikone/27-zvjezdica-puna.png' : '/ikone/26-zvjezdica-prazna.png'}
              alt=""
              aria-hidden="true"
              width="20"
              height="20"
            />
          {/each}
        </span>
      </p>
      {#if settlement.izazivac.novaRazina > 0}
        <p class="level-up">Nova razina Izazivača: {settlement.izazivac.novaRazina}</p>
      {/if}
    </div>
    {#if settlement.novaDostignuca.length > 0}
      <ul class="dostignuca" aria-label="Nova dostignuća">
        {#each settlement.novaDostignuca as d (d.id)}
          <li>
            <img src={ikonaDostignuca(d.id)} alt="" width="28" height="28" />
            <span>{d.id} · razina {d.novaRazina}/{d.maksimalnaRazina}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  {#if kraj.ukupnoIskustvo}
    <p class="level" data-testid="izazov-level">
      LVL {kraj.ukupnoIskustvo.poslije.razina}
      {#if kraj.ukupnoIskustvo.prije.razina !== kraj.ukupnoIskustvo.poslije.razina}
        <span class="level-up">
          ({kraj.ukupnoIskustvo.prije.razina} → {kraj.ukupnoIskustvo.poslije.razina})
        </span>
      {/if}
    </p>
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
        }}>Igraj sljedeći: {sljedeci.naziv}</a
      >
      {#if challengeId}
        <a
          class="sporedni"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Pokušaj ponovno</a
        >
      {/if}
      <a class="sporedni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Svi izazovi</a
      >
    {:else if challengeId && !uspjeh}
      <a
        class="primarni"
        href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
        data-testid="izazov-ponovo"
        onclick={naNavigaciju}>Pokušaj ponovno</a
      >
      <a class="sporedni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Odaberi izazov</a
      >
    {:else}
      <a class="primarni" href={mapaHref} data-testid="izazov-odaberi" onclick={naNavigaciju}
        >Odaberi izazov</a
      >
      {#if challengeId}
        <a
          class="sporedni"
          href={`/izazovi?zapocni=${challengeId}&level=${levelOdigranog}`}
          data-testid="izazov-ponovo"
          onclick={naNavigaciju}>Pokušaj ponovno</a
        >
      {/if}
    {/if}
  </div>

  {#if !jeRegistriranKorisnik()}
    <p class="gost-cta" data-testid="izazov-gost-cta">
      Registracijom novog računa zadržavaš napredak s ovog uređaja. Prijava na
      <strong>postojeći</strong> račun ne spaja gost progres.
    </p>
    <div class="gost-akcije">
      <a href="/registracija">Registriraj se</a>
      <a href="/prijava">Prijavi se</a>
    </div>
  {/if}
</section>

<style>
  .rezultat-izazova {
    max-width: 480px;
    margin: 0 auto;
    padding: 8px 0 24px;
  }
  h2 {
    margin: 0 0 4px;
    font-size: var(--naslov-3);
  }
  .challenge-id {
    margin: 0 0 12px;
    color: var(--boja-tekst-sekundarni);
    font-weight: 700;
  }
  .opis {
    margin: 0 0 16px;
  }
  .podciljevi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }
  .podciljevi li {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--boja-obrub);
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }
  .podciljevi li.met {
    border-color: var(--boja-isticanje-tekst);
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .podciljevi li.prekseno {
    border-color: var(--boja-opasnost, #b00020);
    color: var(--boja-opasnost, #b00020);
    font-weight: 700;
  }
  .pending {
    margin: 0 0 16px;
    color: var(--boja-tekst-sekundarni);
  }
  .nagrade {
    display: grid;
    gap: 8px;
    margin: 0 0 16px;
    padding: 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .nagrade p {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 0;
  }
  .zvjezdice {
    display: inline-flex;
    gap: 2px;
  }
  .level-up {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .dostignuca {
    margin: 0 0 16px;
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
  .level {
    margin: 0 0 16px;
    font-weight: 700;
  }
  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
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
  .gost-cta {
    margin: 0 0 8px;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }
  .gost-akcije {
    display: flex;
    gap: 16px;
  }
</style>
