# Umanjenice i uvećanice

## Problem

Trenutni sustav ponavljanje sprječava po leksemskoj grupi izvedenoj iz leme u hrLexu. To dobro pokriva različite gramatičke oblike iste riječi, ali ne i nužno tvorbene izvedenice.

Analizom stvarnog lokalnog izvoda hrLex 1.3 dobiveno je:

| Oblik | Lema | Postojeća grupa |
|---|---|---|
| `tava` | `tava` | `imenica:tava` |
| `tavica` | `tavica` | `imenica:tavica` |
| `trava` | `trava` | `imenica:trava` |
| `travica` | `travica` | `imenica:travica` |
| `kuća` | `kuća` | `imenica:kuća` |
| `kućica` | `kućica` | `imenica:kućica` |
| `travetina` | nije pronađena | nema grupe |
| `kućetina` | nije pronađena | nema grupe |

Prema tome, `tava` i `tavica`, `trava` i `travica` te `kuća` i `kućica` trenutno pripadaju različitim grupama i mogu proći kao odvojeni potezi. HrLex u tim zapisima ne daje podatak da je jedna riječ umanjenica ili uvećanica druge.

## Zaključak

Problem je tehnički rješiv, ali ne pouzdano samo iz postojećih lema. Nastavci poput `-ica` i `-etina` mogu poslužiti za pronalaženje kandidata, ali nisu dovoljan dokaz tvorbene veze jer bi automatska heuristika mogla pogrešno spojiti nepovezane riječi.

Prije promjene pravila treba analizirati ili pribaviti pouzdan derivacijski izvor, odnosno izraditi potvrđeni popis tvorbenih obitelji. Najčišće buduće rješenje je zasebna tvorbena grupa, odvojena od postojeće leksemske grupe, koja bi se trošila zajedno s njom.
