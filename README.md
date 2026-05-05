# NCC CRM

App web React + Vite per un operatore NCC: servizi, agenda, clienti, mezzi, preventivi, fatture e integrazioni calendario.

REALINDI DEN SYSTEMS (C) 2026

## Cosa c'e gia

- Cruscotto operativo con prossimo servizio, agenda del giorno, KPI e stato fatture.
- Agenda giornaliera con blocchi servizio.
- Gestione servizi/prenotazioni con cambio stato, esportazione evento `.ics` e generazione fattura.
- Preventivi con stato bozza/inviato/accettato/scaduto, stampa documento e conversione diretta in servizio.
- Rubrica clienti con dati fiscali, preferenze e storico corse.
- Inserimento rapido nuovi clienti dalla rubrica.
- Area mezzi con inserimento veicolo, stato, scadenze assicurazione/revisione/autorizzazione NCC e spese operative.
- Area fatture con stato `Da emettere`, `Inviata`, `Pagata`, stampa documento e registrazione incasso.
- Area dati con backup JSON, import backup, export CSV servizi e accesso cloud Supabase.
- Area integrazioni pronta per Google Calendar, Apple Calendar/ICS, fatturazione elettronica e pagamenti.
- Archivio iniziale vuoto, senza dati precompilati.

## Avvio

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Supabase

Il frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Le API serverless usano anche
`SUPABASE_SERVICE_ROLE_KEY` solo lato server, per salvare token Google e log fatture.

Le tabelle cloud sono definite in:

```text
supabase/migrations/0001_workspace_state.sql
supabase/migrations/0002_google_calendar_tokens.sql
supabase/migrations/0003_invoice_exports.sql
```

Il salvataggio cloud usa Supabase Auth e RLS: ogni utente legge e scrive solo il proprio workspace.

## Backend online

Le funzioni Vercel in `api/` coprono:

- `GET /api/health`: verifica configurazione server.
- `POST /api/google/auth-url`: genera URL OAuth Google per l'utente Supabase loggato.
- `GET /api/google/callback`: salva token Google Calendar su Supabase.
- `POST /api/google/create-event`: crea evento Google Calendar da un servizio.
- `POST /api/invoicing/create-invoice`: invia una fattura al provider esterno.

## Variabili Vercel

Oltre alle due variabili pubbliche Supabase gia usate dal frontend, in produzione servono:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GOOGLE_OAUTH_STATE_SECRET
FATTURE_IN_CLOUD_TOKEN
FATTURE_IN_CLOUD_COMPANY_ID
```

`GOOGLE_REDIRECT_URI` deve puntare al dominio online, ad esempio
`https://ncc-crm.tuodominio.it/api/google/callback`.

## Fatturazione

Il connettore e predisposto per Fatture in Cloud API v2. Se token e company ID non sono configurati,
l'app mostra un errore esplicito invece di creare documenti finti.
