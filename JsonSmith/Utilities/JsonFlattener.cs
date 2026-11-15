using System.Text.Json;

namespace JsonSmith.Utilities
{
    public static class JsonFlattener
    {
        public static IEnumerable<Dictionary<string, string>> Flatten(string jsonText)
        {
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in root.EnumerateArray())
                    yield return FlattenElement(item, "");
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                yield return FlattenElement(root, "");
            }
        }

        private static Dictionary<string, string> FlattenElement(JsonElement element, string prefix)
        {
            var dict = new Dictionary<string, string>();
            Recurse(element, prefix, dict);
            return dict;
        }

        private static void Recurse(JsonElement element, string prefix, Dictionary<string, string> result)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var prop in element.EnumerateObject())
                    {
                        var key = string.IsNullOrEmpty(prefix) ? prop.Name : $"{prefix}.{prop.Name}";
                        Recurse(prop.Value, key, result);
                    }
                    break;
                case JsonValueKind.Array:
                    var i = 0;
                    foreach (var item in element.EnumerateArray())
                        Recurse(item, $"{prefix}[{i++}]", result);
                    break;
                default:
                    result[prefix] = element.ToString();
                    break;
            }
        }
    }
}
