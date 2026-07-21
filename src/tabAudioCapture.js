let capturedStream = null;
let isListening = false;
let pendingUploads = new Set();

function getSupportedMimeType() {
  const choices = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  return choices.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function recordSegment(stream, durationMs) {
  return new Promise((resolve, reject) => {
    const mimeType = getSupportedMimeType();

    const recorder = new MediaRecorder(
      stream,
      mimeType
        ? {
            mimeType,
            audioBitsPerSecond: 96000
          }
        : undefined
    );

    const chunks = [];

    recorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("error", event => {
      reject(event.error || new Error("Audio recording failed."));
    });

    recorder.addEventListener("stop", () => {
      resolve(
        new Blob(chunks, {
          type: recorder.mimeType || "audio/webm"
        })
      );
    });

    recorder.start();

    window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, durationMs);
  });
}

async function uploadSegment(blob) {
  const response = await fetch("/api/audio", {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "application/octet-stream"
    },
    body: blob
  });

  if (!response.ok) {
    throw new Error(`Audio upload failed: ${response.status}`);
  }

  return response.json();
}

export async function startListening({
  onTranscript,
  onStatus,
  onError
}) {
  try {
    capturedStream =
      await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser"
        },
        audio: true,

        // These are browser hints, not guaranteed restrictions.
        selfBrowserSurface: "exclude",
        monitorTypeSurfaces: "exclude",
        surfaceSwitching: "exclude",
        systemAudio: "exclude"
      });

    const audioTrack = capturedStream.getAudioTracks()[0];
    const videoTrack = capturedStream.getVideoTracks()[0];

    if (!audioTrack) {
      capturedStream.getTracks().forEach(track => track.stop());

      throw new Error(
        'No audio was shared. Select the website tab and enable "Share tab audio".'
      );
    }

    const displaySurface =
      videoTrack?.getSettings()?.displaySurface;

    if (displaySurface && displaySurface !== "browser") {
      capturedStream.getTracks().forEach(track => track.stop());

      throw new Error(
        "Please select the individual browser tab rather than your entire screen."
      );
    }

    const audioOnlyStream = new MediaStream([audioTrack]);

    isListening = true;
    onStatus?.("listening");

    const stopHandler = () => {
      isListening = false;
      onStatus?.("stopped");
    };

    videoTrack?.addEventListener("ended", stopHandler);
    audioTrack.addEventListener("ended", stopHandler);

    while (isListening && audioTrack.readyState === "live") {
      // Each recording is a complete, independent audio file.
      const blob = await recordSegment(
        audioOnlyStream,
        30000
      );

      if (!isListening || blob.size === 0) {
        continue;
      }

      // Do not wait before beginning the next recording.
      const upload = uploadSegment(blob)
        .then(result => {
          if (result.transcript) {
            onTranscript?.(result.transcript, result);
          }
        })
        .catch(error => {
          onError?.(error);
        })
        .finally(() => {
          pendingUploads.delete(upload);
        });

      pendingUploads.add(upload);
    }
  } catch (error) {
    isListening = false;
    onStatus?.("error");
    onError?.(error);
    throw error;
  }
}

export function stopListening() {
  isListening = false;

  if (capturedStream) {
    capturedStream
      .getTracks()
      .forEach(track => track.stop());

    capturedStream = null;
  }
}
