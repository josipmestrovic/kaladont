import { PRAVILA_TEME, SEO_BAZA, putanjaPravilaTeme } from '$lib/seo.js';

export const prerender = true;

function urlZapisa(putanja: string): string {
  const lokacija = putanja === '/' ? `${SEO_BAZA}/` : `${SEO_BAZA}${putanja}`;
  return `  <url>\n    <loc>${lokacija}</loc>\n  </url>`;
}

export function GET() {
  const putanje = [
    '/',
    ...PRAVILA_TEME.map((tema) => putanjaPravilaTeme(tema)),
  ];
  // `kako-igrati` i root hub dijele isti URL — deduplikacija.
  const jedinstvene = [...new Set(putanje)];

  const tijelo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${jedinstvene.map(urlZapisa).join('\n')}
</urlset>
`;

  return new Response(tijelo, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
