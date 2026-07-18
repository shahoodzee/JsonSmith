using JsonSmith.Models;
using System.Diagnostics;
using JsonSmith.Services;
using Microsoft.AspNetCore.Mvc;

    public class HomeController : Controller
    {
        private readonly ISupabaseService _supabaseService;
        private readonly IJsonSmithAIService _aiService;

        public HomeController(ISupabaseService supabaseService, IJsonSmithAIService aiService)
        {
            _supabaseService = supabaseService;
            _aiService = aiService;
        }
        public IActionResult Index()
        {
            ViewData["Title"] = "Feature 1";
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
        
        public IActionResult ImageToJSON()
        {
            ViewData["Title"] = "Image to JSON";
            return View();
        }

        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public async Task<IActionResult> JsonSmithAIHealth()
        {
            var result = await _aiService.CheckHealthAsync();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded." });
            }

            try
            {
                var url = await _supabaseService.UploadFileAsync(file, "Images");
                var jsonResult = await _aiService.ExtractJsonAsync(url);
                
                // Try to parse the result as JSON to return a clean object
                try 
                {
                    var parsedJson = System.Text.Json.Nodes.JsonNode.Parse(jsonResult);
                    return Ok(parsedJson);
                }
                catch
                {
                    // If parsing fails (e.g. if the AI output is still slightly malformed), return the raw result
                    return Ok(new { data = jsonResult, note = "Result may be malformed JSON" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        public IActionResult JsonBuilder()
        {
            ViewData["Title"] = "JSON Builder";
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> GenerateSamples([FromBody] GenerateSamplesRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Key))
                return BadRequest(new { message = "key is required." });

            var type = (request.Type ?? "string").Trim().ToLowerInvariant();
            if (type is not ("string" or "int"))
                return BadRequest(new { message = "type must be 'string' or 'int'." });

            if (request.Frequency < 1 || request.Frequency > 50)
                return BadRequest(new { message = "frequency must be between 1 and 50." });

            try
            {
                var values = await _aiService.GenerateSamplesAsync(
                    request.Key.Trim(),
                    type,
                    request.Seed,
                    request.Frequency);

                return Ok(new { values });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
}
