using System.Net.Http.Headers;

namespace VoiceRun.Models
{
    public static class CommonModel
    {
        public static string OllamaURL { get; set; }
        public static string ModelName { get; set; }
    }
    public static class PromptTemplates
    {
        public static string GenerateSystemPrompt { get; set; } = "";
        public static string GenerateUserPrompt { get; set; } = "";
        public static string EditSystemPrompt { get; set; } = "";
        public static string EditUserPrompt { get; set; } = "";
    }
}
