using System.Text.Json.Serialization;
using VoiceCode.Backend.Services;
using VoiceRun.Models;

var builder = WebApplication.CreateBuilder(args);

var workspaceRoot = Path.Combine(Directory.GetCurrentDirectory(), "GeneratedApp");
Directory.CreateDirectory(workspaceRoot);

builder.Services.AddSingleton(new WorkspaceOptions { WorkspaceRoot = workspaceRoot });

// CORS so your frontend can call the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins", policy =>
    {
        policy
            .AllowAnyOrigin()     
            .AllowAnyMethod()     
            .AllowAnyHeader();   
    });
});

builder.Services.AddControllers();
// HttpClient + Ollama client service
builder.Services.AddSingleton<IOllamaClient, OllamaClient>();

var app = builder.Build();
app.MapGet("/", () => "VoiceCode backend is running");

app.UseCors("AllowAllOrigins");
app.MapControllers();

app.Run();
