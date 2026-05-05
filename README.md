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

Il frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. La tabella cloud e definita in:

```text
supabase/migrations/0001_workspace_state.sql
```

Il salvataggio cloud usa Supabase Auth e RLS: ogni utente legge e scrive solo il proprio workspace.
