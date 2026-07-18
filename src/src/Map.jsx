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

      // Temporary map style
      // We will replace this with the custom neon street style
      // after connecting the real map data
      style: "https://demotiles.maplibre.org/style.json",

      // Peterborough Ontario
      center: [
        -78.3197,
        44.3091
      ],

      zoom: 12,

      minZoom: 10,

      maxZoom: 19,

      pitch: 0,

      bearing: 0

    });


    // Zoom + navigation controls
    map.current.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );


    // Add a marker for the center of Peterborough
    new maplibregl.Marker({
      color: "#00b7ff"
    })
      .setLngLat([
        -78.3197,
        44.3091
      ])
      .addTo(map.current);


    return () => {

      if (map.current) {

        map.current.remove();

        map.current = null;

      }

    };


  }, []);


  return (

    <div
      ref={mapContainer}
      className="map"
    />

  );

}


export default Map;
