export async function onRequestGet() {
  return Response.json({
    success: true,
    message: "Peterborough Dispatch AI backend is working.",
    endpoint: "/api/audio",
    time: new Date().toISOString()
  });
}

export async function onRequestPost(context) {
  try {
    const audio = await context.request.arrayBuffer();

    if (audio.byteLength === 0) {
      return Response.json(
        {
          success: false,
          error: "No audio was received."
        },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: "Audio received successfully.",
      receivedBytes: audio.byteLength,
      time: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "The audio upload could not be processed."
      },
      { status: 500 }
    );
  }
}
