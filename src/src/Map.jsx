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

      // Temporary style - we replace this with our custom neon style next
      style: "https://demotiles.maplibre.org/style.json",

      // Peterborough Ontario
      center: [
        -78.3197,
        44.3091
      ],

      zoom: 12,

      pitch: 0,

      bearing: 0

    });


    map.current.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );


  }, []);


  return (

    <div
      ref={mapContainer}
      className="map"
    />

  );

}


export default Map;
