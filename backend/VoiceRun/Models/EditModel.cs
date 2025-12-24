namespace VoiceCode.Backend.Models;

public class EditModel
{
    public string File { get; set; } = "";
    public string Action { get; set; } = "";  // "replace_region"
    public string Region { get; set; } = "";  // e.g. "AI_ZONE:button-styles"
    public string Content { get; set; } = "";
}
