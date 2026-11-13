<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import {
    obrisiSavSanducic,
    oznaciSavSanducicProcitanim,
    osvjeziSazetakSanducica,
  } from '$lib/stanje-sanducica.svelte.js';
  import {
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

  type Prikaz = 'nove' | 'sve';

  let prikaz = $state<Prikaz>('nove');
  let poruke = $state<SanducicPorukaDetalj[]>([]);
  let novePoruke = $state<SanducicPorukaDetalj[]>([]);
  let noveIds = $state<Set<string>>(new Set());
  let sljedeciCursor = $state<string | null>(null);
  let ucitavanje = $state(true);
  let greska = $state<string | null>(null);
  let brisanje = $state(false);
  let istaknutiId = $state<string | null>(null);
  let oznacenoProcitanima = $state(false);

  const prikazanePoruke = $derived(prikaz === 'nove' ? novePoruke : poruke);

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

  function mapirajProcitano(lista: SanducicPorukaDetalj[]): SanducicPorukaDetalj[] {
    return lista.map((p) => ({ ...p, procitano: true }));
  }

  async function ucitaj(reset = true): Promise<void> {
    ucitavanje = true;
    greska = null;
    try {
      const params = new URLSearchParams();
      if (prikaz === 'nove') {
        params.set('filter', 'neprocitane');
        params.set('limit', '50');
      }
      if (!reset && sljedeciCursor) params.set('cursor', sljedeciCursor);
      const odgovor = await api<{ ok: true; poruke: SanducicPorukaDetalj[]; sljedeciCursor: string | null }>(
        `/sanducic?${params.toString()}`,
      );
      if (reset) {
        const granica = new Date();
        const mapirane = mapirajProcitano(odgovor.poruke);
        if (prikaz === 'nove') {
          noveIds = new Set(odgovor.poruke.map((p) => p.id));
          novePoruke = mapirane;
        } else {
          if (!oznacenoProcitanima) {
            noveIds = new Set(odgovor.poruke.filter((p) => !p.procitano).map((p) => p.id));
            novePoruke = mapirajProcitano(odgovor.poruke.filter((p) => !p.procitano));
          }
          poruke = mapirane;
        }
        sljedeciCursor = prikaz === 'nove' ? null : odgovor.sljedeciCursor;
        if (!oznacenoProcitanima) {
          try {
            await oznaciSavSanducicProcitanim(granica);
            oznacenoProcitanima = true;
          } catch {
            // Lista je već učitana; crvena točka može ostati dok korisnik ne osvježi.
          }
        }
      } else {
        const mapirane = mapirajProcitano(odgovor.poruke);
        if (prikaz === 'nove') {
          novePoruke = [...novePoruke, ...mapirane];
          noveIds = new Set([...noveIds, ...mapirane.map((p) => p.id)]);
        } else {
          poruke = [...poruke, ...mapirane];
        }
        sljedeciCursor = odgovor.sljedeciCursor;
      }
    } catch {
      greska = 'Ne mogu učitati obavijesti.';
      if (reset) {
        if (prikaz === 'nove') {
          novePoruke = [];
          noveIds = new Set();
        } else {
          poruke = [];
        }
      }
    } finally {
      ucitavanje = false;
    }
  }

  async function postaviPrikaz(novi: Prikaz): Promise<void> {
    if (novi === prikaz) return;
    prikaz = novi;
    istaknutiId = null;
    sljedeciCursor = null;
    if (novi === 'sve') {
      await ucitaj(true);
      return;
    }
    // Povratak na Nove: lokalni cache (neprocitane bi bile prazne nakon mark-read).
  }

  async function obrisiSve(): Promise<void> {
    if (prikazanePoruke.length === 0 || brisanje) return;
    if (!confirm('Želiš li obrisati sve obavijesti?')) return;
    brisanje = true;
    try {
      await obrisiSavSanducic();
      poruke = [];
      novePoruke = [];
      noveIds = new Set();
      sljedeciCursor = null;
      istaknutiId = null;
      await osvjeziSazetakSanducica();
    } catch {
      greska = 'Ne mogu obrisati obavijesti.';
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

  onMount(() => {
    void (async () => {
      await ucitaj(true);
      const id = $page.url.searchParams.get('id');
      if (!id) return;
      if (novePoruke.some((p) => p.id === id)) {
        istakniPoruku(id);
        return;
      }
      await postaviPrikaz('sve');
      if (poruke.some((p) => p.id === id)) istakniPoruku(id);
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
      <div class="filter" role="group" aria-label="Filter obavijesti">
        <button
          type="button"
          class="filter-gumb"
          class:aktivan={prikaz === 'nove'}
          aria-pressed={prikaz === 'nove'}
          disabled={ucitavanje}
          onclick={() => void postaviPrikaz('nove')}
        >
          Nove
        </button>
        <button
          type="button"
          class="filter-gumb"
          class:aktivan={prikaz === 'sve'}
          aria-pressed={prikaz === 'sve'}
          disabled={ucitavanje}
          onclick={() => void postaviPrikaz('sve')}
        >
          Sve
        </button>
      </div>
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

  {#if greska}
    <div class="greska" role="alert">
      <p>{greska}</p>
      <button type="button" onclick={() => void ucitaj(true)}>Pokušaj ponovno</button>
    </div>
  {:else if ucitavanje && prikazanePoruke.length === 0}
    <p class="stanje">Učitavanje…</p>
  {:else if prikazanePoruke.length === 0}
    {#if prikaz === 'nove'}
      <div class="stanje prazno-nove">
        <p>Nema novih obavijesti.</p>
        <button type="button" class="filter-gumb aktivan" onclick={() => void postaviPrikaz('sve')}>
          Prikaži sve
        </button>
      </div>
    {:else}
      <p class="stanje">Zasad nema obavijesti.</p>
    {/if}
  {:else}
    <ul class="lista">
      {#each prikazanePoruke as poruka (poruka.id)}
        <li id="obavijest-{poruka.id}">
          <article class="stavka" class:novo={noveIds.has(poruka.id)} class:istaknuto={istaknutiId === poruka.id}>
            <img class="ikona" src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="36" height="36" />
            <div class="tekst">
              <div class="naslovni-red">
                <strong>{poruka.naslov}</strong>
                {#if noveIds.has(poruka.id)}
                  <span class="oznaka-novo">Novo</span>
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
              <time datetime={poruka.stvorenaAt}>{formatirajVrijeme(poruka.stvorenaAt)}</time>
              {#if poruka.poveznica}
                <a class="poveznica" href={poruka.poveznica}>Otvori</a>
              {/if}
            </div>
          </article>
        </li>
      {/each}
    </ul>

    {#if sljedeciCursor}
      <button type="button" class="ucitaj-jos" disabled={ucitavanje} onclick={() => void ucitaj(false)}>
        Učitaj starije
      </button>
    {/if}
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
    justify-content: space-between;
  }

  .filter {
    display: inline-flex;
    gap: 6px;
  }

  .filter-gumb,
  .obrisi-sve,
  .ucitaj-jos,
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

  .filter-gumb.aktivan {
    border-color: var(--boja-isticanje-tekst);
    color: var(--boja-isticanje-tekst);
    background: color-mix(in srgb, var(--boja-isticanje-tekst) 10%, transparent);
  }

  .filter-gumb:disabled,
  .obrisi-sve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stanje,
  .greska {
    padding: 24px 8px;
    text-align: center;
  }

  .prazno-nove {
    display: grid;
    gap: 12px;
    justify-items: center;
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

  .oznaka-novo {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--boja-akcent);
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

  .tekst time {
    font-size: 0.85rem;
    opacity: 0.75;
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
