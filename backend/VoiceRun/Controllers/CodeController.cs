using Microsoft.AspNetCore.Mvc;
using VoiceCode.Backend.Models;
using VoiceCode.Backend.Services;
using VoiceRun.Models;

namespace VoiceCode.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CodeController : ControllerBase
{
    private readonly IOllamaClient _ollama;
    private readonly string _workspaceRoot;

    public CodeController(IOllamaClient ollama, WorkspaceOptions opts)
    {
        _ollama = ollama;
        _workspaceRoot = opts.WorkspaceRoot;
    }

    // POST api/code/generate
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        try
        {
            // Ensure workspace folder exists
            Directory.CreateDirectory(_workspaceRoot);

            // If this is edit mode, load existing files from disk
            if (request.IsEdit)
            {
                var existingFiles = Directory
                    .GetFiles(_workspaceRoot)
                    .Select(f => new FileModel
                    {
                        Name = Path.GetFileName(f),
                        Content = System.IO.File.ReadAllText(f)
                    })
                    .ToList();

                request.CurrentFiles = existingFiles;
            }

            // Call Ollama
            var genResp = await _ollama.GenerateAsync(request);

            // ---------------------------
            //  CASE 1: NEW PROJECT
            // ---------------------------
            if (!request.IsEdit && genResp.Files != null)
            {
                foreach (var file in genResp.Files)
                {
                    var filePath = Path.Combine(_workspaceRoot, file.Name);
                    System.IO.File.WriteAllText(filePath, file.Content);
                }

                return Ok(new
                {
                    files = genResp.Files,
                    explain = genResp.Explain,
                    isEdit = true
                });
            }

            // ---------------------------
            //  CASE 2: EDIT MODE
            // ---------------------------
            if (request.IsEdit && genResp.Edits != null)
            {
                foreach (var edit in genResp.Edits)
                {
                    var filePath = Path.Combine(_workspaceRoot, edit.File);

                    if (!System.IO.File.Exists(filePath))
                        continue;

                    var oldContent = System.IO.File.ReadAllText(filePath);

                    var startTag = $"/* {edit.Region}-start */";
                    var endTag = $"/* {edit.Region}-end */";

                    var startIdx = oldContent.IndexOf(startTag);
                    var endIdx = oldContent.IndexOf(endTag);

                    if (startIdx == -1 || endIdx == -1)
                        continue;

                    var before = oldContent.Substring(0, startIdx + startTag.Length);
                    var after = oldContent.Substring(endIdx);

                    var newContent = $"{before}\n{edit.Content}\n{after}";

                    System.IO.File.WriteAllText(filePath, newContent);
                }

                // After edits load updated files
                var updatedFiles = Directory
                    .GetFiles(_workspaceRoot)
                    .Select(f => new FileModel
                    {
                        Name = Path.GetFileName(f),
                        Content = System.IO.File.ReadAllText(f)
                    })
                    .ToList();

                return Ok(new
                {
                    files = updatedFiles,
                    explain = genResp.Explain,
                    isEdit = true
                });
            }

            return Ok(genResp);
        }
        catch (Exception ex)
        {
            return Problem(ex.Message);
        }
    }


    // Quick health check
    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok("VoiceCode backend is running");
    }
}
