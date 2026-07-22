import React, {
  useEffect,
  useState
} from "react";

import {
  createRoot
} from "react-dom/client";

import Map from "./Map.jsx";

import {
  startListening,
  stopListening
} from "./tabAudioCapture.js";

import "./style.css";

function createIncidentId(location) {
  const latitude =
    Number(location.latitude).toFixed(5);

  const longitude =
    Number(location.longitude).toFixed(5);

  return `${latitude},${longitude}`;
}

function App() {
  const [
    isListening,
    setIsListening
  ] = useState(false);

  const [
    audioStatus,
    setAudioStatus
  ] = useState("Ready");

  const [
    transcripts,
    setTranscripts
  ] = useState([]);

  const [
    incidents,
    setIncidents
  ] = useState([]);

  const [
    audioError,
    setAudioError
  ] = useState("");

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  function addMappedIncident(
    transcript,
    result
  ) {
    const location =
      result?.location;

    if (
      !location?.geocoded ||
      !Number.isFinite(
        Number(location.latitude)
      ) ||
      !Number.isFinite(
        Number(location.longitude)
      )
    ) {
      return;
    }

    const incident = {
      id:
        createIncidentId(location),

      transcript:
        transcript.trim(),

      locationText:
        location.locationText ||
        "Detected location",

      mapLabel:
        location.mapLabel ||
        location.locationText ||
        "Detected location",

      municipality:
        location.municipality || "",

      locationType:
        location.locationType ||
        "unknown",

      latitude:
        Number(location.latitude),

      longitude:
        Number(location.longitude),

      confidence:
        Number(location.confidence) || 0,

      geocodingConfidence:
        Number(
          location.geocodingConfidence
        ) || 0,

      geocodingSource:
        location.geocodingSource || "",

      time:
        new Date().toLocaleTimeString(),

      receivedAt:
        result?.time ||
        new Date().toISOString()
    };

    setIncidents((previous) => {
      const existingIndex =
        previous.findIndex(
          (item) =>
            item.id === incident.id
        );

      if (existingIndex >= 0) {
        const updated = [
          ...previous
        ];

        updated.splice(
          existingIndex,
          1
        );

        return [
          incident,
          ...updated
        ].slice(0, 20);
      }

      return [
        incident,
        ...previous
      ].slice(0, 20);
    });
  }

  function handleTranscript(
    transcript,
    result
  ) {
    if (!transcript?.trim()) {
      return;
    }

    const location =
      result?.location;

    const newTranscript = {
      text:
        transcript.trim(),

      time:
        new Date()
          .toLocaleTimeString(),

      hasLocation:
        Boolean(
          location?.hasLocation
        ),

      geocoded:
        Boolean(
          location?.geocoded
        ),

      locationText:
        location?.locationText || "",

      mapLabel:
        location?.mapLabel || "",

      confidence:
        Number(
          location?.confidence
        ) || 0
    };

    setTranscripts((previous) =>
      [
        newTranscript,
        ...previous
      ].slice(0, 12)
    );

    addMappedIncident(
      transcript,
      result
    );
  }

  function handleAudioStatus(
    status
  ) {
    if (status === "listening") {
      setIsListening(true);

      setAudioStatus(
        "Listening to selected tab"
      );

      return;
    }

    if (status === "selecting") {
      setAudioStatus(
        "Select the audio tab"
      );

      return;
    }

    if (status === "stopped") {
      setIsListening(false);
      setAudioStatus("Stopped");
      return;
    }

    if (status === "error") {
      setIsListening(false);
      setAudioStatus("Audio error");
    }
  }

  function handleAudioError(
    error
  ) {
    console.error(
      "Audio capture error:",
      error
    );

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

    setAudioStatus(
      "Waiting for tab selection"
    );

    startListening({
      onTranscript:
        handleTranscript,

      onStatus:
        handleAudioStatus,

      onError:
        handleAudioError
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

        <button
          onClick={
            handleDispatchButton
          }
        >
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
              {transcripts.map(
                (item, index) => (
                  <div
                    className="transcript-item"
                    key={
                      `${item.time}-${index}`
                    }
                  >
                    <span className="transcript-time">
                      {item.time}
                    </span>

                    <p>
                      {item.text}
                    </p>

                    {item.hasLocation && (
                      <div className="detected-location">
                        Location:{" "}
                        {item.locationText}

                        {item.geocoded
                          ? " — mapped"
                          : " — not mapped"}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="panel incidents-panel">
          <h2>Recent Incidents</h2>

          {incidents.length === 0 ? (
            <p className="empty-message">
              No mapped incidents yet.
            </p>
          ) : (
            <div className="incident-list">
              {incidents.map(
                (incident) => (
                  <div
                    className="incident-item"
                    key={incident.id}
                  >
                    <strong>
                      {incident.mapLabel}
                    </strong>

                    <span>
                      {incident.time}
                    </span>

                    <small>
                      Location confidence:{" "}
                      {Math.round(
                        incident.confidence *
                        100
                      )}
                      %
                    </small>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <Map incidents={incidents} />
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);
