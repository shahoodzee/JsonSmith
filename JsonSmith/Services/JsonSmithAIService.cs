using Microsoft.Extensions.Options;
using JsonSmith.Models;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

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

            if (!string.IsNullOrWhiteSpace(_settings.BASE_URL))
            {
                var baseUrl = _settings.BASE_URL.Trim();
                if (!baseUrl.EndsWith('/'))
                    baseUrl += "/";
                _httpClient.BaseAddress = new Uri(baseUrl);
            }

            if (!string.IsNullOrWhiteSpace(_settings.API_KEY))
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _settings.API_KEY);

            _httpClient.DefaultRequestHeaders.Add("accept", "application/json");
        }

        public async Task<string> ExtractJsonAsync(string imageUrl)
        {
            if (string.IsNullOrWhiteSpace(_settings.BASE_URL))
                throw new InvalidOperationException(
                    "JsonSmithAI:BASE_URL is not configured. Set it to http://127.0.0.1:8000/api/v1/ (trailing slash recommended).");

            if (string.IsNullOrWhiteSpace(_settings.API_KEY))
                throw new InvalidOperationException(
                    "JsonSmithAI:API_KEY is not configured. It must match API_KEY in JsonSmithAI .env (header X-API-Key).");

            var formData = new MultipartFormDataContent();
            formData.Add(new StringContent(imageUrl), "image_url");

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.PostAsync("extract-json", formData);
            }
            catch (HttpRequestException ex) when (ex.InnerException is System.Net.Sockets.SocketException)
            {
                throw new HttpRequestException(
                    "Cannot reach JsonSmithAI. Start the FastAPI service: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000",
                    ex);
            }

            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var message = TryReadApiMessage(responseContent)
                    ?? $"AI Service Error: {response.StatusCode} - {responseContent}";
                throw new HttpRequestException(message);
            }

            return ExtractDataPayload(responseContent);
        }

        public async Task<JsonElement[]> GenerateSamplesAsync(string key, string type, JsonElement seed, int frequency)
        {
            if (string.IsNullOrWhiteSpace(_settings.BASE_URL))
                throw new InvalidOperationException(
                    "JsonSmithAI:BASE_URL is not configured. Set it to http://127.0.0.1:8000/api/v1/ (trailing slash recommended).");

            if (string.IsNullOrWhiteSpace(_settings.API_KEY))
                throw new InvalidOperationException(
                    "JsonSmithAI:API_KEY is not configured. It must match API_KEY in JsonSmithAI .env (header X-API-Key).");

            var payload = new JsonObject
            {
                ["key"] = key,
                ["type"] = type,
                ["frequency"] = frequency,
                ["seed"] = seed.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    ? ""
                    : JsonNode.Parse(seed.GetRawText())
            };

            using var content = new StringContent(
                payload.ToJsonString(),
                Encoding.UTF8,
                "application/json");

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.PostAsync("generate-samples", content);
            }
            catch (HttpRequestException ex) when (ex.InnerException is System.Net.Sockets.SocketException)
            {
                throw new HttpRequestException(
                    "Cannot reach JsonSmithAI. Start the FastAPI service: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000",
                    ex);
            }

            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var message = TryReadDetailMessage(responseContent)
                    ?? TryReadApiMessage(responseContent)
                    ?? $"AI Service Error: {response.StatusCode} - {responseContent}";
                throw new HttpRequestException(message);
            }

            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                if (!doc.RootElement.TryGetProperty("values", out var valuesElement) ||
                    valuesElement.ValueKind != JsonValueKind.Array)
                {
                    throw new HttpRequestException("JsonSmithAI did not return a values array.");
                }

                return valuesElement.EnumerateArray()
                    .Select(v => v.Clone())
                    .ToArray();
            }
            catch (JsonException ex)
            {
                throw new HttpRequestException("Failed to parse generate-samples response.", ex);
            }
        }

        public async Task<JsonSmithAIHealthResult> CheckHealthAsync()
        {
            if (string.IsNullOrWhiteSpace(_settings.BASE_URL))
            {
                return new JsonSmithAIHealthResult
                {
                    IsOnline = false,
                    Message = "JsonSmithAI is not configured. Set JsonSmithAI__BASE_URL in environment variables."
                };
            }

            var healthUri = GetHealthCheckUri();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, healthUri);
                var response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    return new JsonSmithAIHealthResult
                    {
                        IsOnline = true,
                        Message = "JsonSmithAI is online and ready."
                    };
                }

                return new JsonSmithAIHealthResult
                {
                    IsOnline = false,
                    Message = $"JsonSmithAI responded with status {(int)response.StatusCode}."
                };
            }
            catch (OperationCanceledException)
            {
                return new JsonSmithAIHealthResult
                {
                    IsOnline = false,
                    Message = "JsonSmithAI health check timed out."
                };
            }
            catch (HttpRequestException)
            {
                return new JsonSmithAIHealthResult
                {
                    IsOnline = false,
                    Message = "JsonSmithAI is offline. Start the FastAPI service on port 8000."
                };
            }
            catch (Exception)
            {
                return new JsonSmithAIHealthResult
                {
                    IsOnline = false,
                    Message = "JsonSmithAI is unreachable."
                };
            }
        }

        private Uri GetHealthCheckUri()
        {
            var baseUrl = _settings.BASE_URL.Trim();
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var apiUri))
                throw new InvalidOperationException("JsonSmithAI BASE_URL is not a valid absolute URI.");

            return new UriBuilder(apiUri.Scheme, apiUri.Host, apiUri.Port).Uri;
        }

        private static string? TryReadApiMessage(string responseContent)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                if (doc.RootElement.TryGetProperty("Message", out var messageElement))
                    return messageElement.GetString();
            }
            catch (JsonException)
            {
            }

            return null;
        }

        private static string? TryReadDetailMessage(string responseContent)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                if (doc.RootElement.TryGetProperty("detail", out var detailElement))
                {
                    if (detailElement.ValueKind == JsonValueKind.String)
                        return detailElement.GetString();
                    return detailElement.GetRawText();
                }
            }
            catch (JsonException)
            {
            }

            return null;
        }

        private static string ExtractDataPayload(string responseContent)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                var root = doc.RootElement;

                if (root.TryGetProperty("Success", out var successElement) &&
                    successElement.ValueKind == JsonValueKind.False)
                {
                    var message = root.TryGetProperty("Message", out var msg)
                        ? msg.GetString() ?? "JsonSmithAI returned Success=false."
                        : "JsonSmithAI returned Success=false.";
                    throw new HttpRequestException(message);
                }

                if (root.TryGetProperty("Data", out var dataElement) &&
                    dataElement.ValueKind != JsonValueKind.Undefined &&
                    dataElement.ValueKind != JsonValueKind.Null)
                {
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
                return responseContent;
            }
        }
    }
}
