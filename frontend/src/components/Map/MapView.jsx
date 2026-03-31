import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const center = [26.4499, 80.3319]
const clusterColors = ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e', '#319795']

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      if (onMapClick) {
        onMapClick(event.latlng)
      }
    },
  })

  return null
}

const isValidCoordinate = (lat, lon) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180

function MapView({
  orders = [],
  drivers = [],
  onMapClick = null,
  selectedLocation = null,
  geometries = {},
  routeGeometries = {},
  enableOsrmRoutes = true,
}) {
  const [computedGeometries, setComputedGeometries] = useState({})
  const computedRouteCacheRef = useRef({})
  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const aSequence = a.sequence_order ?? Number.MAX_SAFE_INTEGER
        const bSequence = b.sequence_order ?? Number.MAX_SAFE_INTEGER
        return aSequence - bSequence
      }),
    [orders]
  )
  const providedGeometries = useMemo(
    () => ({ ...(geometries || {}), ...(routeGeometries || {}) }),
    [geometries, routeGeometries]
  )

  useEffect(() => {
    let cancelled = false
    const controllers = []
    let osrmFetchesStarted = 0

    // Safety rails: avoid dozens of OSRM requests + huge geojson parsing
    // which can freeze the browser.
    const OSRM_MAX_DRIVERS = 1
    const OSRM_MAX_STOPS = 8
    const OSRM_MAX_COORDS = 800
    const OSRM_TIMEOUT_MS = 8000

    const buildRoutes = async () => {
      if (!enableOsrmRoutes) {
        // Keep the UI responsive while users are editing/creating orders.
        // Polyline will fall back to straight-line points if no backend geometries exist.
        setComputedGeometries({})
        return
      }

      const entries = []
      const driversToProcess = drivers.filter((driver) => isValidCoordinate(driver.latitude, driver.longitude))

      for (const driver of driversToProcess) {
        const driverOrders = sortedOrders.filter(
          (order) =>
            order.driver_id === driver.id &&
            isValidCoordinate(order.latitude, order.longitude) &&
            order.status !== 'DELIVERED'
        )

        if (!driverOrders.length) {
          entries.push([driver.id, []])
          continue
        }

        const driverKey =
          `${driver.id}|` +
          `${driver.latitude},${driver.longitude}|` +
          `${driverOrders.map((o) => o.id).join(',')}`

        const existingFromBackend =
          providedGeometries[String(driver.id)] ?? providedGeometries[driver.id]
        if (Array.isArray(existingFromBackend) && existingFromBackend.length > 1) {
          entries.push([driver.id, existingFromBackend])
          continue
        }

        const cached = computedRouteCacheRef.current[String(driver.id)]
        if (cached?.key === driverKey && Array.isArray(cached.geometry) && cached.geometry.length > 1) {
          entries.push([driver.id, cached.geometry])
          continue
        }

        const points = [
          [driver.latitude, driver.longitude],
          ...driverOrders.map((order) => [order.latitude, order.longitude]),
        ]

        // If the route has many stops, OSRM can return very large geometries and impact UI.
        if (driverOrders.length > OSRM_MAX_STOPS || osrmFetchesStarted >= OSRM_MAX_DRIVERS) {
          entries.push([driver.id, points])
          continue
        }

        osrmFetchesStarted += 1

        try {
          const controller = new AbortController()
          controllers.push(controller)
          const coordinates = points.map(([lat, lon]) => `${lon},${lat}`).join(';')

          const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=simplified&geometries=geojson&steps=false&annotations=false`,
            { signal: controller.signal }
          )
          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`OSRM ${response.status}`)
          }

          const data = await response.json()
          const geometry = data?.routes?.[0]?.geometry?.coordinates
          if (Array.isArray(geometry) && geometry.length > 1) {
            // OSRM returns [lon,lat], Leaflet needs [lat,lon]
            let leafletGeometry = geometry.map(([lon, lat]) => [lat, lon])
            if (leafletGeometry.length > OSRM_MAX_COORDS) {
              const step = Math.ceil(leafletGeometry.length / OSRM_MAX_COORDS)
              leafletGeometry = leafletGeometry.filter((_, idx) => idx % step === 0)
            }
            if (!cancelled) {
              computedRouteCacheRef.current[String(driver.id)] = {
                key: driverKey,
                geometry: leafletGeometry,
              }
            }
            entries.push([driver.id, leafletGeometry])
            continue
          }
        } catch {
          // Ignore fetch errors and fall back to straight lines.
        }

        entries.push([driver.id, points])
      }

      if (!cancelled) {
        setComputedGeometries(Object.fromEntries(entries))
      }
    }

    buildRoutes()
    return () => {
      cancelled = true
      controllers.forEach((c) => c.abort())
    }
  }, [drivers, sortedOrders, providedGeometries, enableOsrmRoutes])

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <MapClickHandler onMapClick={onMapClick} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {selectedLocation && (
        <Marker position={[selectedLocation.latitude, selectedLocation.longitude]}>
          <Popup>
            Selected location
            <br />
            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </Popup>
        </Marker>
      )}

      {sortedOrders
        .filter((order) => isValidCoordinate(order.latitude, order.longitude))
        .map((order) => {
          const color = clusterColors[(order.cluster_id ?? 0) % clusterColors.length]

          return (
            <CircleMarker
              key={order.id}
              center={[order.latitude, order.longitude]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: order.status === 'DELIVERED' ? 0.35 : 0.8 }}
            >
              <Popup>
                <strong>{order.order_name || `Order #${order.id}`}</strong>
                <br />
                {order.address}
                <br />
                Status: <span className={`badge badge-${String(order.status || '').toLowerCase()}`}>{order.status}</span>
                <br />
                Sequence: {order.sequence_order ?? 'N/A'}
              </Popup>
            </CircleMarker>
          )
        })}

      {drivers
        .filter((driver) => isValidCoordinate(driver.latitude, driver.longitude))
        .map((driver) => (
          <Marker key={driver.id} position={[driver.latitude, driver.longitude]} icon={driverIcon}>
            <Popup>
              <strong>{driver.name}</strong>
              <br />
              {driver.phone || 'No phone'}
              <br />
              Status: {driver.status || 'UNKNOWN'}
            </Popup>
          </Marker>
        ))}

      {drivers
        .filter((driver) => isValidCoordinate(driver.latitude, driver.longitude))
        .map((driver) => {
          const driverOrders = sortedOrders.filter(
            (order) =>
              order.driver_id === driver.id &&
              isValidCoordinate(order.latitude, order.longitude) &&
              order.status !== 'DELIVERED'
          )

          if (!driverOrders.length) {
            return null
          }

          const points =
            computedGeometries[driver.id] ||
            computedGeometries[String(driver.id)] ||
            providedGeometries[driver.id] ||
            providedGeometries[String(driver.id)] ||
            [
              [driver.latitude, driver.longitude],
              ...driverOrders.map((order) => [order.latitude, order.longitude]),
            ]

          return (
            <Polyline
              key={`route-${driver.id}`}
              positions={points}
              color={clusterColors[(driverOrders[0].cluster_id ?? 0) % clusterColors.length]}
              weight={4}
              opacity={0.75}
            />
          )
        })}
    </MapContainer>
  )
}

export default MapView
