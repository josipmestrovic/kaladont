<script lang="ts">
  import {
    AVATAR_POZADINA,
    AVATAR_VIEWBOX,
    PREFIKS_DIJELOVA_AVATARA,
    ZADANI_AVATAR_CONFIG,
    slojeviKompozicije,
    type AvatarConfigV1,
  } from 'zajednicko';
  import { bojaBordera, debljinaBorderaRanga } from '$lib/avatari.js';
  import { dohvatiObojeniSvg } from '$lib/avatar-render.js';

  interface Props {
    konfiguracija?: AvatarConfigV1;
    rang?: string | null;
    velicina?: number;
  }

  let { konfiguracija = ZADANI_AVATAR_CONFIG, rang = null, velicina = 280 }: Props = $props();
  const border = $derived(bojaBordera(rang));
  const debljina = $derived(border ? debljinaBorderaRanga(velicina) : 0);
  /** Obojeni URL-ovi samo za trenutni identitet sloja (putanja+boja). */
  let obojanePutanje = $state<Record<string, string>>({});
  let identitetiSlojeva = $state<Record<string, string>>({});
  let generacijaBojanja = 0;

  const slojevi = $derived(slojeviKompozicije(konfiguracija));

  function putanjaSloja(nazivDatoteke: string | null): string | null {
    return nazivDatoteke ? `${PREFIKS_DIJELOVA_AVATARA}/${nazivDatoteke}` : null;
  }

  function identitetSloja(kategorija: string, vrijednost: string | null, boja: string | null): string {
    return `${kategorija}|${vrijednost ?? ''}|${boja ?? ''}`;
  }

  function hrefSloja(kategorija: string, vrijednost: string | null, putanja: string, boja: string | null): string {
    const id = identitetSloja(kategorija, vrijednost, boja);
    if (identitetiSlojeva[kategorija] === id && obojanePutanje[kategorija]) {
      return obojanePutanje[kategorija]!;
    }
    // Dok se novo bojanje ne završi, prikaži neobojeni original nove geometrije (ne stari sloj).
    return putanja;
  }

  $effect(() => {
    const trenutnaGeneracija = ++generacijaBojanja;
    const slojeviZaBojanje = slojevi.filter((sloj) => sloj.vidljiv && sloj.nazivDatoteke && sloj.boja);

    const ucitavanja = slojeviZaBojanje.map(async (sloj) => {
      const putanja = putanjaSloja(sloj.nazivDatoteke)!;
      const boja = sloj.boja!;
      const id = identitetSloja(sloj.kategorija, sloj.vrijednost, boja);
      try {
        const url = await dohvatiObojeniSvg(putanja, boja, sloj.obojiStroke);
        return [sloj.kategorija, url, id] as const;
      } catch {
        return [sloj.kategorija, putanja, id] as const;
      }
    });

    void Promise.all(ucitavanja).then((rezultati) => {
      if (trenutnaGeneracija !== generacijaBojanja) return;
      const novo: Record<string, string> = {};
      const ids: Record<string, string> = {};
      for (const [kategorija, url, id] of rezultati) {
        novo[kategorija] = url;
        ids[kategorija] = id;
      }
      // Atomski zamijeni cijeli kompozit zadnje tražene konfiguracije.
      obojanePutanje = novo;
      identitetiSlojeva = ids;
    });
  });
</script>

<div
  class="avatar-konfiguracija"
  class:ima-rang-border={border !== null}
  style:width={`${velicina}px`}
  style:height={`${velicina}px`}
  style:--boja-rang={border ?? 'transparent'}
  style:--debljina-rang="{debljina}px"
>
  <svg viewBox={`0 0 ${AVATAR_VIEWBOX.sirina} ${AVATAR_VIEWBOX.visina}`} role="img" aria-label="Sastavljeni Kaladont avatar">
    <circle cx="190" cy="190" r="190" fill={AVATAR_POZADINA} />
    {#each slojevi as sloj (sloj.kategorija)}
      {@const putanja = putanjaSloja(sloj.nazivDatoteke)}
      {#if sloj.vidljiv && putanja}
        <image
          href={hrefSloja(sloj.kategorija, sloj.vrijednost, putanja, sloj.boja)}
          x={sloj.x}
          y={sloj.y}
          width={sloj.sirina}
          height={sloj.visina}
          preserveAspectRatio="none"
        />
      {/if}
    {/each}
  </svg>
</div>

<style>
  .avatar-konfiguracija {
    display: inline-flex;
    overflow: hidden;
    flex-shrink: 0;
    border-radius: 50%;
    box-sizing: border-box;
  }
  .avatar-konfiguracija.ima-rang-border {
    box-shadow: 0 0 0 var(--debljina-rang, 3px) var(--boja-rang, transparent);
  }
  svg { display: block; width: 100%; height: 100%; }
  image { overflow: visible; }
</style>
