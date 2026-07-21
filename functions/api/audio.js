function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  let binary = "";

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    const chunk = bytes.subarray(
      index,
      index + chunkSize
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function createEmptyLocation() {
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
    geocodingConfidence: 0
  };
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") {
    return createEmptyLocation();
  }

  const allowedTypes = new Set([
    "address",
    "intersection",
    "road",
    "highway",
    "landmark",
    "unknown"
  ]);

  const confidenceNumber = Number(
    location.confidence
  );

  const confidence = Number.isFinite(
    confidenceNumber
  )
    ? Math.min(1, Math.max(0, confidenceNumber))
    : 0;

  const locationText =
    typeof location.locationText === "string"
      ? location.locationText.trim()
      : "";

  const municipality =
    typeof location.municipality === "string"
      ? location.municipality.trim()
      : "";

  const locationType =
    allowedTypes.has(location.locationType)
      ? location.locationType
      : "unknown";

  const hasLocation =
    Boolean(location.hasLocation) &&
    locationText.length > 0 &&
    confidence >= 0.5;

  return {
    hasLocation,
    locationText: hasLocation
      ? locationText
      : "",
    municipality: hasLocation
      ? municipality
      : "",
    locationType: hasLocation
      ? locationType
      : "unknown",
    confidence,
    geocoded: false,
    latitude: null,
    longitude: null,
    mapLabel: "",
    geocodingConfidence: 0
  };
}

async function extractLocation(
  transcript,
  ai
) {
  if (
    typeof transcript !== "string" ||
    transcript.trim().length === 0
  ) {
    return createEmptyLocation();
  }

  try {
    const extraction = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          {
            role: "system",
            content:
              "Extract the reported incident location from an emergency-service radio transcript. " +
              "The geographic area is Peterborough, Ontario, Peterborough County and nearby communities. " +
              "A valid location may be an address, intersection, road, highway, landmark, business, park or public place. " +
              "Correct obvious transcription mistakes only when the intended local location is clear. " +
              "Never invent or guess a location. " +
              "Return hasLocation false when no reliable location is spoken. " +
              "Do not use a responding unit's movement, patrol route or vehicle position as an incident location. " +
              "For an intersection, include both road names."
          },
          {
            role: "user",
            content:
              "Extract the incident location from this transcript:\n\n" +
              transcript
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

    let location = extraction?.response;

    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch {
        return createEmptyLocation();
      }
    }

    return normalizeLocation(location);
  } catch (error) {
    console.error(
      "Location extraction failed:",
      error
    );

    return createEmptyLocation();
  }
}

function distanceKilometres(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadius = 6371;
  const toRadians = (degrees) =>
    degrees * Math.PI / 180;

  const latitudeDifference = toRadians(
    latitude2 - latitude1
  );

  const longitudeDifference = toRadians(
    longitude2 - longitude1
  );

  const firstLatitude = toRadians(latitude1);
  const secondLatitude = toRadians(latitude2);

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation)
    )
  );
}

async function geocodeLocation(
  location,
  mapTilerKey
) {
  if (
    !mapTilerKey ||
    !location.hasLocation ||
    location.confidence < 0.65
  ) {
    return location;
  }

  const queryParts = [
    location.locationText,
    location.municipality ||
      "Peterborough County",
    "Ontario",
    "Canada"
  ];

  const query = [
    ...new Set(
      queryParts
        .map((part) => part?.trim())
        .filter(Boolean)
    )
  ].join(", ");

  try {
    const url = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`
    );

    url.searchParams.set(
      "key",
      mapTilerKey
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
      "limit",
      "5"
    );

    url.searchParams.set(
      "proximity",
      "-78.3197,44.3091"
    );

    url.searchParams.set(
      "autocomplete",
      "false"
    );

    url.searchParams.set(
      "fuzzyMatch",
      "true"
    );

    const response = await fetch(
      url.toString()
    );

    if (!response.ok) {
      console.error(
        "MapTiler geocoding failed:",
        response.status
      );

      return location;
    }

    const data = await response.json();

    const features = Array.isArray(
      data?.features
    )
      ? data.features
      : [];

    const candidates = features
      .map((feature) => {
        const center = feature?.center;

        if (
          !Array.isArray(center) ||
          center.length < 2
        ) {
          return null;
        }

        const longitude = Number(center[0]);
        const latitude = Number(center[1]);
        const relevance = Number(
          feature.relevance
        );

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        const distance =
          distanceKilometres(
            44.3091,
            -78.3197,
            latitude,
            longitude
          );

        return {
          feature,
          latitude,
          longitude,
          relevance:
            Number.isFinite(relevance)
              ? relevance
              : 0,
          distance
        };
      })
      .filter(Boolean)
      .filter(
        (candidate) =>
          candidate.distance <= 160 &&
          candidate.relevance >= 0.4
      )
      .sort(
        (first, second) =>
          second.relevance -
            first.relevance ||
          first.distance -
            second.distance
      );

    const bestMatch = candidates[0];

    if (!bestMatch) {
      return location;
    }

    return {
      ...location,
      geocoded: true,
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
      mapLabel:
        bestMatch.feature.place_name ||
        location.locationText,
      geocodingConfidence:
        bestMatch.relevance
    };
  } catch (error) {
    console.error(
      "MapTiler geocoding error:",
      error
    );

    return location;
  }
}

export async function onRequestGet(
  context
) {
  return jsonResponse({
    success: true,
    message:
      "Peterborough Dispatch transcription, location and geocoding endpoint is ready.",
    aiBindingConnected: Boolean(
      context.env.AI
    ),
    mapTilerConnected: Boolean(
      context.env.MAPTILER_KEY
    ),
    endpoint: "/api/audio",
    time: new Date().toISOString()
  });
}

export async function onRequestPost(
  context
) {
  try {
    if (!context.env.AI) {
      return jsonResponse(
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
      ) || "application/octet-stream";

    const audioBuffer =
      await context.request.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return jsonResponse(
        {
          success: false,
          error: "No audio was received."
        },
        400
      );
    }

    if (
      audioBuffer.byteLength >
      8 * 1024 * 1024
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "The audio recording is too large."
        },
        413
      );
    }

    const audioBase64 =
      arrayBufferToBase64(audioBuffer);

    const transcription =
      await context.env.AI.run(
        "@cf/openai/whisper-large-v3-turbo",
        {
          audio: audioBase64,
          task: "transcribe",
          language: "en",
          vad_filter: true,
          beam_size: 8,
          condition_on_previous_text: true,
          no_speech_threshold: 0.6,

          initial_prompt:
            "Emergency services radio dispatch in Peterborough, Ontario, Canada. " +
            "Speakers may use police, fire, EMS and OPP radio terminology, unit numbers, " +
            "ten-codes and short clipped sentences. Common phrases include 10-4, copy, " +
            "dispatch, respond, en route, scene, collision, traffic stop, ambulance, " +
            "fire department and Peterborough Police. Possible locations include " +
            "Lansdowne Street, Monaghan Road, Chemong Road, Parkhill Road, " +
            "Ashburnham Drive, Water Street, George Street, Charlotte Street, " +
            "Sherbrooke Street, Clonsilla Avenue, Television Road, Armour Road, " +
            "The Parkway, Highway 7, Highway 28 and Highway 115."
        }
      );

    const transcript =
      typeof transcription?.text === "string"
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

    return jsonResponse({
      success: true,
      transcript,
      location,
      heardSpeech:
        transcript.length > 0,
      receivedBytes:
        audioBuffer.byteLength,
      contentType,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error(
      "Audio processing failed:",
      error
    );

    return jsonResponse(
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
