<script lang="ts">
  import StatistikaRjecnika from '$lib/komponente/StatistikaRjecnika.svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
</script>

<SeoGlava
  title="O igri | Kaladont"
  description="Novosti, release napomene i pregled Kaladonta — hrvatske online igre riječi."
  putanja="/o-igri"
/>

<main class="o-igri">
  <header class="zaglavlje">
    <p class="nadnaslov">Igra riječi</p>
    <h1>O igri</h1>
    <p>Natječi se s drugima, penji se rangovima i ljestvicama, skupljaj riječi u kolekciju i otključavaj dostignuća!
    I paralelno razvijaš svoje vještine jezika i širiš vokabular.</p>
    
  </header>

  <article class="pregled">
    <section>
      <h2>Što je Kaladont?</h2>
      <p>
        Nekad pasta za zube. Danas igra: reci riječ na zadnja dva slova prethodne.
        Riječ <strong>kaladont</strong> (prihvaćamo i kalodont) završava na <strong>nt</strong>, a nijedna hrvatska riječ
        ne počinje tim slovima.
      </p>
      <p>Cilj je jednostavan: ostani zadnji za stolom. Ostali ispadaju, ti slavodobitno skupljaš bodove, penješ se na ljestvicama i otključavaš dostignuća.</p>
    </section>

    <section>
      <h2>Kako se igra</h2>
      <ul>
        <li>svaka riječ počinje zadnjim <strong>dvama slovima</strong> prethodne (npr. sova → vaza)</li>
        <li>u javnoj igri imaš <strong>30 sekundi</strong> po potezu</li>
        <li>kriva riječ ne izbacuje, samo pokušaj opet</li>
        <li>„Ne znam” je predaja: ispadaš i gledaš dalje ili možeš izaći i sve će ti se spremiti</li>
        <li><strong>lj, nj, dž</strong> broje se kao jedno slovo (konj → onj)</li>
        <li>kvačice su bitne! Jer č nije c, š nije s, ć nije c…</li>
      </ul>
    </section>

    <section>
      <h2>Pametan sustav riječi</h2>
      <p>
        Igra ne gleda samo točno slovo po slovo. Kad netko kaže <strong>kuća</strong>,
        potrošena je cijela „obitelj” pa <strong>kućom</strong> više ne prolazi.
       
      </p>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead>
            <tr>
              <th scope="col">Primjer</th>
              <th scope="col">Što to znači</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">kuća → kućom</th>
              <td data-label="Što to znači">Isti oblik u drugom padežu, već potrošeno.</td>
            </tr>
            <tr>
              <th scope="row">dobar → dobra</th>
              <td data-label="Što to znači">Ista obitelj. Nakon „dobar” nema „dobra” ni „dobro”.</td>
            </tr>
            <tr>
              <th scope="row">dobar → bolji</th>
              <td data-label="Što to znači">Drugi stupanj i druga obitelj. Smije se.</td>
            </tr>
            <tr>
              <th scope="row">kaladont</th>
              <td data-label="Što to znači">Jedina iznimka: može se ponavljati (i kalodont isto).</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Kako sve možeš igrati?</h2>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead>
            <tr>
              <th scope="col">Način</th>
              <th scope="col">Tko igra</th>
              <th scope="col">Bodovi i rang</th>
              <th scope="col">Dostignuća</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Četveroboj</th>
              <td data-label="Tko igra">4 igrača</td>
              <td data-label="Bodovi i rang">Da</td>
              <td data-label="Dostignuća">Da</td>
            </tr>
            <tr>
              <th scope="row">Dvoboj</th>
              <td data-label="Tko igra">2 igrača</td>
              <td data-label="Bodovi i rang">Da</td>
              <td data-label="Dostignuća">Da</td>
            </tr>
            <tr>
              <th scope="row">Privatna soba</th>
              <td data-label="Tko igra">2 do 8 prijatelja, šalješ im link</td>
              <td data-label="Bodovi i rang">Ne</td>
              <td data-label="Dostignuća">Djelomično</td>
            </tr>
            <tr>
              <th scope="row">Zagrijavanje</th>
              <td data-label="Tko igra">Ti vs. Računalo</td>
              <td data-label="Bodovi i rang">Ne</td>
              <td data-label="Dostignuća">Djelomično</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Bodovi, rangovi i ljestvice</h2>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead>
            <tr>
              <th scope="col">Način</th>
              <th scope="col">Kako se boduje</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Četveroboj</th>
              <td data-label="Kako se boduje">Mjesto + eliminacije (1. mjesto 4 boda).</td>
            </tr>
            <tr>
              <th scope="row">Dvoboj</th>
              <td data-label="Kako se boduje">Pobjeda 1, poraz 0.</td>
            </tr>
            <tr>
              <th scope="row">Rang</th>
              <td data-label="Kako se boduje">Nakon 10 javnih igara. Do tada si Piskaralo. Odvojeno za Dvoboj i Četveroboj.</td>
            </tr>
            <tr>
              <th scope="row">Ljestvice</th>
              <td data-label="Kako se boduje">Dnevne, tjedne, mjesečne… odvojeno za Dvoboj i Četveroboj.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>rangovi idu od Prvopisca do Kaladonta, nema matchmakinga po rangu dok se ne poveća baza igrača, ali imamo osnovu da ga uvedemo</li>
        <li>forma pokazuje kako ti ide zadnjih 10 igara</li>
        <li>niz pobjeda pali „vatru” na profilu</li>
        <li>botovi pune prazna mjesta u redu, ali ne ulaze na ljestvice</li>
      </ul>
    </section>

    <section>
      <h2>Kako ispadaš iz igre?</h2>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
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
              <td data-label="Što se događa">Predaja. Možeš ostati gledati.</td>
            </tr>
            <tr>
              <th scope="row">Mrtva slova</th>
              <td data-label="Što se događa">Nema slobodnog nastavka - ispada sljedeći na redu.</td>
            </tr>
            <tr>
              <th scope="row">Kaladont na „ka”</th>
              <td data-label="Što se događa">Rekao si riječ na ka, protivnik kaže kaladont - ti ispadaš.</td>
            </tr>
            <tr>
              <th scope="row">Napuštanje</th>
              <td data-label="Što se događa">Izađeš ili se ne vratiš u 10 sekundi.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Iskustvo</h2>
      <ul>
        <li>skupljaj <strong>iskustvo</strong> i penji se razinama (1-100)</li>
        <li>otključavaj riječi u <strong>kolekciji</strong>, od početnika do legende rječnika</li>
        <li>lovi <strong>dostignuća</strong> (zvjezdice za duge riječi, kaladonte, eliminacije…)</li>
        <li>saznaj što ti najbolje ide uz <strong>Kaladont DNK</strong> (vještina, taktika, brzina…)</li>
        <li>napravi svoj <strong>avatar</strong>: boje, dijelovi, ti si šef</li>
        <li>gost može igrati odmah; registracija čuva napredak</li>
      </ul>
    </section>

    <section>
      <h2>Za napomenuti</h2>
      <ul>
        <li>u javnom redu prazna mjesta mogu popuniti botovi, ovo privremeno radi samo za javnu igru dok se ne poveća baza igrača</li>
        <li>za stolom koristite brze reakcije na stolici tako što kliknete na svoj avatar</li>
        <li>font za disleksiju i čitanje novih riječi naglas su eksperimentalne funkcionalnosti</li>
        <li>prijavi ako neka riječ nije riječ ili je netočna, time nam puno pomažeš</li>
        <li>privatna soba: biraj tajmer i vrste riječi</li>
      </ul>
      <p class="poveznica">
        Želiš sitne detalje? <a href="/pravila-kaladonta">Detaljna pravila →</a>
      </p>
    </section>
  </article>

  <article class="licence">
    <h2>Rječnik</h2>
    <p>
      Popis riječi izveden je iz leksikona <strong>hrLex 1.3</strong> (Nikola Ljubešić, 2019., CLARIN.SI,
      <a href="http://hdl.handle.net/11356/1232">hdl.handle.net/11356/1232</a>), dostupnog pod licencom
      <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.hr">CC BY-SA 4.0</a>. Popis je za potrebe
      igre filtriran (bez vlastitih imena i kratica) te obogaćen podacima za tijek igre (parovi slova,
      leksemske grupe); izvedeni popis dostupan je pod istom licencom na zahtjev.
    </p>

    <StatistikaRjecnika prikaz="tablica" />

    <h2>Avatari</h2>
    <p>
      Avatar sustav koristi <strong>Avatar Illustration System</strong> autora Micaha Laniera pod licencom
      <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      <a href="https://www.figma.com/community/file/829741575478342595/avatar-illustration-system"
        >Izvorni sustav avatara</a
      >
      prilagođen je za lokalno sastavljanje dijelova i promjenu boja. Dodatni dijelovi nacrtani za Kaladont
      vlastiti su rad.
    </p>

    <h2>Autorska prava i ikone</h2>
    <p>
      © 2026 Kaladont. Autori projekta. Sva prava pridržana za izvorni kod i vlastite ilustracije. Taj
      navod ne mijenja gore navedene licence rječnika i tuđih dijelova avatara.
    </p>
    <p>
      PNG ikone nacrtane su za Kaladont. Kontrolne ikone biblioteke
      <a href="https://lucide.dev/license">Lucide</a> koriste se pod licencom ISC, a dijelovi izvedeni iz
      Feathera pod licencom MIT. <a href="/licence/lucide.txt">Licencne obavijesti i autori</a>.
    </p>

    <h2>Kontakt</h2>
    <p>
      Pitanja, prijedlozi ili prijave grešaka: koristi gumb „Prijavi” u igri, ili nam piši na
      <a href="mailto:kontakt@kaladont.hr">kontakt@kaladont.hr</a>.
    </p>
  </article>
</main>

<style>
  .o-igri {
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

  .pregled {
    padding-top: 24px;
    border-top: 1px solid #d8cfb8;
  }

  .pregled section {
    padding: 18px 0;
    border-top: 1px solid #e5ddc8;
  }

  .pregled section:first-child {
    border-top: none;
    padding-top: 0;
  }

  h2 {
    margin: 0 0 10px;
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    font-size: 21px;
  }

  p,
  li,
  td,
  th {
    line-height: 1.55;
  }

  p {
    margin: 0 0 12px;
  }

  ul {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  li + li {
    margin-top: 7px;
  }

  a {
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }

  .poveznica {
    margin-top: 16px;
  }

  .tablica-omotac {
    margin: 16px 0;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--boja-povrsina);
  }

  th,
  td {
    padding: 11px 12px;
    border-bottom: 1px solid var(--boja-obrub);
    text-align: left;
    vertical-align: top;
  }

  thead th {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  tbody th {
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-sitni);
    font-weight: 700;
  }

  .licence {
    margin-top: 36px;
    padding-top: 28px;
    border-top: 1px solid #d8cfb8;
  }

  .licence h2 {
    margin-top: 24px;
  }

  .licence h2:first-child {
    margin-top: 0;
  }

  @media (max-width: 999px) {
    .o-igri {
      padding: 28px 0 48px;
    }

    .tablica-omotac {
      overflow-x: visible;
    }

    .tablica-mobilni-retci thead {
      display: none;
    }

    .tablica-mobilni-retci,
    .tablica-mobilni-retci tbody,
    .tablica-mobilni-retci tr,
    .tablica-mobilni-retci th,
    .tablica-mobilni-retci td {
      display: block;
      width: 100%;
    }

    .tablica-mobilni-retci tr {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--boja-obrub);
    }

    .tablica-mobilni-retci th[scope='row'] {
      padding-bottom: 4px;
      border-bottom: none;
    }

    .tablica-mobilni-retci td {
      border-bottom: none;
      padding-top: 4px;
    }

    .tablica-mobilni-retci td::before {
      display: none;
    }
  }
</style>
