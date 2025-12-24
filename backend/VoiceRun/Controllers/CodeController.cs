using Microsoft.AspNetCore.Mvc;
using VoiceCode.Backend.Models;
using VoiceCode.Backend.Services;

namespace VoiceCode.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CodeController : ControllerBase
{
    private readonly IOllamaClient _ollama;

    public CodeController(IOllamaClient ollama)
    {
        _ollama = ollama;
    }

    // POST api/code/generate
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        try
        {
            var result = await _ollama.GenerateAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            // For dev: you can log ex here
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
