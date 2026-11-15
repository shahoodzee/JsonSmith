using Microsoft.AspNetCore.Http;
using JsonSmith.Models;

namespace JsonSmith.Services
{
    public interface ISupabaseService
    {
        Task<string> UploadFileAsync(IFormFile file, string? directory = null);
        Task SaveExtractionAsync(string imageFilename, string? signedUrl, string extractedJson);
        Task<IEnumerable<ExtractionHistory>> GetHistoryAsync(int limit = 50);
    }
}
