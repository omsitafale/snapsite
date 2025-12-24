namespace VoiceCode.Backend.Models;

public class GenerateRequest
{
    public string Prompt { get; set; } = "";
    public bool IsEdit { get; set; } = false;
    public List<FileModel>? CurrentFiles { get; set; }
}
