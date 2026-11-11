<script lang="ts">
  import type { ObracunIskustva, UkupnoIskustvoIshoda } from 'zajednicko';

  let {
    obracun = null,
    ukupnoIskustvo = null,
  }: {
    obracun?: ObracunIskustva | null;
    ukupnoIskustvo?: UkupnoIskustvoIshoda | null;
  } = $props();

  const konacno = $derived(ukupnoIskustvo?.poslije ?? obracun?.poslije ?? null);
  const prikazOsvojenog = $derived(
    ukupnoIskustvo ? ukupnoIskustvo.ukupnoXpStvarno : (obracun?.osvojenoIskustvo ?? 0),
  );
  const postotak = $derived(
    !konacno || konacno.doIduce === null ? 100 : (konacno.uRazini / konacno.doIduce) * 100,
  );
  const imaSadrzaj = $derived(Boolean(konacno) && (obracun || ukupnoIskustvo));
</script>

{#if imaSadrzaj && konacno}
  <section class="iskustvo-partije" aria-label="Osvojeno iskustvo">
    <header>
      <strong>LVL {konacno.razina}</strong>
      <strong>+{prikazOsvojenog} XP</strong>
    </header>
    {#if konacno.doIduce === null}
      <p class="max">MAX</p>
    {:else}
      <p>{konacno.uRazini} / {konacno.doIduce} XP do sljedeće razine</p>
      <div class="traka" aria-label={`Napredak: ${konacno.uRazini} od ${konacno.doIduce} XP`}><span style={`width: ${postotak}%`}></span></div>
    {/if}
    {#if ukupnoIskustvo && (ukupnoIskustvo.prije.razina !== ukupnoIskustvo.poslije.razina)}
      <p class="razina-povecana">Razina povećana: {ukupnoIskustvo.prije.razina} → {ukupnoIskustvo.poslije.razina}</p>
    {:else if obracun && obracun.prije.razina !== obracun.poslije.razina && !ukupnoIskustvo}
      <p class="razina-povecana">Razina povećana: {obracun.prije.razina} → {obracun.poslije.razina}</p>
    {/if}
    {#if ukupnoIskustvo && (ukupnoIskustvo.partijskiXpStvarno > 0 || ukupnoIskustvo.misijskiXpStvarno > 0)}
      <ul class="izvori">
        <li><span>Iz igre</span><strong>+{ukupnoIskustvo.partijskiXpStvarno} XP</strong></li>
        <li><span>Iz misija</span><strong>+{ukupnoIskustvo.misijskiXpStvarno} XP</strong></li>
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
{/if}

<style>
  .iskustvo-partije { margin: 24px 0 0; padding: 16px; border: 1px solid var(--boja-obrub); border-radius: 8px; background: var(--boja-povrsina-2); }
  header, li { display: flex; justify-content: space-between; gap: 12px; }
  header { color: var(--boja-isticanje-tekst); font-size: calc(var(--tekst-baza) * 1.2); }
  p { margin: 8px 0; color: var(--boja-tekst-sekundarni); }
  .max, .razina-povecana { color: var(--boja-isticanje-tekst); font-weight: 700; }
  .traka { height: 8px; overflow: hidden; border-radius: 4px; background: var(--boja-krem); }
  .traka span { display: block; height: 100%; background: var(--boja-isticanje-tekst); }
  ul { display: grid; gap: 6px; margin: 16px 0 0; padding: 0; list-style: none; }
  .izvori { margin-top: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--boja-obrub); }
</style>
