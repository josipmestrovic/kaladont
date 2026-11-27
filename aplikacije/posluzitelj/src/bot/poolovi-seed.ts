/**
 * Urednički seed taktičkih poolova (Botovi V8 C09).
 * Izvor: kaladont-opasne-rijeci-v8.md rev. 3 — samo ćelije riječi, bez napomena.
 * Markdown nije runtime parser; ova konstanta je deterministički seed.
 */
export const OCEKIVANI_BROJ_POOL1 = 221;
export const OCEKIVANI_BROJ_POOL2 = 174;

/** Pool 1 — kandidati za instant eliminaciju (urednička kategorija). */
export const SEED_POOL1_RIJECI: readonly string[] = [
  "videa", "dokument", "student", "argument", "element", "parlament", "talent", "segment",
  "incident", "instrument", "producent", "intervjuu", "statuu", "individuu", "kanuu", "šmrc",
  "rikverc", "šverc", "birc", "škvorc", "herc", "trg", "kirurg", "dramaturg",
  "performans", "rebalans", "balans", "trans", "antioksidans", "link", "punk", "tenk",
  "šank", "cink", "funk", "nivoi", "panoi", "sakoi", "makroi", "demoi",
  "depoi", "vrh", "povrh", "patrijarh", "navrh", "monarh", "oligarh", "sajt",
  "gigabajt", "bajt", "megabajt", "terabajt", "linč", "ranč", "klinč", "punč",
  "inč", "benč", "čušpajz", "marš", "krš", "zoo", "folk", "turbofolk",
  "komp", "kamp", "autokamp", "kramp", "škamp", "golf", "minigolf", "film",
  "napalm", "pornofilm", "mikrofilm", "biofilm", "gumb", "romb", "jamb", "tromb",
  "štrajk", "fejk", "lajk", "dislajk", "impuls", "puls", "skrb", "grb",
  "uštrb", "srp", "trijumf", "grejp", "revanš", "krv", "crv", "rajf",
  "skalp", "koledž", "bedž", "senf", "možeš", "ćeš", "kažeš", "hoćeš",
  "nećeš", "ideš", "dobiješ", "pišeš", "dođeš", "odeš", "mjesec", "zec",
  "igrač", "vozač", "proizvođač", "napadač", "pjevač", "osnivač", "navijač", "mjenjač",
  "predavač", "tenisač", "obitelj", "prijatelj", "voditelj", "ravnatelj", "redatelj", "temelj",
  "nositelj", "roditelj", "pokazatelj", "učitelj", "trening", "marketing", "rejting", "rang",
  "šoping", "holding", "intervjua", "individua", "gurua", "tabua", "statua", "tofua",
  "kanua", "vic", "stric", "blic", "sic", "špic", "seljo", "princ",
  "bonsai", "vikend", "bend", "fond", "trend", "frend", "brand", "brend",
  "štand", "standard", "rekord", "apsurd", "stupanj", "lipanj", "svibanj", "siječanj",
  "travanj", "srpanj", "toranj", "bubanj", "oganj", "gležanj", "park", "trk",
  "brk", "grk", "zvrk", "lunapark", "već", "revolt", "alt", "pult",
  "nivou", "šou", "platou", "birou", "panou", "sakou", "trn", "crn",
  "mladež", "crtež", "svjež", "svrbež", "jež", "kalež", "trulež", "palež",
  "stalež", "lavež", "dizajn", "redizajn", "kombajn", "šerif", "panoe", "sakoe",
  "alarm", "šarm", "grm", "strm", "brz", "žeđ", "smeđ", "tamnosmeđ",
  "svjetlosmeđ", "smuđ", "žanr", "podžanr", "imidž"
] as const;

/** Pool 2 — jako teške riječi (urednička kategorija). */
export const SEED_POOL2_RIJECI: readonly string[] = [
  "pištolj", "pokolj", "gomolj", "knauf", "tartuf", "križ", "prestiž", "konj",
  "vonj", "vodenkonj", "pomoć", "noć", "moć", "sinoć", "nekoć", "ponoć",
  "nemoć", "nadmoć", "punomoć", "preksinoć", "laž", "staž", "draž", "kolaž",
  "raž", "pejsaž", "nivoa", "metroa", "platoa", "panoa", "biroa", "sakoa",
  "projekt", "kontakt", "objekt", "efekt", "aspekt", "produkt", "arhitekt", "subjekt",
  "akt", "pudl", "štrudl", "tip", "princip", "strip", "kip", "čip",
  "prototip", "osip", "nasip", "ih", "bih", "njih", "svih", "tih",
  "drugih", "kojih", "svojih", "onih", "ovih", "božić", "mladić", "vrtić",
  "kao", "rekao", "mogao", "imao", "posao", "trebao", "kazao", "došao",
  "dao", "postao", "pitanja", "istraživanja", "znanja", "rješenja", "svibnja", "lipnja",
  "travnja", "natjecanja", "srpnja", "siječnja", "pitanju", "stanju", "nju", "suradnju",
  "proizvodnju", "pažnju", "mišljenju", "izgradnju", "raspolaganju", "natjecanju", "bio", "dio",
  "dobio", "radio", "izjavio", "vidio", "htio", "uspio", "odlučio", "napravio",
  "vodič", "branič", "sendvič", "kič", "bič", "poklič", "ribič", "studij",
  "scenarij", "medij", "kriterij", "teritorij", "laboratorij", "kolegij", "konzorcij", "ubij",
  "misterij", "šonjo", "dunjo", "sirotinjo", "seronjo", "boginjo", "životinjo", "smrt",
  "sport", "koncert", "vrt", "start", "hrt", "obrt", "nacrt", "osvrt",
  "moguć", "nemoguć", "vruć", "svemoguć", "zastrašujuć", "zadovoljavajuć", "sveznajuć", "zapanjujuć",
  "iznenađujuć", "zbunjujuć", "počeo", "video", "uzeo", "započeo", "naveo", "proveo",
  "doveo", "preuzeo", "izveo", "zauzeo", "intervjui", "individui", "tabui", "kanui",
  "statui", "intervjue", "individue", "statue", "tabue", "gurue", "kanue", "iglue",
  "muzej", "ej", "hej", "trofej", "okej", "esej"
] as const;
