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

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function onRequestGet(context) {
  return jsonResponse({
    success: true,
    message: "Peterborough Dispatch transcription endpoint is ready.",
    aiBindingConnected: Boolean(context.env.AI),
    endpoint: "/api/audio",
    time: new Date().toISOString()
  });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.AI) {
      return jsonResponse(
        {
          success: false,
          error: "Cloudflare Workers AI is not connected."
        },
        500
      );
    }

    const contentType =
      context.request.headers.get("Content-Type") ||
      "application/octet-stream";

    const audioBuffer = await context.request.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return jsonResponse(
        {
          success: false,
          error: "No audio was received."
        },
        400
      );
    }

    if (audioBuffer.byteLength > 8 * 1024 * 1024) {
      return jsonResponse(
        {
          success: false,
          error: "The audio recording is too large."
        },
        413
      );
    }

    const audioBase64 =
      arrayBufferToBase64(audioBuffer);

    const result = await context.env.AI.run(
  "@cf/openai/whisper-large-v3-turbo",
  {
    audio: audioBase64,
    task: "transcribe",
    language: "en",
    vad_filter: true,

    // Higher beam search can improve accuracy,
    // although it may take slightly longer.
    beam_size: 8,

    // Helps Whisper use context inside the recording.
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
      typeof result?.text === "string"
        ? result.text.trim()
        : "";

    return jsonResponse({
      success: true,
      transcript,
      heardSpeech: transcript.length > 0,
      receivedBytes: audioBuffer.byteLength,
      contentType,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error("Audio transcription failed:", error);

    return jsonResponse(
      {
        success: false,
        error: "Cloudflare could not transcribe the audio.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error"
      },
      500
    );
  }
}
