import { SEO_BAZA } from '$lib/seo.js';

export const prerender = true;

function urlZapisa(putanja: string): string {
  const lokacija = putanja === '/' ? `${SEO_BAZA}/` : `${SEO_BAZA}${putanja}`;
  return `  <url>\n    <loc>${lokacija}</loc>\n  </url>`;
}

export function GET() {
  // HINT PR15: /novosti je javna indeksabilna stranica izdanja (ne redirect).
  const putanje = ['/', '/pravila-kaladonta', '/novosti'];

  const tijelo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${putanje.map(urlZapisa).join('\n')}
</urlset>
`;

  return new Response(tijelo, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
