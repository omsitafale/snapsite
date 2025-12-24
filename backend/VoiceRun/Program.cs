using System.Text.Json.Serialization;
using VoiceCode.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

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
