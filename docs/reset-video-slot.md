# Köra om ett video-slot från scratch

## 1. Ta bort jobmappen (kräver sudo)
```bash
sudo rm -rf /home/sajden/github/operator-hub/.local/short-form-video/jobs/<job-id>
```

## 2. Rensa slot-state
Ta bort raden för aktuellt slot i:
```
/home/sajden/github/operator-hub/.local/slot-cloud-state.json
```

## 3. (Valfritt) Rensa no-bg-filer på OneDrive
Om du vill köra bakgrundsborttagnig igen, ta bort filerna i:
```
OneDrive → Seb/Videos/no-bg-videos/video-N/
```
Lämna kvar om du bara vill rendera om med samma no-bg-klipp.

## 4. Watchern triggar automatiskt
Inom ~90 sekunder plockar slot-watchern upp slottet igen och skapar ett nytt jobb.

---

# Trigga om från raw (bg-removal redan borttagen)

Använd detta om du tagit bort no-bg-filerna och vill att pipelinen plockar upp råklippen igen och kör bg-removal + render från scratch.

## 1. Kontrollera att raw-filerna finns kvar
```
OneDrive → Seb/Videos/raw-videos/video-N/   ← ska innehålla dina .MOV-filer
```

## 2. Rensa slot-state för slottet
Öppna filen och ta bort raden för `video-N` — även om raw-filerna är **samma filer som förut** måste detta göras, annars tror watchern att jobbet redan är trigat:
```
/home/sajden/github/operator-hub/.local/slot-cloud-state.json
```
Ta bort raden:
```json
"video-4": "20260423_153934000_iOS.MOV:11850681|..."
```

## 3. Ta bort eventuellt gammalt jobb (kräver sudo)
```bash
sudo rm -rf /home/sajden/github/operator-hub/.local/short-form-video/jobs/<job-id>
```

## 3. Rensa bg-cloud-state så cloud-watchern kör om bg-removal

Cloud-watchern trackar processade filer med OneDrive itemId. Du måste ta bort video-N:s itemIds annars hoppar den över dem.

### Hitta itemIds från docker-loggarna
```bash
docker logs ai-cam-operator-hub 2>&1 | grep "20260423_15.*itemId=" | grep -oP "itemId=\K[A-Z0-9]+"
```
Byt ut datumprefix (`20260423`) mot det som matchar dina raw-filer.

### Ta bort dem ur state-filen
```bash
docker exec ai-cam-operator-hub node -e "
const fs = require('fs');
const path = '/workspace/operator-hub/.local/bg-cloud-state.json';
const d = JSON.parse(fs.readFileSync(path, 'utf-8'));
const toRemove = new Set([
  // klistra in itemIds här, ett per rad med komma
  '01TROW5K...',
]);
let removed = 0;
for (const id of toRemove) {
  if (d.processed[id]) { delete d.processed[id]; removed++; }
}
fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log('Removed', removed, 'entries');
"
```

## 4. Vänta på bg-removal
Cloud-watchern börjar ladda ner raw-filerna och skicka till bg-remover (ca 1 min/klipp).
Verifiera att det startat:
```bash
docker logs ai-cam-operator-hub --since 60s 2>&1 | grep "cloud-watcher\|processFile"
```

## 5. Watchern triggar render automatiskt
När no-bg-mappen har lika många filer som raw plockar slot-watchern upp jobbet inom ~90 sekunder.
