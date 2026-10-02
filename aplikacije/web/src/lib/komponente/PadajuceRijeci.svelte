<script lang="ts">
  const sigurneRijeci = [
    'šećer', 'biser', 'bager', 'bunker', 'laser', 'trener', 'frizer', 'jezik',
    'učenik', 'radnik', 'dnevnik', 'putnik', 'med', 'led', 'sladoled', 'ured',
    'razred', 'pogled', 'raspored', 'rep', 'džep', 'čep', 'zid', 'papir', 'sir',
    'krumpir', 'leptir', 'šešir', 'orah', 'okvir', 'svemir', 'klavir', 'mir',
    'automobil', 'krokodil', 'miš', 'slatkiš', 'nož', 'velik', 'lijep', 'loš',
    'suh', 'gluh', 'duhovit', 'jučer', 'navečer', 'prekjučer', 'naprijed',
    'unaprijed', 'još', 'blizu', 'noću',
  ];
</script>

<div class="pozadina-rijeci" aria-hidden="true">
  {#each sigurneRijeci as rijec, indeks}
    <span
      class="rijec"
      style={`--indeks: ${indeks}; --lijevo: ${(indeks * 37) % 96}%; --odgoda: ${(indeks % 13) * -0.8}s; --trajanje: ${8 + (indeks % 7)}s;`}
    >{rijec}</span>
  {/each}
</div>

<style>
  .pozadina-rijeci {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* Pune boje bez prozirnosti - preklapanje dviju rijeci inace postaje vidljivo. */
  .rijec {
    position: absolute;
    top: -30px;
    left: var(--lijevo);
    color: #3f8474;
    font-family: var(--font-naslov);
    font-size: 24px;
    font-weight: 700;
    transform: rotate(-8deg);
    animation: padanje var(--trajanje) linear var(--odgoda) infinite;
  }

  :global(html[data-tema='svijetla']) .rijec {
    color: #bfd4c9;
  }

  @keyframes padanje {
    0% { transform: translateY(-30px) rotate(-8deg); }
    100% { transform: translateY(calc(100vh + 80px)) rotate(8deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .rijec { animation: none; }
  }
</style>
