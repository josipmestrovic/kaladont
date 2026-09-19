<script lang="ts">
  import { IZDANJA } from '$lib/izdanja.js';

  let odabranaVerzija = $state(IZDANJA[0]?.verzija ?? '');
  let prikaziStarija = $state(false);
  const odabrano = $derived(IZDANJA.find((izdanje) => izdanje.verzija === odabranaVerzija) ?? IZDANJA[0]);
  const prikazanaIzdanja = $derived(prikaziStarija ? IZDANJA : IZDANJA.slice(0, 3));
</script>

<svelte:head>
  <title>Što je novo | Kaladont</title>
  <meta name="description" content="Pregled novosti, poboljšanja i poznatih ograničenja u posljednjim izdanjima Kaladonta." />
</svelte:head>

<main class="novosti">
  <header class="zaglavlje">
    <p class="nadnaslov">Razvoj igre</p>
    <h1>Što je novo</h1>
    <p>Novosti, poboljšanja i stvari koje vrijedi isprobati u posljednjim izdanjima.</p>
  </header>

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

  {#if odabrano}
    <article class="biljeske">
      <p class="datum">{odabrano.datum}</p>
      <h2>{odabrano.naslov}</h2>
      <p class="uvod">{odabrano.uvod}</p>

      <section>
        <h3>Novo</h3>
        {#each odabrano.novo as odjeljak}
          <div class="odjeljak">
            <h4>{odjeljak.naslov}</h4>
            <ul>{#each odjeljak.stavke as stavka}<li>{stavka}</li>{/each}</ul>
          </div>
        {/each}
      </section>

      {#if odabrano.testirati.length > 0}
        <section>
          <h3>Što isprobati</h3>
          <ul>{#each odabrano.testirati as stavka}<li>{stavka}</li>{/each}</ul>
        </section>
      {/if}

      {#if odabrano.ogranicenja.length > 0}
        <section>
          <h3>Poznata ograničenja</h3>
          <ul>{#each odabrano.ogranicenja as stavka}<li>{stavka}</li>{/each}</ul>
        </section>
      {/if}
    </article>
  {/if}
</main>

<style>
  .novosti {
    width: min(780px, 100%);
    margin: 0 auto;
    padding: 36px 0 64px;
  }

  .zaglavlje { margin-bottom: 28px; }
  .zaglavlje h1 { margin: 0; }
  .zaglavlje > p:last-child { margin: 8px 0 0; color: var(--boja-tekst-sekundarni); }

  .nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  .izdanja { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .izdanja button {
    padding: 9px 13px;
    border: 1px solid #d8cfb8;
    border-radius: 8px;
    background: white;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-mali);
    cursor: pointer;
  }
  .izdanja button.odabrano { border-color: var(--boja-mint); background: var(--boja-mint); color: white; }

  .starija-izdanja {
    margin: -8px 0 20px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--boja-mint);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .biljeske { padding-top: 24px; border-top: 1px solid #d8cfb8; }
  .datum { margin: 0 0 5px; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  .biljeske h2 { margin-bottom: 10px; font-size: 34px; line-height: 1.1; }
  .uvod { margin: 0 0 28px; color: var(--boja-tekst-sekundarni); font-size: 1.05rem; line-height: 1.65; }
  .biljeske section { padding: 22px 0; border-top: 1px solid #e5ddc8; }
  .biljeske h3 { margin-bottom: 16px; font-size: 25px; }
  .odjeljak + .odjeljak { margin-top: 22px; }
  .odjeljak h4 { margin: 0 0 8px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: 20px; }
  ul { margin: 0; padding-left: 22px; }
  li { margin: 7px 0; line-height: 1.55; }

  @media (max-width: 767px) {
    .novosti { padding: 28px 0 48px; }
    .biljeske h2 { font-size: 28px; }
  }
</style>