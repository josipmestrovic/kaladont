<script lang="ts">
  import { izracunajPrikazXp } from '$lib/naslovnica-napredak.js';
  import { stanjeProfila } from '$lib/stanje-profila.svelte.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';
  import Avatar from './Avatar.svelte';

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
</script>

<div class="naslovnica-napredak-omotac">
  <a
    href="/profil"
    class="naslovnica-napredak"
    data-testid="naslovnica-napredak"
    aria-label={ariaProfil}
    onclick={() => zabiljeziUmamiDogadjaj('naslovnica-profil-klik')}
  >
    {#if prikaziAvatar && profil}
      <span class="naslovnica-napredak__avatar" aria-hidden="true">
        <Avatar
          avatarId={profil.avatarId}
          avatarConfig={profil.avatarConfig}
          rang={profil.rang}
          gost={profil.vrsta === 'gost'}
          velicina={56}
        />
      </span>
    {/if}

    <span class="naslovnica-napredak__sadrzaj">
      {#if prikaz.vrsta === 'napredak'}
        <span class="naslovnica-napredak__red">
          <span class="naslovnica-napredak__nadimak">{nadimak}</span>
          <span class="naslovnica-napredak__lvl">LVL {prikaz.razina}</span>
        </span>
        <span class="naslovnica-napredak__rang">{prikaz.rang}</span>
        {#if prikaz.maksimalna}
          <span class="naslovnica-napredak__xp">Maksimalna razina</span>
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
      {/if}
    </span>
  </a>

  {#if prikaziGostCta}
    <a
      href="/registracija"
      class="naslovnica-gost-registracija"
      data-testid="naslovnica-gost-registracija"
      onclick={() => zabiljeziUmamiDogadjaj('naslovnica-registracija-klik')}
    >
      <span class="naslovnica-gost-registracija__tekst">Sačuvaj svoj napredak.</span>
      <span class="naslovnica-gost-registracija__akcija">Registriraj se ›</span>
    </a>
  {/if}
</div>

<style>
  .naslovnica-napredak-omotac {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: min(100%, 420px);
    margin: 0 auto;
  }

  .naslovnica-napredak {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
    padding: 4px 2px;
    color: var(--boja-tekst-sekundarni);
    text-decoration: none;
    text-align: left;
  }

  .naslovnica-napredak:hover {
    color: var(--boja-akcent-tekst);
  }

  .naslovnica-napredak:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .naslovnica-napredak__avatar {
    flex: 0 0 auto;
    display: inline-flex;
  }

  .naslovnica-napredak__avatar :global(.avatar) {
    width: 52px !important;
    height: 52px !important;
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
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    min-width: 0;
  }

  .naslovnica-napredak__nadimak {
    margin: 0;
    min-width: 0;
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-naslov);
    font-size: clamp(16px, 2.2dvh, 18px);
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .naslovnica-napredak__nadimak--neutralan {
    color: var(--boja-tekst-sekundarni);
  }

  .naslovnica-napredak__lvl {
    flex: 0 0 auto;
    color: var(--boja-zuta-krema);
    font-family: var(--font-naslov);
    font-size: clamp(14px, 2dvh, 16px);
    font-weight: 700;
    line-height: 1.2;
  }

  .naslovnica-napredak__rang {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    font-weight: 500;
    line-height: 1.2;
  }

  .naslovnica-napredak__traka {
    display: block;
    width: 100%;
    height: 9px;
    overflow: hidden;
    border-radius: var(--radijus-pill);
    background: color-mix(in srgb, var(--boja-tekst-sekundarni) 28%, transparent);
  }

  .naslovnica-napredak__traka > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-zuta-krema);
  }

  .naslovnica-napredak__xp {
    margin: 0;
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    line-height: 1.2;
  }

  .naslovnica-gost-registracija {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    padding: 6px 10px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-sekundarni) 45%, transparent);
    border-radius: 10px;
    color: var(--boja-tekst-sekundarni);
    text-decoration: none;
    text-align: center;
  }

  .naslovnica-gost-registracija:hover {
    color: var(--boja-akcent-tekst);
    border-color: color-mix(in srgb, var(--boja-akcent-tekst) 55%, transparent);
  }

  .naslovnica-gost-registracija:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
  }

  .naslovnica-gost-registracija__tekst {
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    line-height: 1.25;
  }

  .naslovnica-gost-registracija__akcija {
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    font-weight: 700;
    line-height: 1.25;
    text-decoration: underline;
  }

  @media (min-width: 1000px) {
    .naslovnica-napredak-omotac {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 12px 16px;
      width: auto;
      max-width: min(100%, 480px);
      margin: 0;
    }

    .naslovnica-napredak {
      flex: 0 1 auto;
      width: auto;
      min-width: 0;
      max-width: 300px;
    }

    .naslovnica-napredak__avatar :global(.avatar) {
      width: 58px !important;
      height: 58px !important;
    }

    .naslovnica-gost-registracija {
      flex: 0 0 auto;
      align-items: flex-start;
      text-align: left;
      padding: 8px 12px;
    }
  }

  @media (max-width: 999px) {
    .naslovnica-napredak-omotac {
      width: min(100%, 360px);
    }

    .naslovnica-napredak__avatar :global(.avatar) {
      width: 50px !important;
      height: 50px !important;
    }

    .naslovnica-gost-registracija {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px 8px;
      padding: 8px 12px;
    }
  }

  :global(html[data-font-disleksiju]) .naslovnica-napredak__nadimak {
    font-size: clamp(15px, 2.2dvh, 17px);
    line-height: 1.3;
  }

  :global(html[data-tema='svijetla']) .naslovnica-napredak__lvl {
    color: color-mix(in srgb, var(--boja-akcent-tekst) 90%, #8a6a00);
  }
</style>
