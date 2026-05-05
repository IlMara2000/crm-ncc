import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toDateInputValue } from '../lib/format'
import type { Customer, ServiceDraft, Vehicle } from '../lib/types'

interface ServiceFormProps {
  customers: Customer[]
  vehicles: Vehicle[]
  onClose: () => void
  onSubmit: (draft: ServiceDraft) => void
}

export function ServiceForm({
  customers,
  vehicles,
  onClose,
  onSubmit,
}: ServiceFormProps) {
  const [draft, setDraft] = useState<ServiceDraft>({
    customerId: customers[0]?.id ?? '',
    title: 'Nuovo transfer',
    pickup: '',
    dropoff: '',
    date: toDateInputValue(),
    startTime: '09:00',
    endTime: '10:00',
    passengers: 1,
    vehicleId: vehicles[0]?.id ?? '',
    serviceType: 'Transfer aeroporto',
    price: 90,
    paymentMethod: 'Carta',
    flight: '',
    notes: '',
  })

  function update<K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(draft)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="service-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Inserimento rapido</p>
            <h2 id="service-form-title">Nuovo servizio NCC</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <form className="service-form" onSubmit={handleSubmit}>
          <label>
            Cliente
            <select
              value={draft.customerId}
              onChange={(event) => update('customerId', event.target.value)}
              required
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Titolo servizio
            <input
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              required
            />
          </label>

          <label>
            Partenza
            <input
              value={draft.pickup}
              onChange={(event) => update('pickup', event.target.value)}
              placeholder="Es. Aeroporto Venezia Marco Polo"
              required
            />
          </label>

          <label>
            Destinazione
            <input
              value={draft.dropoff}
              onChange={(event) => update('dropoff', event.target.value)}
              placeholder="Es. Hotel, indirizzo, stazione"
              required
            />
          </label>

          <div className="form-row">
            <label>
              Data
              <input
                type="date"
                value={draft.date}
                onChange={(event) => update('date', event.target.value)}
                required
              />
            </label>
            <label>
              Inizio
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => update('startTime', event.target.value)}
                required
              />
            </label>
            <label>
              Fine
              <input
                type="time"
                value={draft.endTime}
                onChange={(event) => update('endTime', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Passeggeri
              <input
                type="number"
                min={1}
                value={draft.passengers}
                onChange={(event) => update('passengers', Number(event.target.value))}
              />
            </label>
            <label>
              Mezzo
              <select
                value={draft.vehicleId}
                onChange={(event) => update('vehicleId', event.target.value)}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Tipo servizio
              <select
                value={draft.serviceType}
                onChange={(event) => update('serviceType', event.target.value)}
              >
                <option>Transfer aeroporto</option>
                <option>Transfer stazione</option>
                <option>Business</option>
                <option>Disposizione oraria</option>
                <option>Evento</option>
              </select>
            </label>
            <label>
              Importo
              <input
                type="number"
                min={0}
                step={5}
                value={draft.price}
                onChange={(event) => update('price', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Pagamento
              <select
                value={draft.paymentMethod}
                onChange={(event) => update('paymentMethod', event.target.value)}
              >
                <option>Carta</option>
                <option>Contanti</option>
                <option>Bonifico</option>
                <option>Fattura hotel</option>
              </select>
            </label>
            <label>
              Volo/treno
              <input
                value={draft.flight}
                onChange={(event) => update('flight', event.target.value)}
                placeholder="Facoltativo"
              />
            </label>
          </div>

          <label>
            Note operative
            <textarea
              value={draft.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
            />
          </label>

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onClose}>
              Annulla
            </button>
            <button className="primary-button" type="submit">
              Crea servizio
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
