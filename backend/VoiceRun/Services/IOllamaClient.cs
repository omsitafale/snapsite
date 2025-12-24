using VoiceCode.Backend.Models;

namespace VoiceCode.Backend.Services;

public interface IOllamaClient
{
    Task<GenerateResponse> GenerateAsync(GenerateRequest request);
}
