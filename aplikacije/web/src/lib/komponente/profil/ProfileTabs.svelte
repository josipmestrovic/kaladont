<script lang="ts">
  import type { PogledProfila } from './tipovi.js';

  let {
    aktivniPogled,
    prikaziAktivnost = false,
    onPromjena,
  }: {
    aktivniPogled: PogledProfila;
    prikaziAktivnost?: boolean;
    onPromjena: (pogled: PogledProfila) => void;
  } = $props();
</script>

<nav class="pogled-tabovi" aria-label="Sadržaj profila">
  <button type="button" class:aktivan={aktivniPogled === 'pregled'} onclick={() => onPromjena('pregled')}>
    Pregled
  </button>
  <button type="button" class:aktivan={aktivniPogled === 'dostignuca'} onclick={() => onPromjena('dostignuca')}>
    Dostignuća
  </button>
  <button type="button" class:aktivan={aktivniPogled === 'rijeci'} onclick={() => onPromjena('rijeci')}>
    <span class="puni">Kolekcija riječi</span>
    <span class="kratki">Kolekcija</span>
  </button>
  {#if prikaziAktivnost}
    <button type="button" class:aktivan={aktivniPogled === 'povijest'} onclick={() => onPromjena('povijest')}>
      Aktivnost
    </button>
  {/if}
</nav>

<style>
  .pogled-tabovi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }
  button {
    padding: 10px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-pill, 999px);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  button.aktivan {
    background: var(--boja-povrsina);
    color: var(--boja-tekst-naslov);
    border-color: var(--boja-obrub-jaci, var(--boja-obrub));
  }
  button:focus-visible {
    outline: 2px solid var(--boja-fokus);
    outline-offset: 2px;
  }
  .kratki { display: none; }

  @media (max-width: 620px) {
    .pogled-tabovi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .puni { display: none; }
    .kratki { display: inline; }
  }
</style>
