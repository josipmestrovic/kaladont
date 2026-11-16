<script lang="ts">
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';

  /**
   * HINT PR15: javna stranica Novosti (više nije 307 → /o-igri).
   * Sidro #v0-2-0 = javno izdanje 0.2.0; NE miješati s tagom v0.2.0-closed-alpha.1.
   * Datum objave zaključan za izdanje: 17. 11. 2026.
   */
  const objave = [
    {
      id: 'v0-2-0',
      naslov: 'Kaladont 0.2.0',
      datum: '17. 11. 2026.',
      odlomci: [
        'Troboj je stigao. Pod „Igraj” prvo izaberi pravila, a zatim Dvoboj, Troboj ili Četveroboj. Ista pravila možeš isprobati u Zagrijavanju ili odabrati za svoju privatnu sobu.',
        'Ana kaže „jabuka”, a Bruno „kaladont”. U Klasičnom Kaladontu ispada Cvita, sljedeća na redu. U KA-ZNA ispada Ana jer je Bruni ostavila „ka”. U modu Dokaži nastavak protivnik ti može vratiti potez. Ako Ana kaže „kuća”, a Bruno ne zna nastavak, Ana ga mora pokazati. Napiše li „ćaća”, Bruno ispada. Ako Ana ne uspije, ispada Ana i Bruno ostaje u igri.',
        'Svi javni formati sada grade jedan rang i jedan Kaladont DNK. Na profilu otvori „Općenito” za pregled svih odigranih partija i stila igre. Svaki format ima svoju ljestvicu, uz sve pravilnike zajedno. Za dnevnu treba 5 partija u tom formatu, a za dulja razdoblja 10. U pool stižu četiri dnevne i četiri tjedne misije te četiri nova dostignuća.',
      ],
    },
  ] as const;
</script>

<SeoGlava
  title="Novosti | Kaladont"
  description="Novosti i bilješke izdanja Kaladonta — Troboj, tri pravilnika, jedan rang i Kaladont DNK."
  putanja="/novosti"
/>

<main class="novosti">
  <header class="zaglavlje">
    <p class="nadnaslov">Izdanja</p>
    <h1>Novosti</h1>
    <p>Što je novo u Kaladontu. Najnovije objave su prve.</p>
  </header>

  <div class="popis">
    {#each objave as objava}
      <article class="objava" id={objava.id}>
        <header class="objava-zaglavlje">
          <h2>{objava.naslov}</h2>
          <time datetime="2026-11-17">{objava.datum}</time>
        </header>
        {#each objava.odlomci as odlomak}
          <p>{odlomak}</p>
        {/each}
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
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 16px;
    margin-bottom: 12px;
  }

  .objava-zaglavlje h2 {
    margin: 0;
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    font-size: 21px;
  }

  .objava-zaglavlje time {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  p {
    margin: 0 0 12px;
    line-height: 1.55;
  }

  .poveznice {
    margin-top: 16px;
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
