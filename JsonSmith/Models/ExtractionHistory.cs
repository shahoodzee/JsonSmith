using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace JsonSmith.Models
{
    [Table("extraction_history")]
    public class ExtractionHistory : BaseModel
    {
        [PrimaryKey("id", false)]
        public string? Id { get; set; }

        [Column("image_filename")]
        public string ImageFilename { get; set; } = "";

        [Column("signed_url")]
        public string? SignedUrl { get; set; }

        [Column("extracted_json")]
        public string ExtractedJson { get; set; } = "";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }
    }
}
