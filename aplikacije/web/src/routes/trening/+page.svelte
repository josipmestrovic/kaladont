<script lang="ts">
  import { Check, Cpu, Crown, Play, Users } from 'lucide-svelte';
  import {
    NAZIVI_PROFILA_BOTA,
    PROFILI_BOTA_IZAZOVA,
    type PravilnikPartije,
    type ProfilBotaIzazova,
  } from 'zajednicko';
  import {
    REDOSLIJED_PRAVILNIKA,
    TEKSTOVI_PRAVILNIKA,
    putanjaZagrijavanjaBotova,
  } from '$lib/igraj-rute.js';
  import { zagrijGameplayZvukove } from '$lib/audio-manager.js';

  const OPCIJE_BOTOVA = [
    { broj: 1 as const, naziv: '1 bot' },
    { broj: 2 as const, naziv: '2 bota' },
    { broj: 3 as const, naziv: '3 bota' },
  ];

  // Default = prvi u redu (lijevo), kao u modalu.
  let pravilnik = $state<PravilnikPartije>(REDOSLIJED_PRAVILNIKA[0]!);
  let profil = $state<ProfilBotaIzazova>(PROFILI_BOTA_IZAZOVA[0]!);
  let brojBotova = $state<1 | 2 | 3>(OPCIJE_BOTOVA[0]!.broj);

  const startHref = $derived(putanjaZagrijavanjaBotova(brojBotova, pravilnik, profil));
</script>

<svelte:head>
  <title>Trening | Kaladont</title>
</svelte:head>

<main class="trening-setup" data-testid="trening-setup">
  <header class="uvod">
    <h1>Trening</h1>
    <p class="podnaslov">
      Namjesti pravila i vježbaj protiv računala. XP i kolekcija se bilježe, bez bodova, ranga i forme.
    </p>
  </header>

  <div class="postavke">
    <section class="grupa" aria-labelledby="naslov-pravila">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <Crown size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-pravila">Pravila igre</h2>
      </div>

      <div class="opcije-gumbi" role="radiogroup" aria-label="Pravilnik">
        {#each REDOSLIJED_PRAVILNIKA as p (p)}
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={pravilnik === p}
            role="radio"
            aria-checked={pravilnik === p}
            onclick={() => (pravilnik = p)}
          >
            {#if pravilnik === p}
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            {/if}
            {TEKSTOVI_PRAVILNIKA[p].naziv}
          </button>
        {/each}
      </div>
      <p class="opis">{TEKSTOVI_PRAVILNIKA[pravilnik].opis}</p>
    </section>

    <section class="grupa" aria-labelledby="naslov-tezina">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <Cpu size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-tezina">Težina bota</h2>
      </div>

      <div class="opcije-gumbi" role="radiogroup" aria-label="Težina bota">
        {#each PROFILI_BOTA_IZAZOVA as p (p)}
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={profil === p}
            role="radio"
            aria-checked={profil === p}
            onclick={() => (profil = p)}
          >
            {#if profil === p}
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            {/if}
            {NAZIVI_PROFILA_BOTA[p]}
          </button>
        {/each}
      </div>
    </section>

    <section class="grupa" aria-labelledby="naslov-botovi">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <Users size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-botovi">Broj botova</h2>
      </div>

      <div class="opcije-gumbi opcije-gumbi--botovi" role="radiogroup" aria-label="Broj botova">
        {#each OPCIJE_BOTOVA as opcija (opcija.broj)}
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={brojBotova === opcija.broj}
            role="radio"
            aria-checked={brojBotova === opcija.broj}
            onclick={() => (brojBotova = opcija.broj)}
          >
            {#if brojBotova === opcija.broj}
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            {/if}
            {opcija.naziv}
          </button>
        {/each}
      </div>
    </section>

    <section class="akcije">
      <a
        class="glavni-gumb"
        href={startHref}
        data-testid="trening-zapocni"
        onclick={() => zagrijGameplayZvukove()}
      >
        <Play size={18} strokeWidth={2.6} aria-hidden="true" />
        Pokreni trening
      </a>
      <a class="sporedni-gumb" href="/">Povratak</a>
    </section>
  </div>
</main>

<style>
  .trening-setup {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 20px 0 48px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .uvod {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h1 {
    font-family: var(--font-naslov);
    font-size: clamp(28px, 4.5vw, 40px);
    line-height: 1.15;
    margin: 0;
  }

  .podnaslov {
    margin: 0;
    max-width: 42rem;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    line-height: 1.45;
  }

  .postavke {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grupa {
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica);
    padding: 18px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .grupa-glava {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .grupa h2 {
    font-family: var(--font-naslov);
    font-size: clamp(18px, 2.4vw, 22px);
    margin: 0;
    line-height: 1.2;
  }

  .grupa-ikona {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    border-radius: 10px;
    background: color-mix(in srgb, var(--boja-isticanje-slova) 22%, transparent);
    color: var(--boja-isticanje-tekst);
  }

  .opcije-gumbi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }

  .opcije-gumbi--botovi {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .odabir-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border: 2px solid var(--boja-obrub);
    border-radius: var(--radijus-pill);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
    text-align: center;
  }

  .odabir-gumb.odabran {
    background: var(--boja-cta-pozadina);
    border-color: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
  }

  .opis {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.45;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
  }

  .glavni-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 12px 22px;
    border-radius: var(--radijus-pill);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font: inherit;
    font-weight: 800;
    text-decoration: none;
  }

  .sporedni-gumb {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 10px 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-pill);
    color: inherit;
    font-weight: 700;
    text-decoration: none;
  }

  @media (max-width: 520px) {
    .opcije-gumbi--botovi {
      grid-template-columns: 1fr;
    }
  }
</style>
