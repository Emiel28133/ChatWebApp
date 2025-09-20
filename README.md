# ChatWebApp

Een eenvoudige realtime chatapp gebouwd met Node.js en Socket.IO. De app serveert een statische frontend en bewaart gebruikers en berichten in lokale JSON-bestanden. Ideaal als portfolio-demo of basis voor verdere uitbreiding.

## Inhoud
- Overzicht
- Features
- Live demo & links
- Technische stack
- Snelstart
- Configuratie
- API & Socket events
- Mappenstructuur
- Beperkingen en roadmap
- Licentie

## Overzicht
ChatWebApp is een minimalistische chattoepassing die realtime berichtenuitwisseling mogelijk maakt met basis-authenticatie, privéberichten en afbeeldingsuploads.

## Features
- Realtime messaging met Socket.IO
- Inloggen/registreren op basis van sessies (Express Session)
- Lijst met online gebruikers en één actieve sessie per username (dubbele sessies worden afgemeld)
- Privéberichten (DM) via een `to`-veld
- Afbeeldingsupload (png/jpg/gif/webp) met limiet (5 MB)
- Basis data-opslag in `users.json` en `messages.json`
- Healthcheck endpoint voor hosting
- Admin-actie: gebruiker “Serpentine” mag berichten bewerken/verwijderen

## Live demo & links
- Live demo (Render): https://chatwebapp-c97c.onrender.com
- Broncode (GitHub): https://github.com/Emiel28133/ChatWebApp

## Technische stack
- Server: Node.js (Express) in `server.js`
- Realtime: Socket.IO
- Frontend: statische assets in `public/`
- Bestandsupload: Multer (uploads naar `public/uploads/`)
- Opslag: lokale JSON-bestanden (demo/ontwikkel-doeleinden)
- Hosting: Render

## Snelstart

Vereisten:
- Node.js (LTS aanbevolen)

Installatie:
```bash
git clone https://github.com/Emiel28133/ChatWebApp
cd ChatWebApp
npm install
```

Starten (lokaal):
```bash
node server.js
```

De app luistert op `process.env.PORT` (indien aanwezig) of poort `3000`. Bezoek:
```
http://localhost:3000
```

## Configuratie
Environment variabelen:
- `PORT` — poort voor de server (Render zet deze automatisch)
- `SESSION_SECRET` — sessiesleutel (zet een sterke waarde in productie)

Opslag:
- `users.json` — gebruikers met gehashte wachtwoorden (bcryptjs)
- `messages.json` — chatgeschiedenis

Uploads:
- Afbeeldingen worden opgeslagen in `public/uploads/`
- Toegestane types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- Max grootte: 5 MB

## API & Socket events

REST API:
- POST `/register` — registreert gebruiker
  - Body: `{ username, password }`
  - Response: `{ success: true }`
- POST `/login` — logt in
  - Body: `{ username, password }`
  - Response: `{ success: true, username }`
- GET `/session` — sessiestatus
  - Response: `{ loggedIn: boolean, username? }`
- POST `/logout` — uitloggen
  - Response: `{ success: true }`
- POST `/upload` — upload afbeelding (auth vereist)
  - Form field: `image`
  - Response: `{ success: true, path: "/uploads/<bestand>" }`
- POST `/edit` — bewerk bericht (alleen “Serpentine”)
  - Body: `{ index, newText }`
- POST `/delete` — verwijder bericht (alleen “Serpentine”)
  - Body: `{ index }`
- GET `/healthz` — healthcheck (tekst `ok`)

Socket.IO events:
- Client → Server:
  - `join` — payload: `username` (string). Laadt berichten en markeert gebruiker online. Kickt oude sessie met dezelfde username.
  - `leave` — verlaat bewust zonder disconnect (online-lijst wordt geüpdatet).
  - `chatMessage` — payload: `{ text?: string, image?: string, to?: string }`
- Server → Client:
  - `loadMessages` — payload: `messages[]` (volledige geschiedenis)
  - `onlineUsers` — payload: `string[]` (usernames online)
  - `message` — payload: `message, index` (nieuw bericht)
  - `updateMessage` — payload: `{ index, newText }` (na bewerken)
  - `deleteMessage` — payload: `{ index }` (na verwijderen)

Berichtmodel (voorbeeld):
```json
{
  "user": "Alice",
  "text": "Hallo!",
  "image": null,
  "to": null,
  "ts": 1700000000000
}
```

## Mappenstructuur
```
.
├─ public/                 # statische frontend + uploads/
├─ messages.json           # berichtendata (lokaal)
├─ users.json              # gebruikersdata (lokaal, gehashte wachtwoorden)
├─ package.json
├─ package-lock.json
├─ server.js               # Node.js + Socket.IO server
└─ .gitattributes
```

## Beperkingen en roadmap
Bekende beperkingen:
- Geen “echte” database; JSON-bestanden zijn niet geschikt voor productie
- Beperkte autorisatie/rollen (alleen speciale case “Serpentine”)

Roadmap-ideeën:
- Migratie naar Postgres/MongoDB
- Uitgebreidere auth (rollen/permissions, wachtwoord reset)
- Chatrooms/kanalen, mention-system, leesbevestigingen
- Bestandsuploads met CDN en virus/mimetype-scans
- CI/CD en monitoring/logging

## Licentie
MIT © Emiel
