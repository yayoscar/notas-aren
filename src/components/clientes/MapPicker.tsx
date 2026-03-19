"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix default marker icon (webpack issue with Leaflet)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const DEFAULT_CENTER: [number, number] = [23.6345, -102.5528] // Mexico center
const DEFAULT_ZOOM = 5

interface Props {
  latitud?: number | null
  longitud?: number | null
  onChange: (lat: number, lng: number) => void
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 15)
  }, [map, lat, lng])
  return null
}

export function MapPicker({ latitud, longitud, onChange }: Props) {
  const hasPosition = latitud != null && longitud != null
  const center: [number, number] = hasPosition
    ? [latitud, longitud]
    : DEFAULT_CENTER
  const zoom = hasPosition ? 15 : DEFAULT_ZOOM

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-[300px] w-full rounded-md border z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      {hasPosition && (
        <>
          <Marker position={[latitud, longitud]} />
          <RecenterMap lat={latitud} lng={longitud} />
        </>
      )}
    </MapContainer>
  )
}
