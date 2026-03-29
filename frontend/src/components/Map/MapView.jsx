import React from 'react'
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

function MapView({ orders = [], drivers = [], onMapClick = null, selectedLocation = null }) {
  const sortedOrders = [...orders].sort((a, b) => {
    const aSequence = a.sequence_order ?? Number.MAX_SAFE_INTEGER
    const bSequence = b.sequence_order ?? Number.MAX_SAFE_INTEGER
    return aSequence - bSequence
  })

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
        .filter((order) => typeof order.latitude === 'number' && typeof order.longitude === 'number')
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
        .filter((driver) => typeof driver.latitude === 'number' && typeof driver.longitude === 'number')
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
        .filter((driver) => typeof driver.latitude === 'number' && typeof driver.longitude === 'number')
        .map((driver) => {
          const driverOrders = sortedOrders.filter(
            (order) =>
              order.driver_id === driver.id &&
              typeof order.latitude === 'number' &&
              typeof order.longitude === 'number' &&
              order.status !== 'DELIVERED'
          )

          if (!driverOrders.length) {
            return null
          }

          const points = [
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
