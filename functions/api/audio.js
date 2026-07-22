const CENTER = {
  lat: 44.3091,
  lon: -78.3197
};

const BBOX = {
  south: 43.75,
  west: -79.2,
  north: 44.95,
  east: -77.3
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (
    let index = 0;
    index < bytes.length;
    index += 32768
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        index,
        index + 32768
      )
    );
  }

  return btoa(binary);
}

function emptyLocation() {
  return {
    hasLocation: false,
    locationText: "",
    municipality: "",
    locationType: "unknown",
    confidence: 0,
    geocoded: false,
    latitude: null,
    longitude: null,
    mapLabel: "",
    geocodingConfidence: 0,
    geocodingSource: ""
  };
}

function normalizeLocation(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return emptyLocation();
  }

  const allowedTypes = new Set([
    "address",
    "intersection",
    "road",
    "highway",
    "landmark",
    "unknown"
  ]);

  const confidenceValue =
    Number(value.confidence);

  const confidence =
    Number.isFinite(confidenceValue)
      ? Math.max(
          0,
          Math.min(1, confidenceValue)
        )
      : 0;

  const locationText =
    typeof value.locationText === "string"
      ? value.locationText.trim()
      : "";

  const municipality =
    typeof value.municipality === "string"
      ? value.municipality.trim()
      : "";

  const locationType =
    allowedTypes.has(value.locationType)
      ? value.locationType
      : "unknown";

  const hasLocation =
    Boolean(value.hasLocation) &&
    Boolean(locationText) &&
    confidence >= 0.5;

  return {
    ...emptyLocation(),

    hasLocation,

    locationText:
      hasLocation
        ? locationText
        : "",

    municipality:
      hasLocation
        ? municipality
        : "",

    locationType:
      hasLocation
        ? locationType
        : "unknown",

    confidence
  };
}

async function extractLocation(
  transcript,
  ai
) {
  if (!transcript?.trim()) {
    return emptyLocation();
  }

  try {
    const result = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          {
            role: "system",

            content:
              "Extract the reported incident location from an emergency-service radio transcript. " +
              "The area is Peterborough, Ontario, Peterborough County and nearby communities. " +
              "A location may be an address, intersection, road, highway, landmark, business, park or public place. " +
              "Never invent a location. " +
              "Return hasLocation false when the location is unclear or missing. " +
              "Do not treat a responding unit's movement, patrol route, or vehicle position as an incident location. " +
              "For an intersection, include both road names."
          },

          {
            role: "user",
            content: transcript
          }
        ],

        temperature: 0,
        max_tokens: 220,

        response_format: {
          type: "json_schema",

          json_schema: {
            type: "object",

            properties: {
              hasLocation: {
                type: "boolean"
              },

              locationText: {
                type: "string"
              },

              municipality: {
                type: "string"
              },

              locationType: {
                type: "string",

                enum: [
                  "address",
                  "intersection",
                  "road",
                  "highway",
                  "landmark",
                  "unknown"
                ]
              },

              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1
              }
            },

            required: [
              "hasLocation",
              "locationText",
              "municipality",
              "locationType",
              "confidence"
            ],

            additionalProperties: false
          }
        }
      }
    );

    let value = result?.response;

    if (typeof value === "string") {
      value = JSON.parse(value);
    }

    return normalizeLocation(value);
  } catch (error) {
    console.error(
      "Location extraction failed:",
      error
    );

    return emptyLocation();
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}

function meaningfulTokens(value) {
  const ignored = new Set([
    "at",
    "and",
    "near",
    "on",
    "in",
    "by",
    "the",
    "of",
    "to",
    "road",
    "rd",
    "street",
    "st",
    "avenue",
    "ave",
    "drive",
    "dr",
    "highway",
    "hwy",
    "route",
    "line",
    "county",
    "peterborough",
    "ontario",
    "canada",
    "west",
    "east",
    "north",
    "south"
  ]);

  return [
    ...new Set(
      normalizeText(value)
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .filter(
          (token) =>
            !ignored.has(token) &&
            (
              token.length >= 2 ||
              /^\d+$/.test(token)
            )
        )
    )
  ];
}

function splitIntersection(text) {
  const parts = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(
      /\s+(?:and|at|near|by|@|&|\/|x)\s+/i
    )
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length >= 2
    ? [parts[0], parts[1]]
    : null;
}

function kilometres(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadius = 6371;

  const radians = (degrees) =>
    degrees * Math.PI / 180;

  const latitudeDifference =
    radians(latitude2 - latitude1);

  const longitudeDifference =
    radians(longitude2 - longitude1);

  const calculation =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(
        longitudeDifference / 2
      ) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation)
    )
  );
}

function featureLabel(feature) {
  return String(
    feature?.place_name ||
    feature?.text ||
    feature?.properties?.name ||
    ""
  ).trim();
}

function featureTypes(feature) {
  return [
    ...(
      Array.isArray(feature?.place_type)
        ? feature.place_type
        : []
    ),

    ...(
      Array.isArray(feature?.types)
        ? feature.types
        : []
    ),

    feature?.type,
    feature?.kind,
    feature?.properties?.type,
    feature?.properties?.kind
  ]
    .filter(Boolean)
    .map(
      (value) =>
        String(value).toLowerCase()
    );
}

function isGenericLabel(label) {
  const value =
    normalizeText(label)
      .replace(/\s+/g, " ")
      .trim();

  return new Set([
    "peterborough",
    "peterborough ontario",
    "peterborough ontario canada",
    "peterborough canada",
    "peterborough county",
    "peterborough county ontario",
    "peterborough county ontario canada"
  ]).has(value);
}

function buildQueries(location) {
  const municipality =
    location.municipality ||
    "Peterborough County";

  const suffix =
    `${municipality}, Ontario, Canada`;

  const queries = [
    `${location.locationText}, ${suffix}`
  ];

  if (
    location.locationType ===
    "intersection"
  ) {
    const roads =
      splitIntersection(
        location.locationText
      );

    if (roads) {
      const [firstRoad, secondRoad] =
        roads;

      queries.unshift(
        `${firstRoad} & ${secondRoad}, ${suffix}`,
        `${firstRoad} at ${secondRoad}, ${suffix}`,
        `${secondRoad} at ${firstRoad}, ${suffix}`
      );
    }
  }

  return [...new Set(queries)];
}

async function mapTilerLookup(
  location,
  key
) {
  const encodedQueries =
    buildQueries(location)
      .map(
        (query) =>
          encodeURIComponent(query)
      )
      .join(";");

  const url = new URL(
    `https://api.maptiler.com/geocoding/${encodedQueries}.json`
  );

  url.searchParams.set(
    "key",
    key
  );

  url.searchParams.set(
    "country",
    "ca"
  );

  url.searchParams.set(
    "language",
    "en"
  );

  url.searchParams.set(
    "types",
    "address,road,poi"
  );

  url.searchParams.set(
    "limit",
    "5"
  );

  url.searchParams.set(
    "proximity",
    `${CENTER.lon},${CENTER.lat}`
  );

  url.searchParams.set(
    "bbox",
    [
      BBOX.west,
      BBOX.south,
      BBOX.east,
      BBOX.north
    ].join(",")
  );

  url.searchParams.set(
    "autocomplete",
    "false"
  );

  url.searchParams.set(
    "fuzzyMatch",
    "true"
  );

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `MapTiler returned ${response.status}`
    );
  }

  const data =
    await response.json();

  const collections =
    Array.isArray(data)
      ? data
      : [data];

  const features =
    collections.flatMap(
      (item) =>
        Array.isArray(item?.features)
          ? item.features
          : []
    );

  const requestedTokens =
    meaningfulTokens(
      location.locationText
    );

  const usefulTypes =
    new Set([
      "address",
      "road",
      "street",
      "poi",
      "road_relation",
      "virtual_street"
    ]);

  const candidates =
    features
      .map((feature) => {
        const coordinates =
          Array.isArray(feature?.center)
            ? feature.center
            : feature?.geometry
                ?.coordinates;

        if (
          !Array.isArray(coordinates) ||
          coordinates.length < 2 ||
          Array.isArray(coordinates[0])
        ) {
          return null;
        }

        const longitude =
          Number(coordinates[0]);

        const latitude =
          Number(coordinates[1]);

        const relevance =
          Number(feature.relevance) || 0;

        const label =
          featureLabel(feature);

        const labelTokens =
          new Set(
            meaningfulTokens(label)
          );

        const tokenMatches =
          requestedTokens.filter(
            (token) =>
              labelTokens.has(token)
          ).length;

        return {
          feature,
          latitude,
          longitude,
          relevance,
          label,
          tokenMatches,

          distance:
            kilometres(
              CENTER.lat,
              CENTER.lon,
              latitude,
              longitude
            )
        };
      })
      .filter(Boolean)
      .filter((candidate) => {
        const typeMatches =
          featureTypes(
            candidate.feature
          ).some(
            (type) =>
              usefulTypes.has(type)
          );

        if (
          !typeMatches ||
          isGenericLabel(
            candidate.label
          )
        ) {
          return false;
        }

        if (
          candidate.distance > 160 ||
          candidate.relevance < 0.65
        ) {
          return false;
        }

        const requiredMatches =
          location.locationType ===
          "intersection"
            ? Math.min(
                2,
                requestedTokens.length
              )
            : Math.min(
                1,
                requestedTokens.length
              );

        return (
          candidate.tokenMatches >=
          requiredMatches
        );
      })
      .sort(
        (first, second) =>
          second.tokenMatches -
            first.tokenMatches ||

          second.relevance -
            first.relevance ||

          first.distance -
            second.distance
      );

  const bestMatch =
    candidates[0];

  if (!bestMatch) {
    return null;
  }

  return {
    ...location,

    geocoded: true,

    latitude:
      bestMatch.latitude,

    longitude:
      bestMatch.longitude,

    mapLabel:
      bestMatch.label ||
      location.locationText,

    geocodingConfidence:
      bestMatch.relevance,

    geocodingSource:
      "maptiler"
  };
}

function escapeRegex(value) {
  return String(value || "")
    .replace(
      /[\\^$.*+?()[\]{}|]/g,
      "\\$&"
    );
}

function roadVariants(name) {
  const original =
    String(name || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!original) {
    return [];
  }

  const variants =
    new Set([
      original,

      original.replace(
        /\bSt\.?\b/gi,
        "Street"
      ),

      original.replace(
        /\bRd\.?\b/gi,
        "Road"
      ),

      original.replace(
        /\bAve\.?\b/gi,
        "Avenue"
      ),

      original.replace(
        /\bDr\.?\b/gi,
        "Drive"
      ),

      original.replace(
        /\bHwy\.?\b/gi,
        "Highway"
      )
    ]);

  return [...variants]
    .filter(Boolean);
}

function overpassRoadUnion(
  name,
  setName
) {
  const boundingBox = [
    BBOX.south,
    BBOX.west,
    BBOX.north,
    BBOX.east
  ].join(",");

  const selectors =
    roadVariants(name)
      .map(
        (variant) =>
          `way["highway"]["name"~"^${escapeRegex(variant)}$",i](${boundingBox});`
      );

  const highwayNumber =
    String(name).match(
      /\b(?:highway|hwy|route)\s*(\d+[a-z]?)\b/i
    )?.[1];

  if (highwayNumber) {
    selectors.push(
      `way["highway"]["ref"~"(^|;[[:space:]]*)${escapeRegex(highwayNumber)}([[:space:]]*;|$)",i](${boundingBox});`
    );
  }

  return (
    `(${selectors.join("\n")})->.${setName};`
  );
}

async function overpassIntersection(
  location
) {
  if (
    location.locationType !==
    "intersection"
  ) {
    return null;
  }

  const roads =
    splitIntersection(
      location.locationText
    );

  if (!roads) {
    return null;
  }

  const [
    firstRoad,
    secondRoad
  ] = roads;

  const query = [
    "[out:json][timeout:15];",

    overpassRoadUnion(
      firstRoad,
      "firstRoad"
    ),

    overpassRoadUnion(
      secondRoad,
      "secondRoad"
    ),

    "node(w.firstRoad)(w.secondRoad);",
    "out body;"
  ].join("\n");

  try {
    const response =
      await fetch(
        "https://overpass-api.de/api/interpreter",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",

            "Accept":
              "application/json"
          },

          body:
            new URLSearchParams({
              data: query
            }).toString()
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    const nodes =
      (
        Array.isArray(data?.elements)
          ? data.elements
          : []
      )
        .filter(
          (item) =>
            item?.type === "node"
        )
        .map((item) => ({
          latitude:
            Number(item.lat),

          longitude:
            Number(item.lon)
        }))
        .filter(
          (item) =>
            Number.isFinite(
              item.latitude
            ) &&
            Number.isFinite(
              item.longitude
            )
        )
        .map((item) => ({
          ...item,

          distance:
            kilometres(
              CENTER.lat,
              CENTER.lon,
              item.latitude,
              item.longitude
            )
        }))
        .filter(
          (item) =>
            item.distance <= 160
        )
        .sort(
          (first, second) =>
            first.distance -
            second.distance
        );

    const bestNode =
      nodes[0];

    if (!bestNode) {
      return null;
    }

    return {
      ...location,

      geocoded: true,

      latitude:
        bestNode.latitude,

      longitude:
        bestNode.longitude,

      mapLabel:
        `${firstRoad} & ${secondRoad}` +
        (
          location.municipality
            ? `, ${location.municipality}`
            : ""
        ),

      geocodingConfidence:
        0.92,

      geocodingSource:
        "openstreetmap"
    };
  } catch (error) {
    console.error(
      "Overpass lookup failed:",
      error
    );

    return null;
  }
}

async function geocodeLocation(
  location,
  key
) {
  if (
    !key ||
    !location.hasLocation ||
    location.confidence < 0.65
  ) {
    return location;
  }

  try {
    const mapTilerResult =
      await mapTilerLookup(
        location,
        key
      );

    if (mapTilerResult) {
      return mapTilerResult;
    }
  } catch (error) {
    console.error(
      "MapTiler lookup failed:",
      error
    );
  }

  const intersectionResult =
    await overpassIntersection(
      location
    );

  if (intersectionResult) {
    return intersectionResult;
  }

  return {
    ...location,

    geocoded: false,
    latitude: null,
    longitude: null,
    mapLabel: "",
    geocodingConfidence: 0,
    geocodingSource: ""
  };
}

export async function onRequestGet(
  context
) {
  return json({
    success: true,

    message:
      "Peterborough Dispatch transcription, location and mapping endpoint is ready.",

    aiBindingConnected:
      Boolean(context.env.AI),

    mapTilerConnected:
      Boolean(
        context.env.MAPTILER_KEY
      ),

    endpoint:
      "/api/audio",

    time:
      new Date().toISOString()
  });
}

export async function onRequestPost(
  context
) {
  try {
    if (!context.env.AI) {
      return json(
        {
          success: false,

          error:
            "Cloudflare Workers AI is not connected."
        },

        500
      );
    }

    const contentType =
      context.request.headers.get(
        "Content-Type"
      ) ||
      "application/octet-stream";

    const audioBuffer =
      await context.request
        .arrayBuffer();

    if (
      audioBuffer.byteLength === 0
    ) {
      return json(
        {
          success: false,

          error:
            "No audio was received."
        },

        400
      );
    }

    if (
      audioBuffer.byteLength >
      8 * 1024 * 1024
    ) {
      return json(
        {
          success: false,

          error:
            "The audio recording is too large."
        },

        413
      );
    }

    const transcription =
      await context.env.AI.run(
        "@cf/openai/whisper-large-v3-turbo",

        {
          audio:
            toBase64(audioBuffer),

          task:
            "transcribe",

          language:
            "en",

          vad_filter:
            true,

          beam_size:
            8,

          condition_on_previous_text:
            true,

          no_speech_threshold:
            0.6,

          initial_prompt:
            "Emergency services radio dispatch in Peterborough, Ontario, Canada. " +
            "Speakers may use police, fire, EMS and OPP terminology, unit numbers, ten-codes and clipped sentences. " +
            "Common local roads include Lansdowne Street, Monaghan Road, Chemong Road, Parkhill Road, " +
            "Ashburnham Drive, Water Street, George Street, Charlotte Street, Sherbrooke Street, " +
            "Clonsilla Avenue, Television Road, Armour Road, The Parkway, Highway 7, Highway 28 and Highway 115."
        }
      );

    const transcript =
      typeof transcription?.text ===
      "string"
        ? transcription.text.trim()
        : "";

    const extractedLocation =
      await extractLocation(
        transcript,
        context.env.AI
      );

    const location =
      await geocodeLocation(
        extractedLocation,
        context.env.MAPTILER_KEY
      );

    return json({
      success: true,
      transcript,
      location,

      heardSpeech:
        transcript.length > 0,

      receivedBytes:
        audioBuffer.byteLength,

      contentType,

      time:
        new Date().toISOString()
    });
  } catch (error) {
    console.error(
      "Audio processing failed:",
      error
    );

    return json(
      {
        success: false,

        error:
          "Cloudflare could not process the audio.",

        details:
          error instanceof Error
            ? error.message
            : "Unknown error"
      },

      500
    );
  }
}
