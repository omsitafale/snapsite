using System.Text.Json.Serialization;

namespace VoiceCode.Backend.Models;

public class RunInfo
{
    public string Command { get; set; } = "";

    // bind JSON "preview_port" to .NET PreviewPort
    [JsonPropertyName("preview_port")]
    public int? PreviewPort { get; set; }
}
