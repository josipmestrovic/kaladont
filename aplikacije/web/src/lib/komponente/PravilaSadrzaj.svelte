<script lang="ts">
  import { Home } from 'lucide-svelte';
  import { zadnjaDva } from 'zajednicko';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import { breadcrumbPravila, metaPravilaTeme, putanjaPravilaTeme } from '$lib/seo.js';

  const meta = metaPravilaTeme('kako-igrati');
  const putanja = putanjaPravilaTeme('kako-igrati');
  const jsonLd = breadcrumbPravila('kako-igrati');

  const opisMrtvihSlova =
    'Zadnja dva slova nemaju nijednu slobodnu riječ: ili je nema u rječniku, ili su svi oblici već odigrani u ovoj igri.';

  type PrimjerDio = { t: string; u?: boolean };

  function rijecSaZavrsetkom(rijec: string): PrimjerDio[] {
    const zavrsetak = zadnjaDva(rijec);
    return [{ t: rijec.slice(0, rijec.length - zavrsetak.length) }, { t: zavrsetak, u: true }];
  }

  function popisRijeciSaZavrsetkom(rijeci: string[]): PrimjerDio[] {
    return rijeci.flatMap((rijec, i) => (i === 0 ? rijecSaZavrsetkom(rijec) : [{ t: ', ' }, ...rijecSaZavrsetkom(rijec)]));
  }

  const koraci: {
    tekst: string;
    primjer: PrimjerDio[];
  }[] = [
    {
      tekst: 'Svaka riječ počinje zadnjim dvama slovima prethodne.',
      primjer: [
        { t: 'so' },
        { t: 'va', u: true },
        { t: ' → ' },
        { t: 'va', u: true },
        { t: 'za' },
      ],
    },
    {
      tekst: 'Ako nema nastavka, automatski ispadaš.',
      primjer: popisRijeciSaZavrsetkom(['kaladont', 'akord', 'nakovanj']),
    },
    {
      tekst: 'Ako kažeš krivu riječ, ne ispadaš već pokušavaš opet. Ali pazi na vrijeme!',
      primjer: [{ t: '30 s po potezu' }],
    },
    {
      tekst: 'Svaka riječ smije se reći samo jednom. Isti oblici ne prolaze.',
      primjer: [{ t: 'kuća blokira kući / kućom / kuće' }],
    },
    {
      tekst: 'lj, nj, dž broje se kao jedno slovo.',
      primjer: [{ t: 'konj → onj' }],
    },
    {
      tekst: 'Kvačice su bitne: č nije c, š nije s, ć nije c…',
      primjer: [{ t: 'čaj ≠ caj' }],
    },
  ];
</script>

<SeoGlava title={meta.title} description={meta.description} putanja={putanja} jsonLd={jsonLd} />

<main class="pomoc">
  <header class="zaglavlje">
    <h1>Pravila igre</h1>
    <p class="uvod">
      Cilj je jednostavan: nastavi niz na zadnja dva slova i ostani zadnji za stolom!
    </p>
  </header>

  <section id="sadrzaj-pomoci" class="sadrzaj pregled-igre" aria-label="Pravila igre">
    <section>
      <h3>6 pravila koje trebaš znati</h3>
      <ol class="koraci-mreza">
        {#each koraci as korak, i}
          <li>
            <span class="korak-broj" aria-hidden="true"><span>{i + 1}</span></span>
            <p>{korak.tekst}</p>
            <p class="korak-primjer">
              <span class="korak-primjer-vrijednost">
                {#each korak.primjer as dio}
                  {#if dio.u}
                    <span class="korak-primjer-istaknuto">{dio.t}</span>
                  {:else}
                    {dio.t}
                  {/if}
                {/each}
              </span>
            </p>
          </li>
        {/each}
      </ol>
    </section>

    <section>
      <h3>Kako ispadaš iz igre?</h3>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci tablica-bez-oznaka">
          <thead>
            <tr>
              <th scope="col">Razlog</th>
              <th scope="col">Što se događa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Istek vremena</th>
              <td data-label="Što se događa">Tajmer istekne prije valjane riječi - van!</td>
            </tr>
            <tr>
              <th scope="row">„Ne znam”</th>
              <td data-label="Što se događa">Predaja — ispadaš.</td>
            </tr>
            <tr>
              <th scope="row"
                ><PojamPomoc tekst="Mrtva slova" opis={opisMrtvihSlova} id="mrtva-slova-pravila" /></th
              >
              <td data-label="Što se događa">Nema slobodnog nastavka — ispada sljedeći na redu.</td>
            </tr>
            <tr>
              <th scope="row">Napuštanje</th>
              <td data-label="Što se događa">Izađeš ili se ne vratiš u 10 sekundi.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <aside class="napomena">
        Tko ne zna nastavak, ispada.
      </aside>
    </section>
  </section>

  <nav class="povezano" aria-label="Navigacija">
    <a href="/" class="povratak-pocetna">
      <Home class="povratak-ikona" size={28} strokeWidth={2.2} aria-hidden="true" />
      <span>Povratak na početnu stranicu</span>
    </a>
  </nav>
</main>

<style>
  .pomoc { width: min(780px, 100%); margin: 0 auto; padding: 0 4px 64px; }
  .pregled-igre .tablica-mobilni-retci tbody th { color: var(--boja-tekst-osnovni); font-weight: 700; }
  .zaglavlje { margin-bottom: 8px; }
  h1, h3 { font-family: var(--font-naslov); color: var(--boja-tekst-naslov); }
  h1 { margin: 0; font-size: var(--naslov-1); }
  .uvod { margin: 12px 0 0; color: var(--boja-tekst-sekundarni); line-height: 1.6; }
  #sadrzaj-pomoci { scroll-margin-top: 16px; outline: none; }
  .sadrzaj { padding: 8px 0 22px; }
  .sadrzaj > section { padding: 18px 0; border-top: 1px solid var(--boja-obrub); }
  h3 { margin: 0 0 16px; font-size: var(--naslov-3); }
  p, li, td, th { line-height: 1.6; }
  p { margin: 0 0 12px; }
  a { color: var(--boja-pozadina-primarna); font-weight: 700; }

  .koraci-mreza {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .koraci-mreza li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
  }
  .korak-broj {
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border-radius: 50%;
    background: #ffffff;
    color: var(--boja-mint);
    /* Inter se čisto centrira; Baloo u krugu optički “pluta” */
    font-family: var(--font-tijelo);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .korak-broj > span {
    display: block;
    line-height: 1;
    transform: translateY(0.06em);
  }
  .koraci-mreza p {
    margin: 0;
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-baza);
  }
  .korak-primjer {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.35em 0.5em;
    margin: 0;
    padding: 0.2em 0.55em;
    border-radius: 6px;
    background: color-mix(in srgb, #ffffff 10%, transparent);
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    line-height: 1.4;
  }
  .korak-primjer-vrijednost {
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-naslov);
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .korak-primjer-istaknuto {
    text-decoration: underline;
    text-decoration-thickness: from-font;
    text-underline-offset: 0.12em;
    color: var(--boja-isticanje-slova, var(--boja-akcent-tekst));
  }

  @media (min-width: 640px) {
    .koraci-mreza {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1000px) {
    .koraci-mreza {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .tablica-omotac { margin: 20px 0; overflow-x: auto; }
  @media (min-width: 1000px) {
    .tablica-omotac {
      border-radius: var(--radijus-kartica);
      overflow: hidden;
    }
  }
  table { width: 100%; border-collapse: collapse; background: var(--boja-povrsina); }
  th, td { padding: 11px 12px; border-bottom: 1px solid var(--boja-obrub); text-align: left; vertical-align: top; }
  th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .povezano {
    margin-top: 8px;
    padding-top: 24px;
    border-top: 1px solid var(--boja-obrub);
  }
  .povratak-pocetna {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
  }
  .povratak-pocetna:hover,
  .povratak-pocetna:focus-visible {
    color: var(--boja-akcent-tekst);
  }
  .povratak-ikona {
    display: block;
    flex-shrink: 0;
  }
  .napomena {
    padding: 14px 16px;
    border-left: 4px solid var(--boja-isticanje-tekst);
    border-radius: var(--radijus-kartica);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
  }
  @media (max-width: 999px) {
    .pomoc { padding-top: 0; }
    h1 { font-size: 28px; }
    h3 { font-size: 22px; }
    .tablica-omotac { overflow-x: visible; }
    .tablica-mobilni-retci thead { display: none; }
    .tablica-mobilni-retci {
      display: block;
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: transparent;
    }
    .tablica-mobilni-retci tbody {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .tablica-mobilni-retci tr,
    .tablica-mobilni-retci tbody th,
    .tablica-mobilni-retci tbody td {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .tablica-mobilni-retci tr {
      margin: 0;
      padding: 14px 16px;
      border: 1px solid var(--boja-obrub);
      border-radius: var(--radijus-kartica);
      background: var(--boja-povrsina);
    }
    .tablica-mobilni-retci tbody th,
    .tablica-mobilni-retci tbody td {
      border: 0;
      padding: 0;
      overflow-wrap: anywhere;
    }
    .tablica-mobilni-retci tbody th {
      margin: 0 0 10px;
      font-size: var(--tekst-baza);
      color: var(--boja-tekst-naslov);
    }
    .tablica-mobilni-retci tbody td + td { margin-top: 10px; }
    .tablica-mobilni-retci tbody td[data-label] {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      column-gap: 40px;
      row-gap: 4px;
    }
    .tablica-mobilni-retci tbody td[data-label]::before {
      content: attr(data-label);
      color: var(--boja-tekst-sekundarni);
      font-size: var(--tekst-mali);
      font-weight: 700;
      line-height: 1.35;
    }
    .tablica-bez-oznaka tbody td[data-label] { display: block; }
    .tablica-bez-oznaka tbody td[data-label]::before { display: none; }
  }
</style>
