<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

  interface Potez {
    id: number;
    rijec: string | null;
  }

  const LIMIT_PRIJAVA = 3;
  const VELICINA_STRANICE = 6;
  const PORUKA_LIMITA = 'Dosegnut je maksimalan broj prijava za ovu kategoriju.';
  const TEKST_LIMITA_GUMBA = 'maksimalan broj prijava dosegnut';
  const PORUKA_ZAHVALE = 'Hvala! Tvoja prijava nam pomaže poboljšati rječnik.';
  const TRAJANJE_ZAHVALE_MS = 7000;

  let {
    partijaId,
    potezi,
    odbijeneRijeci,
    ucitavanje = false,
    greska = null as string | null,
    imaJos = false,
    naUcitajJos,
    naOtvori,
    otvorenoPocetno = false,
    prijavljeneOdbijene = $bindable(new Set<string>()),
    brojDodavanje = $bindable(0),
    limitDodavanjeDosegnut = $bindable(false),
  }: {
    partijaId: string;
    potezi: Potez[];
    odbijeneRijeci: string[];
    ucitavanje?: boolean;
    greska?: string | null;
    imaJos?: boolean;
    naUcitajJos?: () => void;
    naOtvori?: () => void;
    otvorenoPocetno?: boolean;
    prijavljeneOdbijene?: Set<string>;
    brojDodavanje?: number;
    limitDodavanjeDosegnut?: boolean;
  } = $props();

  let otvoreno = $state(otvorenoPocetno);

  onMount(() => {
    if (otvoreno) naOtvori?.();
  });

  function prebaciOtvoreno() {
    otvoreno = !otvoreno;
    if (otvoreno) naOtvori?.();
  }

  function zatvoriPanel() {
    otvoreno = false;
  }
  let prikaz: 'odigrane' | 'odbijene' = $state('odigrane');
  let prijavljeniPotezi = $state<Set<number>>(new Set());
  let prijavaUTijeku = $state<Set<string>>(new Set());
  let brojBrisanje = $state(0);
  let limitBrisanjeDosegnut = $state(false);
  let porukaGreske = $state<string | null>(null);
  let vidljivoPrihvacenih = $state(VELICINA_STRANICE);
  let vidljivoOdbijenih = $state(VELICINA_STRANICE);

  const odigrane = $derived(potezi.filter((potez) => potez.rijec));
  // Odigrane dolaze već najnovije-prve (živ zapis + API smjer=desc). Odbijene se i dalje grade kronološki.
  const odbijeneNajnovijePrvo = $derived([...odbijeneRijeci].toReversed());
  const prikazaneOdigrane = $derived(odigrane.slice(0, vidljivoPrihvacenih));
  const prikazaneOdbijene = $derived(odbijeneNajnovijePrvo.slice(0, vidljivoOdbijenih));
  const imaJosPrihvacenih = $derived(odigrane.length > vidljivoPrihvacenih || imaJos);
  const imaJosOdbijenihListe = $derived(odbijeneRijeci.length > vidljivoOdbijenih);

  function kljucPoteza(id: number) {
    return `p:${id}`;
  }

  function kljucOdbijene(rijec: string) {
    return `o:${rijec}`;
  }

  function jeGreskaLimita(poruka: string) {
    return /limit|dosegnut/i.test(poruka);
  }

  function oznaciLimitBrisanja() {
    limitBrisanjeDosegnut = true;
    porukaGreske = PORUKA_LIMITA;
  }

  function oznaciLimitDodavanja() {
    limitDodavanjeDosegnut = true;
    porukaGreske = PORUKA_LIMITA;
  }

  function ucitajJosPrihvacenih() {
    vidljivoPrihvacenih += VELICINA_STRANICE;
    if (vidljivoPrihvacenih > odigrane.length && imaJos && naUcitajJos) {
      naUcitajJos();
    }
  }

  function ucitajJosOdbijenih() {
    vidljivoOdbijenih += VELICINA_STRANICE;
  }

  async function prijaviPotez(potez: Potez) {
    if (!potez.rijec) return;
    const kljuc = kljucPoteza(potez.id);
    if (prijavljeniPotezi.has(potez.id) || prijavaUTijeku.has(kljuc) || limitBrisanjeDosegnut) return;
    if (brojBrisanje >= LIMIT_PRIJAVA) {
      oznaciLimitBrisanja();
      return;
    }
    prijavaUTijeku = new Set(prijavaUTijeku).add(kljuc);
    porukaGreske = null;
    try {
      const tijelo = potez.id > 0
        ? { partijaId, tip: 'za_brisanje' as const, potezId: potez.id }
        : { partijaId, tip: 'za_brisanje' as const, rijec: potez.rijec };
      await api<{ ok: boolean; poruka?: string }>('/prijave', {
        method: 'POST',
        body: JSON.stringify(tijelo),
      });
      prijavljeniPotezi = new Set(prijavljeniPotezi).add(potez.id);
      brojBrisanje += 1;
      pokaziUspjeh(PORUKA_ZAHVALE, TRAJANJE_ZAHVALE_MS);
    } catch (greskaPrijava) {
      const poruka = greskaPrijava instanceof Error ? greskaPrijava.message : 'Prijava nije uspjela.';
      if (jeGreskaLimita(poruka)) {
        oznaciLimitBrisanja();
      } else {
        porukaGreske = poruka;
      }
    } finally {
      const novi = new Set(prijavaUTijeku);
      novi.delete(kljuc);
      prijavaUTijeku = novi;
    }
  }

  async function prijaviOdbijenu(rijec: string) {
    const normalizirana = rijec.normalize('NFC').trim().toLowerCase();
    const kljuc = kljucOdbijene(normalizirana);
    if (prijavljeneOdbijene.has(normalizirana) || prijavaUTijeku.has(kljuc) || limitDodavanjeDosegnut) return;
    if (brojDodavanje >= LIMIT_PRIJAVA) {
      oznaciLimitDodavanja();
      return;
    }
    prijavaUTijeku = new Set(prijavaUTijeku).add(kljuc);
    porukaGreske = null;
    try {
      await api<{ ok: boolean; poruka?: string }>('/prijave', {
        method: 'POST',
        body: JSON.stringify({ partijaId, tip: 'za_dodavanje', rijec: normalizirana }),
      });
      prijavljeneOdbijene = new Set(prijavljeneOdbijene).add(normalizirana);
      brojDodavanje += 1;
      pokaziUspjeh(PORUKA_ZAHVALE, TRAJANJE_ZAHVALE_MS);
    } catch (greskaPrijava) {
      const poruka = greskaPrijava instanceof Error ? greskaPrijava.message : 'Prijava nije uspjela.';
      if (jeGreskaLimita(poruka)) {
        oznaciLimitDodavanja();
      } else {
        porukaGreske = poruka;
      }
    } finally {
      const novi = new Set(prijavaUTijeku);
      novi.delete(kljuc);
      prijavaUTijeku = novi;
    }
  }
</script>

<section class="panel-prijava-rijeci">
  <button type="button" class="naslov" aria-expanded={otvoreno} onclick={prebaciOtvoreno}>
    <span>Prijavi riječ</span>
    <span aria-hidden="true">{otvoreno ? '−' : '+'}</span>
  </button>

  {#if otvoreno}
    <div class="toggle" role="tablist" aria-label="Vrsta riječi">
      <button type="button" role="tab" aria-selected={prikaz === 'odigrane'} class:aktivan={prikaz === 'odigrane'} onclick={() => (prikaz = 'odigrane')}>
        Prihvaćene riječi
      </button>
      <button type="button" role="tab" aria-selected={prikaz === 'odbijene'} class:aktivan={prikaz === 'odbijene'} onclick={() => (prikaz = 'odbijene')}>
        Odbijene riječi
      </button>
    </div>

    {#if porukaGreske}<p class="greska" role="alert">{porukaGreske}</p>{/if}

    {#if prikaz === 'odigrane'}
      {#if ucitavanje && odigrane.length === 0}
        <p aria-live="polite">Učitavanje riječi...</p>
        <div class="panel-podnozje">
          <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
        </div>
      {:else if greska}
        <p class="greska" role="alert">{greska}</p>
        <div class="panel-podnozje">
          <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
        </div>
      {:else if odigrane.length === 0}
        <p class="prazno">Još nema prihvaćenih riječi.</p>
        <div class="panel-podnozje">
          <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
        </div>
      {:else}
        <ul>
          {#each prikazaneOdigrane as potez (potez.id)}
            <li>
              <span class="rijec">{potez.rijec}</span>
              <button
                type="button"
                class="prijavi"
                disabled={prijavljeniPotezi.has(potez.id) || prijavaUTijeku.has(kljucPoteza(potez.id)) || limitBrisanjeDosegnut}
                onclick={() => void prijaviPotez(potez)}
              >
                {#if prijavljeniPotezi.has(potez.id)}
                  Prijavljeno
                {:else if prijavaUTijeku.has(kljucPoteza(potez.id))}
                  Šaljem...
                {:else if limitBrisanjeDosegnut}
                  {TEKST_LIMITA_GUMBA}
                {:else}
                  Prijavi
                {/if}
              </button>
            </li>
          {/each}
        </ul>
        <div class="panel-podnozje">
          {#if imaJosPrihvacenih}
            <button type="button" class="vidi-jos" onclick={ucitajJosPrihvacenih} disabled={ucitavanje}>
              {ucitavanje ? 'Učitavanje...' : 'Vidi još'}
            </button>
          {/if}
          <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
        </div>
      {/if}
    {:else if odbijeneRijeci.length === 0}
      <p class="prazno">Nemaš odbijenih riječi u ovoj partiji.</p>
      <div class="panel-podnozje">
        <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
      </div>
    {:else}
      <ul>
        {#each prikazaneOdbijene as rijec (rijec)}
          <li>
            <span class="rijec">{rijec}</span>
            <button
              type="button"
              class="prijavi"
              disabled={prijavljeneOdbijene.has(rijec) || prijavaUTijeku.has(kljucOdbijene(rijec)) || limitDodavanjeDosegnut}
              onclick={() => void prijaviOdbijenu(rijec)}
            >
              {#if prijavljeneOdbijene.has(rijec)}
                Prijavljeno
              {:else if prijavaUTijeku.has(kljucOdbijene(rijec))}
                Šaljem...
              {:else if limitDodavanjeDosegnut}
                {TEKST_LIMITA_GUMBA}
              {:else}
                Prijavi
              {/if}
            </button>
          </li>
        {/each}
      </ul>
      <div class="panel-podnozje">
        {#if imaJosOdbijenihListe}
          <button type="button" class="vidi-jos" onclick={ucitajJosOdbijenih}>
            Vidi još
          </button>
        {/if}
        <button type="button" class="zatvori-panel" onclick={zatvoriPanel}>Zatvori</button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .panel-prijava-rijeci {
    width: 100%;
    margin-top: 16px;
    padding: 0;
    border-top: 1px solid var(--boja-obrub);
  }

  .naslov {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .toggle button {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--boja-obrub);
    border-radius: 6px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .toggle button.aktivan {
    border-color: var(--boja-cta-pozadina);
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--boja-obrub);
  }

  .rijec {
    font-weight: 700;
    word-break: break-word;
  }

  .prijavi,
  .vidi-jos,
  .zatvori-panel {
    flex: 0 0 auto;
    padding: 6px 10px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 6px;
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .prijavi:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .panel-podnozje {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }

  .vidi-jos:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .greska {
    color: var(--boja-poraz-tekst);
  }

  .prazno {
    color: var(--boja-tekst-sekundarni);
    font-size: 0.95rem;
  }
</style>
