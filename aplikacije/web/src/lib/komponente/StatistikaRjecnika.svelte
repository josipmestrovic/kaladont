<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatistikaRjecnika } from 'zajednicko';
  import { ADRESA_POSLUZITELJA } from '$lib/konfiguracija.js';

  /** Hrvatski nazivi kategorija u množini (redoslijed dolazi sortiran silazno s poslužitelja). */
  const NAZIVI: Record<string, string> = {
    imenica: 'Imenice',
    glagol: 'Glagoli',
    pridjev: 'Pridjevi',
    prilog: 'Prilozi',
    zamjenica: 'Zamjenice',
    broj: 'Brojevi',
    prijedlog: 'Prijedlozi',
    veznik: 'Veznici',
    cestica: 'Čestice',
    uzvik: 'Uzvici',
  };

  let statistika = $state<StatistikaRjecnika | null>(null);

  onMount(async () => {
    try {
      const odgovor = await fetch(`${ADRESA_POSLUZITELJA}/rjecnik/statistika`);
      if (odgovor.ok) statistika = (await odgovor.json()) as StatistikaRjecnika;
    } catch {
      // statistika je ukras naslovnice - bez nje stranica normalno radi
    }
  });

  const fmt = (n: number) => n.toLocaleString('hr-HR');
</script>

{#if statistika}
  <section class="statistika" aria-label="Statistika rječnika">
    <h2>U rječniku je {fmt(statistika.ukupno)} riječi</h2>
    <ul class="kategorije">
      {#each statistika.kategorije as kategorija (kategorija.vrsta)}
        <li>
          <span class="naziv">{NAZIVI[kategorija.vrsta] ?? kategorija.vrsta}</span>
          <span class="broj">{fmt(kategorija.brojOblika)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .statistika {
    max-width: 360px;
    margin: 32px auto 0;
  }

  h2 {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
    text-align: center;
    margin-bottom: 12px;
  }

  .kategorije {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }

  .kategorije li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    background: var(--boja-pozadina-kartica, #fff);
    border-radius: var(--radijus-kartica);
    padding: 8px 14px;
    box-shadow: var(--sjena-suptilna);
  }

  .naziv {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }

  .broj {
    font-family: var(--font-naslov);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
