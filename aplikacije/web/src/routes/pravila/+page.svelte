<script lang="ts">
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';
</script>

<svelte:head>
  <title>Pravila igre | Kaladont</title>
</svelte:head>

<main class="pravila">
  <h1>Pravila igre</h1>

  <section>
    <h2>2 zadnja slova</h2>
    <p>Odgovori riječju koja počinje na zadnja 2 slova prethodne riječi. <strong>Nj, lj i dž</strong> jedno su slovo.</p>
    <p>Primjer: nakon <strong>kralj</strong>, traži se <strong>alj</strong>; nakon <strong>ulje</strong>, traži se <strong>lje</strong>. Kod nekoliko riječi, poput „injekcija”, slova se pravilno rastavljaju kao <strong>i-n-j</strong>.</p>
  </section>

  <section>
    <h2>Koje su riječi dozvoljene?</h2>
    <p> da bi riječ bila prihvačena, moraš slijediti ova pravila:</p>
    <ul>
      <li>riječ mora biti u standardnom, hrvatskom rječniku i početi na tražena 2 slova</li>
      <li>prihvaćamo: imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice i usklike, u svim njihovim oblicima</li>
      <li>dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom; ta slova na tipkovnici nisu dekoracija</li>
      <li>vlastita imena, kratice, riječi s brojkama, crticama ili razmacima nisu u igri.</li>
    </ul>
  </section>

  <section>
    <h2>Jednom odigrano, potrošeno</h2>
    <p>Ne možeš vrtjeti istu riječ u raznim padežima i očekivati da nitko ne primijeti. Nakon „dobar”, ne prolaze ni „dobra” ni „dobro”. Ako je oblik već potrošen, reć ćemo ti koji je bio prvi.</p>
    <p>„Bolji” i „najbolji” su zasebne grupe, baš kao i „pisati” i „napisati”. Posebna iznimka su <strong>„kaladont”</strong> i <strong>„kalodont”</strong>, oni se mogu ponoviti.</p>
  </section>

  <section>
    <h2>Kada ispadaš?</h2>
      <p>Izgubio si ako:</p>
    <ul>
      <li>klikneš <strong>Ne znam</strong></li>
      <li>istekne vrijeme prije valjane riječi</li>
      <li>ti prethodni igrač ostavi <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-pravila" />, odnosno nema nijednog dostupnog nastavka</li>
      <li>se ne vratiš nakon prekida veze u roku od 10 sekundi.</li>
    </ul>
    <p>Pogrešno upisana riječ te ne ruši odmah. Samo ti pojede vrijeme što je i dovoljno poučno.</p>
  </section>

  <section>
    <h2>Kaladont efekt</h2>
    <p>Kada odigraš „kaladont” ili „kalodont” na <strong>ka</strong>, ne ispada sljedeći igrač nego onaj tko ti je otvorio „ka”. Ti dobivaš bod za eliminaciju, a sustav otvara novu rundu. Ako je „ka” dao sustav, nitko ne ispada i igra ide dalje.</p>
  </section>

  <section>
    <h2>Klasični mod 4 igrača</h2>
    <p>Igraju točno 4 igrača, nasumično odabrana. Sustav bira početnu riječ, svi imate 30 sekundi po potezu, a nakon svake eliminacije, sustav postavlja novu početnu riječ. Prvi ispali je četvrti, zadnji preostali pobjeđuje.</p>
    <p>Bodovi: plasman donosi 0, 1, 2 ili 3 boda, svaka izazvana eliminacija još 1 bod (ukupno je moguće 3 boda za eliminaciju - slučaj kada izbaciš nekoga ako nema ili taj igrač ne zna riječ sastavljenu od zadnja 2 slova prethodne riječi), a pobjednik dobiva dodatni bod. Najviše možeš uzeti 7 bodova u jednoj igri.</p>
  </section>

  <section>
    <h2>1 vs 1 dvoboj</h2>
    <p>2 igrača, nasumično odabrana, isti nastavci riječi, nema skrivanja iza trećeg čovjeka. Tko prvi ispadne, gubi; pobjednik dobiva 1 bod.</p>
    <p>Dvoboj ima zasebne statistike, rang i <a href="/ljestvica">ljestvicu</a>. Rezultati Klasičnog moda i Dvoboja ne miješaju se.</p>
  </section>

  <section>
    <h2>Privatne sobe</h2>
    <p>U privatnoj sobi, s ekipom možeš dogovoriti: duljinu trajanja poteza, vrste riječi, minimalnu duljinu, osnovne oblike i bodove za eliminaciju. Pravila nastavaka, slova i ponavljanja ostaju ista; rezultat vrijedi samo za ljestvicu te sobe, ne za globalni rang.</p>
  </section>
</main>

<style>
  .pravila {
    max-width: 760px;
    margin: 0 auto;
    padding: 32px 20px 56px;
  }

  h1,
  h2 {
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
  }

  h1 {
    margin: 0 0 28px;
  }

  section {
    padding: 20px 0;
    border-top: 1px solid #e5ddc8;
  }

  h2 {
    margin: 0 0 10px;
    font-size: var(--naslov-3);
  }

  p,
  li {
    line-height: 1.6;
  }

  p {
    margin: 0 0 12px;
  }

  ul {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  li + li {
    margin-top: 6px;
  }

  a {
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }
</style>
