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
