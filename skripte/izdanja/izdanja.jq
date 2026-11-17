# Zajednička jq logika skripti izdanja (ADR-018).
#
# Pravila izvođenja oznake i sidra moraju ostati jednaka onima u
# aplikacije/web/src/lib/izdanja.ts; usklađenost provjerava CI nad izgrađenom slikom.
# Validacija je ovdje namjerno blaža nego u TypeScriptu: pri rollbacku se podaci
# čitaju sa starog commita, pa skripta mora čitati i starije datoteke.

def dani_u_mjesecu($godina; $mjesec):
  if $mjesec == 2 then
    (if ($godina % 4 == 0 and ($godina % 100 != 0 or $godina % 400 == 0)) then 29 else 28 end)
  elif ($mjesec == 4 or $mjesec == 6 or $mjesec == 9 or $mjesec == 11) then 30
  else 31
  end;

def je_datum:
  type == "string"
  and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
  and (
    (.[0:4] | tonumber) as $godina
    | (.[5:7] | tonumber) as $mjesec
    | (.[8:10] | tonumber) as $dan
    | $godina >= 100 and $mjesec >= 1 and $mjesec <= 12 and $dan >= 1 and $dan <= dani_u_mjesecu($godina; $mjesec)
  );

# "2026-12-05" -> "5. 12. 2026."
def datum_hr: "\(.[8:10] | tonumber). \(.[5:7] | tonumber). \(.[0:4]).";

def provjeri_zapise:
  if type != "array" then error("Izdanja moraju biti polje zapisa.") else . end
  | to_entries
  | map(
      "Zapis izdanja #\(.key + 1)" as $opis
      | .value
      | if type != "object" then error("\($opis) mora biti objekt.") else . end
      | if .objavljeno != null and (.objavljeno | je_datum | not) then
          error("\($opis): objavljeno mora biti null ili postojeći datum oblika YYYY-MM-DD.")
        else . end
      | if .nastavak != null
          and ((.nastavak | type) != "number" or .nastavak < 1 or .nastavak != (.nastavak | floor)) then
          error("\($opis): nastavak mora biti cijeli broj veći od 0.")
        else . end
    );

# Datirani zapis -> zapis s izvedenim poljima.
def izvedi:
  (.nastavak // 0 | floor) as $nastavak
  | .objavljeno as $datum
  | (if $nastavak == 0 then $datum else "\($datum)-\($nastavak)" end) as $id
  | {
      datum: $datum,
      nastavak: $nastavak,
      id: $id,
      sidro: "izdanje-\($id)",
      oznaka: ("v" + ($datum | split("-") | join(".")) + (if $nastavak == 0 then "" else ".\($nastavak)" end)),
      naslov_releasea: ("Kaladont | " + ($datum | datum_hr) + (if $nastavak == 0 then "" else " (\($nastavak + 1))" end)),
      naslov: .naslov,
      stavke: .stavke
    };

# Datirana izdanja od najnovijeg prema najstarijem; redoslijed u datoteci nije bitan.
def datirana:
  map(select(.objavljeno != null) | izvedi)
  | (group_by(.id) | map(select(length > 1) | .[0].id)) as $dvostruka
  | if ($dvostruka | length) > 0 then
      error("Dva izdanja imaju isti datum i nastavak: \($dvostruka | join(", ")).")
    else . end
  | sort_by([.datum, .nastavak])
  | reverse;

def popis_oznaka: split("\n") | map(rtrimstr("\r") | select(length > 0));

# Usporedba cijele oznake: "v2026.11.23" ne postoji samo zato što postoji "v2026.11.23.1".
def ima_oznaku($oznake): . as $oznaka | any($oznake[]; . == $oznaka);

# Odluka za skripte/izdanja/odredi-izdanje.sh. Ispisuje retke s prefiksom:
#   izlaz:<kljuc>=<vrijednost>   ide na stdout skripte
#   poruka:<tekst>               ide na stderr skripte
#   kod:<broj>                   izlazni kod skripte
def odluci($danas; $oznake_tekst; $samo_izvjestaj):
  provjeri_zapise
  | (map(select(.objavljeno == null)) | length) as $nacrta
  | datirana as $datirana
  | ($oznake_tekst | popis_oznaka) as $oznake
  | (if ($datirana | length) == 0 then
      {vrsta: "tiho", razlog: "U datoteci izdanja nema datiranih zapisa.", upozorenje: "", poruke: []}
    else
      $datirana[0] as $najnovije
      | ($datirana[1:] | map(select(.oznaka | ima_oznaku($oznake) | not))) as $starija_bez_oznake
      | if ($najnovije.oznaka | ima_oznaku($oznake)) then
          {
            vrsta: "tiho",
            razlog: "Oznaka \($najnovije.oznaka) već postoji, pa je izdanje \($najnovije.datum) već objavljeno.",
            upozorenje: "",
            poruke: []
          }
        elif ($starija_bez_oznake | length) > 0 then
          ($starija_bez_oznake | map(.oznaka) | join(", ")) as $nedostaju
          | "Starije izdanje nema oznaku (\($nedostaju)), a izdanje \($najnovije.datum) čeka objavu." as $razlog
          | {
              vrsta: "izdanje",
              razlog: $razlog,
              upozorenje: $razlog,
              poruke: [
                $razlog,
                "Svako izdanje mora dobiti oznaku prije sljedećeg.",
                "- Ako je starije izdanje već na produkciji: stvori njegovu oznaku ručno na commitu tog izdanja (runbook, tablica „Što ako”).",
                "- Ako nije: vrati mu \"objavljeno\" na null ili ga objavi prije novijeg."
              ]
            }
        elif $najnovije.datum != $danas then
          "Izdanje \($najnovije.datum) nema oznaku \($najnovije.oznaka), a danas je \($danas)." as $razlog
          | {
              vrsta: "izdanje",
              razlog: $razlog,
              upozorenje: $razlog,
              poruke: [
                $razlog,
                "Novo izdanje smije se promovirati samo na dan upisan u izdanja.json.",
                "- Ako izdanje još nije objavljeno: novim PR-om upiši današnji datum ili vrati \"objavljeno\" na null.",
                "- Ako je izdanje već na produkciji, a oznaka nedostaje: stvori je ručno na commitu tog izdanja (runbook, tablica „Što ako”)."
              ]
            }
        else
          {
            vrsta: "izdanje",
            razlog: "Izdanje \($najnovije.datum) još nema oznaku \($najnovije.oznaka), a datum je današnji.",
            upozorenje: "",
            poruke: []
          }
        end
    end) as $odluka
  | ($datirana[0] // {oznaka: "", datum: "", sidro: "", naslov_releasea: ""}) as $najnovije
  | "izlaz:vrsta=\($odluka.vrsta)",
    "izlaz:oznaka=\($najnovije.oznaka)",
    "izlaz:datum=\($najnovije.datum)",
    "izlaz:sidro=\($najnovije.sidro)",
    "izlaz:naslov_releasea=\($najnovije.naslov_releasea)",
    "izlaz:nacrta=\($nacrta)",
    "izlaz:razlog=\($odluka.razlog)",
    "izlaz:upozorenje=\($odluka.upozorenje)",
    ($odluka.poruke[] | "poruka:\(.)"),
    "kod:\(if $odluka.upozorenje != "" and $samo_izvjestaj != "da" then 3 else 0 end)";

# Markdown tijelo GitHub Releasea za skripte/izdanja/biljeske-izdanja.sh.
def biljeske($oznaka; $adresa):
  provjeri_zapise
  | datirana
  | map(select(.oznaka == $oznaka)) as $pogoci
  | if ($pogoci | length) == 0 then error("Nijedno datirano izdanje nema oznaku \($oznaka).") else $pogoci[0] end
  | if (.naslov | type) != "string" or (.stavke | type) != "array" or (.stavke | all(type == "string") | not) then
      error("Izdanje \(.id): naslov mora biti tekst, a stavke polje tekstova.")
    else . end
  | "**\(.naslov)**",
    "",
    (.stavke[] | "- \(.)"),
    "",
    "Javni zapis: \($adresa)/novosti#\(.sidro)";
