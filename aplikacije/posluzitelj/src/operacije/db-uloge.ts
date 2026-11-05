import postgres from 'postgres';

export const APP_ULOGA = 'kaladont_app';

export function urlZaMigracije(): string {
  return process.env.BAZA_URL_MIGRACIJE?.trim() || process.env.BAZA_URL?.trim() || '';
}

export function lozinkaAppUloge(): string {
  return process.env.BAZA_APP_LOZINKA?.trim() || '';
}

function escapeLiteral(vrijednost: string): string {
  return `'${vrijednost.replace(/'/g, "''")}'`;
}

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Neispravno ime baze: ${ident}`);
  }
  return ident;
}

/**
 * Idempotentno: stvara/osvježava `kaladont_app` i daje DML prava na public shemu.
 * Mora se pokrenuti vlasničkim URL-om (BAZA_URL_MIGRACIJE).
 */
export async function osigurajDbUloge(opcije?: {
  vlasnickiUrl?: string;
  appLozinka?: string;
  appUloga?: string;
}): Promise<{ uloga: string; kreirana: boolean }> {
  const vlasnickiUrl = opcije?.vlasnickiUrl ?? urlZaMigracije();
  const appLozinka = opcije?.appLozinka ?? lozinkaAppUloge();
  const uloga = opcije?.appUloga ?? APP_ULOGA;

  if (!vlasnickiUrl) {
    throw new Error('BAZA_URL_MIGRACIJE ili BAZA_URL mora biti postavljen za osiguravanje DB uloga.');
  }
  if (!appLozinka) {
    throw new Error('BAZA_APP_LOZINKA mora biti postavljena za aplikacijsku DB ulogu.');
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(uloga)) {
    throw new Error(`Neispravno ime DB uloge: ${uloga}`);
  }

  const sql = postgres(vlasnickiUrl, { max: 1 });
  try {
    const postojeci = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = ${uloga}) AS exists
    `;
    const kreirana = !postojeci[0]?.exists;

    if (kreirana) {
      await sql.unsafe(`CREATE ROLE ${uloga} LOGIN PASSWORD ${escapeLiteral(appLozinka)}`);
    } else {
      await sql.unsafe(`ALTER ROLE ${uloga} WITH LOGIN PASSWORD ${escapeLiteral(appLozinka)}`);
    }

    const bazaRedovi = await sql<{ db: string }[]>`SELECT current_database() AS db`;
    const imeBaze = bazaRedovi[0]?.db;
    if (!imeBaze) {
      throw new Error('Ne mogu očitati current_database() za GRANT CONNECT.');
    }
    await sql.unsafe(`GRANT CONNECT ON DATABASE ${quoteIdent(imeBaze)} TO ${uloga}`);
    await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${uloga}`);
    await sql.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${uloga}`,
    );
    await sql.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${uloga}`);
    await sql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${uloga}`,
    );
    await sql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${uloga}`,
    );

    return { uloga, kreirana };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
