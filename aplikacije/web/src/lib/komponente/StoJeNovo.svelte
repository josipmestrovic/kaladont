<script lang="ts">
  import { IZDANJA } from '$lib/izdanja.js';

  let { zatvori = () => undefined } = $props<{ zatvori?: () => void }>();
  let odabranaVerzija = $state(IZDANJA[0]?.verzija ?? '');
  const odabrano = $derived(IZDANJA.find((izdanje) => izdanje.verzija === odabranaVerzija) ?? IZDANJA[0]);
</script>

<div class="podloga" role="presentation" onclick={zatvori}>
  <div class="sadrzaj" role="dialog" aria-modal="true" aria-label="Što je novo" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && zatvori()}>
    <button class="zatvori" type="button" aria-label="Zatvori" onclick={zatvori}>×</button>
    <h2>Što je novo</h2>
    <nav class="izdanja" aria-label="Izdanja">
      {#each IZDANJA as izdanje (izdanje.verzija)}
        <button type="button" class:odabrano={izdanje.verzija === odabranaVerzija} onclick={() => (odabranaVerzija = izdanje.verzija)}>
          {izdanje.verzija}
        </button>
      {/each}
    </nav>

    {#if odabrano}
      <article class="biljeske">
        <p class="datum">{odabrano.datum}</p>
        <h3>{odabrano.naslov}</h3>
        <p class="uvod">{odabrano.uvod}</p>
        <h4>Novo</h4>
        {#each odabrano.novo as odjeljak}
          <section>
            <h5>{odjeljak.naslov}</h5>
            <ul>{#each odjeljak.stavke as stavka}<li>{stavka}</li>{/each}</ul>
          </section>
        {/each}
      </article>
    {/if}
  </div>
</div>

<style>
  .podloga { position: fixed; z-index: 150; inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(26 24 21 / 55%); }
  .sadrzaj { position: relative; width: min(760px, 100%); max-height: 88vh; overflow: auto; padding: 28px; border-radius: 12px; background: var(--boja-krem); box-shadow: 0 16px 60px rgb(0 0 0 / 28%); }
  .zatvori { position: absolute; top: 12px; right: 16px; border: 0; background: none; font-size: 28px; cursor: pointer; }
  h2 { margin: 0 0 16px; }
  .izdanja { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .izdanja button { padding: 8px 12px; border: 1px solid #e5ddc8; border-radius: 8px; background: white; color: var(--boja-tekst-osnovni); cursor: pointer; font: inherit; font-size: var(--tekst-mali); }
  .izdanja button.odabrano { border-color: var(--boja-mint); background: var(--boja-mint); color: white; }
  .datum { margin: 0; color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  h3 { margin: 4px 0 10px; font-family: var(--font-naslov); font-size: 1.45rem; }
  h4 { margin: 24px 0 10px; font-family: var(--font-naslov); color: var(--boja-tekst-naslov); font-size: 1.25rem; }
  h5 { margin: 18px 0 6px; font-size: 1.1rem; }
  .uvod { line-height: 1.6; font-size: 1.05rem; }
  li { margin: 7px 0; line-height: 1.55; font-size: 1.02rem; }
</style>
