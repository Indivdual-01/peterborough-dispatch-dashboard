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
      map && layerId ? layerId : "",
      property,
      value
    );
  } catch {
    // Skip unsupported paint properties.
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
      const isWater =
        /water|ocean|lake|river|stream|reservoir/.test(
          description
        );

      const isPark =
        /park|wood|forest|grass|landcover|nature|green/.test(
          description
        );

      const isBuilding =
        /building/.test(
          description
        );

      if (isWater) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#05070d"
        );

        safelySetPaint(
          map,
          layerId,
          "fill-opacity",
          1
        );
      } else if (isPark) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#d9dcc7"
        );

        safelySetPaint(
          map,
          layerId,
          "fill-opacity",
          1
        );
      } else if (isBuilding) {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#070707"
        );

        safelySetPaint(
          map,
          layerId,
          "fill-opacity",
          0.95
        );
      } else {
        safelySetPaint(
          map,
          layerId,
          "fill-color",
          "#000000"
        );

        safelySetPaint(
          map,
          layerId,
          "fill-opacity",
          1
        );
      }

      safelySetPaint(
        map,
        layerId,
        "fill-outline-color",
        "#101010"
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
        "#080808"
      );

      safelySetPaint(
        map,
        layerId,
        "fill-extrusion-opacity",
        0.75
      );

      return;
    }

    if (layer.type === "line") {
      const isMajorRoad =
        /motorway|trunk|primary|secondary|major|highway|freeway|expressway/.test(
          description
        );

      const isLowUseRoad =
        /service|track|alley|access|driveway|parking_aisle|parking-aisle|service-road|service_road/.test(
          description
        );

      const isPathOrTrail =
        /footway|footpath|path|trail|cycleway|pedestrian|steps|bridleway/.test(
          description
        );

      const isResidentialRoad =
        /residential|tertiary|minor|street|road|transportation|local/.test(
          description
        );

      const isWaterLine =
        /river|stream|waterway|canal/.test(
          description
        );

      const isBoundary =
        /boundary|administrative/.test(
          description
        );

      if (isMajorRoad) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#43b8d6"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.9
        );

        safelySetPaint(
          map,
          layerId,
          "line-blur",
          0.2
        );
      } else if (isLowUseRoad) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#8059a8"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.8
        );

        safelySetPaint(
          map,
          layerId,
          "line-blur",
          0.15
        );
      } else if (isPathOrTrail) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#3c294f"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.45
        );

        safelySetPaint(
          map,
          layerId,
          "line-blur",
          0.1
        );
      } else if (isResidentialRoad) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#2b7f99"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.82
        );

        safelySetPaint(
          map,
          layerId,
          "line-blur",
          0.1
        );
      } else if (isWaterLine) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#102433"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.65
        );
      } else if (isBoundary) {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#222222"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.35
        );
      } else {
        safelySetPaint(
          map,
          layerId,
          "line-color",
          "#1a1a1a"
        );

        safelySetPaint(
          map,
          layerId,
          "line-opacity",
          0.5
        );
      }

      return;
    }

    if (layer.type === "symbol") {
      const isRoadLabel =
        /road|street|transportation|highway/.test(
          description
        );

      const isMajorRoadLabel =
        /motorway|trunk|primary|secondary|major|highway/.test(
          description
        );

      safelySetPaint(
        map,
        layerId,
        "text-color",
        isMajorRoadLabel
          ? "#f2f2f2"
          : isRoadLabel
            ? "#d8d8d8"
            : "#ffffff"
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
        1.4
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
        "#6e5b8b"
      );

      safelySetPaint(
        map,
        layerId,
        "circle-opacity",
        0.5
      );
    }
  });
}

function getMarkerColor(
  locationType
) {
  switch (locationType) {
    case "intersection":
      return "#ff6a3d";

    case "address":
      return "#f2a65a";

    case "highway":
      return "#43b8d6";

    case "road":
      return "#2b7f99";

    case "landmark":
      return "#8bcf9b";

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
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.addControl(
      new maplibregl.FullscreenControl(),
      "top-right"
    );

    map.on("load", () => {
      applyNeonMapStyle(map);
      updateMarkers(
        incidentsRef.current
      );
    });

    map.on("error", (event) => {
      console.error(
        "MapLibre error:",
        event?.error || event
      );
    });

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
