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

                // Save to history (best-effort — don't fail the request if DB write fails)
                try { await _supabaseService.SaveExtractionAsync(file.FileName, url, jsonResult); } catch { }

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

        [HttpPost]
        public async Task<IActionResult> UploadImages(List<IFormFile> files)
        {
            if (files == null || files.Count == 0)
                return BadRequest(new { message = "No files uploaded." });

            if (files.Count > 10)
                return BadRequest(new { message = "Maximum 10 files per batch." });

            var tasks = files.Select(async file =>
            {
                try
                {
                    var url = await _supabaseService.UploadFileAsync(file, "Images");
                    var jsonResult = await _aiService.ExtractJsonAsync(url);
                    try
                    {
                        var parsed = System.Text.Json.Nodes.JsonNode.Parse(jsonResult);
                        return new { fileName = file.FileName, success = true, data = parsed, error = (string?)null };
                    }
                    catch
                    {
                        return new { fileName = file.FileName, success = false, data = (System.Text.Json.Nodes.JsonNode?)null, error = "Malformed JSON returned" };
                    }
                }
                catch (Exception ex)
                {
                    return new { fileName = file.FileName, success = false, data = (System.Text.Json.Nodes.JsonNode?)null, error = ex.Message };
                }
            });

            var results = await Task.WhenAll(tasks);
            return Ok(results);
        }

        [HttpPost]
        public IActionResult ExportJson([FromBody] JsonSmith.Models.ExportJsonRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.Json))
                return BadRequest(new { message = "json is required." });

            if (request.Format is not ("csv" or "xlsx"))
                return BadRequest(new { message = "format must be 'csv' or 'xlsx'." });

            List<Dictionary<string, string>> rows;
            try
            {
                rows = JsonSmith.Utilities.JsonFlattener.Flatten(request.Json).ToList();
            }
            catch
            {
                return BadRequest(new { message = "Invalid JSON." });
            }

            if (rows.Count == 0)
                return BadRequest(new { message = "No data to export." });

            var headers = rows.SelectMany(r => r.Keys).Distinct().ToList();
            var stamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

            if (request.Format == "csv")
            {
                var sb = new System.Text.StringBuilder();
                sb.AppendLine(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                foreach (var row in rows)
                    sb.AppendLine(string.Join(",", headers.Select(h =>
                    {
                        var v = row.TryGetValue(h, out var val) ? val : "";
                        return $"\"{v.Replace("\"", "\"\"")}\"";
                    })));
                return File(System.Text.Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"export_{stamp}.csv");
            }
            else
            {
                using var wb = new ClosedXML.Excel.XLWorkbook();
                var ws = wb.Worksheets.Add("Export");
                for (int c = 0; c < headers.Count; c++)
                    ws.Cell(1, c + 1).Value = headers[c];
                for (int r = 0; r < rows.Count; r++)
                    for (int c = 0; c < headers.Count; c++)
                    {
                        var v = rows[r].TryGetValue(headers[c], out var val) ? val : "";
                        ws.Cell(r + 2, c + 1).Value = v;
                    }
                using var ms = new MemoryStream();
                wb.SaveAs(ms);
                return File(ms.ToArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"export_{stamp}.xlsx");
            }
        }

        public IActionResult JsonBuilder()
        {
            ViewData["Title"] = "JSON Builder";
            return View();
        }

        public async Task<IActionResult> History()
        {
            ViewData["Title"] = "History";
            try
            {
                var history = await _supabaseService.GetHistoryAsync();
                return View(history);
            }
            catch
            {
                return View(Enumerable.Empty<JsonSmith.Models.ExtractionHistory>());
            }
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
                    request.Frequency,
                    request.Schema);

                return Ok(new { values });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
}
