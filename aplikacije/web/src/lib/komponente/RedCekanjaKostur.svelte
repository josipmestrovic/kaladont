<script lang="ts">
  let { ukupnoMjesta }: { ukupnoMjesta: number } = $props();
</script>

<main class="red-sadrzaj" role="status" aria-label="Učitavanje čekaonice" aria-busy="true">
  <div class="kostur kostur-naslov"></div>
  <div class="kostur kostur-prosjek"></div>

  <ul class="mjesta" aria-hidden="true">
    {#each Array.from({ length: ukupnoMjesta }, (_vrijednost, indeks) => indeks) as indeks (indeks)}
      <li class="mjesto-kostur">
        <div class="kostur kostur-avatar"></div>
        <div class="kostur-podaci">
          <span class="kostur kostur-ime"></span>
          <span class="kostur kostur-rang"></span>
          <span class="kostur kostur-statistika"></span>
        </div>
      </li>
    {/each}
  </ul>

  <div class="kostur kostur-gumb"></div>
  <section class="kostur-savjet" aria-hidden="true">
    <div class="kostur kostur-savjet-naslov"></div>
    <div class="kostur kostur-savjet-tekst"></div>
  </section>
</main>

<style>
  .red-sadrzaj { width: 100%; max-width: 327px; margin: 0 auto; padding-top: 16px; }
  .kostur { border-radius: 6px; background: var(--boja-povrsina-2); }
  .kostur-naslov { width: min(270px, 82%); height: 22px; margin-bottom: 8px; }
  .kostur-prosjek { width: 190px; height: 16px; margin-bottom: 24px; }
  .mjesta { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .mjesto-kostur { display: flex; min-height: 108px; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-kartica); background: var(--boja-povrsina); }
  .kostur-avatar { width: 84px; height: 84px; flex: 0 0 84px; border-radius: 50%; background: var(--boja-povrsina-3); }
  .kostur-podaci { display: grid; width: min(280px, 65%); gap: 8px; }
  .kostur-ime { width: 58%; height: 16px; }
  .kostur-rang { width: 42%; height: 12px; }
  .kostur-statistika { width: 82%; height: 12px; }
  .kostur-gumb { width: 140px; height: 42px; margin-top: 12px; border-radius: var(--radijus-pill); }
  .kostur-savjet { display: grid; gap: 8px; margin-top: 28px; }
  .kostur-savjet-naslov { width: 150px; height: 16px; }
  .kostur-savjet-tekst { width: 100%; height: 48px; border-radius: 8px; }

  @media (min-width: 1000px) {
    .red-sadrzaj { max-width: 100%; }
  }
</style>