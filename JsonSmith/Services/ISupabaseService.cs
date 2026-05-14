using Microsoft.AspNetCore.Http;

namespace JsonSmith.Services
{
    public interface ISupabaseService
    {
        Task<string> UploadFileAsync(IFormFile file, string? directory = null);
    }
}
