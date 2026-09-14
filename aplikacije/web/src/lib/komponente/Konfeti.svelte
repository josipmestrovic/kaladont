<script lang="ts">
  let { intenzitet = 'srednji' } = $props<{ intenzitet?: 'mali' | 'srednji' | 'veliki' }>();
  const cestice = Array.from({ length: 80 }, (_, indeks) => indeks);
  const brojCestica = $derived(intenzitet === 'mali' ? 12 : intenzitet === 'srednji' ? 32 : 80);
</script>

<div class="konfeti" class:konfeti-srednji={intenzitet === 'srednji'} class:konfeti-veliki={intenzitet === 'veliki'} aria-hidden="true">
  {#each cestice.slice(0, brojCestica) as cestica}
    <span style={`--indeks: ${cestica}; --x: ${(cestica * 37) % 100}%; --boja: hsl(${(cestica * 47) % 360} 70% 52%);`}></span>
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
    top: -12px;
    left: var(--x);
    width: 10px;
    height: 18px;
    background: var(--boja);
    transform: rotate(calc(var(--indeks) * 31deg));
    animation: pad-konfeta 2200ms cubic-bezier(0.16, 0.84, 0.32, 1) forwards;
    animation-delay: calc(var(--indeks) * 12ms);
  }
  @keyframes pad-konfeta {
    to {
      opacity: 0;
      transform: translate3d(calc((var(--indeks) - 12) * 7px), 75vh, 0) rotate(540deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .konfeti span { animation: none; opacity: 0; }
  }
</style>
