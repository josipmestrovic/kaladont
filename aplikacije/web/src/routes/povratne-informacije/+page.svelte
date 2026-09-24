<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';

  type KljucOcjene = 'pravila' | 'rjecnik' | 'vrijemePoteza' | 'snalazenjeUAplikaciji' | 'brzinaUcitavanja' | 'gamifikacija';
  const pitanja: { kljuc: KljucOcjene; naziv: string }[] = [
    { kljuc: 'pravila', naziv: 'Pravila' },
    { kljuc: 'rjecnik', naziv: 'Rječnik' },
    { kljuc: 'vrijemePoteza', naziv: 'Vrijeme za potez' },
    { kljuc: 'snalazenjeUAplikaciji', naziv: 'Snalaženje u aplikaciji' },
    { kljuc: 'brzinaUcitavanja', naziv: 'Brzina učitavanja' },
    { kljuc: 'gamifikacija', naziv: 'Gamifikacija: iskustvo, dostignuća i Kaladont DNK' },
  ];

  let poruka = $state('');
  let prikaziAnketu = $state(true);
  let anketaIspunjena = $state(false);
  let ocjene = $state<Partial<Record<KljucOcjene, number>>>({});
  let greska = $state<string | null>(null);
  let saljeSe = $state(false);

  onMount(async () => {
    try {
      const stanje = await api<{ anketaIspunjena: boolean }>('/povratne-informacije/stanje');
      anketaIspunjena = stanje.anketaIspunjena;
      prikaziAnketu = !stanje.anketaIspunjena;
    } catch (razlog) {
      const porukaGreske = razlog instanceof Error ? razlog.message : 'Povratne informacije nisu dostupne.';
      if (porukaGreske.includes('Potrebna je prijava')) {
        await goto('/prijava');
        return;
      }
      greska = porukaGreske;
    }
  });

  function postaviOcjenu(kljuc: KljucOcjene, ocjena: number) {
    ocjene = { ...ocjene, [kljuc]: ocjena };
  }

  async function posalji(dogadaj: SubmitEvent) {
    dogadaj.preventDefault();
    greska = null;
    if (poruka.trim().length < 20) {
      greska = 'Prekratka poruka.';
      return;
    }
    if (prikaziAnketu && pitanja.some((pitanje) => !ocjene[pitanje.kljuc])) {
      greska = 'Odaberi ocjenu za svako pitanje.';
      return;
    }
    saljeSe = true;
    try {
      await api('/povratne-informacije', {
        method: 'POST',
        body: JSON.stringify({ poruka, ...(prikaziAnketu ? { ocjene } : {}) }),
      });
      await goto('/zahvala-za-informacije');
    } catch (razlog) {
      greska = razlog instanceof Error ? razlog.message : 'Slanje nije uspjelo.';
    } finally {
      saljeSe = false;
    }
  }
</script>

<svelte:head>
  <title>Pomozi poboljšati igru | Kaladont</title>
  <meta name="description" content="Pošalji povratnu informaciju i pomozi u poboljšanju Kaladonta." />
</svelte:head>

<main class="povratne-informacije">
  <header>
    <p class="nadnaslov">Glas zajednice</p>
    <h1>Pomozi poboljšati igru</h1>
    <p>Opiši što ti se sviđa, što te koči ili što bi promijenio.</p>
  </header>

  <form onsubmit={posalji}>
    <label for="poruka">Tvoja poruka</label>
    <textarea id="poruka" bind:value={poruka} minlength="20" maxlength="2000" required placeholder="Napiši nam svoje mišljenje..." />
    <p class="pomocni-tekst">Najmanje 20 znakova.</p>

    {#if !anketaIspunjena}
      <label class="checkbox-redak">
        <input type="checkbox" bind:checked={prikaziAnketu} />
        <span>Želim ocijeniti igru i time pomoći u daljnjem razvoju.</span>
      </label>

      {#if prikaziAnketu}
        <section class="anketa" aria-labelledby="ocjene-naslov">
          <h2 id="ocjene-naslov">Ocijeni igru</h2>
          {#each pitanja as pitanje}
            <fieldset>
              <legend>{pitanje.naziv}</legend>
              <div class="zvjezdice" aria-label={`Ocjena: ${pitanje.naziv}`}>
                {#each [1, 2, 3, 4, 5] as ocjena}
                  <button
                    type="button"
                    class:odabrana={(ocjene[pitanje.kljuc] ?? 0) >= ocjena}
                    aria-label={`${ocjena} od 5`}
                    aria-pressed={ocjene[pitanje.kljuc] === ocjena}
                    onclick={() => postaviOcjenu(pitanje.kljuc, ocjena)}
                  >★</button>
                {/each}
              </div>
            </fieldset>
          {/each}
        </section>
      {/if}
    {/if}

    {#if greska}<p class="greska" role="alert">{greska}</p>{/if}
    <button type="submit" disabled={saljeSe}>{saljeSe ? 'Šaljem...' : 'Pošalji'}</button>
  </form>
</main>

<style>
  .povratne-informacije { width: min(680px, 100%); margin: 0 auto; padding: 36px 0 64px; }
  header { margin-bottom: 28px; }
  h1 { margin: 0; }
  header p:last-child { color: var(--boja-tekst-sekundarni); }
  .nadnaslov { margin: 0 0 5px; color: var(--boja-akcent); font-size: var(--tekst-sitni); font-weight: 800; text-transform: uppercase; }
  form { display: grid; gap: 12px; }
  label { font-weight: 700; }
  textarea { min-height: 180px; padding: 12px; border: 1px solid #d8cfb8; border-radius: 6px; font: inherit; resize: vertical; }
  .pomocni-tekst { margin: -7px 0 8px; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .checkbox-redak { display: flex; align-items: start; gap: 9px; padding: 14px; border: 1px solid #d8cfb8; border-radius: 6px; }
  .checkbox-redak input { margin-top: 3px; }
  .anketa { display: grid; gap: 14px; padding: 18px; border: 1px solid #d8cfb8; border-radius: 6px; }
  .anketa h2 { margin: 0; font-size: 24px; }
  fieldset { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0; border: 0; }
  legend { font-weight: 700; }
  .zvjezdice { display: flex; gap: 4px; }
  .zvjezdice button { padding: 0; border: 0; background: transparent; color: #c8c0a9; font-size: 28px; line-height: 1; cursor: pointer; }
  .zvjezdice button.odabrana { color: var(--boja-akcent); }
  .greska { color: #b3261e; font-weight: 700; }
  form > button { justify-self: start; padding: 11px 20px; border: 0; border-radius: 6px; background: var(--boja-mint); color: white; font: inherit; font-weight: 800; cursor: pointer; }
  form > button:disabled { opacity: .65; cursor: wait; }
  @media (max-width: 599px) { fieldset { display: grid; } }
</style>
