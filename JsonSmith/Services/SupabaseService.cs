using Microsoft.Extensions.Options;
using JsonSmith.Models;
using Supabase;
using Supabase.Postgrest.Constants;

namespace JsonSmith.Services
{
    public class SupabaseService : ISupabaseService
    {
        private readonly Client _supabase;
        private readonly SupabaseSettings _settings;

        public SupabaseService(IOptions<SupabaseSettings> settings)
        {
            _settings = settings.Value;
            var options = new SupabaseOptions
            {
                AutoRefreshToken = false,
                AutoConnectRealtime = false
            };
            _supabase = new Client(_settings.SUPABASE_API_URL, _settings.SUPABASE_API_KEY, options);
        }

        public async Task<string> UploadFileAsync(IFormFile file, string? directory = null)
        {
            await _supabase.InitializeAsync();

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var bytes = memoryStream.ToArray();

            var safeFileName = file.FileName.Replace(" ", "_");
            var fileName = $"{Guid.NewGuid()}_{safeFileName}";
            
            if (!string.IsNullOrEmpty(directory)) 
            {
                fileName = $"{directory}/{fileName}";
            }
            
            // Upload the file
            await _supabase.Storage
                .From(_settings.SUPABASE_BUCKET_NAME)
                .Upload(bytes, fileName);

            // Get the signed URL (valid for 1 hour)
            var signedUrl = await _supabase.Storage
                .From(_settings.SUPABASE_BUCKET_NAME)
                .CreateSignedUrl(fileName, 3600);

            return signedUrl;
        }

        public async Task SaveExtractionAsync(string imageFilename, string? signedUrl, string extractedJson)
        {
            await _supabase.InitializeAsync();
            var record = new ExtractionHistory
            {
                ImageFilename = imageFilename,
                SignedUrl = signedUrl,
                ExtractedJson = extractedJson
            };
            await _supabase.From<ExtractionHistory>().Insert(record);
        }

        public async Task<IEnumerable<ExtractionHistory>> GetHistoryAsync(int limit = 50)
        {
            await _supabase.InitializeAsync();
            var response = await _supabase.From<ExtractionHistory>()
                .Select("*")
                .Order("created_at", Ordering.Descending)
                .Limit(limit)
                .Get();
            return response.Models;
        }
    }
}
