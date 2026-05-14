namespace JsonSmith.Services
{
    public interface IJsonSmithAIService
    {
        Task<string> ExtractJsonAsync(string imageUrl);
    }
}
