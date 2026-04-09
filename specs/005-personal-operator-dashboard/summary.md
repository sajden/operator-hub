# Sammanfattning: Vad Vi Har Gjort För `005-personal-operator-dashboard`

Det här dokumentet beskriver i detalj vad vi har gjort hittills för feature:n `005-personal-operator-dashboard` i `operator-hub`.

Viktigt: vi har inte byggt funktionaliteten ännu. Vi har gjort förarbetet som behövs för att kunna bygga rätt produkt på ett strukturerat sätt.

## Bakgrund

Utgångspunkten var att du ville bygga något som började som en kanban-idé men som i praktiken behövde bli mer än så:

- ett ställe där du kan styra din dag
- ett ställe där du kan planera din egen verksamhet
- ett ställe där du kan strukturera outreach och Parkpal-arbete
- ett system som kan trigga AI- och MCP-baserade actions
- en produkt som känns roligare, snyggare och mer high-tech än en vanlig todo-app

Det gjorde att vi ganska snabbt såg att det här inte bara är en board-app, utan ett större personligt arbetsverktyg.

## Det viktigaste produktbeslutet

Vi landade i att detta ska byggas i `operator-hub`, inte i `ai-cam`.

Skälen var:

- `operator-hub` är redan på väg att bli ett delat capability-lager
- `operator-hub` har redan både UI och hub-struktur
- `ai-cam` passar bättre som execution/device-lager för TV, Home Assistant, ljud och smarta hemmet
- planner, dashboard, widgets, actions och framtida M365-kopplingar hör mer naturligt hemma i `operator-hub`

Det gav följande ansvarsfördelning:

- `operator-hub`: planner, dashboard, widgets, boards, actions, datamodell, lokal persistence
- `ai-cam`: device execution senare, till exempel TV-visning eller smart-home-drivna actions

## Produktförståelsen vi tog fram

En viktig del av arbetet var att inte hoppa direkt till kod eller tekniska detaljer, utan först förstå själva problemet bättre.

Vi kom fram till att problemet inte främst var:

- "jag behöver en kanban"

utan snarare:

- du saknar ett eget system för att styra dagen
- du saknar ett bra sätt att hålla ihop strategi, utförande och uppföljning
- du vill ha ett system som både visar och gör saker
- du vill ha ett verktyg som känns motiverande och premium att använda

Det ledde till att produktdefinitionen förändrades från en enkel board-idé till:

- ett personligt operator-dashboard
- ett workbench-liknande planeringssystem
- flera boards under samma produkt
- widgets som går att kombinera och utöka
- actions som minskar friktion, särskilt kring outreach och uppföljning

## Produktprinciper vi låste

Vi kom fram till ett antal bärande principer som styr resten av arbetet:

- `day-first`: startsidan ska hjälpa dig idag
- `widget-first`: dashboarden ska byggas som moduler/widgets
- `multi-board`: olika typer av arbete ska kunna ha egna boards
- `actionable`: widgets och kort ska kunna utföra direkta actions
- `premium`: design och UX ska kännas genomtänkta och inte generiska
- `light-mode first`: light mode blir primär designyta
- `dark-mode parity`: dark mode ska följa samma designspråk
- `gamification as momentum`: feedback ska hjälpa dig få saker gjorda, inte bara ge poäng

Vi identifierade också att en viktig smärtpunkt för dig är outreach och att kontakta människor, och att systemet därför ska hjälpa till särskilt med uppgifter som annars känns jobbiga att göra.

## Designriktningen vi låste

Vi valde att inte gå mot ett överdrivet sci-fi- eller neonhållet dashboard-utseende, utan mot en mer kontrollerad riktning:

- en mix av `Operator Cockpit` och `Creative Workbench`
- premium snarare än lekfull
- tydlig widgetstruktur
- stark visuell hierarki
- light mode som primär arbetsyta
- TV-vy som separat wallboard-layout

Det betyder i praktiken:

- dashboarden ska kännas som ett personligt kontrollrum
- den ska vara tydlig och funktionell
- den ska vara snygg nog att vilja öppna varje dag
- widgets ska se ut som riktiga moduler, inte bara generiska kort
- gamification ska kännas vuxen och diskret

## Spec-arbetet

När produktbilden var tillräckligt klar skapade vi en faktisk feature-spec i:

- [spec.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/spec.md)

Den filen beskriver produkten på produktnivå, utan att gå in i implementation.

### Vad specen innehåller

Specen innehåller bland annat:

- tre user stories
  - US1: styra dagen från en dashboard
  - US2: arbeta över flera boards utan att tappa sammanhang
  - US3: använda actions för att minska friktion i jobbiga uppgifter
- edge cases
  - t.ex. första tomma läget, för många widgets, carry-over, fel i actions och TV-läsbarhet
- funktionella krav
  - dashboarden måste vara day-first
  - widgets måste kunna ha direkta actions
  - systemet måste stödja flera boards
  - Parkpal ska leva som specialiserad workspace
  - systemet måste fungera även utan externa integrationer
  - TV-läge ska vara en förenklad wallboard, inte bara desktop på TV
- experience principles
  - premium workbench
  - modularitet
  - tydlighet
  - behavior-shaping
- key entities
  - dashboard, board, widget, work item, goal, context link, action, momentum signal
- assumptions
  - single-user
  - local-first
  - CRM-light i första versionen
- success criteria
  - till exempel att du snabbt ska förstå dagens fokus och kunna arbeta från dashboarden

Vi skapade också en separat kvalitetschecklista för specen:

- [checklists/requirements.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/checklists/requirements.md)

Syftet med den var att säkerställa att specen var komplett, testbar på produktnivå och redo att planeras vidare.

## Plan-arbetet

Efter specen tog vi nästa steg och skapade implementationplanen i:

- [plan.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/plan.md)

Den filen översätter produktvisionen till en teknisk riktning.

### Viktiga tekniska beslut i planen

I planen låste vi bland annat:

- planner-datat ska lagras i lokal SQLite
- hubben i `operator-hub/hub/` ska vara persistence- och capability-lager
- React-appen i `operator-hub/app/` ska bli ett route-baserat shell
- Parkpal ska leva kvar som specialiserad workspace
- TV-vyn ska byggas som en separat route
- actions ska modelleras som:
  - action -> capability -> provider
- v1 ska bara ha user-triggered actions, inte automatiska regler

Det här var viktigt för att undvika att systemet blir spretigt när fler MCP:er och API:er kopplas in senare.

## Research-dokumentet

Vi skapade också:

- [research.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/research.md)

Den filen dokumenterar varför vi tog vissa beslut.

### Exempel på beslut i research

- varför SQLite är bättre än ad hoc JSON för planner-datat
- varför `operator-hub` ska bli ett route-baserat shell
- varför dashboarden bör byggas som widget-definitioner plus widget-instanser
- varför actions måste abstrakteras från providers
- varför TV-läge ska vara en separat wallboard-route
- varför Parkpal ska vara en specialiserad workspace, inte hela datamodellen
- varför CRM i v1 ska börja som länkar/follow-up-kontext snarare än full CRM-svit

Research-dokumentet gjorde att plansteget inte bara blev lösa antaganden, utan ett dokumenterat beslutssystem.

## Datamodellen vi tog fram

Vi skapade:

- [data-model.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/data-model.md)

Det dokumentet definierar vilka domänobjekt som behövs för att systemet ska kunna byggas på ett stabilt sätt.

### Viktiga entiteter

Datamodellen innehåller bland annat:

- `PlannerBoard`
- `BoardColumn`
- `WorkItem`
- `Goal`
- `DashboardView`
- `WidgetInstance`
- `ContextLink`
- `ActionDefinition`
- `ActionRun`
- `ActivityEvent`

### Vad det betyder praktiskt

Det här är ett viktigt steg eftersom det visar att produkten inte längre bara är en idé om “kort i kolumner”.

Den blir istället en riktig modell där vi kan hantera:

- flera boards
- work items med status
- dagens fokus utan att duplicera data
- widgets som egna instanser
- mål som kopplas till arbete
- context links till filer, noter, kontakter, projekt och externa resurser
- actions som loggas
- activity events som kan användas för statistik, carry-over och momentum

## Kontrakten vi definierade

Vi skapade två kontraktsdokument:

- [planner-api-contract.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/contracts/planner-api-contract.md)
- [planner-action-contract.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/contracts/planner-action-contract.md)

### Planner API-kontraktet

Det beskriver planner-delens API-surface, bland annat:

- dashboard-data
- boards
- work items
- widget-layouter

Det ger oss en tydlig bild av vilka endpoints hubben behöver exponera.

### Action-kontraktet

Det beskriver hur actions ska fungera utan att UI:t binder sig till råa providers.

Det låser bland annat att:

- UI ska prata med `actionId` och source context
- resultat ska tillbaka till samma widget eller work item
- providers ska kunna bytas ut utan att UI:t behöver skrivas om
- v1-actions är user-triggered only

Det här är ett av de viktigaste arkitekturbesluten i hela arbetet, eftersom du vill kunna koppla på många MCP:er och API:er över tid.

## Quickstart-dokumentet

Vi skapade också:

- [quickstart.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md)

Det dokumentet beskriver hur feature:n ska startas och verifieras när implementationen väl finns.

### Det täcker bland annat

- start av hubben
- start av frontend
- verifiering av default dashboard
- verifiering av daily execution-flödet
- verifiering av multi-board-flödet
- verifiering av direkta actions
- verifiering av TV wallboard mode

Det fungerar alltså som en framtida manuell verifieringsplan för den faktiska implementationen.

## Tasks-arbetet

När spec och plan var klara bröt vi ner arbetet till konkreta implementationstasks i:

- [tasks.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/tasks.md)

Det dokumentet gör att vi nu har en tydlig ordning att bygga i.

### Faserna i task-listan

Task-listan är uppdelad i sex faser:

#### Phase 1: Setup

Här läggs grundfilerna till:

- dependencies
- planner-typer
- planner-client
- theme scaffold
- hub-moduler för planner

#### Phase 2: Foundational

Här byggs den gemensamma grunden:

- SQLite-schema
- query helpers
- action registry
- planner-endpoints i hubben
- planner-tools i `mcpTools.mjs`
- route shell i appen

Det här är blockerande infrastruktur som alla stories behöver.

#### Phase 3: User Story 1

Det här är MVP:n.

Här byggs:

- widget-shells
- Today/In Progress/Goals/Weekly Progress/Quick Actions
- work item UI
- Operator dashboard page
- create/focus/start/complete-flöden
- premium light-mode styling
- default route till dashboarden

Det här är första riktiga produkten: en dashboard där du kan styra dagen.

#### Phase 4: User Story 2

Här kommer:

- fler boards
- board-sidan
- default boards som Daily Execution och Parkpal Outreach
- TV wallboard route
- integration av Parkpal in i nya app-shellen

Det här gör systemet mer komplett, men är inte nödvändigt för första MVP.

#### Phase 5: User Story 3

Här läggs action-lagret på i UI och hub:

- action UI-komponenter
- action endpoints
- seedade default-actions
- action result panel
- recoverable failure states

Det här är första steget mot att systemet faktiskt gör saker åt dig.

#### Phase 6: Polish

Här kommer:

- dark mode
- copy och momentum-texter
- slutlig dokumentationssynk
- manuell end-to-end-validering

## MVP-scope vi definierade

En viktig del av arbetet var att inte göra v1 för stor.

Vi valde därför att tydligt definiera MVP som:

- Phase 1
- Phase 2
- Phase 3

alltså:

- setup
- foundation
- US1

Det betyder att första riktiga leveransen blir:

- en day-first operator dashboard
- med riktiga work items
- today/in progress/goals/weekly progress/quick actions
- progress och carry-over

utan att vi behöver bygga fler boards, TV-mode och actions direkt från dag ett.

Det här är ett viktigt val eftersom det ger oss en kärna som faktiskt går att använda tidigt.

## Git- och speckit-flödet

Vi valde att använda det `speckit`-upplägg som redan finns i repot.

Det gav oss en sammanhängande feature-katalog för:

- spec
- checklist
- plan
- research
- data model
- quickstart
- contracts
- tasks

Under arbetet skapades:

- [spec.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/spec.md)
- [checklists/requirements.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/checklists/requirements.md)
- [plan.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/plan.md)
- [research.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/research.md)
- [data-model.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/data-model.md)
- [quickstart.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/quickstart.md)
- [contracts/planner-api-contract.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/contracts/planner-api-contract.md)
- [contracts/planner-action-contract.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/contracts/planner-action-contract.md)
- [tasks.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/tasks.md)

Vi uppdaterade också agentkontexten i:

- [AGENTS.md](/home/sajden/github/operator-hub/AGENTS.md)

så att repoets lokala instruktioner nu känner till feature:ns teknikval och struktur.

## En praktisk detalj som dök upp

När vi skapade feature:n upptäckte vi att repot lokalt inte hade en fungerande `origin`-remote.

Det betydde att den remote-del av `speckit`-flödet som tittar på remote branches inte kunde köras bokstavligt. Vi fortsatte därför med lokal numrering och skapade feature:n som:

- `005-personal-operator-dashboard`

Det påverkar inte själva spec- eller planinnehållet, men är bra att känna till om branchnummer jämförs mot ett framtida remote senare.

## Vad resultatet betyder

Före arbetet var idén lös:

- kanske en kanban
- kanske TV-visning
- kanske MCP-skills
- kanske CRM

Efter arbetet har vi:

- en tydlig produktdefinition
- en tydlig designriktning
- en tydlig teknisk plan
- en tydlig datamodell
- tydliga API- och action-kontrakt
- en tydlig MVP
- en tydlig task breakdown

Det innebär att nästa steg inte längre är att “lista ut vad vi bygger”, utan att börja implementera det i ordnad form.

## Vad vi inte har gjort ännu

Vi har inte:

- byggt planner-UI:t
- byggt dashboarden
- byggt SQLite-lagret
- byggt TV-route
- byggt action-systemet
- byggt multi-board fullt ut
- kopplat in `ai-cam` för TV/device execution

Så detta arbete är specifikation, planering och task breakdown, inte implementation.

## Nästa naturliga steg

Det naturliga nästa steget är att börja implementera MVP enligt:

- [tasks.md](/home/sajden/github/operator-hub/specs/005-personal-operator-dashboard/tasks.md)

Det innebär att börja med:

- Phase 1
- Phase 2
- Phase 3

alltså den första riktiga dashboard-versionen i `operator-hub`.

## Kort slutsats

Vi har gått från en lös idé om “en egen kanban/dashboard med TV och MCP” till ett välstrukturerat feature-paket i `operator-hub` med:

- tydlig produktvision
- tydlig scope
- tydlig designriktning
- tydlig teknisk arkitektur
- tydliga kontrakt
- tydliga implementationstasks

Det gör att själva bygget nu kan börja utan att vi behöver uppfinna produkten på nytt under implementationen.
