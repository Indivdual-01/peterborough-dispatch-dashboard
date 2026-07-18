import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,

      // Real street and road map
      style: "https://tiles.openfreemap.org/styles/liberty",

      // Peterborough, Ontario
      center: [-78.3197, 44.3091],

      zoom: 12,
      minZoom: 9,
      maxZoom: 19,
      pitch: 0,
      bearing: 0
    });

    map.current.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.current.addControl(
      new maplibregl.FullscreenControl(),
      "top-right"
    );

    new maplibregl.Marker({
      color: "#00b7ff"
    })
      .setLngLat([-78.3197, 44.3091])
      .setPopup(
        new maplibregl.Popup().setHTML(
          "<strong>Peterborough, Ontario</strong>"
        )
      )
      .addTo(map.current);

    map.current.on("error", (event) => {
      console.error("Map loading error:", event.error);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return <div ref={mapContainer} className="map" />;
}

export default Map;
