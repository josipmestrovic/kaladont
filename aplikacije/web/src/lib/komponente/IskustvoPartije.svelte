<script lang="ts">
  import type { ObracunIskustva } from 'zajednicko';

  let { obracun }: { obracun: ObracunIskustva } = $props();
  const postotak = $derived(
    obracun.poslije.doIduce === null ? 100 : (obracun.poslije.uRazini / obracun.poslije.doIduce) * 100,
  );
</script>

<section class="iskustvo-partije" aria-label="Osvojeno iskustvo">
  <header>
    <strong>LVL {obracun.poslije.razina}</strong>
    <strong>+{obracun.osvojenoIskustvo} XP</strong>
  </header>
  {#if obracun.poslije.doIduce === null}
    <p class="max">MAX</p>
  {:else}
    <p>{obracun.poslije.uRazini} / {obracun.poslije.doIduce} XP do sljedeće razine</p>
    <div class="traka" aria-label={`Napredak: ${obracun.poslije.uRazini} od ${obracun.poslije.doIduce} XP`}><span style={`width: ${postotak}%`}></span></div>
  {/if}
  {#if obracun.prije.razina !== obracun.poslije.razina}
    <p class="razina-povecana">Razina povećana: {obracun.prije.razina} → {obracun.poslije.razina}</p>
  {/if}
  <ul>
    {#each obracun.stavke as stavka (`${stavka.vrsta}-${stavka.naziv}`)}
      <li><span>{stavka.naziv}{stavka.poStavci !== null ? ` ${stavka.kolicina} × ${stavka.poStavci}` : ''}</span><strong>+{stavka.iskustvo}</strong></li>
    {/each}
  </ul>
</section>

<style>
  .iskustvo-partije { margin: 16px 0; padding: 16px; border: 1px solid #e5ddc8; border-radius: 8px; background: #fffdf5; }
  header, li { display: flex; justify-content: space-between; gap: 12px; }
  header { color: var(--boja-mint); font-size: var(--tekst-veliki); }
  p { margin: 8px 0; color: var(--boja-tekst-sekundarni); }
  .max, .razina-povecana { color: var(--boja-mint); font-weight: 700; }
  .traka { height: 8px; overflow: hidden; border-radius: 4px; background: #e5ddc8; }
  .traka span { display: block; height: 100%; background: var(--boja-mint); }
  ul { display: grid; gap: 6px; margin: 16px 0; padding: 0; list-style: none; }
</style>
