import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { useProfilePrefs } from '../contexts/ProfileContext'
import { fetchCosts, fetchAdjustedTotals, type StoreResult } from '../lib/tripleConstraint'

// ---------------------------------------------------------------------------
// Fix Leaflet's default icon path resolution in Vite
// ---------------------------------------------------------------------------
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoreRow {
  id: string
  name: string
  type: 'independent' | 'farmer' | 'butcher' | 'fisher' | 'conglomerate'
  address: string
  lat: number | null
  lng: number | null
  has_delivery: boolean
  owner_story: string | null
  hours: Record<string, { open: string; close: string }> | null
}

type ConstraintMode = 'cost' | 'time' | 'health'

// ---------------------------------------------------------------------------
// Pin color by store type
// ---------------------------------------------------------------------------

const PIN_COLORS: Record<StoreRow['type'], string> = {
  independent: '#161C47',  // Deep Navy
  farmer:      '#94313C',  // Burgundy
  butcher:     '#94313C',  // Burgundy
  fisher:      '#94313C',  // Burgundy
  conglomerate: '#9CA3AF', // Grey
}

function makeIcon(color: string, isBest: boolean) {
  const size = isBest ? 36 : 28
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.4}" viewBox="0 0 30 42">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 9.941 15 27 15 27S30 24.941 30 15C30 6.716 23.284 0 15 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      ${isBest ? `<circle cx="15" cy="15" r="6" fill="white"/>` : ''}
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size * 1.4],
    iconAnchor: [size / 2, size * 1.4],
    popupAnchor: [0, -(size * 1.4)],
  })
}

// ---------------------------------------------------------------------------
// Helper: fly map to bounds when stores load
// ---------------------------------------------------------------------------

function FitBounds({ stores }: { stores: StoreRow[] }) {
  const map = useMap()
  useEffect(() => {
    const valid = stores.filter((s) => s.lat && s.lng)
    if (valid.length === 0) return
    const bounds = L.latLngBounds(valid.map((s) => [s.lat!, s.lng!]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [stores, map])
  return null
}

// ---------------------------------------------------------------------------
// Hours formatter
// ---------------------------------------------------------------------------

function formatHours(hours: StoreRow['hours']) {
  if (!hours) return 'Hours not available'
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  const todayHours = hours[today]
  if (!todayHours || todayHours.open === 'closed') return 'Closed today'
  return `Today: ${todayHours.open} – ${todayHours.close}`
}

// ---------------------------------------------------------------------------
// Main Stores page
// ---------------------------------------------------------------------------

export function Stores({ isVisible }: { isVisible: boolean }) {
  const { prefs } = useProfilePrefs()
  const [stores, setStores] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<ConstraintMode>(
    (prefs?.primary_focus as ConstraintMode) ?? 'cost'
  )
  const [tcResults, setTcResults] = useState<StoreResult[]>([])
  const [tcLoading, setTcLoading] = useState(false)
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null)
  const runningTC = useRef(false)

  // Sync activeMode with user's stored preference when it loads
  useEffect(() => {
    if (prefs?.primary_focus) setActiveMode(prefs.primary_focus as ConstraintMode)
  }, [prefs?.primary_focus])

  const loadStores = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, type, address, lat, lng, has_delivery, owner_story, hours')
        .order('name')
      if (!error && data) setStores(data as StoreRow[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isVisible) loadStores()
  }, [isVisible, loadStores])

  // Run cost engine to rank stores when mode = cost or time
  useEffect(() => {
    if (!isVisible || stores.length === 0) return
    if (activeMode === 'health') { setTcResults([]); return }
    if (runningTC.current) return
    runningTC.current = true
    setTcLoading(true)

    const run = async () => {
      try {
        const storeNames = stores.map((s) => s.name)
        let results = await fetchCosts(storeNames, {
          storage_capacity: prefs?.storage_capacity,
          strict_health: prefs?.strict_health,
        })

        if (activeMode === 'time' && prefs?.postal_code) {
          const storesWithAddress = results.map((r) => ({
            ...r,
            address: stores.find((s) => s.name === r.store_name)?.address ?? r.store_name,
          }))
          results = await fetchAdjustedTotals(storesWithAddress, prefs.postal_code + ', Vancouver, BC')
        }
        setTcResults(results)
      } catch (err) {
        console.warn('Store TC error:', err)
      } finally {
        setTcLoading(false)
        runningTC.current = false
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, stores, activeMode])

  // Filter/sort stores for display
  const displayedStores = (() => {
    if (activeMode === 'health') {
      return stores.filter((s) =>
        ['farmer', 'butcher', 'fisher'].includes(s.type)
      )
    }
    if (tcResults.length > 0) {
      // Sort map pins in TC order
      const rankMap = new Map(tcResults.map((r, i) => [r.store_name, i]))
      return stores.slice().sort((a, b) => {
        const ra = rankMap.get(a.name) ?? 999
        const rb = rankMap.get(b.name) ?? 999
        return ra - rb
      })
    }
    return stores
  })()

  const bestStore = tcResults[0]?.store_name

  const CONSTRAINT_OPTIONS: { id: ConstraintMode; label: string }[] = [
    { id: 'cost',   label: 'Cost' },
    { id: 'time',   label: 'Time' },
    { id: 'health', label: 'Health' },
  ]

  return (
    <div className="flex flex-col">
      {/* Header + constraint bar */}
      <div className="px-6 pt-6 pb-3">
        <h2 className="font-display text-3xl font-semibold text-midnight-navy">Stores</h2>
        <p className="mt-1 text-sm text-midnight-navy/60">Vancouver grocery map</p>

        <div className="mt-3 flex rounded-xl border border-midnight-navy/10 bg-white p-1">
          {CONSTRAINT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setActiveMode(opt.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeMode === opt.id
                  ? 'bg-sunset-red text-white'
                  : 'text-midnight-navy/60 hover:text-midnight-navy'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {tcLoading && (
          <p className="mt-2 text-center text-xs text-midnight-navy/40">
            Calculating store rankings...
          </p>
        )}
      </div>

      {/* Map */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-midnight-navy/50">Loading stores...</p>
        </div>
      ) : (
        <div className="h-[50vh] w-full overflow-hidden">
          <MapContainer
            center={[49.2827, -123.1207]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds stores={displayedStores} />
            {displayedStores
              .filter((s) => s.lat && s.lng)
              .map((store) => (
                <Marker
                  key={store.id}
                  position={[store.lat!, store.lng!]}
                  icon={makeIcon(
                    PIN_COLORS[store.type],
                    store.name === bestStore && activeMode !== 'health'
                  )}
                  eventHandlers={{ click: () => setSelectedStore(store) }}
                >
                  <Popup>
                    <strong className="font-semibold">{store.name}</strong>
                    <br />
                    <span className="text-xs capitalize">{store.type}</span>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      )}

      {/* Store list / rankings */}
      <div className="px-6 pt-4 pb-8">
        {activeMode !== 'health' && tcResults.length > 0 && (
          <>
            <h3 className="font-display text-lg font-semibold text-midnight-navy">
              {activeMode === 'cost' ? 'Lowest Basket Price' : 'Fastest to Reach'}
            </h3>
            <ul className="mt-2 divide-y divide-midnight-navy/10 rounded-xl border border-midnight-navy/10 bg-white">
              {tcResults.slice(0, 6).map((r, i) => (
                <li key={r.store_name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-midnight-navy">
                      {i === 0 && <span className="mr-1 font-bold text-emerald-600">★ </span>}
                      {r.store_name}
                    </p>
                    {activeMode === 'time' && r.transit_time_minutes != null && (
                      <p className="text-xs text-midnight-navy/50">
                        {r.transit_time_minutes} min · +${r.transit_cost?.toFixed(2) ?? '0.00'} fare
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-midnight-navy">
                      ${r.running_total.toFixed(2)}
                    </p>
                    {activeMode === 'time' && r.adjusted_total !== r.running_total && (
                      <p className="text-xs text-midnight-navy/40">
                        ${r.adjusted_total.toFixed(2)} total
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {activeMode === 'health' && (
          <>
            <h3 className="font-display text-lg font-semibold text-midnight-navy">
              Farm, Butcher &amp; Fisher Stores
            </h3>
            <ul className="mt-2 divide-y divide-midnight-navy/10 rounded-xl border border-midnight-navy/10 bg-white">
              {displayedStores.map((s) => (
                <li
                  key={s.id}
                  className="cursor-pointer px-4 py-3 hover:bg-cream"
                  onClick={() => setSelectedStore(s)}
                >
                  <p className="text-sm font-semibold text-midnight-navy">{s.name}</p>
                  <p className="text-xs capitalize text-burgundy">{s.type}</p>
                  <p className="mt-0.5 text-xs text-midnight-navy/50">{formatHours(s.hours)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Store detail bottom sheet */}
      {selectedStore && (
        <StoreBottomSheet store={selectedStore} onClose={() => setSelectedStore(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Store Bottom Sheet
// ---------------------------------------------------------------------------

function StoreBottomSheet({ store, onClose }: { store: StoreRow; onClose: () => void }) {
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-midnight-navy/20" />

        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold text-midnight-navy">{store.name}</h3>
            <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
              ['farmer','butcher','fisher'].includes(store.type)
                ? 'bg-burgundy/10 text-burgundy'
                : 'bg-deep-navy/10 text-deep-navy'
            }`}>
              {store.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-midnight-navy/40 hover:bg-midnight-navy/5"
          >
            ✕
          </button>
        </div>

        {store.has_delivery && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Delivery available
          </div>
        )}

        {store.owner_story && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
              Owner's Story
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-midnight-navy/80">
              {store.owner_story}
            </p>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
            Address
          </p>
          <p className="mt-1 text-sm text-midnight-navy">{store.address}</p>
        </div>

        {store.hours && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
              Hours
            </p>
            <ul className="mt-1.5 space-y-1">
              {DAYS.map((day) => {
                const h = store.hours![day]
                if (!h) return null
                const isToday =
                  DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] === day
                return (
                  <li
                    key={day}
                    className={`flex justify-between text-sm ${
                      isToday ? 'font-semibold text-midnight-navy' : 'text-midnight-navy/60'
                    }`}
                  >
                    <span className="capitalize">{day}</span>
                    <span>
                      {h.open === 'closed' ? 'Closed' : `${h.open} – ${h.close}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-midnight-navy/10 bg-cream p-3 text-xs text-midnight-navy/50">
          Reviews coming soon — be the first to share your experience at {store.name}.
        </div>
      </div>
    </div>
  )
}
