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

function safelySetPaint(
  map,
  layerId,
  property,
  value
) {
  try {
    map.setPaintProperty(
      layerId,
      property,
      value
    );
  } catch {
    // Some map layers do not support every
    // paint property. Those layers are skipped.
  }
}

function applyNeonMapStyle(map) {
  const style = map.getStyle();

  const layers =
    Array.isArray(style?.layers)
      ? style.layers
      : [];

  layers.forEach((layer) => {
    const layerId =
      String(layer.id || "");

    const sourceLayer =
      String(
        layer["source-layer"] || ""
      );

    const description =
      `${layerId} ${sourceLayer}`
        .toLowerCase();

    if (layer.type === "background") {
      safelySetPaint(
        map,
        layerId,
        "background-color",
        "#000000"
      );

      safelySetPaint(
        map,
        layerId,
        "background-opacity",
        1
      );

      return;
    }

    if (layer.type === "fill") {
      if (
        /water|ocean|lake|river/.test(
          description
        )
      ) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#020512"
        );
      } else if (
        /park|wood|forest|grass|landcover/.test(
          description
        )
      ) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#050008"
        );
      } else if (
        /building/.test(description)
      ) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#0b0610"
        );
      } else {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#000000"
        );
      }

      safelySetPaint(
        map,
        layerId,
        "fill-outline-color",
        "#190025"
      );

      return;
    }

    if (
      layer.type ===
      "fill-extrusion"
    ) {
      safelySetPaint(
        map,
        layerId,
        "fill-extrusion-color",
        "#0b0610"
      );

      safelySetPaint(
        map,
        layerId,
        "fill-extrusion-opacity",
        0.7
      );

      return;
    }

    if (layer.type === "line") {
      const isRoad =
        /road|street|transportation|motorway|trunk|primary|secondary|tertiary|residential|service|minor|highway/.test(
          description
        );

      const isMainRoad =
        /motorway|trunk|primary|secondary|major|highway/.test(
          description
        );

      if (isRoad) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          isMainRoad
            ? "#00d9ff"
            : "#b100ff"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          isMainRoad
            ? 1
            : 0.95
        );

        safelySetPaint(
          map,
          layerId,
          "line-blur",
          isMainRoad
            ? 0.75
            : 0.45
        );
      } else {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#250035"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.7
        );
      }

      return;
    }

    if (layer.type === "symbol") {
      safelySetPaint(
        map,
        layerId,
        "text-color",
        "#ffffff"
      );

      safelySetPaint(
        map,
        layerId,
        "text-halo-color",
        "#000000"
      );

      safelySetPaint(
        map,
        layerId,
        "text-halo-width",
        1.5
      );

      safelySetPaint(
        map,
        layerId,
        "text-halo-blur",
        0.5
      );

      safelySetPaint(
        map,
        layerId,
        "icon-opacity",
        0.75
      );

      return;
    }

    if (layer.type === "circle") {
      safelySetPaint(
        map,
        layerId,
        "circle-color",
        "#8d00cc"
      );

      safelySetPaint(
        map,
        layerId,
        "circle-opacity",
        0.6
      );
    }
  });
}

function getMarkerColor(
  locationType
) {
  switch (locationType) {
    case "intersection":
      return "#ff2d55";

    case "address":
      return "#ff9500";

    case "highway":
      return "#00d9ff";

    case "road":
      return "#b100ff";

    case "landmark":
      return "#39ff88";

    default:
      return "#ffffff";
  }
}

function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Unknown";
  }

  return `${Math.round(
    number * 100
  )}%`;
}

function createPopupContent(
  incident
) {
  const container =
    document.createElement("div");

  container.className =
    "incident-popup";

  const title =
    document.createElement("strong");

  title.textContent =
    incident.mapLabel ||
    incident.locationText ||
    "Detected event";

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

    container.appendChild(
      transcript
    );
  }

  const confidence =
    document.createElement("small");

  confidence.textContent =
    `Location confidence: ${formatPercentage(
      incident.confidence
    )}`;

  container.appendChild(
    confidence
  );

  if (
    incident.geocodingSource
  ) {
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
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
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
            .setLngLat(
              coordinates
            )
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

    newestMarker?.togglePopup();
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

    mapRef.current = map;

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

    map.on("load", () => {
      applyNeonMapStyle(map);

      updateMarkers(
        incidentsRef.current
      );
    });

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
