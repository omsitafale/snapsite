import React, { useState } from "react";

type FileModel = {
  name: string;
  content: string;
};

type EditModel = {
  file: string;
  action: string;   // "replace_region"
  region: string;   // e.g. "AI_ZONE:button-styles"
  content: string;
};

type GenerateResponse = {
  files: FileModel[] | null;
  edits: EditModel[] | null;
  run: { command: string; preview_port: number } | null;
  explain: string | null;
};
function applyEdits(files: FileModel[], edits: EditModel[]): FileModel[] {
  let updated = [...files];

  for (const edit of edits) {
    if (edit.action === "replace_region") {
      updated = updated.map((f) => {
        if (f.name !== edit.file) return f;

        const region = edit.region; // e.g. "AI_ZONE:button-styles"
        const startTag = `/* ${region}-start */`;
        const endTag = `/* ${region}-end */`;

        const startIndex = f.content.indexOf(startTag);
        const endIndex = f.content.indexOf(endTag);

        if (startIndex === -1 || endIndex === -1) {
          console.warn("Region markers not found for", edit.region);
          return f;
        }

        const before = f.content.slice(0, startIndex + startTag.length);
        const after = f.content.slice(endIndex);

        const newContent = `${before}\n${edit.content}\n${after}`;
        return { ...f, content: newContent };
      });
    }
  }

  return updated;
}

const API_BASE = "https://localhost:44327"; // 🔴 change this port to your backend port

function App() {
  const [prompt, setPrompt] = useState(
    "Create a simple calculator UI with HTML, CSS and JavaScript."
  );
  const [files, setFiles] = useState<FileModel[]>([]);
  const [explain, setExplain] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<boolean>(false);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const handleGenerate = async () => {
  setLoading(true);
  setError(null);
  setPreviewUrl(null);

  // 🔹 Decide mode based on whether we already have files
  const isEdit = files.length > 0;

  try {
    const resp = await fetch(`${API_BASE}/api/code/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        isEdit,                          // 👈 now correct
        currentFiles: isEdit ? files : null, // 👈 send files only in edit mode
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Backend error: ${resp.status} - ${txt}`);
    }

    const data: GenerateResponse = await resp.json();

    // If it's initial generation → use data.files
    // If it's edit mode → we expect data.edits and must apply them to existing files

    if (!isEdit) {
      // initial generation
      const newFiles = data.files || [];
      setFiles(newFiles);
      setExplain(data.explain || null);

      if (newFiles.length > 0) {
        setActiveFileName(newFiles[0].name);
      }
    } else {
      // edit mode
      if (data.edits && Array.isArray(data.edits)) {
        const updated = applyEdits(files, data.edits);
        setFiles(updated);
        setExplain(data.explain || null);
      } else {
        setError("No edits returned from backend.");
      }
    }
  } catch (err: any) {
    setError(err.message || "Unknown error");
  } finally {
    setLoading(false);
  }
};

  // Simple editor: update file content in state
  const updateFileContent = (name: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, content } : f))
    );
  };

  const handleRun = () => {
    if (!files || files.length === 0) return;

    const html = files.find((f) => f.name.toLowerCase() === "index.html")
      ?.content;
    const css = files.find((f) => f.name.toLowerCase() === "style.css")
      ?.content;
    const js = files.find((f) => f.name.toLowerCase() === "app.js")?.content;

    if (!html) {
      setError("index.html not found in files.");
      return;
    }

    // Inject CSS and JS into HTML
    let finalHtml = html;

    if (css) {
      if (finalHtml.includes("</head>")) {
        finalHtml = finalHtml.replace(
          "</head>",
          `<style>\n${css}\n</style>\n</head>`
        );
      } else {
        finalHtml =
          `<style>\n${css}\n</style>\n` +
          finalHtml; // fallback: prepend
      }
    }

    if (js) {
      if (finalHtml.includes("</body>")) {
        finalHtml = finalHtml.replace(
          "</body>",
          `<script>\n${js}\n</script>\n</body>`
        );
      } else {
        finalHtml += `\n<script>\n${js}\n</script>\n`; // fallback
      }
    }

    const blob = new Blob([finalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  const activeFile =
    files.find((f) => f.name === activeFileName) || files[0] || null;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      {/* Left panel: controls + editors */}
      <div
        style={{
          width: "50%",
          padding: "12px",
          boxSizing: "border-box",
          borderRight: "1px solid #ddd",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <h2>VoiceCode </h2>

        <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
          Prompt
          <textarea
            value={prompt}
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

        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{ padding: "6px 12px" }}
          >
            {loading ? "Generating..." : "Generate"}
          </button>

          <button
            onClick={handleRun}
            disabled={files.length === 0}
            style={{ padding: "6px 12px" }}
          >
            Run
          </button>
        </div>

        {error && (
          <div style={{ color: "red", fontSize: "0.85rem" }}>{error}</div>
        )}

        {explain && (
          <div
            style={{
              fontSize: "0.85rem",
              background: "#3b3b3b",
              padding: "6px",
              borderRadius: "4px",
            }}
          >
            <strong>Explain:</strong> {explain}
          </div>
        )}

        {/* File tabs */}
        {files.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setActiveFileName(f.name)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.85rem",
                    border:
                      activeFileName === f.name
                        ? "2px solid #0078d4"
                        : "1px solid #ccc",
                    background:
                      activeFileName === f.name ? "#1a1a1a" : "#1a1a1a",
                    cursor: "pointer",
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {activeFile && (
              <div style={{ marginTop: "8px", flex: 1, minHeight: 0 }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    marginBottom: "4px",
                    opacity: 0.7,
                  }}
                >
                  Editing: {activeFile.name}
                </div>
                <textarea
                  value={activeFile.content}
                  onChange={(e) =>
                    updateFileContent(activeFile.name, e.target.value)
                  }
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "250px",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    padding: "6px",
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Right panel: preview */}
      <div style={{ width: "50%", padding: "12px", boxSizing: "border-box" }}>
        <h3>Preview</h3>
        {!previewUrl && <div>Click "Run" to see preview here.</div>}
        {previewUrl && (
          <iframe
            src={previewUrl}
            title="Preview"
            style={{
              width: "100%",
              height: "90%",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
