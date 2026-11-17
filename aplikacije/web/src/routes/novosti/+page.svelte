<script lang="ts">
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import { IZDANJA } from '$lib/izdanja.js';
</script>

<SeoGlava
  title="Novosti | Kaladont"
  description="Novosti i bilješke izdanja Kaladonta — što je novo u svakom izdanju, od prvog nadalje."
  putanja="/novosti"
/>

<main class="novosti">
  <header class="zaglavlje">
    <p class="nadnaslov">Izdanja</p>
    <h1>Novosti</h1>
    <p>Što je novo u Kaladontu. Najnovije objave su prve.</p>
  </header>

  <div class="popis">
    {#each IZDANJA as izdanje (izdanje.id)}
      <article class="objava" id={izdanje.sidro}>
        <header class="objava-zaglavlje">
          <h2><time datetime={izdanje.objavljeno}>{izdanje.datumHr}</time></h2>
          <p class="objava-naslov">{izdanje.naslov}</p>
        </header>
        <ul class="stavke">
          {#each izdanje.stavke as stavka}
            <li>{stavka}</li>
          {/each}
        </ul>
        <p class="poveznice">
          <a href="/o-igri">O igri</a>
          ·
          <a href="/pravila-kaladonta">Pravila</a>
        </p>
      </article>
    {/each}
  </div>
</main>

<style>
  .novosti {
    width: min(780px, 100%);
    margin: 0 auto;
    padding: 36px 0 64px;
  }

  .zaglavlje {
    margin-bottom: 28px;
  }

  .zaglavlje h1 {
    margin: 0;
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
  }

  .zaglavlje > p:last-child {
    margin: 8px 0 0;
    color: var(--boja-tekst-sekundarni);
  }

  .nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  .popis {
    padding-top: 24px;
    border-top: 1px solid #d8cfb8;
  }

  .objava {
    padding: 18px 0 28px;
    scroll-margin-top: 24px;
  }

  .objava + .objava {
    border-top: 1px solid #e5ddc8;
  }

  .objava-zaglavlje {
    margin-bottom: 12px;
  }

  .objava-zaglavlje h2 {
    margin: 0;
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    font-size: 21px;
  }

  .objava-naslov {
    margin: 4px 0 0;
    font-weight: 700;
  }

  .stavke {
    margin: 0;
    padding-left: 1.25em;
    line-height: 1.55;
  }

  .stavke li + li {
    margin-top: 6px;
  }

  .poveznice {
    margin: 16px 0 0;
  }

  a {
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }

  @media (max-width: 999px) {
    .novosti {
      padding: 28px 0 48px;
    }
  }
</style>
