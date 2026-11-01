<script lang="ts">
  let { napredak = 0 }: { napredak?: number } = $props();

  const postotak = $derived(Math.round(Math.min(1, Math.max(0, napredak)) * 100));
</script>

<main class="boot" role="status" aria-busy="true" aria-live="polite">
  <p class="brand">Kaladont</p>
  <p class="tekst">Učitavanje…</p>
  <div
    class="traka"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={postotak}
    aria-label="Napredak učitavanja"
  >
    <div class="ispuna" style={`width: ${postotak}%`}></div>
  </div>
</main>

<style>
  .boot {
    box-sizing: border-box;
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
    color: var(--boja-tekst-osnovni);
  }

  .brand {
    margin: 0;
    font-family: var(--font-naslov, inherit);
    font-size: clamp(2rem, 6vw, 2.75rem);
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.1;
  }

  .tekst {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    opacity: 0.85;
  }

  .traka {
    width: min(240px, 70vw);
    height: 8px;
    overflow: hidden;
    border: 1px solid var(--boja-obrub, transparent);
    border-radius: var(--radijus-pill, 999px);
    background: var(--boja-povrsina-2, var(--boja-povrsina));
  }

  .ispuna {
    height: 100%;
    border-radius: inherit;
    background: var(--boja-cta-pozadina, var(--boja-tekst-osnovni));
    transition: width 160ms ease-out;
  }
</style>
