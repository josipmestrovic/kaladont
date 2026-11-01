<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  const zanimljivosti = [
    { naslov: 'Mjesec hrvatskoga jezika', tekst: 'Od 21. veljače do 17. ožujka slavimo hrvatski jezik. To je odlična prilika za nove riječi i dobre priče!' },
    { naslov: 'Dan materinskoga jezika', tekst: '21. veljače obilježava se Međunarodni dan materinskoga jezika. Materinski je jezik onaj koji najčešće učimo prvi u obitelji.' },
    { naslov: 'Gramatika stara više od 400 godina', tekst: 'Bartol Kašić napisao je prvu gramatiku hrvatskoga književnog jezika. Objavljena je u Rimu 1604. godine.' },
    { naslov: 'Hrvatski u Saboru', tekst: 'Ivan Kukuljević Sakcinski održao je poznati govor na hrvatskom jeziku u Saboru 1843. godine. U Saboru se tada često govorilo latinski.' },
    { naslov: 'Važni govori', tekst: 'Josip Juraj Strossmayer i Ante Starčević održali su znamenite govore na hrvatskom jeziku u Saboru 1861. godine.' },
    { naslov: 'Govori kroz vrijeme', tekst: 'Ivan Mažuranić govorio je u Saboru 1886., a Stjepan Radić održao je znamenit govor 1918. godine.' },
    { naslov: 'Jedan važan datum', tekst: 'Franjo Tuđman održao je govor u Saboru 30. svibnja 1990. godine. Govori su dio naše jezične i povijesne baštine.' },
    { naslov: 'Velika jezična obitelj', tekst: 'Hrvatski je slavenski jezik. Pripada velikoj indoeuropskoj obitelji jezika, u kojoj su i mnogi drugi europski jezici.' },
    { naslov: 'Davni predak jezika', tekst: 'Slavenski jezici razvili su se iz zajedničkoga davnog jezika: praslavenskoga. Zato neke riječi u njima zvuče slično.' },
    { naslov: 'Milijuni govornika', tekst: 'Hrvatski je materinski jezik milijunima ljudi. Govori se u Hrvatskoj, Bosni i Hercegovini i brojnim zajednicama diljem svijeta.' },
    { naslov: 'Tri narječja', tekst: 'Čakavski, kajkavski i štokavski tri su hrvatska narječja. Imena su dobila prema riječima ča, kaj i što.' },
    { naslov: 'Jezik putuje', tekst: 'Hrvatske zajednice žive i u Austriji, Mađarskoj, Slovačkoj i Italiji. Neke su sačuvale posebne govore svojih predaka.' },
    { naslov: 'Hrvatski u Moliseu', tekst: 'U talijanskoj pokrajini Molise postoje mjesta u kojima se govori poseban hrvatski govor. Jezik može povezivati ljude preko granica.' },
    { naslov: 'Hrvatski u Rumunjskoj', tekst: 'Krašovani su hrvatska zajednica u Rumunjskoj. Njihov govor također pripada bogatoj jezičnoj baštini.' },
    { naslov: 'Tisuću godina pisanja', tekst: 'Početci hrvatske pisane jezične baštine sežu do kraja 11. stoljeća. To je prije otprilike tisuću godina!' },
    { naslov: 'Glagoljica', tekst: 'Mnogi stari hrvatski tekstovi zapisani su glagoljicom. To pismo ima slova koja izgledaju drukčije od onih koja danas koristimo.' },
    { naslov: 'Tri pisma', tekst: 'U hrvatskoj povijesti koristile su se glagoljica, ćirilica zvana bosančica i latinica. Danas pišemo latinicom.' },
    { naslov: 'Književnost starih vremena', tekst: 'U 16. i 17. stoljeću nastajala su važna djela hrvatske književnosti. Pisci su stvarali i na čakavskim i na štokavskim govorima.' },
    { naslov: 'Jezik koji nas povezuje', tekst: 'Standardni jezik pomaže da se lakše razumijemo. Hrvatski standard postupno se oblikovao kroz više stoljeća.' },
    { naslov: 'Hrvatski narodni preporod', tekst: 'U 19. stoljeću ljudi su radili na zajedničkom hrvatskom pisanom jeziku. To razdoblje zovemo Hrvatski narodni preporod.' },
    { naslov: 'Mali znakovi, velika razlika', tekst: 'Znakovi iznad slova razlikuju c, č i ć te s i š. U Kaladontu ih pišemo pažljivo jer mijenjaju riječ!' },
    { naslov: 'Deklaracija iz 1967.', tekst: 'Godine 1967. objavljena je Deklaracija o nazivu i položaju hrvatskoga jezika. Bila je važna za njegov javni položaj.' },
    { naslov: 'Uvijek možemo učiti', tekst: 'I odrasli otkrivaju nove riječi i uče o jeziku. Čitanje, razgovor i igra pomažu da ga bolje upoznamo.' },
  ];
  let poredak = $state(zanimljivosti);
  let indeks = $state(0);
  let klizac: HTMLDivElement | undefined = $state();

  onMount(() => {
    const pocetak = Math.floor(Math.random() * zanimljivosti.length);
    poredak = [...zanimljivosti.slice(pocetak), ...zanimljivosti.slice(0, pocetak)];
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
  <div class="klizac" bind:this={klizac} role="group" aria-label="Zanimljivosti o hrvatskom jeziku"
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
  .klizac { display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: thin; overscroll-behavior-x: contain; }
  article { min-width: 0; padding: 12px 4px; scroll-snap-align: start; overflow-wrap: anywhere; }
  h3 { margin: 0 0 8px; font-size: 16px; color: var(--boja-tekst-naslov); }
  p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--boja-tekst-sekundarni); }
</style>