let capturedStream = null;
let isListening = false;
let pendingUploads = new Set();

function getSupportedMimeType() {
  const choices = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  return (
    choices.find((type) =>
      MediaRecorder.isTypeSupported(type)
    ) || ""
  );
}

function recordSegment(
  stream,
  durationMs
) {
  return new Promise(
    (resolve, reject) => {
      const mimeType =
        getSupportedMimeType();

      const recorder =
        new MediaRecorder(
          stream,
          mimeType
            ? {
                mimeType,
                audioBitsPerSecond: 96000
              }
            : undefined
        );

      const chunks = [];
      let timerId = null;

      recorder.addEventListener(
        "dataavailable",
        (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        }
      );

      recorder.addEventListener(
        "error",
        (event) => {
          if (timerId) {
            window.clearTimeout(
              timerId
            );
          }

          reject(
            event.error ||
              new Error(
                "Audio recording failed."
              )
          );
        }
      );

      recorder.addEventListener(
        "stop",
        () => {
          if (timerId) {
            window.clearTimeout(
              timerId
            );
          }

          resolve(
            new Blob(chunks, {
              type:
                recorder.mimeType ||
                "audio/webm"
            })
          );
        }
      );

      recorder.start();

      timerId =
        window.setTimeout(() => {
          if (
            recorder.state !==
            "inactive"
          ) {
            recorder.stop();
          }
        }, durationMs);
    }
  );
}

async function uploadSegment(blob) {
  const response = await fetch(
    "/api/audio",
    {
      method: "POST",

      headers: {
        "Content-Type":
          blob.type ||
          "application/octet-stream"
      },

      body: blob
    }
  );

  const responseText =
    await response.text();

  let result = {};

  if (responseText) {
    try {
      result =
        JSON.parse(responseText);
    } catch {
      result = {
        error:
          responseText.length > 500
            ? `${responseText.slice(
                0,
                500
              )}…`
            : responseText
      };
    }
  }

  if (!response.ok) {
    const message =
      result?.details ||
      result?.error ||
      `Cloudflare returned HTTP ${response.status}.`;

    throw new Error(message);
  }

  if (
    result?.success === false
  ) {
    throw new Error(
      result?.details ||
        result?.error ||
        "Cloudflare could not process the audio."
    );
  }

  return result;
}

export async function startListening({
  onTranscript,
  onStatus,
  onError
}) {
  try {
    onStatus?.("selecting");

    capturedStream =
      await navigator.mediaDevices
        .getDisplayMedia({
          video: {
            displaySurface:
              "browser"
          },

          audio: true,

          /*
           * These are browser hints.
           * The browser may not enforce
           * every option.
           */
          selfBrowserSurface:
            "exclude",

          monitorTypeSurfaces:
            "exclude",

          surfaceSwitching:
            "exclude",

          systemAudio:
            "exclude"
        });

    const audioTrack =
      capturedStream
        .getAudioTracks()[0];

    const videoTrack =
      capturedStream
        .getVideoTracks()[0];

    if (!audioTrack) {
      capturedStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      capturedStream = null;

      throw new Error(
        'No audio was shared. Select the website tab and enable "Share tab audio".'
      );
    }

    const displaySurface =
      videoTrack
        ?.getSettings()
        ?.displaySurface;

    if (
      displaySurface &&
      displaySurface !== "browser"
    ) {
      capturedStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      capturedStream = null;

      throw new Error(
        "Please select the individual browser tab rather than your entire screen."
      );
    }

    const audioOnlyStream =
      new MediaStream([
        audioTrack
      ]);

    isListening = true;

    onStatus?.("listening");

    const stopHandler = () => {
      isListening = false;
      onStatus?.("stopped");
    };

    videoTrack?.addEventListener(
      "ended",
      stopHandler,
      {
        once: true
      }
    );

    audioTrack.addEventListener(
      "ended",
      stopHandler,
      {
        once: true
      }
    );

    while (
      isListening &&
      audioTrack.readyState ===
        "live"
    ) {
      const blob =
        await recordSegment(
          audioOnlyStream,
          30000
        );

      if (
        !isListening ||
        blob.size === 0
      ) {
        continue;
      }

      /*
       * Upload the completed segment
       * while the next segment begins
       * recording.
       */
      const upload =
        uploadSegment(blob)
          .then((result) => {
            if (
              result?.transcript
            ) {
              onTranscript?.(
                result.transcript,
                result
              );
            }
          })
          .catch((error) => {
            console.error(
              "Audio upload error:",
              error
            );

            onError?.(error);
          })
          .finally(() => {
            pendingUploads.delete(
              upload
            );
          });

      pendingUploads.add(upload);
    }
  } catch (error) {
    isListening = false;

    onStatus?.("error");
    onError?.(error);
  }
}

export function stopListening() {
  isListening = false;

  if (capturedStream) {
    capturedStream
      .getTracks()
      .forEach((track) =>
        track.stop()
      );

    capturedStream = null;
  }
}
