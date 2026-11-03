<script lang="ts">
  let { intenzitet = 'srednji', neprekidno = false } = $props<{ intenzitet?: 'mali' | 'srednji' | 'veliki'; neprekidno?: boolean }>();
  const cestice = Array.from({ length: 120 }, (_, indeks) => indeks);
  const brojCestica = $derived(intenzitet === 'mali' ? 16 : intenzitet === 'srednji' ? 40 : 120);
</script>

<div class="konfeti" class:neprekidno aria-hidden="true">
  {#each cestice.slice(0, brojCestica) as cestica}
    <span style={`--indeks: ${cestica}; --x: ${(cestica * 37) % 100}%; --kasnjenje: ${(cestica * 18) % 900}ms; --trajanje: ${1800 + (cestica * 47) % 1400}ms; --boja: hsl(${(cestica * 47) % 360} 70% 52%); --velicina: ${8 + (cestica % 5) * 2}px;`}></span>
  {/each}
</div>

<style>
  .konfeti {
    position: fixed;
    z-index: 120;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .konfeti span {
    position: absolute;
    top: -18px;
    left: var(--x);
    width: var(--velicina);
    height: calc(var(--velicina) * 1.7);
    background: var(--boja);
    transform: rotate(calc(var(--indeks) * 31deg));
    animation: pad-konfeta var(--trajanje) cubic-bezier(0.16, 0.84, 0.32, 1) forwards;
    animation-delay: var(--kasnjenje);
  }
  .neprekidno span {
    animation-name: pad-konfeta-neprekidno;
    animation-duration: 5200ms;
    animation-iteration-count: infinite;
  }
  @keyframes pad-konfeta {
    0% { opacity: 1; }
    80% { opacity: 1; }
    to {
      opacity: 0;
      transform: translate3d(calc((var(--indeks) - 20) * 9px), 110vh, 0) rotate(720deg);
    }
  }
  @keyframes pad-konfeta-neprekidno {
    0% { opacity: 0; transform: translateY(0) rotate(0deg); }
    10%, 80% { opacity: 0.72; }
    100% { opacity: 0; transform: translate3d(calc((var(--indeks) - 12) * 7px), 105vh, 0) rotate(540deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .konfeti span { animation: none; opacity: 0; }
  }
</style>
