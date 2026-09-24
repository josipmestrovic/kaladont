<svelte:head>
  <title>Hvala za povratnu informaciju | Kaladont</title>
  <meta name="description" content="Hvala što aktivno sudjeluješ u poboljšanju Kaladonta." />
</svelte:head>

<main class="zahvala">
  <p class="nadnaslov">Glas zajednice</p>
  <h1>Hvala što aktivno sudjeluješ u poboljšanju igre.</h1>
  <p>Tvoje mišljenje čitamo i koristimo pri daljnjem razvoju Kaladonta.</p>
  <div class="akcije">
    <a href="/">Nastavi igrati</a>
    <a href="/profil">Otvori profil</a>
  </div>
</main>

<style>
  .zahvala { width: min(680px, 100%); min-height: calc(100dvh - 120px); margin: 0 auto; display: grid; align-content: center; text-align: center; padding: 48px 0; }
  .nadnaslov { margin: 0 0 8px; color: var(--boja-akcent); font-size: var(--tekst-sitni); font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0; }
  p:not(.nadnaslov) { color: var(--boja-tekst-sekundarni); font-size: 1.1rem; line-height: 1.6; }
  .akcije { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
  .akcije a { padding: 11px 18px; border: 1px solid var(--boja-mint); border-radius: 6px; color: var(--boja-tekst-osnovni); font-weight: 800; text-decoration: none; }
  .akcije a:first-child { background: var(--boja-mint); color: white; }
</style>
