<script lang="ts">
  import KaladontDnkGraf from '$lib/komponente/KaladontDnkGraf.svelte';
  import FormaIgraca from '$lib/komponente/FormaIgraca.svelte';
  import OsobniRekordi from './OsobniRekordi.svelte';
  import TrobojStatistika from './TrobojStatistika.svelte';
  import NapredakIzazova from './NapredakIzazova.svelte';
  import DetaljnaStatistika from './DetaljnaStatistika.svelte';
  import { formaTroboja, type JavniDioProfila, type OsobniRekordi as OsobniRekordiTip } from './tipovi.js';

  let { profil }: { profil: JavniDioProfila } = $props();

  const forma = $derived(formaTroboja(profil));
  const troboj = $derived(profil.formati?.tri_igraca);
  const rekordi = $derived.by((): OsobniRekordiTip => {
    if (profil.osobniRekordi) return profil.osobniRekordi;
    return {
      najboljiNizPobjeda: forma?.najboljiNiz ?? 0,
      nizPrihvacenihRijeci: profil.dnk.metrike.nizPrihvacenihRijeci,
      najduzaRijec: profil.statistikaRijeci?.najduzaRijec ?? null,
      najduzaRijecGrafemi: profil.statistikaRijeci?.najduzaRijecGrafemi ?? 0,
      najbrziPrihvaceniPotezMs: null,
    };
  });
  const napredakIzazova = $derived(profil.napredakIzazova ?? {
    trenutniLevel: 1,
    zavrseniIzazovi: 0,
    zvjezdice: 0 as const,
    napredakDoSljedeceg: { zavrseno: 0, ukupno: 15 },
  });
</script>

<section id="pregled" class="pregled" aria-label="Pregled profila">
  <OsobniRekordi {rekordi} />
  <KaladontDnkGraf profil={profil.dnk} naslov="Kaladont DNK" />
  <TrobojStatistika
    odigrane={troboj?.odigrane ?? 0}
    pobjede={troboj?.pobjede ?? 0}
  />
  {#if forma}
    <FormaIgraca {forma} mod="tri_igraca" sakrijNajboljiNiz={true} />
  {/if}
  <NapredakIzazova napredak={napredakIzazova} />
  <DetaljnaStatistika
    metrike={profil.dnk.metrike}
    prosjekBodova={troboj && troboj.odigrane > 0 ? troboj.prosjekBodova : null}
  />
</section>

<style>
  .pregled {
    display: grid;
    gap: 20px;
  }
</style>
