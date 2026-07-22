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

function markerColor(locationType) {
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

function percentage(value) {
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

  const time =
    document.createElement("div");

  time.className =
    "incident-popup-time";

  time.textContent =
    incident.time || "";

  container.appendChild(time);

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
    `Location confidence: ${percentage(
      incident.confidence
    )}`;

  container.appendChild(confidence);

  if (incident.geocodingSource) {
    const source =
      document.createElement("small");

    source.textContent =
      `Map source: ${
        incident.geocodingSource
      }`;

    container.appendChild(
      document.createElement("br")
    );

    container.appendChild(source);
  }

  return container;
}

function Map({ incidents = [] }) {
  const mapContainer =
    useRef(null);

  const map =
    useRef(null);

  const markers =
    useRef(new Map());

  const latestIncidentId =
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
    if (
      !map.current ||
      !map.current.loaded()
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

    /*
     * Remove markers that are no longer
     * present in Recent Incidents.
     */
    markers.current.forEach(
      (marker, id) => {
        if (!currentIds.has(id)) {
          marker.remove();
          markers.current.delete(id);
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

        const existingMarker =
          markers.current.get(
            incident.id
          );

        if (existingMarker) {
          existingMarker
            .setLngLat(coordinates);

          existingMarker
            .setPopup(
              new maplibregl.Popup({
                offset: 28,
                closeButton: true
              }).setDOMContent(
                createPopupContent(
                  incident
                )
              )
            );

          return;
        }

        const marker =
          new maplibregl.Marker({
            color:
              markerColor(
                incident.locationType
              )
          })
            .setLngLat(coordinates)
            .setPopup(
              new maplibregl.Popup({
                offset: 28,
                closeButton: true
              }).setDOMContent(
                createPopupContent(
                  incident
                )
              )
            )
            .addTo(map.current);

        markers.current.set(
          incident.id,
          marker
        );
      }
    );

    /*
     * The newest incident is first in
     * the incidents array.
     */
    const newestIncident =
      currentIncidents[0];

    if (
      newestIncident &&
      newestIncident.id !==
        latestIncidentId.current
    ) {
      const latitude =
        Number(
          newestIncident.latitude
        );

      const longitude =
        Number(
          newestIncident.longitude
        );

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        latestIncidentId.current =
          newestIncident.id;

        map.current.flyTo({
          center: [
            longitude,
            latitude
          ],

          zoom: 15,
          speed: 0.8,
          essential: true
        });

        const marker =
          markers.current.get(
            newestIncident.id
          );

        marker?.togglePopup();
      }
    }
  }

  useEffect(() => {
    if (
      map.current ||
      !mapContainer.current
    ) {
      return;
    }

    const mapInstance =
      new maplibregl.Map({
        container:
          mapContainer.current,

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

    map.current =
      mapInstance;

    mapInstance.addControl(
      new maplibregl
        .NavigationControl(),

      "top-right"
    );

    mapInstance.addControl(
      new maplibregl
        .FullscreenControl(),

      "top-right"
    );

    mapInstance.on(
      "load",
      () => {
        updateMarkers(
          incidentsRef.current
        );
      }
    );

    mapInstance.on(
      "error",
      (event) => {
        console.error(
          "Map loading error:",
          event.error
        );
      }
    );

    return () => {
      markers.current.forEach(
        (marker) =>
          marker.remove()
      );

      markers.current.clear();

      mapInstance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    updateMarkers(incidents);
  }, [incidents]);

  return (
    <div
      ref={mapContainer}
      className="map"
    />
  );
}

export default Map;
