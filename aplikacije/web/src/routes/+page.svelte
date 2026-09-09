<script lang="ts">
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import StatistikaRjecnika from '$lib/komponente/StatistikaRjecnika.svelte';

  const registriran = jeRegistriranKorisnik();
</script>

<div class="landing">
  <h1 class="logotip">Kaladont</h1>
  <p class="podnaslov">Hrvatska igra riječi. Četvero za stolom, 30 sekundi po potezu.</p>

  <a href="/red" class="igraj-gumb">IGRAJ</a>

  {#if registriran}
    <p><a href="/postavke">⚙ Postavke</a></p>
  {:else}
    <p class="racun-linkovi">
      <a href="/prijava">Prijavi se</a> · <a href="/registracija">Registriraj se</a>
    </p>
  {/if}

  <StatistikaRjecnika />

  <p class="early-access-napomena">
    <strong>Early access</strong> — očekuj moguće greške. Ako ih pronađeš, prijavi ih kroz ugrađeni sustav za prijavu grešaka.
  </p>
</div>

<footer>
  <a href="/pravila">Pravila</a> · <a href="/o-igri">O igri</a> · <a href="/ljestvica">Ljestvica</a>
</footer>

<style>
  .landing {
    text-align: center;
    padding-top: 40px;
  }

  .logotip {
    font-size: 40px;
  }

  .podnaslov {
    color: var(--boja-tekst-sekundarni);
    margin-bottom: 32px;
    font-size: inherit;
  }

  .igraj-gumb {
    display: inline-block;
    background: var(--boja-pozadina-primarna);
    color: white;
    font-family: var(--font-naslov);
    font-size: 24px;
    font-weight: 700;
    text-decoration: none;
    padding: 20px 64px;
    border-radius: var(--radijus-pill);
    box-shadow: var(--sjena-suptilna);
  }

  .racun-linkovi {
    margin-top: 20px;
    font-size: inherit;
  }

  .early-access-napomena {
    max-width: 360px;
    margin: 24px auto 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }

  footer {
    margin-top: 32px;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
    text-align: center;
  }
</style>
