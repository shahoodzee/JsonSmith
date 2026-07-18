using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace JsonSmith.Models
{
    public class GenerateSamplesRequest
    {
        [Required]
        public string Key { get; set; } = string.Empty;

        [Required]
        public string Type { get; set; } = "string";

        public JsonElement Seed { get; set; }

        [Range(1, 50)]
        public int Frequency { get; set; } = 1;
    }
}
