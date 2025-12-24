import React, { useState, useRef, useEffect } from "react";

type FileModel = {
  name: string;
  content: string;
};

type GenerateResponse = {
  files: FileModel[] | null;
  explain: string | null;
  isEdit?: boolean;
};

const API_BASE = "https://localhost:44327"; // your backend

function App() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<FileModel[]>([]);
  const [explain, setExplain] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Voice mode states
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // -------------------------------------------------------------------
  //  Voice Recognition Setup
  // -------------------------------------------------------------------
  const setupRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("This browser does not support voice input.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;

    return rec;
  };

  // Start listening
  const startListening = () => {
    if (!voiceMode) return;
    if (!recognitionRef.current) recognitionRef.current = setupRecognition();

    const rec = recognitionRef.current;
    if (!rec) return;

    setListening(true);
    rec.start();

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);

      // Auto-generate → auto-preview
      autoGenerateFromVoice(transcript);
    };

    rec.onerror = () => {
      setListening(false);
      if (voiceMode) setTimeout(startListening, 800); // retry
    };

    rec.onend = () => {
      setListening(false);
      if (voiceMode) setTimeout(startListening, 500);
    };
  };

  // -------------------------------------------------------------------
  //  Auto-generate when voice input is received
  // -------------------------------------------------------------------
  const autoGenerateFromVoice = async (text: string) => {
    await handleGenerate(text, true);
    handleRun(); // auto-preview
  };

  // -------------------------------------------------------------------
  //  Generate (used by both voice + text)
  // -------------------------------------------------------------------
  const handleGenerate = async (customPrompt?: string, isVoice?: boolean) => {
  setLoading(true);
  setError(null);
  setPreviewUrl(null);

  const currentPrompt = customPrompt ?? prompt;
  const isEdit = files.length > 0;

  // STOP if prompt is empty (in text mode)
  if (!voiceMode && currentPrompt.trim() === "") {
    setError("Please enter a prompt.");
    setLoading(false);
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/code/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: currentPrompt,
        isEdit,
        currentFiles: isEdit ? files : null,
      }),
    });

    // Handle NON-JSON backend errors safely
    const text = await resp.text();

    if (!resp.ok) {
      // Backend error (like "Prompt is required")
      setError(text);
      setLoading(false);
      return;
    }

    const data: GenerateResponse = JSON.parse(text);

    const newFiles = data.files || [];
    setFiles(newFiles);
    setExplain(data.explain || null);

    setActiveFileName(newFiles[0]?.name || null);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  // -------------------------------------------------------------------
  //  Run (Preview)
  // -------------------------------------------------------------------
  const handleRun = () => {
    if (!files || files.length === 0) return;

    const html = files.find((f) => f.name === "index.html")?.content;
    const css = files.find((f) => f.name === "style.css")?.content;
    const js = files.find((f) => f.name === "app.js")?.content;

    if (!html) {
      setError("index.html missing.");
      return;
    }

    let finalHtml = html;

    if (css) {
      finalHtml = finalHtml.replace("</head>", `<style>${css}</style></head>`);
    }
    if (js) {
      finalHtml = finalHtml.replace("</body>", `<script>${js}</script></body>`);
    }

    const blob = new Blob([finalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  // -------------------------------------------------------------------
  //  Start voice mode automatically re-listening
  // -------------------------------------------------------------------
  useEffect(() => {
    if (voiceMode) startListening();
    else setListening(false);
  }, [voiceMode]);

  const activeFile =
    files.find((f) => f.name === activeFileName) || files[0] || null;

  // -------------------------------------------------------------------
  //  UI
  // -------------------------------------------------------------------
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#111",
        color: "white",
      }}
    >
      {/* LEFT PANEL */}
      <div
        style={{
          width: "50%",
          height: "100%",
          padding: "12px",
          boxSizing: "border-box",
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <h2>VoiceCode</h2>

        {/* Mode Toggle */}
        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={() => setVoiceMode((v) => !v)}
            style={{
              padding: "6px 12px",
              background: voiceMode ? "#C62828" : "#0078d4",
              border: "none",
              borderRadius: "4px",
              color: "white",
              cursor: "pointer",
            }}
          >
            {voiceMode ? "Stop Voice Mode" : "Start Voice Mode"}
          </button>

          {voiceMode && (
            <span style={{ marginLeft: "10px", color: "#0f0" }}>
              {listening ? "Listening..." : "Waiting..."}
            </span>
          )}
        </div>

        {/* PROMPT */}
        {!voiceMode && (
          <>
            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Prompt
              <textarea
                value={prompt}
                placeholder="Create a simple calculator UI..."
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: "4px",
                  boxSizing: "border-box",
                  padding: "6px",
                }}
              />
            </label>

           <div style={{ display: "flex", flexDirection: "row", gap: "10px", marginTop: "12px" }}>
  <button
    onClick={() => handleGenerate()}
    disabled={loading}
    style={{
      padding: "8px 16px",
      background: "#0078d4",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      minWidth: "100px",
    }}
  >
    {loading ? "Generating..." : "Generate"}
  </button>

  <button
    onClick={handleRun}
    disabled={files.length === 0}
    style={{
      padding: "8px 16px",
      background: "#444",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      minWidth: "80px",
    }}
  >
    Run
  </button>
</div>
          </>
        )}

        {error && <div style={{ color: "red" }}>{error}</div>}
        {explain && (
          <div
            style={{
              marginTop: "8px",
              fontSize: "0.85rem",
              background: "#222",
              padding: "6px",
              borderRadius: "4px",
            }}
          >
            {explain}
          </div>
        )}

        {/* FILE TABS */}
        {files.length > 0 && !voiceMode && (
          <>
            <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setActiveFileName(f.name)}
                  style={{
                    padding: "4px 8px",
                    border:
                      activeFileName === f.name
                        ? "2px solid #0078d4"
                        : "1px solid #ccc",
                    background: "#1a1a1a",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {activeFile && (
              <textarea
                value={activeFile.content}
                onChange={(e) =>
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.name === activeFile.name
                        ? { ...f, content: e.target.value }
                        : f
                    )
                  )
                }
                style={{
                  flex: 1,
                  marginTop: "8px",
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  background: "#1d1d1d",
                  color: "white",
                  padding: "8px",
                }}
              />
            )}
          </>
        )}
      </div>

      {/* RIGHT PANEL (PREVIEW) */}
      <div
        style={{
          width: "50%",
          padding: "12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <h3>Preview</h3>

        <div
          style={{
            flex: 1,
            width: "100%",
            background: "#000",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {!previewUrl ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#aaa",
              }}
            >
              Run to preview
            </div>
          ) : (
            <iframe
              src={previewUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "white",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
