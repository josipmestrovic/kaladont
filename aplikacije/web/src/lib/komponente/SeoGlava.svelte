<script lang="ts">
  import {
    SEO_OG_ALT,
    SEO_OG_SIRINA,
    SEO_OG_SLIKA,
    SEO_OG_VISINA,
    kanonskiUrl,
    jsonLdSkripta,
  } from '$lib/seo.js';

  let {
    title,
    description,
    putanja,
    jsonLd = null,
    ogType = 'website',
    ogImage,
    ogTitle,
    ogImageAlt,
  }: {
    title: string;
    description?: string;
    /** Relativna putanja (npr. `/` ili `/pravila-kaladonta/bodovi`). */
    putanja: string;
    jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
    ogType?: string;
    ogImage?: string;
    ogTitle?: string;
    ogImageAlt?: string;
  } = $props();

  const kanonski = $derived(kanonskiUrl(putanja));
  const opis = $derived(
    description ??
      'Kaladont — online hrvatska igra riječi. Igraj Dvoboj, Četveroboj ili privatnu sobu.',
  );
  const dijeljeniNaslov = $derived(ogTitle ?? title);
  const dijeljenaSlika = $derived(ogImage ?? SEO_OG_SLIKA);
  const dijeljeniAlt = $derived(ogImageAlt ?? SEO_OG_ALT);
  const jsonLdTekst = $derived(jsonLd ? jsonLdSkripta(jsonLd) : null);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={opis} />
  <link rel="canonical" href={kanonski} />

  <meta property="og:type" content={ogType} />
  <meta property="og:locale" content="hr_HR" />
  <meta property="og:site_name" content="Kaladont" />
  <meta property="og:title" content={dijeljeniNaslov} />
  <meta property="og:description" content={opis} />
  <meta property="og:url" content={kanonski} />
  <meta property="og:image" content={dijeljenaSlika} />
  <meta property="og:image:width" content={String(SEO_OG_SIRINA)} />
  <meta property="og:image:height" content={String(SEO_OG_VISINA)} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content={dijeljeniAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={dijeljeniNaslov} />
  <meta name="twitter:description" content={opis} />
  <meta name="twitter:image" content={dijeljenaSlika} />
  <meta name="twitter:image:alt" content={dijeljeniAlt} />

  {#if jsonLdTekst}
    {@html `<script type="application/ld+json">${jsonLdTekst}</script>`}
  {/if}
</svelte:head>
