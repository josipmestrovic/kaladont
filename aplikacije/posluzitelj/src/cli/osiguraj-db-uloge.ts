import { osigurajDbUloge } from '../operacije/db-uloge.js';

async function glavno(): Promise<void> {
  const rezultat = await osigurajDbUloge();
  console.log(
    rezultat.kreirana
      ? `DB uloga ${rezultat.uloga} je stvorena i dobila DML prava.`
      : `DB uloga ${rezultat.uloga} je osvježena (lozinka i DML prava).`,
  );
}

glavno().catch((greska: unknown) => {
  console.error(greska instanceof Error ? greska.message : greska);
  process.exitCode = 1;
});
