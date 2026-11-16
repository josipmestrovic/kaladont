<script lang="ts">
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';

  /**
   * HINT PR15: javna stranica Novosti (više nije 307 → /o-igri).
   * Sidra #v0-2-0 / #v0-1-0 = javna izdanja; NE miješati s closed-alpha tagovima.
   */
  const objave = [
    {
      id: 'v0-2-0',
      naslov: 'Kaladont 0.2.0',
      datum: '17. 11. 2026.',
      datetime: '2026-11-17',
      stavke: [
        'Troboj (3 igrača) uz postojeći Dvoboj i Četveroboj',
        'Tri pravilnika — Klasični Kaladont, KA-ZNA, Dokaži nastavak — biraju se prije formata',
        'Jedan univerzalni rang i jedan Kaladont DNK za sve javne formate',
        'Ljestvice po formatu; ulaz 5 partija dnevno / 10 dulje razdoblje',
        'Novi paket misija i dostignuća (Troboj, dokaz, Klasični, KA-ZNA)',
      ],
    },
    {
      id: 'v0-1-0',
      naslov: 'Kaladont 0.1.0',
      datum: '1. 10. 2026.',
      datetime: '2026-10-01',
      stavke: [
        'Klasični Kaladont — igra na zadnja dva grafema, 30 s po potezu, hrLex rječnik',
        'Javni formati Dvoboj i Četveroboj',
        'Privatna soba (2–8 igrača) i Zagrijavanje protiv Računala',
        'Računi, profil i javni profil',
        'XP, razine, dnevne i tjedne misije te dostignuća',
        'Javne ljestvice',
        'Kolekcija riječi, editor avatara i sandučić obavijesti',
        'Popuna javnog reda botovima',
      ],
    },
  ] as const;
</script>

<SeoGlava
  title="Novosti | Kaladont"
  description="Novosti i bilješke izdanja Kaladonta — značajke po verziji, od prvog izdanja nadalje."
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
          <time datetime={objava.datetime}>{objava.datum}</time>
        </header>
        <ul class="stavke">
          {#each objava.stavke as stavka}
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
