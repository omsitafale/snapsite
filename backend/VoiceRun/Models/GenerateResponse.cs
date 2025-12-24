namespace VoiceCode.Backend.Models;

public class GenerateResponse
{
    public List<FileModel>? Files { get; set; }
    public List<EditModel>? Edits { get; set; }
    public RunInfo? Run { get; set; }
    public string? Explain { get; set; }
    public bool IsEdit { get; set; }
}
