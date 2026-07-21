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
    confidence: 0
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

  const confidenceNumber =
    Number(location.confidence);

  const confidence = Number.isFinite(
    confidenceNumber
  )
    ? Math.min(
        1,
        Math.max(0, confidenceNumber)
      )
    : 0;

  const locationType =
    allowedTypes.has(location.locationType)
      ? location.locationType
      : "unknown";

  const locationText =
    typeof location.locationText === "string"
      ? location.locationText.trim()
      : "";

  const municipality =
    typeof location.municipality === "string"
      ? location.municipality.trim()
      : "";

  const hasLocation =
    Boolean(location.hasLocation) &&
    locationText.length > 0 &&
    confidence >= 0.5;

  return {
    hasLocation,
    locationText:
      hasLocation ? locationText : "",
    municipality:
      hasLocation ? municipality : "",
    locationType:
      hasLocation ? locationType : "unknown",
    confidence
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
              "You extract reported incident locations from emergency-service radio transcripts. " +
              "The geographic area is Peterborough, Ontario, Canada, Peterborough County, and nearby communities. " +
              "A valid location may be a civic address, intersection, road, highway, landmark, business, park, or public place. " +
              "Correct an obvious speech-transcription error only when the intended local place is clear. " +
              "Never invent or guess a location. " +
              "Return hasLocation false when no reliable location is spoken. " +
              "Do not treat a responding unit's movement, patrol route, current vehicle position, or destination without an incident as an incident location. " +
              "For an intersection, include both road names. " +
              "Use the clearest normalized location wording possible."
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

    /*
     * Cloudflare normally returns the JSON Mode
     * result as an object. This also handles a
     * string response safely.
     */
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

    /*
     * A location-extraction failure should not
     * prevent the transcript from appearing.
     */
    return createEmptyLocation();
  }
}

export async function onRequestGet(
  context
) {
  return jsonResponse({
    success: true,
    message:
      "Peterborough Dispatch transcription and location endpoint is ready.",
    aiBindingConnected: Boolean(
      context.env.AI
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

    const location =
      await extractLocation(
        transcript,
        context.env.AI
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
      "Audio transcription failed:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          "Cloudflare could not transcribe the audio.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error"
      },
      500
    );
  }
}
