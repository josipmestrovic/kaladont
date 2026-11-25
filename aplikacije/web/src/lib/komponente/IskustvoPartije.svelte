<script lang="ts">
  import type { ObracunIskustva, StanjeIskustva, UkupnoIskustvoIshoda } from 'zajednicko';

  let {
    obracun = null,
    ukupnoIskustvo = null,
    /** Izazovi: kampanjski XP (awarded). Kad je postavljen, ukupno = igra + kampanja + misije. */
    kampanjskiXp = null,
    kampanjskiXpNominal = null,
    /** Izazovi: eksplicitni konačni snapshot (poslije svih nagrada). */
    konacnoStanje = null,
    prijeStanje = null,
    forsirajUkupno = null,
  }: {
    obracun?: ObracunIskustva | null;
    ukupnoIskustvo?: UkupnoIskustvoIshoda | null;
    kampanjskiXp?: number | null;
    kampanjskiXpNominal?: number | null;
    konacnoStanje?: StanjeIskustva | null;
    prijeStanje?: StanjeIskustva | null;
    forsirajUkupno?: number | null;
  } = $props();

  const izazovniMod = $derived(kampanjskiXp != null);

  // Word XP iz obračuna riječi; u izazovnom modu ne koristi ukupno.partijski (to je challenge).
  const xpOdIgre = $derived((() => {
    const izRijeci = obracun?.osvojenoIskustvo;
    if (izRijeci != null && izRijeci > 0) return izRijeci;
    if (izazovniMod) return izRijeci ?? 0;
    return ukupnoIskustvo?.partijskiXpStvarno ?? 0;
  })());
  const xpMisija = $derived(ukupnoIskustvo?.misijskiXpStvarno ?? 0);
  const xpKampanja = $derived(Math.max(0, kampanjskiXp ?? 0));
  const konacno = $derived(konacnoStanje ?? ukupnoIskustvo?.poslije ?? obracun?.poslije ?? null);
  const prije = $derived(prijeStanje ?? ukupnoIskustvo?.prije ?? obracun?.prije ?? null);
  const prikazOsvojenog = $derived((() => {
    if (forsirajUkupno != null) return forsirajUkupno;
    if (izazovniMod) return xpOdIgre + xpKampanja + xpMisija;
    if (!ukupnoIskustvo) return xpOdIgre;
    if (obracun && obracun.osvojenoIskustvo > (ukupnoIskustvo.partijskiXpStvarno ?? 0)) {
      return obracun.osvojenoIskustvo + xpMisija;
    }
    return ukupnoIskustvo.ukupnoXpStvarno;
  })());
  const postotak = $derived(
    !konacno || konacno.doIduce === null ? 100 : (konacno.uRazini / konacno.doIduce) * 100,
  );
  const imaSadrzaj = $derived(
    Boolean(konacno) && (obracun || ukupnoIskustvo || izazovniMod || forsirajUkupno != null),
  );
  const prikaziIzvore = $derived(
    xpOdIgre > 0
      || xpMisija > 0
      || xpKampanja > 0
      || (kampanjskiXpNominal != null && kampanjskiXpNominal > 0)
      || Boolean(ukupnoIskustvo && ukupnoIskustvo.misijskiXpNominalno > 0),
  );
  const razinaPovecana = $derived(
    Boolean(prije && konacno && prije.razina !== konacno.razina),
  );
</script>

{#if imaSadrzaj && konacno}
  <section class="iskustvo-partije" aria-label="Osvojeno iskustvo" data-testid="iskustvo-partije">
    <header>
      <strong>LVL {konacno.razina}</strong>
      <strong data-testid="iskustvo-ukupno-xp">+{prikazOsvojenog} XP</strong>
    </header>
    {#if konacno.doIduce === null}
      <p class="max">MAX</p>
    {:else}
      <p>{konacno.uRazini} / {konacno.doIduce} XP do sljedeće razine</p>
      <div class="traka" aria-label={`Napredak: ${konacno.uRazini} od ${konacno.doIduce} XP`}><span style={`width: ${postotak}%`}></span></div>
    {/if}
    {#if razinaPovecana && prije}
      <p class="razina-povecana">Razina povećana: {prije.razina} → {konacno.razina}</p>
    {/if}
    {#if prikaziIzvore}
      <ul class="izvori">
        {#if xpOdIgre > 0 || !izazovniMod}
          <li data-testid="iskustvo-xp-igre">
            <span>XP od igre</span>
            <strong>+{xpOdIgre} XP</strong>
          </li>
        {/if}
        {#if izazovniMod && (xpKampanja > 0 || (kampanjskiXpNominal != null && kampanjskiXpNominal > 0))}
          <li data-testid="iskustvo-xp-izazova">
            <span>XP za prelazak izazova</span>
            <strong>
              {#if xpKampanja === 0 && kampanjskiXpNominal != null && kampanjskiXpNominal > 0}
                0 / {kampanjskiXpNominal} XP
              {:else}
                +{xpKampanja} XP
              {/if}
            </strong>
          </li>
        {/if}
        {#if xpMisija > 0 || (ukupnoIskustvo && ukupnoIskustvo.misijskiXpNominalno > 0)}
          <li data-testid="iskustvo-xp-misija">
            <span>XP misija</span>
            <strong>+{xpMisija} XP</strong>
          </li>
        {/if}
      </ul>
    {/if}
    {#if obracun}
      <ul>
        {#each obracun.stavke as stavka (`${stavka.vrsta}-${stavka.naziv}`)}
          <li>
            <span>{stavka.naziv}{stavka.poStavci !== null ? ` ${stavka.kolicina} × ${stavka.poStavci}` : ''}</span>
            <strong>+{stavka.iskustvo}</strong>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{:else if izazovniMod && (xpOdIgre > 0 || xpKampanja > 0 || xpMisija > 0)}
  <section class="iskustvo-partije" aria-label="Osvojeno iskustvo" data-testid="iskustvo-partije">
    <header>
      <strong data-testid="iskustvo-ukupno-xp">+{prikazOsvojenog} XP</strong>
    </header>
    <p class="bez-razine">Konačna razina nije dostupna za ovaj pokušaj.</p>
    <ul class="izvori">
      {#if xpOdIgre > 0}
        <li data-testid="iskustvo-xp-igre"><span>XP od igre</span><strong>+{xpOdIgre} XP</strong></li>
      {/if}
      {#if xpKampanja > 0 || (kampanjskiXpNominal != null && kampanjskiXpNominal > 0)}
        <li data-testid="iskustvo-xp-izazova">
          <span>XP za prelazak izazova</span>
          <strong>+{xpKampanja} XP</strong>
        </li>
      {/if}
      {#if xpMisija > 0}
        <li data-testid="iskustvo-xp-misija"><span>XP misija</span><strong>+{xpMisija} XP</strong></li>
      {/if}
    </ul>
  </section>
{/if}

<style>
  .iskustvo-partije { margin: 24px 0 0; padding: 16px; border: 1px solid var(--boja-obrub); border-radius: 8px; background: var(--boja-povrsina-2); }
  header, li { display: flex; justify-content: space-between; gap: 12px; }
  header { margin-bottom: 8px; }
  .traka { height: 8px; background: var(--boja-obrub); border-radius: 999px; overflow: hidden; margin: 6px 0 10px; }
  .traka span { display: block; height: 100%; background: var(--boja-pozadina-primarna); }
  .max, .razina-povecana, .bez-razine { margin: 0 0 8px; color: var(--boja-tekst-sekundarni); }
  .izvori, ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .izvori { margin-bottom: 10px; }
</style>
