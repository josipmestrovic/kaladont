<script lang="ts">
  import Konfeti from '$lib/komponente/Konfeti.svelte';
  import StoJeNovo from '$lib/komponente/StoJeNovo.svelte';

  let otvoreneNovosti = $state(false);
</script>

<svelte:head>
  <title>Hvala što si dio Kaladonta</title>
  <meta name="description" content="Dobrodošlica novim članovima Kaladont zajednice." />
</svelte:head>

<div class="zahvala">
  <Konfeti intenzitet="srednji" neprekidno />
  <main class="zahvala-sadrzaj">
    <p class="nadnaslov">Dobrodošao u ekipu</p>
    <h1>Legenda si što si se registrirao! 🎉</h1>
    <p class="uvod">
      Kaladont je još u počecima i svaki novi član nam je prejeben dodatak zajednici. Hvala ti što si ovdje i što ćeš pomoći da igra raste. 💚
    </p>

    <section class="izbor-akcija" aria-labelledby="izbor-akcija-naslov">
      <h2 id="izbor-akcija-naslov">Što želiš sada?</h2>
      <div class="akcije">
        <a class="glavna-akcija" href="/red?mod=dva_igraca">Igrati u 2 igrača</a>
        <a class="glavna-akcija" href="/red?mod=cetiri_igraca">Igrati u 4 igrača</a>
        <a class="sporedna-akcija" href="/soba/kreiraj">Stvoriti privatnu sobu</a>
        <a class="sporedna-akcija" href="/pravila">Pročitati pravila</a>
        <a class="sporedna-akcija" href="/profil">Vidjeti svoj profil</a>
        <a class="sporedna-akcija" href="/postavke">Otvoriti postavke</a>
        <a class="sporedna-akcija" href="/ljestvica">Pogledati ljestvice</a>
        <button type="button" class="sporedna-akcija" onclick={() => (otvoreneNovosti = true)}>Vidjeti što je novo u igri</button>
      </div>
    </section>
  </main>
</div>

{#if otvoreneNovosti}
  <StoJeNovo zatvori={() => (otvoreneNovosti = false)} />
{/if}

<style>
  .zahvala {
    position: relative;
    min-height: calc(100dvh - 64px);
    display: grid;
    place-items: center;
    padding: 40px 0 64px;
  }

  .zahvala-sadrzaj {
    position: relative;
    z-index: 1;
    width: min(720px, 100%);
    text-align: center;
  }

  .nadnaslov {
    margin: 0 0 8px;
    color: var(--boja-akcent);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 680px;
    margin: 0 auto;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: clamp(2.4rem, 8vw, 5rem);
    line-height: 1;
  }

  .uvod {
    max-width: 620px;
    margin: 20px auto 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-baza);
    line-height: 1.6;
  }

  .izbor-akcija {
    margin-top: 32px;
    padding: 24px;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    background: rgb(255 255 255 / 88%);
    box-shadow: var(--sjena-suptilna);
    text-align: left;
  }

  h2 {
    margin: 0 0 16px;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: var(--naslov-3);
    text-align: center;
  }

  .akcije {
    display: grid;
    gap: 10px;
  }

  .glavna-akcija,
  .sporedna-akcija {
    display: block;
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radijus-pill);
    font: inherit;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }

  .glavna-akcija {
    border: 1px solid var(--boja-pozadina-primarna);
    background: var(--boja-pozadina-primarna);
    color: white;
  }

  .sporedna-akcija {
    border: 1px solid #e5ddc8;
    background: var(--boja-krem);
    color: var(--boja-tekst-naslov);
  }

  @media (min-width: 600px) {
    .akcije {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .zahvala-sadrzaj { transition: none; }
  }
</style>
