using Microsoft.Extensions.Options;
using JsonSmith.Models;
using System.Text.Json;

namespace JsonSmith.Services
{
    public class JsonSmithAIService : IJsonSmithAIService
    {
        private readonly HttpClient _httpClient;
        private readonly JsonSmithAISettings _settings;

        public JsonSmithAIService(HttpClient httpClient, IOptions<JsonSmithAISettings> settings)
        {
            _httpClient = httpClient;
            _settings = settings.Value;

            _httpClient.BaseAddress = new Uri(_settings.BASE_URL);
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", _settings.API_KEY);
            _httpClient.DefaultRequestHeaders.Add("accept", "application/json");
        }

        public async Task<string> ExtractJsonAsync(string imageUrl)
        {
            var formData = new MultipartFormDataContent();
            formData.Add(new StringContent(imageUrl), "image_url");

            var response = await _httpClient.PostAsync("extract-json", formData);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"AI Service Error: {response.StatusCode} - {errorContent}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            
            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                if (doc.RootElement.TryGetProperty("Data", out var dataElement) &&
                    dataElement.ValueKind != JsonValueKind.Undefined &&
                    dataElement.ValueKind != JsonValueKind.Null)
                {
                    // API returns structured JSON in Data (object/array/primitive), not an escaped JSON string.
                    if (dataElement.ValueKind == JsonValueKind.String)
                    {
                        var s = dataElement.GetString();
                        if (!string.IsNullOrEmpty(s))
                            return s.Trim();
                    }
                    else
                        return dataElement.GetRawText();
                }
                return responseContent;
            }
            catch (JsonException)
            {
                // Fallback to returning raw content if parsing fails
                return responseContent;
            }
        }
    }
}
