<script lang="ts">
  let {
    odigrane,
    pobjede,
  }: {
    odigrane: number;
    pobjede: number;
  } = $props();

  const porazi = $derived(Math.max(0, odigrane - pobjede));
  const postotak = $derived(odigrane > 0 ? Math.round((100 * pobjede) / odigrane) : null);
</script>

<section class="troboj" aria-labelledby="troboj-naslov">
  <h2 id="troboj-naslov">Troboj</h2>
  <div class="mreza">
    <article class="kartica">
      <strong class="vrijednost">{odigrane}</strong>
      <span class="naziv">Odigrane igre</span>
    </article>
    <article class="kartica">
      <strong class="vrijednost">{pobjede}</strong>
      <span class="naziv">Pobjede</span>
    </article>
    <article class="kartica">
      <strong class="vrijednost">{porazi}</strong>
      <span class="naziv">Porazi</span>
    </article>
    <article class="kartica">
      <strong class="vrijednost">{postotak === null ? '—' : `${postotak} %`}</strong>
      <span class="naziv">Postotak pobjeda</span>
    </article>
  </div>
</section>

<style>
  .troboj { display: grid; gap: 12px; }
  h2 { margin: 0; font-family: var(--font-naslov); font-size: 1.35rem; }
  .mreza {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .kartica {
    display: grid;
    gap: 6px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica, 8px);
    background: var(--boja-povrsina);
  }
  .vrijednost {
    font-family: var(--font-naslov);
    font-size: 1.55rem;
    line-height: 1.1;
  }
  .naziv { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }

  @media (max-width: 999px) {
    .mreza { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
