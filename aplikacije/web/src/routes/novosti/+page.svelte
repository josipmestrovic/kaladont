<script lang="ts">
  import { DEMO_BILJESKE } from '$lib/demo-novosti.js';
</script>

<svelte:head>
  <title>Što je novo | Kaladont</title>
  <meta name="description" content="Igraj Kaladont s ekipom, otključaj riječi, napreduj i uredi svoj avatar." />
</svelte:head>

<main class="novosti">
  <header class="zaglavlje">
    <p class="nadnaslov">Razvoj igre</p>
    <h1>Što je novo</h1>
    <p>Zaigraj riječima, izazovi prijatelje i pokaži što znaš.</p>
  </header>

  <article class="biljeske">
    <h2>{DEMO_BILJESKE.naslov}</h2>

    {#each DEMO_BILJESKE.odjeljci as odjeljak}
      <section class="odjeljak">
        <h3>{odjeljak.naslov}</h3>
        <ul>
          {#each odjeljak.stavke as stavka}
            <li>
              {#if stavka.istaknuto}
                <strong>{stavka.tekst}</strong>{stavka.nastavak}
              {:else}
                {stavka.tekst}
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    <p class="zavrsna-poruka">{DEMO_BILJESKE.zavrsnaPoruka}</p>
  </article>
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

  .biljeske { padding-top: 24px; border-top: 1px solid #d8cfb8; }
  .biljeske h2 { margin-bottom: 20px; font-size: 30px; line-height: 1.15; }
  .odjeljak { padding: 18px 0; border-top: 1px solid #e5ddc8; }
  .odjeljak h3 { margin: 0 0 10px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: 21px; }
  ul { margin: 0; padding-left: 22px; }
  li { margin: 7px 0; line-height: 1.55; }
  .zavrsna-poruka { margin: 18px 0 0; padding-top: 18px; border-top: 1px solid #e5ddc8; line-height: 1.55; }

  @media (max-width: 999px) {
    .novosti { padding: 28px 0 48px; }
    .biljeske h2 { font-size: 26px; }
  }
</style>