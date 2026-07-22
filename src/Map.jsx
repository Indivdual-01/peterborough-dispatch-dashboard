import React, {
  useEffect,
  useRef
} from "react";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PETERBOROUGH_CENTER = [
  -78.3197,
  44.3091
];

function getMarkerColor(locationType) {
  switch (locationType) {
    case "intersection":
      return "#ff3b30";

    case "address":
      return "#ff9500";

    case "highway":
      return "#ffcc00";

    case "road":
      return "#00b7ff";

    case "landmark":
      return "#af52de";

    default:
      return "#00ff99";
  }
}

function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Unknown";
  }

  return `${Math.round(number * 100)}%`;
}

function createPopupContent(incident) {
  const container =
    document.createElement("div");

  container.className =
    "incident-popup";

  const title =
    document.createElement("strong");

  title.textContent =
    incident.mapLabel ||
    incident.locationText ||
    "Detected location";

  container.appendChild(title);

  if (incident.time) {
    const time =
      document.createElement("div");

    time.className =
      "incident-popup-time";

    time.textContent =
      incident.time;

    container.appendChild(time);
  }

  if (incident.transcript) {
    const transcript =
      document.createElement("p");

    transcript.textContent =
      incident.transcript;

    container.appendChild(transcript);
  }

  const confidence =
    document.createElement("small");

  confidence.textContent =
    `Location confidence: ${formatPercentage(
      incident.confidence
    )}`;

  container.appendChild(confidence);

  if (incident.geocodingSource) {
    container.appendChild(
      document.createElement("br")
    );

    const source =
      document.createElement("small");

    source.textContent =
      `Map source: ${incident.geocodingSource}`;

    container.appendChild(source);
  }

  return container;
}

function DispatchMap({
  incidents = []
}) {
  const mapContainerRef =
    useRef(null);

  const mapRef =
    useRef(null);

  const markersRef =
    useRef(
      new globalThis.Map()
    );

  const latestIncidentIdRef =
    useRef("");

  const incidentsRef =
    useRef(incidents);

  useEffect(() => {
    incidentsRef.current =
      incidents;
  }, [incidents]);

  function updateMarkers(
    currentIncidents
  ) {
    const map =
      mapRef.current;

    if (
      !map ||
      !map.loaded()
    ) {
      return;
    }

    const currentIds =
      new Set(
        currentIncidents.map(
          (incident) =>
            incident.id
        )
      );

    markersRef.current.forEach(
      (marker, id) => {
        if (!currentIds.has(id)) {
          marker.remove();

          markersRef.current.delete(
            id
          );
        }
      }
    );

    currentIncidents.forEach(
      (incident) => {
        const latitude =
          Number(
            incident.latitude
          );

        const longitude =
          Number(
            incident.longitude
          );

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return;
        }

        const coordinates = [
          longitude,
          latitude
        ];

        const popup =
          new maplibregl.Popup({
            offset: 28,
            closeButton: true
          }).setDOMContent(
            createPopupContent(
              incident
            )
          );

        const existingMarker =
          markersRef.current.get(
            incident.id
          );

        if (existingMarker) {
          existingMarker
            .setLngLat(coordinates)
            .setPopup(popup);

          return;
        }

        const marker =
          new maplibregl.Marker({
            color:
              getMarkerColor(
                incident.locationType
              )
          })
            .setLngLat(coordinates)
            .setPopup(popup)
            .addTo(map);

        markersRef.current.set(
          incident.id,
          marker
        );
      }
    );

    const newestIncident =
      currentIncidents[0];

    if (
      !newestIncident ||
      newestIncident.id ===
        latestIncidentIdRef.current
    ) {
      return;
    }

    const latitude =
      Number(
        newestIncident.latitude
      );

    const longitude =
      Number(
        newestIncident.longitude
      );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    latestIncidentIdRef.current =
      newestIncident.id;

    map.flyTo({
      center: [
        longitude,
        latitude
      ],

      zoom: 15,
      speed: 0.8,
      essential: true
    });

    const newestMarker =
      markersRef.current.get(
        newestIncident.id
      );

    if (newestMarker) {
      newestMarker.togglePopup();
    }
  }

  useEffect(() => {
    if (
      mapRef.current ||
      !mapContainerRef.current
    ) {
      return;
    }

    const map =
      new maplibregl.Map({
        container:
          mapContainerRef.current,

        style:
          "https://tiles.openfreemap.org/styles/liberty",

        center:
          PETERBOROUGH_CENTER,

        zoom: 12,
        minZoom: 8,
        maxZoom: 19,
        pitch: 0,
        bearing: 0
      });

    mapRef.current =
      map;

    map.addControl(
      new maplibregl
        .NavigationControl(),

      "top-right"
    );

    map.addControl(
      new maplibregl
        .FullscreenControl(),

      "top-right"
    );

    map.on(
      "load",
      () => {
        updateMarkers(
          incidentsRef.current
        );
      }
    );

    map.on(
      "error",
      (event) => {
        console.error(
          "MapLibre error:",
          event?.error ||
          event
        );
      }
    );

    return () => {
      markersRef.current.forEach(
        (marker) => {
          marker.remove();
        }
      );

      markersRef.current.clear();

      map.remove();

      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    updateMarkers(incidents);
  }, [incidents]);

  return (
    <div
      ref={mapContainerRef}
      className="map"
    />
  );
}

export default DispatchMap;
