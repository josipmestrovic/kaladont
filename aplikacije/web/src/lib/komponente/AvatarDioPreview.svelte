<script lang="ts">
  import { bojiStroke, dohvatiObojeniSvg, putanjaSlicice } from '$lib/avatar-render.js';

  interface Props {
    kategorija: string;
    vrijednost: string | null;
    boja?: string | null;
  }

  let { kategorija, vrijednost, boja = null }: Props = $props();

  const putanja = $derived(putanjaSlicice(kategorija, vrijednost));
  let prikazanaPutanja = $state<string | null>(null);
  let generacija = 0;

  $effect(() => {
    const trenutna = ++generacija;
    const izvor = putanja;
    const bojaZaBojanje = boja;
    // Ne prikazuj prethodnu varijantu dok se nova ne pripremi.
    prikazanaPutanja = izvor;
    if (!izvor) {
      prikazanaPutanja = null;
      return;
    }
    if (!bojaZaBojanje) return;
    void dohvatiObojeniSvg(izvor, bojaZaBojanje, bojiStroke(kategorija))
      .then((obojeno) => {
        if (trenutna === generacija) prikazanaPutanja = obojeno;
      })
      .catch(() => {
        if (trenutna === generacija) prikazanaPutanja = izvor;
      });
  });
</script>

<div class="dio-krug">
  {#if prikazanaPutanja}
    <img src={prikazanaPutanja} alt="" aria-hidden="true" />
  {/if}
</div>

<style>
  /* Velicinu diktira kartica u mrezici, zato je krug fluidan. */
  .dio-krug {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    padding: 8%;
    border-radius: 50%;
    background: #ffedef;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
