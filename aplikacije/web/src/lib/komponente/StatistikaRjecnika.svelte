<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatistikaRjecnika, VrstaRijeci } from 'zajednicko';
  import { apiUrl } from '$lib/api-url.js';

  interface Props { prikaz?: 'pregled' | 'tablica'; }
  let { prikaz = 'pregled' }: Props = $props();

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
    uzvik: 'Usklici',
    vlastito_ime: 'Vlastita imena',
  };

  let statistika = $state<StatistikaRjecnika | null>(null);

  onMount(async () => {
    try {
      const odgovor = await fetch(apiUrl('/rjecnik/statistika'));
      if (odgovor.ok) statistika = (await odgovor.json()) as StatistikaRjecnika;
    } catch {
      // statistika je ukras naslovnice - bez nje stranica normalno radi
    }
  });

  const fmt = (n: number) => n.toLocaleString('hr-HR');
</script>

{#if statistika}
  {#if prikaz === 'tablica'}
    <section class="statistika-tablica" aria-label="Broj riječi po vrsti">
      <div class="tablica-omotac">
        <table>
          <thead><tr><th scope="col">Vrsta riječi</th><th scope="col">Broj oblika</th></tr></thead>
          <tbody>
            {#each statistika.kategorije as kategorija (kategorija.vrsta)}
              <tr><th scope="row">{NAZIVI[kategorija.vrsta as VrstaRijeci] ?? kategorija.vrsta}</th><td>{fmt(kategorija.brojOblika)}</td></tr>
            {/each}
            <tr class="ukupno"><th scope="row">Ukupno jedinstvenih oblika</th><td>{fmt(statistika.ukupno)}</td></tr>
          </tbody>
        </table>
      </div>
      <p>Jedan oblik može pripadati više vrsta riječi, zato zbroj kategorija može biti veći od ukupnog broja jedinstvenih oblika.</p>
    </section>
  {:else}
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
{/if}

<style>
  .statistika {
    max-width: 360px;
    margin: 32px auto 0;
  }

  h2 {
    font-size: var(--tekst-baza);
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
    background: var(--boja-povrsina);
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

  .statistika-tablica { margin: 14px 0; }
  .tablica-omotac { min-width: 0; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; background: var(--boja-povrsina); }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--boja-obrub); text-align: left; overflow-wrap: anywhere; }
  thead th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  tbody th { font-weight: 600; }
  td { text-align: right; font-variant-numeric: tabular-nums; }
  .ukupno th, .ukupno td { border-top: 2px solid var(--boja-obrub-jaci); font-weight: 800; }
  .statistika-tablica p { margin: 10px 0 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
</style>
