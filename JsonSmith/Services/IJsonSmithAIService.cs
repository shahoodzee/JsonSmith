using System.Text.Json;
using JsonSmith.Models;

namespace JsonSmith.Services
{
    public interface IJsonSmithAIService
    {
        Task<string> ExtractJsonAsync(string imageUrl);
        Task<JsonSmithAIHealthResult> CheckHealthAsync();
        Task<JsonElement[]> GenerateSamplesAsync(string key, string type, JsonElement seed, int frequency);
    }
}
