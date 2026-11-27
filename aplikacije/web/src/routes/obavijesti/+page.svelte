<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { relativnoVrijemeObavijesti } from '$lib/naslovnica-obavijesti.js';
  import {
    obrisiSavSanducic,
    oznaciSavSanducicProcitanim,
    osvjeziSazetakSanducica,
  } from '$lib/stanje-sanducica.svelte.js';
  import {
    MAKS_SANDUCIC_PORUKA_PO_IGRACU,
    TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA,
    TIP_SANDUCIC_NOVA_XP_RAZINA,
    TIP_SANDUCIC_NOVA_ZVJEZDICA,
    TIP_SANDUCIC_PRIJAVA_IGRACA_NIJE_UVAZENA,
    TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
    TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA,
    TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_DODANA,
    TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_UKLONJENA,
    TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA,
    dohvatiDefinicijuDostignuca,
    normalizirajNapomenuPrijave,
    type SanducicPorukaDetalj,
  } from 'zajednicko';

  let poruke = $state<SanducicPorukaDetalj[]>([]);
  let ucitavanje = $state(true);
  let greska = $state<string | null>(null);
  let greskaAkcije = $state<string | null>(null);
  let brisanje = $state(false);
  let oznacavanjeSve = $state(false);
  let istaknutiId = $state<string | null>(null);
  let ciljanaPoruka = $state<SanducicPorukaDetalj | null>(null);
  let ciljanaNedostupna = $state(false);
  let zahtjevGen = 0;

  const prikazanePoruke = $derived.by(() => {
    if (!ciljanaPoruka) return poruke;
    if (poruke.some((p) => p.id === ciljanaPoruka!.id)) return poruke;
    return [ciljanaPoruka, ...poruke];
  });

  function formatirajVrijeme(iso: string): string {
    try {
      return new Date(iso).toLocaleString('hr-HR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function tekstPolje(podaci: Record<string, unknown>, kljuc: string): string {
    const vrijednost = podaci[kljuc];
    return typeof vrijednost === 'string' ? vrijednost : '';
  }

  function brojPolje(podaci: Record<string, unknown>, kljuc: string): number | null {
    const vrijednost = podaci[kljuc];
    const broj = typeof vrijednost === 'number' ? vrijednost : Number(vrijednost);
    return Number.isFinite(broj) ? broj : null;
  }

  function oblikZvjezdice(broj: number): string {
    if (broj === 1) return 'zvjezdicu';
    if (broj >= 2 && broj <= 4) return 'zvjezdice';
    return 'zvjezdica';
  }

  function jePrijavaTip(tip: string): boolean {
    return (
      tip === TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA
      || tip === TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_DODANA
      || tip === TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA
      || tip === TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_UKLONJENA
      || tip === TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA
      || tip === TIP_SANDUCIC_PRIJAVA_IGRACA_NIJE_UVAZENA
    );
  }

  async function ucitaj(): Promise<void> {
    const gen = ++zahtjevGen;
    ucitavanje = true;
    greska = null;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(MAKS_SANDUCIC_PORUKA_PO_IGRACU));
      const odgovor = await api<{ ok: true; poruke: SanducicPorukaDetalj[]; sljedeciCursor: string | null }>(
        `/sanducic?${params.toString()}`,
      );
      if (gen !== zahtjevGen) return;
      poruke = odgovor.poruke;
      if (ciljanaPoruka && poruke.some((p) => p.id === ciljanaPoruka!.id)) {
        ciljanaPoruka = null;
      }
    } catch {
      if (gen !== zahtjevGen) return;
      greska = 'Ne mogu učitati obavijesti.';
      poruke = [];
    } finally {
      if (gen === zahtjevGen) ucitavanje = false;
    }
  }

  async function oznaciSve(): Promise<void> {
    if (oznacavanjeSve) return;
    oznacavanjeSve = true;
    greskaAkcije = null;
    const granica = new Date();
    try {
      await oznaciSavSanducicProcitanim(granica);
      poruke = poruke.map((p) =>
        !p.procitano && new Date(p.stvorenaAt).getTime() <= granica.getTime()
          ? { ...p, procitano: true }
          : p,
      );
      if (ciljanaPoruka && !ciljanaPoruka.procitano) {
        ciljanaPoruka = { ...ciljanaPoruka, procitano: true };
      }
    } catch {
      greskaAkcije = 'Ne mogu označiti sve obavijesti pročitanima.';
    } finally {
      oznacavanjeSve = false;
    }
  }

  async function obrisiSve(): Promise<void> {
    if (prikazanePoruke.length === 0 || brisanje) return;
    if (!confirm('Želiš li obrisati sve obavijesti?')) return;
    brisanje = true;
    greskaAkcije = null;
    try {
      await obrisiSavSanducic();
      poruke = [];
      ciljanaPoruka = null;
      ciljanaNedostupna = false;
      istaknutiId = null;
      await osvjeziSazetakSanducica();
    } catch {
      greskaAkcije = 'Ne mogu obrisati obavijesti.';
    } finally {
      brisanje = false;
    }
  }

  function istakniPoruku(id: string): void {
    istaknutiId = id;
    queueMicrotask(() => {
      document.getElementById(`obavijest-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  async function obradiDeepLink(id: string): Promise<void> {
    if (poruke.some((p) => p.id === id)) {
      istakniPoruku(id);
      return;
    }
    try {
      const odgovor = await api<{ ok: true; poruka: SanducicPorukaDetalj }>(`/sanducic/${id}`);
      ciljanaPoruka = { ...odgovor.poruka, procitano: true };
      ciljanaNedostupna = false;
      istakniPoruku(id);
    } catch {
      ciljanaPoruka = null;
      ciljanaNedostupna = true;
    }
  }

  onMount(() => {
    void (async () => {
      await ucitaj();
      const id = $page.url.searchParams.get('id');
      // Ulazak na stranicu = sve pročitano (prije deep-linka da badge nestane odmah).
      await oznaciSve();
      if (id) await obradiDeepLink(id);
    })();
  });
</script>

<svelte:head>
  <title>Obavijesti — Kaladont</title>
</svelte:head>

<main class="obavijesti">
  <header class="zaglavlje">
    <h1>Obavijesti</h1>
    <div class="akcije">
      <button
        type="button"
        class="obrisi-sve"
        disabled={brisanje || prikazanePoruke.length === 0}
        onclick={() => void obrisiSve()}
      >
        Obriši sve obavijesti
      </button>
    </div>
  </header>

  {#if ciljanaNedostupna}
    <p class="stanje upozorenje" role="status">Obavijest više nije dostupna.</p>
  {/if}

  {#if greskaAkcije}
    <p class="stanje upozorenje" role="alert">{greskaAkcije}</p>
  {/if}

  {#if greska}
    <div class="greska" role="alert">
      <p>{greska}</p>
      <button type="button" onclick={() => void ucitaj()}>Pokušaj ponovno</button>
    </div>
  {:else if ucitavanje && prikazanePoruke.length === 0}
    <p class="stanje">Učitavanje…</p>
  {:else if prikazanePoruke.length === 0}
    <p class="stanje">Zasad nema obavijesti.</p>
  {:else}
    <ul class="lista">
      {#each prikazanePoruke as poruka (poruka.id)}
        <li id="obavijest-{poruka.id}">
          <article
            class="stavka"
            class:novo={!poruka.procitano}
            class:procitano={poruka.procitano}
            class:istaknuto={istaknutiId === poruka.id}
          >
            <img class="ikona" src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="36" height="36" />
            <div class="tekst">
              <div class="naslovni-red">
                {#if !poruka.procitano}
                  <span class="tockica" aria-hidden="true"></span>
                {/if}
                <strong class:naslov-muted={poruka.procitano}>{poruka.naslov}</strong>
                {#if !poruka.procitano}
                  <span class="oznaka-novo">Nepročitano</span>
                {:else}
                  <span class="oznaka-procitano">Pročitano</span>
                {/if}
              </div>
              {#if poruka.tip === TIP_SANDUCIC_NOVA_XP_RAZINA}
                <p class="tijelo">
                  Bravo! Dosegnuo/la si <strong class="istaknuto-lvl">LVL {brojPolje(poruka.podaci, 'razina') ?? '?'}</strong>!
                </p>
              {:else if poruka.tip === TIP_SANDUCIC_NOVA_ZVJEZDICA}
                {@const naziv = tekstPolje(poruka.podaci, 'naziv') || 'dostignuće'}
                {@const broj = brojPolje(poruka.podaci, 'zvjezdice') ?? 1}
                {@const opis = dohvatiDefinicijuDostignuca(tekstPolje(poruka.podaci, 'dostignuceId'))?.opis}
                <p class="tijelo tijelo-dostignuce">
                  {#if broj <= 1}
                    Bravo! Otključano dostignuće <strong>{naziv}</strong>: {broj}.
                  {:else}
                    Bravo! Dostignuće <strong>{naziv}</strong> sada ima <span class="neprekidaj">{broj} {oblikZvjezdice(broj)}!</span>
                  {/if}
                </p>
                {#if opis}
                  <p class="opis-dostignuca">{opis}</p>
                {/if}
              {:else if poruka.tip === TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA}
                <p class="tijelo tijelo-dostignuce">
                  Bravo! Otključana kolekcionarska razina <strong>{tekstPolje(poruka.podaci, 'naziv') || 'nova razina'}</strong>!
                </p>
              {:else if jePrijavaTip(poruka.tip)}
                {@const rijec = tekstPolje(poruka.podaci, 'rijec') || 'prijavljena riječ'}
                {@const nadimak = tekstPolje(poruka.podaci, 'nadimak') || 'korisnika'}
                {@const napomena = normalizirajNapomenuPrijave(poruka.podaci.napomena)}
                <p class="tijelo tijelo-prijava">
                  {#if poruka.tip === TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA}
                    Riječ „<strong>{rijec}</strong>” koju si prijavio/la <strong>JE DODANA</strong> u rječnik. Hvala na pomoći! :)
                  {:else if poruka.tip === TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_DODANA}
                    Riječ „<strong>{rijec}</strong>” koju si prijavio/la <strong>NIJE DODANA</strong> u rječnik. Hvala na pokušaju! :)
                  {:else if poruka.tip === TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA}
                    Riječ „<strong>{rijec}</strong>” koju si prijavio/la <strong>JE UKLONJENA</strong> iz rječnika. Hvala na pomoći! :)
                  {:else if poruka.tip === TIP_SANDUCIC_PRIJAVA_RIJEC_NIJE_UKLONJENA}
                    Riječ „<strong>{rijec}</strong>” koju si prijavio/la <strong>NIJE UKLONJENA</strong> iz rječnika. Hvala što si pokušao pomoć i samo tako nastavi!
                  {:else if poruka.tip === TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA}
                    {#if poruka.podaci.razlog === 'pogrdan_nadimak'}
                      Tvoja prijava vulgarnog nadimka za korisnika „<strong>{nadimak}</strong>” <strong>JE UVAŽENA</strong>. Hvala ti što pomažeš poboljšati Kaladont! :)
                    {:else}
                      Tvoja prijava igrača „<strong>{nadimak}</strong>” <strong>JE UVAŽENA</strong>. Hvala ti što pomažeš poboljšati Kaladont! :)
                    {/if}
                  {:else}
                    {#if poruka.podaci.razlog === 'pogrdan_nadimak'}
                      Tvoja prijava vulgarnog nadimka za korisnika „<strong>{nadimak}</strong>” <strong>NIJE UVAŽENA</strong>.
                    {:else}
                      Tvoja prijava igrača „<strong>{nadimak}</strong>” <strong>NIJE UVAŽENA</strong>.
                    {/if}
                  {/if}
                </p>
                {#if napomena}
                  <p class="dodatna-napomena">
                    <span class="oznaka">Dodatna napomena</span>
                    <span class="tekst-napomene">{napomena}</span>
                  </p>
                {/if}
              {:else}
                <p class="tijelo">{poruka.tekst}</p>
              {/if}
              <div class="meta-red">
                <time datetime={poruka.stvorenaAt}>
                  {relativnoVrijemeObavijesti(poruka.stvorenaAt)}
                  <span class="meta-apsolutno">({formatirajVrijeme(poruka.stvorenaAt)})</span>
                </time>
              </div>
              {#if poruka.poveznica}
                <a class="poveznica" href={poruka.poveznica}>Otvori</a>
              {/if}
            </div>
          </article>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .obavijesti {
    width: min(100% - 32px, 720px);
    margin: 16px auto 48px;
    display: grid;
    gap: 16px;
  }

  .zaglavlje {
    display: grid;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-naslov);
    font-size: 1.8rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
  }

  .obrisi-sve,
  .greska button {
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 20%, transparent);
    border-radius: 8px;
    background: var(--boja-povrsina, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
    font-weight: 600;
  }

  .obrisi-sve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stanje,
  .greska {
    padding: 24px 8px;
    text-align: center;
  }

  .upozorenje {
    padding: 8px;
    opacity: 0.9;
  }

  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .stavka {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 12%, transparent);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .stavka.novo {
    border-color: color-mix(in srgb, var(--boja-akcent) 45%, transparent);
    background: color-mix(in srgb, var(--boja-akcent) 8%, transparent);
  }

  .stavka.procitano {
    opacity: 0.88;
  }

  .stavka.istaknuto {
    outline: 2px solid var(--boja-akcent);
  }

  .tekst {
    display: grid;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .naslovni-red {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .naslovni-red strong {
    font-size: 1.05rem;
  }

  .naslov-muted {
    font-weight: 600;
    color: var(--boja-tekst-sekundarni);
  }

  .tockica {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--boja-zuta-krema, #f0d878);
  }

  .oznaka-novo,
  .oznaka-procitano {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .oznaka-novo {
    color: var(--boja-akcent);
  }

  .oznaka-procitano {
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }

  .tijelo {
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .tijelo-dostignuce,
  .tijelo-prijava {
    white-space: normal;
  }

  .tijelo strong,
  .istaknuto-lvl {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }

  .tijelo-dostignuce strong,
  .tijelo-prijava strong {
    color: var(--boja-zlato-tekst);
    font-weight: 800;
  }

  .neprekidaj {
    white-space: nowrap;
  }

  .opis-dostignuca {
    margin: 4px 0 0;
    line-height: 1.4;
    font-size: 0.92rem;
    opacity: 0.85;
  }

  .dodatna-napomena {
    margin: 6px 0 0;
    line-height: 1.45;
    color: var(--boja-zlato-tekst);
    font-weight: 700;
  }

  .dodatna-napomena .oznaka {
    display: block;
    font-size: 0.85rem;
    font-weight: 800;
    margin-bottom: 2px;
  }

  .dodatna-napomena .tekst-napomene {
    white-space: pre-wrap;
  }

  .meta-red {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
  }

  .meta-red time {
    font-size: 0.85rem;
    opacity: 0.75;
  }

  .meta-apsolutno {
    margin-left: 4px;
    opacity: 0.8;
  }

  .poveznica {
    font-weight: 600;
    color: var(--boja-akcent);
    width: fit-content;
  }

  .ikona {
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
