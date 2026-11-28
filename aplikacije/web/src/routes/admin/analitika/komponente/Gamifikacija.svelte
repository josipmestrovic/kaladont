<script lang="ts">
  import type { AgregatGamifikacije } from '../tipovi.js';
  import { formatSekundi, nazivKonteksta, neprimjenjivoIli, postotak } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  const PREDLOSCI_PO_STRANICI = 25;

  let {
    agregat,
    ucitava,
    greska,
  }: {
    agregat: AgregatGamifikacije | null;
    ucitava: boolean;
    greska: string | null;
  } = $props();

  let stranicaPredlozaka = $state(1);

  $effect(() => {
    if (agregat) stranicaPredlozaka = 1;
  });
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if agregat}
  {@const predlosciSvi = agregat.razdoblje.predlosci}
  {@const predlosciOd = (stranicaPredlozaka - 1) * PREDLOSCI_PO_STRANICI}
  {@const predlosciStranica = predlosciSvi.slice(predlosciOd, predlosciOd + PREDLOSCI_PO_STRANICI)}
  {@const predlosciUkupnoStranica = Math.max(1, Math.ceil(predlosciSvi.length / PREDLOSCI_PO_STRANICI))}
  {@const misijeDostupne = agregat.razdoblje.doprinosiINagradeMisija?.dostupno !== false}

  <section aria-labelledby="gamifikacija-naslov">
    <h2 id="gamifikacija-naslov">Gamifikacija</h2>
    <p class="meta">
      Zona: {agregat.vremenskaZona} · {agregat.od} – {agregat.do}
      {#if agregat.kontekst}
        · kontekst: {nazivKonteksta(agregat.kontekst)}
      {/if}
    </p>
    <p class="meta">{agregat.napomena}</p>

    <h3>Misije</h3>
    <p class="meta">{agregat.razdoblje.misije.napomenaNazivnika}</p>
    <AnalitikaKpi>
      <div><dt>Dnevne dodijeljene</dt><dd>{agregat.razdoblje.misije.dnevne.dodijeljene}</dd></div>
      <div>
        <dt>Dnevne dovršene</dt>
        <dd>
          {agregat.razdoblje.misije.dnevne.dovrsene} ({postotak(agregat.razdoblje.misije.dnevne.udioTrenutnoDovrsenih)})
        </dd>
      </div>
      <div>
        <dt>Dnevne terminalna stopa</dt>
        <dd>
          {postotak(agregat.razdoblje.misije.dnevne.terminalnaStopaDovrsavanja)} (n={agregat.razdoblje.misije.dnevne
            .terminalniNazivnik})
        </dd>
      </div>
      <div>
        <dt>Dnevne aktivne / zamijenjene / istekle</dt>
        <dd>
          {agregat.razdoblje.misije.dnevne.aktivne} / {agregat.razdoblje.misije.dnevne.zamijenjene} / {agregat.razdoblje
            .misije.dnevne.istekle}
        </dd>
      </div>
      <div>
        <dt>Dnevne primatelji / dovršitelji</dt>
        <dd>
          {agregat.razdoblje.misije.dnevne.primatelji} / {agregat.razdoblje.misije.dnevne.dovrsitelji}
        </dd>
      </div>
      <div>
        <dt>Dnevne vrijeme dovršetka</dt>
        <dd>
          prosjek {formatSekundi(agregat.razdoblje.misije.dnevne.vrijemeDovrsetka.prosjekSekundi)} · medijan {formatSekundi(
            agregat.razdoblje.misije.dnevne.vrijemeDovrsetka.medijanSekundi,
          )} (n={agregat.razdoblje.misije.dnevne.vrijemeDovrsetka.uzorak})
        </dd>
      </div>
      <div><dt>Tjedne dodijeljene</dt><dd>{agregat.razdoblje.misije.tjedne.dodijeljene}</dd></div>
      <div>
        <dt>Tjedne dovršene</dt>
        <dd>
          {agregat.razdoblje.misije.tjedne.dovrsene} ({postotak(agregat.razdoblje.misije.tjedne.udioTrenutnoDovrsenih)})
        </dd>
      </div>
      <div>
        <dt>Tjedne terminalna stopa</dt>
        <dd>
          {postotak(agregat.razdoblje.misije.tjedne.terminalnaStopaDovrsavanja)} (n={agregat.razdoblje.misije.tjedne
            .terminalniNazivnik})
        </dd>
      </div>
      <div>
        <dt>Tjedne aktivne / zamijenjene / istekle</dt>
        <dd>
          {agregat.razdoblje.misije.tjedne.aktivne} / {agregat.razdoblje.misije.tjedne.zamijenjene} / {agregat.razdoblje
            .misije.tjedne.istekle}
        </dd>
      </div>
      <div>
        <dt>Tjedne primatelji / dovršitelji</dt>
        <dd>
          {agregat.razdoblje.misije.tjedne.primatelji} / {agregat.razdoblje.misije.tjedne.dovrsitelji}
        </dd>
      </div>
      <div>
        <dt>Tjedne vrijeme dovršetka</dt>
        <dd>
          prosjek {formatSekundi(agregat.razdoblje.misije.tjedne.vrijemeDovrsetka.prosjekSekundi)} · medijan {formatSekundi(
            agregat.razdoblje.misije.tjedne.vrijemeDovrsetka.medijanSekundi,
          )} (n={agregat.razdoblje.misije.tjedne.vrijemeDovrsetka.uzorak})
        </dd>
      </div>
      <div>
        <dt>Zamjene (ukupno)</dt>
        <dd>
          {agregat.razdoblje.zamjene.ukupno} · dnevne {agregat.razdoblje.zamjene.dnevne} / tjedne {agregat.razdoblje
            .zamjene.tjedne} · {agregat.razdoblje.zamjene.jedinstveniIgraci} igrača
        </dd>
      </div>
    </AnalitikaKpi>

    {#if agregat.razdoblje.zamjene.najcesceZamijenjeni.length > 0}
      <h4>Najčešće zamijenjeni predlošci</h4>
      <table>
        <thead>
          <tr><th>Predložak</th><th>v</th><th>Broj</th></tr>
        </thead>
        <tbody>
          {#each agregat.razdoblje.zamjene.najcesceZamijenjeni as red (`zam-stara-${red.predlozakId}-${red.verzijaDefinicije}-${red.naziv}`)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.verzijaDefinicije}</td>
              <td>{red.broj}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if agregat.razdoblje.zamjene.najcesceDobiveniKaoZamjena.length > 0}
      <h4>Najčešće dobiveni kao zamjena</h4>
      <table>
        <thead>
          <tr><th>Predložak</th><th>v</th><th>Broj</th></tr>
        </thead>
        <tbody>
          {#each agregat.razdoblje.zamjene.najcesceDobiveniKaoZamjena as red (`zam-nova-${red.predlozakId}-${red.verzijaDefinicije}-${red.naziv}`)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.verzijaDefinicije}</td>
              <td>{red.broj}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if agregat.razdoblje.zamjene.stopaPoPredloskuKohorteDodjela?.length}
      <h4>Stopa zamjene po predlošku (kohorta dodjela)</h4>
      <table>
        <thead>
          <tr>
            <th>Predložak</th>
            <th>Vrsta</th>
            <th>v</th>
            <th>Zamijenjene</th>
            <th>Dodjele</th>
            <th>Stopa</th>
          </tr>
        </thead>
        <tbody>
          {#each agregat.razdoblje.zamjene.stopaPoPredloskuKohorteDodjela as red (`stopa-${red.predlozakId}-${red.vrsta}-${red.verzijaDefinicije}`)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.vrsta}</td>
              <td>{red.verzijaDefinicije}</td>
              <td>{red.zamijenjeneDodjele}</td>
              <td>{red.dodjeleKohorte}</td>
              <td>{postotak(red.stopaZamjenjivanja)}{#if red.maliUzorak} · mali{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h4>Uspješnost predložaka</h4>
    {#if predlosciSvi.length === 0}
      <p class="meta">Nema dodjela u rasponu.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Predložak</th>
            <th>Vrsta</th>
            <th>v</th>
            <th>Dodjele</th>
            <th>Dovršene</th>
            <th>Zamjene</th>
            <th>Terminalna</th>
          </tr>
        </thead>
        <tbody>
          {#each predlosciStranica as red (`${red.predlozakId}-${red.vrsta}-${red.verzijaDefinicije}`)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.vrsta}</td>
              <td>{red.verzijaDefinicije}</td>
              <td>{red.dodjele}</td>
              <td>{red.dovrsene}</td>
              <td>{red.zamijenjene}</td>
              <td>{postotak(red.terminalnaStopaDovrsavanja)}{#if red.maliUzorak} · mali{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if predlosciSvi.length > PREDLOSCI_PO_STRANICI}
        <p class="meta">
          <button type="button" disabled={stranicaPredlozaka <= 1} onclick={() => { stranicaPredlozaka -= 1; }}
            >Prethodna</button
          >
          <span
            >Stranica {stranicaPredlozaka} / {predlosciUkupnoStranica} ({predlosciSvi.length} predložaka)</span
          >
          <button
            type="button"
            disabled={stranicaPredlozaka >= predlosciUkupnoStranica}
            onclick={() => {
              stranicaPredlozaka += 1;
            }}>Sljedeća</button
          >
        </p>
      {/if}
    {/if}

    <p class="meta">
      Dotok dnevnih: {agregat.razdoblje.dotokDnevnih.dodijeljeno} dodijeljeno / {agregat.razdoblje.dotokDnevnih.preskoceno}
      preskočeno — {agregat.razdoblje.dotokDnevnih.napomena}
    </p>

    <h3>XP i razine</h3>
    {#if !misijeDostupne}
      <p class="meta">
        {agregat.razdoblje.doprinosiINagradeMisija.razlog ??
          'Doprinosi i XP nagrade misija nisu primjenjivi za ovaj kontekst.'}
      </p>
    {/if}
    <AnalitikaKpi>
      <div>
        <dt>XP misija (stvarno / nominalno)</dt>
        <dd>
          {neprimjenjivoIli(
            `${agregat.razdoblje.xpMisija.ukupnoStvarno} / ${agregat.razdoblje.xpMisija.ukupnoNominalno}`,
            misijeDostupne,
          )}
        </dd>
      </div>
      <div>
        <dt>Dnevne / tjedne (stvarno)</dt>
        <dd>
          {neprimjenjivoIli(
            `${agregat.razdoblje.xpMisija.dnevneStvarno} / ${agregat.razdoblje.xpMisija.tjedneStvarno}`,
            misijeDostupne,
          )}
        </dd>
      </div>
      <div>
        <dt>Nagrade misija</dt>
        <dd>
          {neprimjenjivoIli(
            `${agregat.razdoblje.xpMisija.brojNagrada} · ${agregat.razdoblje.xpMisija.primatelji} primatelja`,
            misijeDostupne,
          )}
        </dd>
      </div>
      <div>
        <dt>Prosjek XP/nagrada</dt>
        <dd>
          {neprimjenjivoIli(agregat.razdoblje.xpMisija.prosjekStvarnogPoNagradi?.toFixed(1) ?? '—', misijeDostupne)}
        </dd>
      </div>
      <div><dt>XP izazova (prvi uspjeh)</dt><dd>{agregat.razdoblje.xpIzazova.awardedXpUkupno}</dd></div>
      <div>
        <dt>Prvi uspjesi</dt>
        <dd>
          {agregat.razdoblje.xpIzazova.prviUspjesi} · {agregat.razdoblje.xpIzazova.jedinstveniIgraci} igrača
        </dd>
      </div>
      <div>
        <dt>Prosjek XP po prvom uspjehu</dt>
        <dd>{agregat.razdoblje.xpIzazova.prosjekPoPrvomUspjehu?.toFixed(1) ?? '—'}</dd>
      </div>
      <div>
        <dt>Otključavanja (★ / riječi)</dt>
        <dd>
          {agregat.razdoblje.prvaOtkljucavanjaDostignuca} / {agregat.razdoblje.otkljucavanjaRijeci}
        </dd>
      </div>
    </AnalitikaKpi>
    <p class="meta">{agregat.razdoblje.xpIzazova.napomena ?? 'Zasebna metrika izazova.'}</p>
    {#if misijeDostupne}
      <p class="meta">
        Doprinosi: javna {agregat.razdoblje.doprinosi.javna?.doprinosi ?? 0}
        ({agregat.razdoblje.doprinosi.javna?.distinctIgara ?? 0} igara)
        · trening {agregat.razdoblje.doprinosi.trening?.doprinosi ?? 0}
        ({agregat.razdoblje.doprinosi.trening?.distinctIgara ?? 0} igara)
        · izazov {agregat.razdoblje.doprinosi.izazov?.doprinosi ?? 0}
        ({agregat.razdoblje.doprinosi.izazov?.distinctIgara ?? 0} igara)
      </p>
    {:else}
      <p class="meta">Doprinosi misija: Nije primjenjivo</p>
    {/if}

    <h4>Raspodjela XP razina (trenutačno)</h4>
    <p class="meta">Baza igrača: {agregat.trenutacniPresjek.bazaIgraca} · nije XP zarađen u filteru datuma.</p>
    <AnalitikaKpi>
      <div>
        <dt>Prosjek / medijan XP</dt>
        <dd>
          {agregat.trenutacniPresjek.xpRazine.prosjekXp?.toFixed(0) ?? '—'} / {agregat.trenutacniPresjek.xpRazine
            .medijanXp?.toFixed(0) ?? '—'}
        </dd>
      </div>
      <div>
        <dt>Prosjek / medijan razina</dt>
        <dd>
          {agregat.trenutacniPresjek.xpRazine.prosjekRazina?.toFixed(1) ?? '—'} / {agregat.trenutacniPresjek.xpRazine
            .medijanRazina?.toFixed(1) ?? '—'}
        </dd>
      </div>
      <div><dt>Iznad razine 1</dt><dd>{agregat.trenutacniPresjek.xpRazine.napredovaliIznadPrve}</dd></div>
    </AnalitikaKpi>
    {#if agregat.trenutacniPresjek.xpRazine.poRasponu.length > 0}
      <table>
        <thead><tr><th>Raspon razine</th><th>Igrači</th></tr></thead>
        <tbody>
          {#each agregat.trenutacniPresjek.xpRazine.poRasponu as red (red.raspon)}
            <tr><td>{red.raspon}</td><td>{red.broj}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Dostignuća</h3>
    <AnalitikaKpi>
      <div><dt>S barem jednim</dt><dd>{agregat.trenutacniPresjek.dostignuca.igraciSBaremJednim}</dd></div>
      <div>
        <dt>Prosjek otključanih</dt>
        <dd>{agregat.trenutacniPresjek.dostignuca.prosjekOtkljucanih?.toFixed(1) ?? '—'}</dd>
      </div>
      <div>
        <dt>Prosjek / medijan ★</dt>
        <dd>
          {agregat.trenutacniPresjek.dostignuca.prosjekZvjezdica?.toFixed(1) ?? '—'} / {agregat.trenutacniPresjek
            .dostignuca.medijanZvjezdica?.toFixed(1) ?? '—'}
        </dd>
      </div>
      <div><dt>S max pojedinim</dt><dd>{agregat.trenutacniPresjek.dostignuca.igraciSMaksimalnoDovrsenimPojedinim}</dd></div>
    </AnalitikaKpi>
    {#if agregat.trenutacniPresjek.dostignuca.raspodjelaUkupnihZvjezdica?.length}
      <table>
        <thead><tr><th>Ukupne ★</th><th>Igrači</th></tr></thead>
        <tbody>
          {#each agregat.trenutacniPresjek.dostignuca.raspodjelaUkupnihZvjezdica as red (red.raspon)}
            <tr><td>{red.raspon}</td><td>{red.broj}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if agregat.trenutacniPresjek.dostignuca.poDostignucu.length > 0}
      <table>
        <thead>
          <tr>
            <th>Dostignuće</th>
            <th>Otključano</th>
            <th>Udio</th>
            <th>Maks. zvjezdica</th>
            <th>Igrači na maksimumu</th>
            <th>Prosjek ★</th>
            <th>Razine 0…max</th>
          </tr>
        </thead>
        <tbody>
          {#each agregat.trenutacniPresjek.dostignuca.poDostignucu as red (red.id)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.otkljucani}</td>
              <td>{postotak(red.udioOtkljucanih)}</td>
              <td>{red.maksimalnaRazina}</td>
              <td>{red.naMaksimalnojRazini}</td>
              <td>{red.prosjekZvjezdicaOtkljucanih?.toFixed(2) ?? '—'}</td>
              <td>{red.raspodjelaRazina?.map((r) => r.broj).join(' / ') ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Kolekcije riječi</h3>
    <p class="meta">
      Globalno jedinstvene riječi ≠ zbroj otključavanja po igračima.
      Period otključavanja riječi ({agregat.razdoblje.otkljucavanjaRijeci}) ostaje odvojen od trenutačnog presjeka.
    </p>
    <AnalitikaKpi>
      <div><dt>S barem jednom riječi</dt><dd>{agregat.trenutacniPresjek.kolekcija.igraciSBaremJednomRijeci}</dd></div>
      <div><dt>Jedinstvene riječi</dt><dd>{agregat.trenutacniPresjek.kolekcija.distinctRijeciGlobalno}</dd></div>
      <div>
        <dt>Prosjek / medijan veličine</dt>
        <dd>
          {agregat.trenutacniPresjek.kolekcija.prosjekVelicine?.toFixed(1) ?? '—'} / {agregat.trenutacniPresjek.kolekcija
            .medijanVelicine?.toFixed(1) ?? '—'}
        </dd>
      </div>
      <div>
        <dt>Duge / rijetke (redovi)</dt>
        <dd>
          {agregat.trenutacniPresjek.kolekcija.brojDugihOtkljucavanja} / {agregat.trenutacniPresjek.kolekcija
            .brojRijetkihOtkljucavanja}
        </dd>
      </div>
    </AnalitikaKpi>
    {#if agregat.trenutacniPresjek.kolekcija.raspodjelaVelicine.length > 0}
      <table>
        <thead><tr><th>Veličina kolekcije</th><th>Igrači</th></tr></thead>
        <tbody>
          {#each agregat.trenutacniPresjek.kolekcija.raspodjelaVelicine as red (red.raspon)}
            <tr><td>{red.raspon}</td><td>{red.broj}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}