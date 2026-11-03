<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { povuciScroll } from '$lib/povuci-klizac.js';

  const zanimljivosti = [
    {
      naslov: 'Najstariju gramatiku hrvatskog književnog jezika napisao je isusovac.',
      tekst: 'Bartol Kašić početkom 17. stoljeća napisao je Institutionum linguae illyricae (Ustroj ilirskoga/hrvatskoga jezika): knjiga je objavljena u Rimu 1604. godine.',
    },
    {
      naslov: 'Šest govora na hrvatskom jeziku u Saboru smatra se osobito znamenitima.',
      tekst: 'Riječ je o govorima Ivana Kukuljevića Sakcinskog 1843., koji je dugo važio za najstariji govor na hrvatskom jeziku u Saboru. Zatim Josipa Jurja Strossmayera 1861., Ante Starčevića 1861., Ivana Mažuranića 1886., Stjepana Radića 1918., Franje Tuđmana 30. svibnja 1990.',
    },
    {
      naslov: 'Hrvatski jezik pripada indoeuropskim jezicima.',
      tekst: 'Hrvatski je slavenski jezik, zapadnojužnoslavenske podskupine u slavenskoj grani indoeuropske jezične porodice koji se kao i ostali slavenski jezici razvio iz praslavenskoga.',
    },
    {
      naslov: 'Najstariji su hrvatski tekstovi pisani svojevrsnom mješavinom hrvatske inačice crkvenoslavenskog jezika i arhaične čakavštine te isključivo glagoljicom.',
      tekst: 'Od XII. stoljeća Hrvati razvijaju vlastitu inačicu ćiriličnoga pisma koja se najčešće naziva bosančicom, a od XIV. stoljeća sve se češće počinju koristiti i latiničkim pismom.',
    },
    {
      naslov: 'U doba Hrvatskoga narodnog preporoda u prvoj polovici XIX. st. zapadna novoštokavština postaje temeljem općehrvatskoga jezičnoga standarda.',
      tekst: 'Pod utjecajem sjevernih i zapadnih slavenskih jezika uvodi se morfofonološki pravopis, a u grafiju dijakritički znakovi. Grafija se ustaljuje tek krajem XIX. st. (s pravopisom I. Broza).',
    },
  ];
  let poredak = $state(zanimljivosti);
  let indeks = $state(0);
  let klizac: HTMLDivElement | undefined = $state();

  onMount(() => {
    const izmjesano = [...zanimljivosti];
    for (let i = izmjesano.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [izmjesano[i], izmjesano[j]] = [izmjesano[j]!, izmjesano[i]!];
    }
    poredak = izmjesano;
  });

  function pomakni(pomak: number) {
    if (!klizac) return;
    const cilj = Math.max(0, Math.min(poredak.length - 1, indeks + pomak));
    klizac.scrollTo({ left: cilj * klizac.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function listajTipkom(dogadaj: KeyboardEvent) {
    if (dogadaj.key === 'ArrowLeft' || dogadaj.key === 'ArrowRight') {
      dogadaj.preventDefault();
      pomakni(dogadaj.key === 'ArrowLeft' ? -1 : 1);
    }
  }
</script>

<section class="zanimljivosti" aria-label="Zanimljivosti o hrvatskom jeziku" aria-roledescription="klizač">
  <div class="zaglavlje">
    <h2>Zanimljivosti</h2>
    <div class="kontrole">
      <button type="button" aria-label="Prethodna zanimljivost" title="Prethodna zanimljivost" disabled={indeks === 0} onclick={() => pomakni(-1)} onkeydown={listajTipkom}><ChevronLeft size={20} aria-hidden="true" /></button>
      <span class="brojac" aria-live="polite">{indeks + 1} / {poredak.length}</span>
      <button type="button" aria-label="Sljedeća zanimljivost" title="Sljedeća zanimljivost" disabled={indeks === poredak.length - 1} onclick={() => pomakni(1)} onkeydown={listajTipkom}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
  </div>
  <div class="klizac" bind:this={klizac} use:povuciScroll role="group" aria-label="Zanimljivosti o hrvatskom jeziku"
    onscroll={() => { if (klizac?.clientWidth) indeks = Math.round(klizac.scrollLeft / klizac.clientWidth); }}
  >
    {#each poredak as zanimljivost, redniBroj (zanimljivost.naslov)}
      <article aria-hidden={redniBroj !== indeks}>
        <h3>{zanimljivost.naslov}</h3>
        <p>{zanimljivost.tekst}</p>
      </article>
    {/each}
  </div>
</section>

<style>
  .zanimljivosti { min-width: 0; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--boja-obrub); }
  .zaglavlje { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 18px; }
  .kontrole { display: flex; align-items: center; gap: 6px; }
  button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--boja-obrub-jaci); border-radius: 6px; background: var(--boja-povrsina); color: var(--boja-tekst-osnovni); cursor: pointer; }
  button:disabled { opacity: 0.45; cursor: default; }
  .brojac { min-width: 54px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--boja-tekst-sekundarni); }
  .klizac { display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: thin; overscroll-behavior-x: contain; cursor: grab; touch-action: pan-x; }
  .klizac:global(.povlace) { scroll-snap-type: none; cursor: grabbing; user-select: none; }
  article { min-width: 0; padding: 12px 4px; scroll-snap-align: start; overflow-wrap: anywhere; }
  h3 { margin: 0 0 8px; font-size: 16px; color: var(--boja-tekst-naslov); }
  p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--boja-tekst-sekundarni); }
</style>