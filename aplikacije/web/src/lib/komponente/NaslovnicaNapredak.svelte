<script lang="ts">
  import {
    gostImaXp,
    izracunajPrikazXp,
    tekstRegistracijeGosta,
  } from '$lib/naslovnica-napredak.js';
  import { stanjeProfila } from '$lib/stanje-profila.svelte.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';
  import Avatar from './Avatar.svelte';
  import NaslovnicaObavijesti from './NaslovnicaObavijesti.svelte';

  let {
    izazoviZavrseno = 0,
  }: {
    izazoviZavrseno?: number;
  } = $props();

  const prikaz = $derived(izracunajPrikazXp(stanjeProfila.profil, stanjeProfila.status));
  const profil = $derived(stanjeProfila.profil);
  const jeGostProfil = $derived(profil?.vrsta === 'gost');
  /** CTA tek kad je snapshot pouzdano učitan — bez SSR/hidratacijskog bljeska. */
  const prikaziGostCta = $derived(stanjeProfila.status === 'spreman' && jeGostProfil);
  const prikaziAvatar = $derived(stanjeProfila.status === 'spreman' && profil !== null);
  const nadimak = $derived(
    jeGostProfil ? 'Gost' : (profil?.nadimak?.trim() || 'Moj napredak'),
  );
  const ariaProfil = $derived(
    prikaz.vrsta === 'napredak'
      ? `${nadimak}, ${prikaz.rang}, razina ${prikaz.razina}`
      : prikaz.natpis,
  );
  const gostCtaTekst = $derived(
    tekstRegistracijeGosta({
      imaXp: gostImaXp(profil?.iskustvo),
      imaZavrseneIzazove: izazoviZavrseno > 0,
    }),
  );
  const linkNaProfil = $derived(stanjeProfila.status === 'spreman' && !jeGostProfil);
  /** Desktop raspored za registrirane — neovisno o broju dostignuća. */
  const prikaziRegistriranRaspored = $derived(linkNaProfil);
</script>

<div
  class="naslovnica-napredak-omotac"
  class:naslovnica-napredak-omotac--gost={prikaziGostCta}
  class:naslovnica-napredak-omotac--registriran={prikaziRegistriranRaspored}
>
  {#if linkNaProfil}
    <a
      href="/profil"
      class="naslovnica-napredak"
      data-testid="naslovnica-napredak"
      aria-label={ariaProfil}
      onclick={() => zabiljeziUmamiDogadjaj('naslovnica-profil-klik')}
    >
      {@render sadrzajNapretka()}
    </a>
  {:else}
    <div
      class="naslovnica-napredak naslovnica-napredak--staticki"
      data-testid="naslovnica-napredak"
      aria-label={ariaProfil}
    >
      {@render sadrzajNapretka()}
    </div>
  {/if}

  {#if prikaziRegistriranRaspored}
    <div class="naslovnica-obavijesti-slot">
      <NaslovnicaObavijesti />
    </div>
  {/if}

  {#if prikaziGostCta}
    <div class="naslovnica-gost-cta" data-testid="naslovnica-gost-cta">
      <a
        href="/registracija"
        class="naslovnica-gost-registracija"
        data-testid="naslovnica-gost-registracija"
        onclick={() => zabiljeziUmamiDogadjaj('naslovnica-registracija-klik')}
      >
        <span class="naslovnica-gost-registracija__tekst">{gostCtaTekst}</span>
        <span class="naslovnica-gost-registracija__akcija">Registriraj se ›</span>
      </a>
      <p class="naslovnica-gost-prijava">
        Već imaš račun?
        <a
          href="/prijava"
          data-testid="naslovnica-gost-prijava"
          onclick={() => zabiljeziUmamiDogadjaj('naslovnica-prijava-klik')}
        >Prijavi se</a>
      </p>
    </div>
  {/if}
</div>

{#snippet sadrzajNapretka()}
  {#if prikaziAvatar && profil}
    <span class="naslovnica-napredak__avatar" aria-hidden="true">
      <Avatar
        avatarId={profil.avatarId}
        avatarConfig={profil.avatarConfig}
        rang={profil.rang}
        gost={profil.vrsta === 'gost'}
        velicina={52}
      />
    </span>
  {:else}
    <span class="naslovnica-napredak__avatar naslovnica-napredak__avatar--rezerva" aria-hidden="true"
    ></span>
  {/if}

  <span class="naslovnica-napredak__sadrzaj">
    {#if prikaz.vrsta === 'napredak'}
      <span class="naslovnica-napredak__red">
        <span class="naslovnica-napredak__nadimak">{nadimak}</span>
        <span class="naslovnica-napredak__lvl">LVL {prikaz.razina}</span>
      </span>
      <span class="naslovnica-napredak__rang">{prikaz.rang}</span>
      {#if prikaz.maksimalna}
        <span
          class="naslovnica-napredak__traka"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          aria-label="Maksimalna razina"
        >
          <span style="width: 100%"></span>
        </span>
        <span class="naslovnica-napredak__xp">Maksimalna razina</span>
      {:else if prikaz.doIduceTekst !== null && prikaz.postotak !== null}
        <span
          class="naslovnica-napredak__traka"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(prikaz.postotak)}
          aria-label={`Napredak do sljedeće razine: ${prikaz.uRaziniTekst} od ${prikaz.doIduceTekst} XP`}
        >
          <span style={`width: ${prikaz.postotak}%`}></span>
        </span>
        <span class="naslovnica-napredak__xp"
          >{prikaz.uRaziniTekst} / {prikaz.doIduceTekst} XP</span
        >
      {/if}
    {:else}
      <span class="naslovnica-napredak__nadimak naslovnica-napredak__nadimak--neutralan"
        >{prikaz.natpis}</span
      >
      <span class="naslovnica-napredak__traka naslovnica-napredak__traka--prazna" aria-hidden="true"
      ></span>
    {/if}
  </span>
{/snippet}

<style>
  .naslovnica-napredak-omotac {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    /* Tamniji mint od pozadine — bez krem/bijele pločice. */
    background: var(--boja-povrsina);
    border: 1px solid color-mix(in srgb, #fff 14%, transparent);
    min-height: 0;
    box-sizing: border-box;
  }

  :global(html[data-tema='svijetla']) .naslovnica-napredak-omotac {
    background: color-mix(in srgb, var(--boja-mint) 7%, transparent);
    border-color: color-mix(in srgb, var(--boja-mint) 26%, transparent);
  }

  .naslovnica-napredak-omotac--gost {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }

  .naslovnica-napredak {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
    padding: 0;
    color: var(--boja-tekst-sekundarni);
    text-decoration: none;
    text-align: left;
  }

  .naslovnica-napredak--staticki {
    cursor: default;
  }

  .naslovnica-napredak-omotac--gost .naslovnica-napredak {
    flex: 1 1 200px;
    width: auto;
    min-width: 0;
  }

  a.naslovnica-napredak:hover {
    color: var(--boja-akcent-tekst);
  }

  a.naslovnica-napredak:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .naslovnica-napredak__avatar {
    flex: 0 0 auto;
    display: inline-flex;
    width: 48px;
    height: 48px;
  }

  .naslovnica-napredak__avatar--rezerva {
    border-radius: 50%;
    background: color-mix(in srgb, var(--boja-tekst-sekundarni) 18%, transparent);
  }

  .naslovnica-napredak__avatar :global(.avatar) {
    width: 48px !important;
    height: 48px !important;
  }

  .naslovnica-napredak__sadrzaj {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
  }

  .naslovnica-napredak__red {
    display: flex;
    flex-wrap: nowrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .naslovnica-napredak__nadimak {
    margin: 0;
    min-width: 0;
    flex: 1 1 auto;
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-naslov);
    /* Mobitel: ime 20, ostalo 16 / min 14. Desktop override ispod. */
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .naslovnica-napredak__nadimak--neutralan {
    color: var(--boja-tekst-sekundarni);
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
  }

  .naslovnica-napredak__lvl {
    flex: 0 0 auto;
    color: var(--boja-zuta-krema);
    font-family: var(--font-naslov);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .naslovnica-napredak__rang {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .naslovnica-napredak__traka {
    display: block;
    width: 100%;
    min-width: 0;
    height: 8px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: color-mix(in srgb, var(--boja-tekst-sekundarni) 28%, transparent);
  }

  .naslovnica-napredak__traka--prazna {
    visibility: hidden;
  }

  .naslovnica-napredak__traka > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-zuta-krema);
  }

  .naslovnica-napredak__xp {
    margin: 0;
    align-self: flex-start;
    font-family: var(--font-tijelo);
    font-size: 14px;
    line-height: 1.2;
    text-align: left;
  }

  .naslovnica-obavijesti-slot {
    display: none;
  }

  .naslovnica-gost-cta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    text-align: right;
  }

  .naslovnica-gost-registracija {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px 8px;
    max-width: 100%;
    padding: 2px 2px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    text-decoration: none;
    text-align: right;
  }

  .naslovnica-gost-registracija:hover .naslovnica-gost-registracija__akcija {
    text-decoration: underline;
  }

  .naslovnica-gost-registracija:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .naslovnica-gost-registracija__tekst {
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    font-weight: 500;
    line-height: 1.3;
  }

  .naslovnica-gost-registracija__akcija {
    color: var(--boja-crvena);
    font-family: var(--font-tijelo);
    font-size: clamp(15px, 2.1dvh, 17px);
    font-weight: 800;
    line-height: 1.25;
    text-decoration: none;
    white-space: nowrap;
  }

  .naslovnica-gost-prijava {
    margin: 0;
    padding: 0 2px 2px;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    font-weight: 500;
    line-height: 1.3;
  }

  .naslovnica-gost-prijava a {
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .naslovnica-gost-prijava a:hover {
    color: var(--boja-akcent-tekst);
  }

  .naslovnica-gost-prijava a:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  @media (min-width: 1000px) {
    .naslovnica-napredak-omotac {
      align-items: stretch;
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 14px 16px;
    }

    .naslovnica-napredak-omotac--gost {
      flex-wrap: nowrap;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 100%;
      gap: 16px 24px;
    }

    .naslovnica-napredak-omotac--registriran {
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-start;
      gap: 0;
    }

    .naslovnica-napredak-omotac--registriran .naslovnica-napredak {
      flex: 0 0 30%;
      width: 30%;
      max-width: 30%;
      box-sizing: border-box;
      padding-right: 16px;
      justify-content: flex-start;
    }

    .naslovnica-obavijesti-slot {
      display: block;
      flex: 0 0 70%;
      width: 70%;
      max-width: 70%;
      min-width: 0;
      box-sizing: border-box;
    }

    .naslovnica-napredak-omotac--gost .naslovnica-napredak {
      flex: 1 1 auto;
      width: auto;
      max-width: none;
    }

    .naslovnica-napredak__nadimak {
      font-size: 22px;
    }

    .naslovnica-napredak__lvl {
      font-size: 18px;
    }

    .naslovnica-napredak__rang {
      font-size: 18px;
    }

    .naslovnica-napredak__xp {
      font-size: 16px;
    }

    .naslovnica-napredak__sadrzaj {
      min-width: 0;
      width: 100%;
      max-width: none;
    }

    .naslovnica-napredak__traka {
      min-width: 0;
      width: 100%;
      max-width: none;
      height: 9px;
    }

    .naslovnica-napredak__avatar,
    .naslovnica-napredak__avatar :global(.avatar) {
      width: 52px !important;
      height: 52px !important;
    }

    .naslovnica-gost-cta {
      flex: 0 0 auto;
      margin-left: auto;
    }
  }

  @media (max-width: 999px) {
    .naslovnica-napredak-omotac--gost {
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: stretch;
      justify-content: flex-start;
      width: 100%;
      max-width: 100%;
      gap: 10px;
    }

    .naslovnica-napredak-omotac--gost .naslovnica-napredak {
      flex: 0 1 auto;
      width: 100%;
      justify-content: flex-start;
    }

    .naslovnica-gost-cta {
      align-items: center;
      width: 100%;
      text-align: center;
    }

    .naslovnica-gost-registracija {
      justify-content: center;
      text-align: center;
    }

    .naslovnica-gost-prijava {
      text-align: center;
    }
  }

  :global(html[data-font-disleksiju]) .naslovnica-napredak__nadimak {
    line-height: 1.3;
  }

  :global(html[data-tema='svijetla']) .naslovnica-napredak__lvl {
    color: color-mix(in srgb, var(--boja-akcent-tekst) 90%, #8a6a00);
  }

  :global(html[data-tema='svijetla']) .naslovnica-gost-registracija__akcija {
    color: color-mix(in srgb, var(--boja-crvena) 88%, #5a1a08);
  }

  :global(html:not([data-tema='svijetla'])) .naslovnica-gost-registracija__akcija {
    color: color-mix(in srgb, var(--boja-crvena) 72%, #fff);
  }
</style>
