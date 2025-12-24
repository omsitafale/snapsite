using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using VoiceCode.Backend.Models;

namespace VoiceCode.Backend.Services;

public class OllamaClient : IOllamaClient
{
    private const string OllamaUrl = "http://127.0.0.1:11434/api/chat";
    private const string ModelName = "deepseek-v3.1:671b-cloud";

    public OllamaClient()
    {
    }

    public async Task<GenerateResponse> GenerateAsync(GenerateRequest req)
    {
        bool isEdit = req.IsEdit && req.CurrentFiles is not null && req.CurrentFiles.Any();

        string systemPrompt;
        string userPrompt;

        if (!isEdit)
        {
            // Initial project generation
            systemPrompt = """
            You are a code generator for small HTML/CSS/JS web apps.

            You MUST respond with ONLY a JSON object, wrapped in triple backticks.

            JSON shape:
            {
              "files": [
                { "name": "index.html", "content": "<!DOCTYPE html>..." },
                { "name": "style.css", "content": "/* CSS here */" },
                { "name": "app.js", "content": "// JS here" }
              ],
              "run": {
                "command": "serve /app",
                "preview_port": 8080
              },
              "explain": "Short explanation of what you built."
            }

            Rules:
            - Only generate HTML, CSS and JavaScript.
            - Use filenames index.html, style.css and app.js unless the user asks otherwise.
            - For styles that might change later (like button styles), wrap them in comment markers:

              /* AI_ZONE:button-styles-start */
              button { background:#ddd; color:#000; }
              /* AI_ZONE:button-styles-end */

            - Do NOT output any text outside the JSON.
            - Always wrap the JSON in triple backticks ```json ... ```.

            """;

            userPrompt = $"""
            Create a small HTML/CSS/JS web app based on this request:

            "{req.Prompt}"

            The app should be self-contained and use index.html, style.css and app.js.
            """;
        }
        else
        {
            // Edit mode (replace_region edits)
            var currentFilesJson = JsonSerializer.Serialize(
                req.CurrentFiles,
                new JsonSerializerOptions { WriteIndented = false });

            systemPrompt = """
            You are a code editor for small HTML/CSS/JS web apps.

            You MUST respond with ONLY a JSON object, wrapped in triple backticks.

            JSON shape:
            {
              "edits": [
                {
                  "file": "style.css",
                  "action": "replace_region",
                  "region": "AI_ZONE:button-styles",
                  "content": "button { background: orange; color: white; }"
                }
              ],
              "explain": "Short explanation of what you changed."
            }

            Rules:
            - Use "replace_region" edits targeting existing regions that look like:
                /* AI_ZONE:button-styles-start */
                ... old content ...
                /* AI_ZONE:button-styles-end */
            - "region" field should match the base name, e.g. "AI_ZONE:button-styles".
            - Do NOT regenerate whole files here, only edits.
            - Do NOT output anything outside the JSON.
            - Always wrap the JSON in triple backticks ```json ... ```.

            """;

            userPrompt = $"""
            Existing files (JSON):
            {currentFilesJson}

            User request:
            "{req.Prompt}"

            Return ONLY the edits needed to satisfy the user request.
            """;
        }

        var body = new
        {
            model = ModelName,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            },
            stream = false
        };

        var jsonBody = JsonSerializer.Serialize(body);

        using var http = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(5)   // or 3, up to you
        };
        HttpResponseMessage httpResponse;

        Console.WriteLine($"[OllamaClient] Calling: {OllamaUrl}");

        try
        {
            httpResponse = await http.PostAsync(OllamaUrl,new StringContent(jsonBody, Encoding.UTF8, "application/json"));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OllamaClient] EXCEPTION calling Ollama: {ex.GetType().Name} - {ex.Message}");
            throw;
        }

        var responseText = await httpResponse.Content.ReadAsStringAsync();
        Console.WriteLine($"[OllamaClient] Status: {httpResponse.StatusCode}");

        if (!httpResponse.IsSuccessStatusCode)
        {
            throw new Exception($"Ollama error: {httpResponse.StatusCode} - {responseText}");
        }

        using var doc = JsonDocument.Parse(responseText);
        if (!doc.RootElement.TryGetProperty("message", out var msgEl) || !msgEl.TryGetProperty("content", out var contentEl))
        {
            throw new Exception("Unexpected Ollama response (no message.content).");
        }

        var modelOutput = contentEl.GetString() ?? "";
        var json = ExtractJsonFromText(modelOutput) ?? throw new Exception("Could not find JSON in model output.");

        var genResp = JsonSerializer.Deserialize<GenerateResponse>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        genResp.IsEdit = true;
        if (genResp is null)
            throw new Exception("Failed to deserialize GenerateResponse.");

        return genResp;
    }

    // Helper: extract JSON inside ``` ``` fences
    private static string? ExtractJsonFromText(string text)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(text)) return null;

            var m = Regex.Match(text, @"```(?:json)?\s*(\{[\s\S]*\})\s*```");
            if (m.Success)
                return m.Groups[1].Value;

            var m2 = Regex.Match(text, @"(\{[\s\S]*\})");
            if (m2.Success)
                return m2.Groups[1].Value;

            return null;
        }
        catch (Exception ex)
        {

            throw;
        }
    }
}
