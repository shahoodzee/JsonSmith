using JsonSmith.Models;

namespace JsonSmith.Services
{
    public interface IJsonSmithAIService
    {
        Task<string> ExtractJsonAsync(string imageUrl);
        Task<JsonSmithAIHealthResult> CheckHealthAsync();
    }
}
