using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using VoiceCode.Backend.Models;
using VoiceRun.Models;

namespace VoiceCode.Backend.Services;

public class OllamaClient : IOllamaClient
{
    public async Task<GenerateResponse> GenerateAsync(GenerateRequest req)
    {
        bool isEdit = req.IsEdit && req.CurrentFiles is not null && req.CurrentFiles.Any();

        string systemPrompt;
        string userPrompt;

        if (!isEdit)
        {
            // Generation mode
            systemPrompt = PromptTemplates.GenerateSystemPrompt;

            userPrompt = PromptTemplates.GenerateUserPrompt
                .Replace("{PROMPT}", req.Prompt);
        }
        else
        {
            // Edit mode
            var currentFilesJson = JsonSerializer.Serialize(
                req.CurrentFiles,
                new JsonSerializerOptions { WriteIndented = false }
            );

            systemPrompt = PromptTemplates.EditSystemPrompt;

            userPrompt = PromptTemplates.EditUserPrompt
                .Replace("{PROMPT}", req.Prompt)
                .Replace("{CURRENT_FILES}", currentFilesJson);
        }
        var body = new
        {
            model = CommonModel.ModelName,
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


        try
        {
            httpResponse = await http.PostAsync(CommonModel.OllamaURL, new StringContent(jsonBody, Encoding.UTF8, "application/json"));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OllamaClient] EXCEPTION calling Ollama: {ex.GetType().Name} - {ex.Message}");
            throw;
        }

        var responseText = await httpResponse.Content.ReadAsStringAsync();

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
