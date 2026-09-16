<script lang="ts">
  import { IZDANJA } from '$lib/izdanja.js';
  import StatistikaRjecnika from './StatistikaRjecnika.svelte';

  let { zatvori = () => undefined, pogled = 'novosti' } = $props<{ zatvori?: () => void; pogled?: 'novosti' | 'o-igri' | 'uvjeti' | 'privatnost' }>();
  let odabranaVerzija = $state(IZDANJA[0]?.verzija ?? '');
  let prikaziStarija = $state(false);
  const odabrano = $derived(IZDANJA.find((izdanje) => izdanje.verzija === odabranaVerzija) ?? IZDANJA[0]);
  const prikazanaIzdanja = $derived(prikaziStarija ? IZDANJA : IZDANJA.slice(0, 3));
</script>

<div class="podloga" role="presentation" onclick={zatvori}>
  <div class="sadrzaj" role="dialog" aria-modal="true" aria-label="Što je novo" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && zatvori()}>
    <button class="zatvori" type="button" aria-label="Zatvori" onclick={zatvori}>×</button>
    {#if pogled === 'novosti'}
      <h2>Što je novo</h2>
      <nav class="izdanja" aria-label="Izdanja">
        {#each prikazanaIzdanja as izdanje (izdanje.verzija)}
          <button type="button" class:odabrano={izdanje.verzija === odabranaVerzija} onclick={() => (odabranaVerzija = izdanje.verzija)}>
            {izdanje.verzija}
          </button>
        {/each}
      </nav>
      {#if !prikaziStarija && IZDANJA.length > 3}
        <button type="button" class="starija-izdanja" onclick={() => (prikaziStarija = true)}>Učitaj starije verzije</button>
      {/if}
    {:else if pogled === 'o-igri'}
      <h2>O igri</h2>
      <p class="tekst">Kaladont je hrvatska igra riječi u kojoj svaki potez određuje nastavak za sljedećeg igrača. Posebnost riječi „kaladont” je završetak „nt”, nakon kojeg nema hrvatskog nastavka.</p>
      <h4>Rječnik i licenca</h4>
      <p class="tekst">Popis riječi izveden je iz leksikona <strong>hrLex 1.3</strong> (Nikola Ljubešić, CLARIN.SI, <a href="http://hdl.handle.net/11356/1232" target="_blank" rel="noreferrer">hdl.handle.net/11356/1232</a>), dostupnog pod licencom <strong>CC BY-SA 4.0</strong>.</p>
      <p class="tekst">Za potrebe igre popis je filtriran bez vlastitih imena i kratica te obogaćen grafemskim parovima i leksemskim grupama. Izvedeni popis dostupan je pod istom licencom na zahtjev.</p>
      <StatistikaRjecnika />
      <h4>Kontakt</h4>
      <p class="tekst">Pitanja, prijedlozi ili prijave grešaka: koristi gumb „Prijavi” u igri ili piši na <a href="mailto:kontakt@kaladont.hr">kontakt@kaladont.hr</a>.</p>
      <p class="poveznica"><a href="/pomoc?tema=kako-igrati">Otvori cijeli vodič Pomoć →</a></p>
    {:else if pogled === 'uvjeti'}
      <h2>Uvjeti</h2>
      <p class="tekst">Uvjeti korištenja bit će dopunjeni prije šireg otvaranja igre.</p>
    {:else}
      <h2>Privatnost</h2>
      <p class="tekst">Pravila privatnosti bit će dopunjena prije šireg otvaranja igre.</p>
    {/if}

    {#if pogled === 'novosti' && odabrano}
      <article class="biljeske">
        <h3>{odabrano.naslov}</h3>
        <p class="uvod">{odabrano.uvod}</p>
        <p class="datum">{odabrano.datum}</p>
        <h4>Novo</h4>
        {#each odabrano.novo as odjeljak}
          <section>
            <h5>{odjeljak.naslov}</h5>
            <ul>{#each odjeljak.stavke as stavka}<li>{stavka}</li>{/each}</ul>
          </section>
        {/each}
      </article>
    {/if}
  </div>
</div>

<style>
  .podloga { position: fixed; z-index: 150; inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(26 24 21 / 55%); }
  .sadrzaj { position: relative; width: min(760px, 100%); max-height: 88vh; overflow: auto; padding: 28px; border-radius: 12px; background: var(--boja-krem); box-shadow: 0 16px 60px rgb(0 0 0 / 28%); }
  .zatvori { position: absolute; top: 12px; right: 16px; border: 0; background: none; font-size: 28px; cursor: pointer; }
  h2 { margin: 0 0 16px; }
  .izdanja { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .izdanja button { padding: 8px 12px; border: 1px solid #e5ddc8; border-radius: 8px; background: white; color: var(--boja-tekst-osnovni); cursor: pointer; font: inherit; font-size: var(--tekst-mali); }
  .izdanja button.odabrano { border-color: var(--boja-mint); background: var(--boja-mint); color: white; }
  .starija-izdanja { margin: -12px 0 18px; padding: 0; border: 0; background: none; color: var(--boja-mint); font: inherit; font-weight: 700; cursor: pointer; }
  .datum { margin: 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  h3 { margin: 4px 0 10px; font-family: var(--font-naslov); font-size: 1.45rem; }
  h4 { margin: 24px 0 10px; font-family: var(--font-naslov); color: var(--boja-tekst-naslov); font-size: 1.25rem; }
  h5 { margin: 18px 0 6px; font-size: 1.1rem; }
  .uvod { line-height: 1.6; font-size: 1.05rem; }
  li { margin: 7px 0; line-height: 1.55; font-size: 1.02rem; }
  .tekst { line-height: 1.65; font-size: 1.02rem; }
</style>
