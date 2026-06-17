# VPS Infrastructure Plan

## Bakgrund

Idag körs allt lokalt på stationär PC. Målet är att flytta autonoma processer och verktyg till en molnserver så de:
- Alltid är tillgängliga oavsett vilken enhet du är på
- Körs automatiskt utan att stationären behöver vara igång
- Inte kostar mer än vad de ersätter

## Server

**Hetzner CX32** — ~80kr/mån
- 4 vCPU, 8GB RAM
- Räcker för video-pipeline (inkl. bgremover utan GPU) + övriga services
- Allt körs i Docker, separata docker-compose per service

## Planerade services

| Service | Syfte | Status |
|---|---|---|
| `video-pipeline` | Automatisk videoproduktion (watcher → bgremove → render → social copy) | Byggas |
| `InvoiceNinja` | Fakturering, tillgänglig var som helst | Planerad |
| `SEO-checker` | Från operator-hub, tillgänglig var som helst | Planerad |
| `Lead-agent` | Autonom agent som letar leads | Framtid |
| `Mail-agent` | Autonom agent som följer upp leads via mail | Framtid |
| `Uptime Kuma` | Övervakar att alla services är uppe, skickar notis vid kraschar | Planerad |

## Tankar om operator-hub

operator-hub UI:t kan på sikt bli ingången till allt ovanstående — inte bara video. Varje autonom agent och verktyg exponerar ett API, operator-hub visar status och låter dig trigga actions.

## Nästa steg

1. Slutför `video-pipeline`-migreringen (pågående)
2. Sätt upp Hetzner CX32
3. Deployta `video-pipeline` + InvoiceNinja + Uptime Kuma
4. Flytta SEO-checker dit
5. Börja designa lead-agent och mail-agent
