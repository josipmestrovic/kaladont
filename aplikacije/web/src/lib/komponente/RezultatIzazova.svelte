<script lang="ts">
  import type {
    GoalProgressIzazova,
    IdIzazova,
    KrajPartije,
    SettlementIzazovaDto,
  } from 'zajednicko';
  import { ID_OVI_IZAZOVA } from 'zajednicko';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { tekstRazlogaNeuspjeha } from '$lib/izazovi-klijent.js';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  let {
    kraj,
    challengeId = null,
    goalProgress = null,
    terminalStatus = null,
    terminalReason = null,
  }: {
    kraj: KrajPartije;
    challengeId?: IdIzazova | null;
    goalProgress?: GoalProgressIzazova | null;
    terminalStatus?: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto' | string | null;
    terminalReason?: string | null;
  } = $props();

  const settlement = $derived(kraj.izazovSettlement ?? null);
  const uspjeh = $derived(terminalStatus === 'uspjeh');
  const pending = $derived(settlement?.settlementState === 'spremanje_u_tijeku');
  const gameWonBezCilja = $derived(
    !uspjeh && terminalReason === 'cilj_neispunjen',
  );

  const sljedeciId = $derived(((): IdIzazova | null => {
    if (!challengeId || !uspjeh) return null;
    const idx = ID_OVI_IZAZOVA.indexOf(challengeId);
    if (idx < 0 || idx >= ID_OVI_IZAZOVA.length - 1) return null;
    return ID_OVI_IZAZOVA[idx + 1]!;
  })());

  const naslov = $derived(
    terminalStatus === 'tehnicki_prekinuto'
      ? 'Tehnički prekid'
      : uspjeh
        ? 'Izazov uspješan!'
        : gameWonBezCilja
          ? 'Pobjeda bez cilja'
          : 'Izazov nije uspio',
  );

  function prikaziXp(dio: SettlementIzazovaDto['challengeXp'] | null | undefined): string {
    if (!dio) return '—';
    if (dio.awarded === 0 && dio.nominal > 0) return `0 / ${dio.nominal} XP`;
    return `+${dio.awarded} XP`;
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
      <li class:met={false}>Pobjeda</li>
      {#if goalProgress.bezPogreske.required}
        <li class:met={goalProgress.bezPogreske.met}>Bez pogreške</li>
      {/if}
      {#if goalProgress.dugeRijeci.required > 0}
        <li class:met={goalProgress.dugeRijeci.met}>
          Duge {goalProgress.dugeRijeci.current}/{goalProgress.dugeRijeci.required}
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

  <div class="akcije">
    {#if uspjeh && sljedeciId && !pending}
      <a class="primarni" href={`/izazovi?zapocni=${sljedeciId}`} data-testid="izazov-sljedeci"
        >Sljedeći izazov</a
      >
    {:else if challengeId}
      <a class="primarni" href={`/izazovi?zapocni=${challengeId}`} data-testid="izazov-ponovo"
        >Pokušaj ponovno</a
      >
    {/if}
    <a class="sporedni" href="/izazovi" data-testid="izazov-svi">Svi izazovi</a>
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
