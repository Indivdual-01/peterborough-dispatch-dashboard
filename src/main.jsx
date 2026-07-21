import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Map from "./Map.jsx";
import {
  startListening,
  stopListening
} from "./tabAudioCapture.js";
import "./style.css";

function App() {
  const [isListening, setIsListening] = useState(false);
  const [audioStatus, setAudioStatus] = useState("Ready");
  const [transcripts, setTranscripts] = useState([]);
  const [audioError, setAudioError] = useState("");

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  function handleTranscript(transcript) {
    if (!transcript?.trim()) return;

    const newTranscript = {
      text: transcript.trim(),
      time: new Date().toLocaleTimeString()
    };

    setTranscripts((previous) =>
      [newTranscript, ...previous].slice(0, 10)
    );
  }

  function handleAudioStatus(status) {
    if (status === "listening") {
      setIsListening(true);
      setAudioStatus("Listening to selected tab");
    } else if (status === "selecting") {
      setAudioStatus("Select the audio tab");
    } else if (status === "stopped") {
      setIsListening(false);
      setAudioStatus("Stopped");
    } else if (status === "error") {
      setIsListening(false);
      setAudioStatus("Audio error");
    }
  }

  function handleAudioError(error) {
    console.error("Audio capture error:", error);

    setAudioError(
      error instanceof Error
        ? error.message
        : "An audio error occurred."
    );

    setIsListening(false);
    setAudioStatus("Audio error");
  }

  function handleDispatchButton() {
    if (isListening) {
      stopListening();
      setIsListening(false);
      setAudioStatus("Stopped");
      return;
    }

    setAudioError("");
    setAudioStatus("Waiting for tab selection");

    startListening({
      onTranscript: handleTranscript,
      onStatus: handleAudioStatus,
      onError: handleAudioError
    }).catch(handleAudioError);
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h1>
          Peterborough
          <br />
          Dispatch Dashboard
        </h1>

        <div className="status">
          ● System Online
        </div>

        <input
          type="text"
          placeholder="Search address..."
        />

        <button onClick={handleDispatchButton}>
          {isListening
            ? "■ Stop Listening"
            : "▶ Live Dispatch"}
        </button>

        <div className="audio-status">
          {audioStatus}
        </div>

        {audioError && (
          <div className="audio-error">
            {audioError}
          </div>
        )}

        <div className="panel transcript-panel">
          <h2>AI Transcript</h2>

          {transcripts.length === 0 ? (
            <p className="empty-message">
              No speech transcribed yet.
            </p>
          ) : (
            <div className="transcript-list">
              {transcripts.map((item, index) => (
                <div
                  className="transcript-item"
                  key={`${item.time}-${index}`}
                >
                  <span className="transcript-time">
                    {item.time}
                  </span>

                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Recent Incidents</h2>

          <p className="empty-message">
            No mapped incidents yet.
          </p>
        </div>
      </div>

      <Map />
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);
