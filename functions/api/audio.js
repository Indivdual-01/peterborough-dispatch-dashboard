export async function onRequestGet(context) {
  return Response.json({
    success: true,
    message: "Peterborough Dispatch AI backend is working.",
    aiBindingConnected: Boolean(context.env.AI),
    endpoint: "/api/audio",
    time: new Date().toISOString()
  });
}

export async function onRequestPost(context) {
  return Response.json({
    success: true,
    message: "Audio endpoint is ready for transcription.",
    aiBindingConnected: Boolean(context.env.AI),
    time: new Date().toISOString()
  });
}
