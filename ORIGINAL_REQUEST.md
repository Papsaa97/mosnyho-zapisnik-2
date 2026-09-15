# Original User Request

## Initial Request — 2026-09-13T07:45:44Z

Implementace komplexního balíčku vylepšení pro PWA aplikaci „Montážní & svářečský zápisník 2.0“ na základě provedeného průzkumu trhu terénních aplikací (Tradify, Jobber, Fieldwire, Stavario, iDoklad). Balíček zahrnuje digitální předávací protokol s podpisem na displeji (Sign-on-Glass), svářečský technický pasport, legislativu ČR (MPSV pásma diet a § 92e PDP doložka), montážní materiálový lístek a terénní fotodokumentaci svarů.

Working directory: /home/miichalpapi/Mošny
Integrity mode: development

## Requirements

### R1. Digitální předávací protokol s podpisem zákazníka (Sign-on-Glass)
- Umožnit zhotoviteli i objednateli/stavbyvedoucímu podepsat se prstem nebo stylusem přímo na dotykovém displeji do elektronického předávacího protokolu.
- Protokol musí být možné vygenerovat do tiskové A4 podoby a exportovat jako ucelený dokument obsahující soupis prací, odpracované hodiny, rozpis materiálu, podpis obou stran a tuzemský platební QR kód (SPAYD).
- Možnost vymazat a opakovat podpis před uložením, a bezpečné offline uložení podpisu v lokální databázi (IndexedDB) k danému záznamu/směně.

### R2. Svářečský & technický pasport zakázky (EN 1090 / ISO 9606-1)
- Rozšířit evidenci směny a zakázky o technické parametry specifické pro svářečskou a zámečnickou praxi: metoda svařování (TIG/141, MIG-MAG/135-136, MMA/111, Autogen/311), jakost a tloušťka základního materiálu, typ ochranného plynu a šarže přídavného materiálu (drát / elektroda).
- Technické parametry se musí automaticky promítat do protokolu o předání pro technický dozor a investora.

### R3. Soulad s českou legislativou: Zákonná pásma diet MPSV & Doložka § 92e PDP
- Automatický výpočet tuzemského stravného dle aktuálních 3 zákonných pásem MPSV (5–12 hod, 12–18 hod, nad 18 hod) z celkového trvání směny s možností ručního přepsání.
- Možnost zapnout režim přenesené daňové povinnosti ve stavebnictví (§ 92e zákona o DPH) pro příslušného klienta nebo směnu, která na výstupu automaticky vygeneruje povinnou zákonnou formulaci: „Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH“.

### R4. Montážní materiálový lístek & rychlé terénní štítky
- Rozšířit evidenci nákladů o rychlý terénní výběr spotřebního materiálu (kotouče, technické plyny, kotevní technika, spojovací materiál) s volitelným režijním paušálem nebo marží.
- Přidat rychlé dotykové štítky činností (Příprava, Svařování, Montáž ve výškách, Broušení/začištění, Kotvení) pro minimální psaní na stavbě v montérkách.

### R5. Rychlá terénní fotodokumentace svarů a montáže
- Možnost připojit ke směně fotodokumentaci přímo z fotoaparátu mobilu či úložiště s automatickou offline kompresí pro šetření místa v IndexedDB.
- Automatický časový a projektový vodoznak na pořízené fotce a zobrazení miniatur fotodokumentace v protokolu.

## Acceptance Criteria

### Funkčnost Sign-on-Glass & tiskového protokolu
- [ ] Dotykové plátno umožňuje plynulé kreslení podpisu prstem/stylusem na mobilním i desktopovém zařízení.
- [ ] Tlačítko pro vymazání plátna okamžitě resetuje podpis do prázdného stavu.
- [ ] V tiskovém náhledu @media print a na exportovaném protokolu je podpis vykreslen v ostré kvalitě na vyhrazeném podpisovém řádku zhotovitele i objednatele.

### Svářečský pasport & materiálový lístek
- [ ] Záznam směny umožňuje vybrat a uložit svářečskou metodu, materiál, šarže drátu a ochranný plyn, přičemž tyto hodnoty se promítnou do tiskového protokolu.
- [ ] Uživatel může k zakázce přidat položky spotřebního montážního materiálu s kalkulovanou částkou zahrnutou do celkové bilance zakázky.

### Legislativní výpočty ČR
- [ ] Diety se při změně odpracovaných hodin automaticky předvyplní podle příslušného pásma MPSV ČR (5–12 h, 12–18 h, >18 h).
- [ ] Při aktivaci přepínače § 92e PDP se na protokolu / podkladu k faktuře zřetelně zobrazí zákonná klauzule o přenesení daňové povinnosti.

### Fotodokumentace & offline provoz
- [ ] Připojené fotografie se před uložením do IndexedDB automaticky zkomprimují (pod 500 KB na snímek).
- [ ] Aplikace funguje 100% offline bez nutnosti internetového připojení.
- [ ] Projekt prochází `npm run build` a TypeScript kontrolou bez chyb.

## 2026-09-15T16:22:13Z

This is a single self-contained fix; keep it small and focused.
Kompletní UI/UX redesign a zjednodušení informační architektury aplikace Mošnyho zápisník 2.0. Cílem je odstranit vizuální chaos, zajistit okamžitou viditelnost klíčových dat na mobilu i desktopu a zpříjemnit každodenní práci řemeslníka v terénu.

Working directory: /home/miichalpapi/Mošny
Integrity mode: development

## Requirements

### R1. Kompaktní a přehledná hlavní obrazovka (Deník směn)
- **Sbalitelný Live Tracker (Stopky)**: Pokud stopky neběží (stav `idle`), panel se zobrazí jako úsporný, elegantní jednořádkový pruh s rychlým tlačítkem pro spuštění. Plný ovládací panel s mezičasy a poznámkami se rozbalí pouze v momentě, kdy je směna aktivní, pozastavená nebo na explicitní kliknutí uživatele.
- **Sbalitelná filtrace & vyhledávání**: Převést rozsáhlý blok mnoha výběrových polí (stav, měsíc, klient, typ práce, řazení) na kompaktní vyhledávací řádek s tlačítkem „Filtry“, které otevírá rozbalovací panel nebo drawer s indikátorem počtu aktivních filtrů a tlačítkem pro rychlý reset.
- **Minimalistický souhrn (KPIs)**: Zjednodušit 4 velké KPI boxy tak, aby nezabíraly vertikální prostor a aby na mobilním displeji byly ihned po otevření viditelné poslední záznamy směn.

### R2. Hierarchické a uklidněné karty směn (EntryCard)
- **Odstranění vizuálního šumu (badge clutter)**: Redukovat množství svítících štítků. Základní pohled na kartu musí prioritně zobrazovat pouze:
  1. Název zakázky / projekt a odběratele
  2. Datum a odpracovaný čas (od-do, celkový počet hodin)
  3. Celkový výdělek (výrazná typografie) a stavový štítek (Koncept / Odevzdáno / Vyfakturováno / Zaplaceno)
- **Strukturovaný detail**: Technické parametry svářečského pasportu (metoda ISO, tloušťka, jakost, VT zkouška), detailní rozpad nákladů (cestovné, stravné, spotřební materiál) a fotodokumentaci zobrazovat v přehledně organizovaném rozbalovacím detailu karty.
- **Rychlé a ergonomické akce**: Snadno přístupná tlačítka pro editaci, změnu fakturačního stavu a smazání.

### R3. Optimalizace terénního formuláře směny (ShiftModalForm)
- **Logické rozdělení na Základní zápis a Rozšířené detaily**:
  1. *Krok 1 (Základ)*: Datum, čas začátku a konce, rychlé tlačítko pauzy, výběr projektu/klienta a typ práce. Umožnit bleskové uložení bez nutnosti rolovat přes desítky nepovinných polí.
  2. *Krok 2 (Sazby a doprava)*: Hodinová sazba, příplatky za víkend/noc/výšky, kilometry a automatické stravné dle MPSV.
  3. *Krok 3 (Technický pasport & materiál)*: Svářečské metody ISO, jakosti oceli, tloušťka, šarže drátu, VT kontrola, montážní materiál a fotodokumentace.
- **Zachování plné reaktivity**: Zachovat dynamický propočet celkové částky v reálném čase, presety a automatické návrhy.

### R4. Čistá globální hlavička a navigace
- **Přesun servisních funkcí**: Správu záloh (export JSON, import JSON, reset demo dat) přesunout z horní hlavičky do záložky Nastavení / Profil.
- **Minimalistická hlavička**: V záhlaví ponechat pouze název aplikace, indikaci offline/online a primární tlačítko pro nový zápis.
- **Zachování 100% stávající funkčnosti**: Tiskový protokol A4 se Sign-on-Glass a platebním QR kódem SPAYD, Kanban pipeline a Dexie IndexedDB zůstávají plně integrovány.

## Acceptance Criteria

### Ergonomie a layout
- [ ] V neaktivním stavu stopek zabírá tracker a filtrace na mobilní obrazovce méně než 35 % výšky viewportu, takže jsou okamžitě bez scrollování čitelné první záznamy směn.
- [ ] Karty směn mají jasnou vizuální hierarchii bez přeplácanosti barevnými štítky v základním zobrazení.
- [ ] Formulář směny umožňuje rychlé uložení základních údajů bez nutnosti scrollovat přes nepoužité sekce technického pasportu.
- [ ] Tlačítka pro zálohování a obnovu dat jsou čistě umístěna v sekci Nastavení.

### Technická integrita a stabilita
- [ ] Celá testovací sada Vitest (`npm test`) prochází na 100 % bez selhání (všech 774 testů nebo aktualizovaných UI testů).
- [ ] Produkční build (`npm run build`) proběhne s nulovými chybami TypeScriptu a Vite.
- [ ] Linter (`npm run lint`) nehlásí žádné syntaktické či pravidlové chyby.

