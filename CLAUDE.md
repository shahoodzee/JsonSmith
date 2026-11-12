# JsonSmithApp — Claude Code Instructions

## Project

JsonSmithApp is the C# ASP.NET Core MVC web UI for JsonSmith. It orchestrates image uploads to Supabase Storage and AI calls to JsonSmithAI to extract structured JSON from images and generate AI sample values for JSON building.

**Companion service:** JsonSmithAI (Python FastAPI) lives at `d:\Repos\JsonSmith\JsonSmithAI` — port 8000.

## Architecture

| Layer | Detail |
|-------|--------|
| Framework | ASP.NET Core MVC, .NET 10 |
| Port (dev) | 5138 |
| Port (Docker) | 8080 |
| Storage | Supabase Storage (file upload + signed URLs) |
| AI backend | JsonSmithAI at `http://127.0.0.1:8000/api/v1/` |

Data flow: Browser → JsonSmithApp → Supabase Storage + JsonSmithAI → OCR.Space / Gemini

## Running

```powershell
# Must run from the folder containing the .csproj
cd d:\Repos\JsonSmith\JsonSmithApp\JsonSmith
dotnet watch run
```

## Configuration

Secrets via ASP.NET User Secrets (dev) or environment variables (prod):

```
Supabase:SUPABASE_API_URL
Supabase:SUPABASE_API_KEY
Supabase:SUPABASE_BUCKET_NAME
JsonSmithAI:BASE_URL          → http://127.0.0.1:8000/api/v1/
JsonSmithAI:API_KEY           → must match API_KEY in JsonSmithAI .env
```

Docker env var separator is double-underscore: `Supabase:SUPABASE_API_KEY` → `Supabase__SUPABASE_API_KEY`.

## Key Files

| File | Purpose |
|------|---------|
| `JsonSmith/Program.cs` | DI setup, middleware pipeline |
| `JsonSmith/Controllers/HomeController.cs` | All web endpoints |
| `JsonSmith/Services/SupabaseService.cs` | File upload to Supabase, signed URL |
| `JsonSmith/Services/JsonSmithAIService.cs` | HTTP client for JsonSmithAI |
| `JsonSmith/Models/SupabaseSettings.cs` | Supabase config model |
| `JsonSmith/Models/JsonSmithAISettings.cs` | AI service config model |
| `JsonSmith/appsettings.json` | Non-secret config (no keys) |
| `JsonSmith/Properties/launchSettings.json` | Dev port settings |

## Code Conventions

- MVC conventions: controllers, services, models in separate folders.
- `IService` interface + concrete class for every service.
- `IOptions<T>` / `Configure<T>(section)` for all configuration.
- `async`/`await` throughout — no `.Result` or `.Wait()`.
- `HttpClient` registered via `AddHttpClient<IService, Impl>()` in `Program.cs`.

## Common Gotchas

- **`dotnet run` from `JsonSmith\`** — the folder containing the `.csproj`, not the solution root.
- **Never commit secrets** — use user-secrets for dev; env vars for prod.
- **C# double-underscore for Docker** — `Supabase:SUPABASE_API_KEY` → `Supabase__SUPABASE_API_KEY`.
- **Supabase service role key bypasses RLS** — treat as root; never expose client-side.
- **Signed URLs expire** — OCR fails with download error if the signed URL has expired; re-upload.
- **CORS is `*` wildcard** — restrict origins before production.

## Git & GitHub

| Item | Value |
|------|-------|
| Git username | shahoodzee |
| Git email | shahood.bin.amir@gmail.com |
| Repository | https://github.com/shahoodzee/JsonSmithAI |
| gh CLI account | shahoodzee |
| GitHub Project | https://github.com/users/shahoodzee/projects/12 |

### Commits

No co-author attribution. Commit messages should be concise and describe the change.

### Issues

When creating GitHub issues, fill **every** field:
- **Label** — appropriate label (bug, enhancement, etc.)
- **Type** — Bug / Enhancement / Task
- **Parent** — link to parent issue if applicable
- **Assignee** — always `shahoodzee`
- **Project** — https://github.com/users/shahoodzee/projects/12

### Branches & PRs

For every bug, enhancement, or task issue: create a dedicated branch and open a PR targeting `main`. No reviewer required.

## Tests

No test suite currently. When adding: xUnit in `JsonSmithApp.Tests/` project, mock `ISupabaseService` and `IJsonSmithAIService`.
