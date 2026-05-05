# SCEVA CRM NCC

App web React + Vite pensata per un singolo operatore NCC che vuole gestire lavoro quotidiano, clienti, corse, fatture e calendario senza complessita inutili.

## Cosa c'e gia

- Cruscotto operativo con prossimo servizio, agenda del giorno, KPI e stato fatture.
- Agenda giornaliera con blocchi servizio.
- Gestione servizi/prenotazioni con cambio stato, esportazione evento `.ics` e generazione fattura demo.
- Preventivi con stato bozza/inviato/accettato/scaduto, stampa documento e conversione diretta in servizio.
- Rubrica clienti con dati fiscali, preferenze e storico corse.
- Inserimento rapido nuovi clienti dalla rubrica.
- Area mezzi con stato veicolo, scadenze assicurazione/revisione/autorizzazione NCC e spese operative.
- Area fatture con stato `Da emettere`, `Inviata`, `Pagata`, stampa documento e registrazione incasso.
- Area dati con backup JSON, import backup e export CSV servizi.
- Area integrazioni pronta per Google Calendar, Apple Calendar/ICS, fatturazione elettronica e pagamenti.
- Persistenza locale via `localStorage`, utile per prototipo e demo senza backend.

## Avvio

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Architettura integrazioni

Il frontend prepara gia i dati necessari:

- Google Calendar: `src/lib/calendar.ts` genera il payload evento compatibile con `events.insert`.
- Apple Calendar: la stessa libreria genera file iCalendar `.ics`, importabile da Apple Calendar e riutilizzabile per un feed `webcal`.
- Fatturazione: servizi e fatture hanno id, cliente, importi, IVA, stato e campo `externalId` per collegare un provider esterno.
- Dati: il backup JSON esporta l'intero stato locale e puo diventare la base per una futura migrazione verso database.

Il passo successivo naturale e aggiungere backend/API per autenticazione, database, OAuth Google e provider di fatturazione.
