# JsonSmith

ASP.NET Core web app that accepts an image upload, stores it in **Supabase Storage**, sends the public/signed image URL to a separate **JsonSmith AI** HTTP service, and returns structured **JSON** extracted from the image.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| [.NET SDK 10](https://dotnet.microsoft.com/download) | Matches `net10.0` in `JsonSmith.csproj`. |
| [Supabase](https://supabase.com/) project | Storage bucket + API URL and keys from the dashboard. |
| JsonSmith AI service | HTTP API that implements `POST …/extract-json` (see [Configuration](#configuration)). Optional for UI pages that do not call upload. |
| *(Optional)* [Docker](https://docs.docker.com/get-docker/) | For containerized runs using `JsonSmith/Dockerfile`. |

### NuGet packages (restored automatically)

- **Supabase** (`Supabase` client for .NET) — uploads and signed URLs.

No local database is required for the web app itself; persistence is Supabase + the AI service.

## Configuration

Copy settings into `JsonSmith/appsettings.json`, or use **User Secrets** (recommended for keys; the project already has a `UserSecretsId` in the `.csproj`).

### `Supabase`

| Key | Description |
|-----|-------------|
| `SUPABASE_API_URL` | Project API URL, e.g. `https://<project-ref>.supabase.co`. Must match the same project as your keys. |
| `SUPABASE_API_KEY` | **Service role** secret (server-side uploads). Keep private. |
| `SUPABASE_BUCKET_NAME` | Storage bucket id (create the bucket under **Storage** in the Supabase dashboard). |

The URL host (`<project-ref>`) must match the `ref` claim inside your JWT, or you will see auth/signature errors.

### `JsonSmithAI`

| Key | Description |
|-----|-------------|
| `BASE_URL` | Base URL of the AI API, including path prefix if any, e.g. `http://127.0.0.1:8000/api/v1/` (trailing slash is fine). |
| `API_KEY` | Value sent as header `X-API-Key`; must match what the AI service expects. |

The app calls `POST {BASE_URL}extract-json` with multipart form field `image_url` set to the Supabase signed URL.

## Run locally

From the repository root:

```bash
cd JsonSmith
dotnet restore
dotnet run
```

Then open the URL shown in the console (by default **http://localhost:5138** for the `http` profile in `Properties/launchSettings.json`).

- **Image → JSON flow:** `/Home/ImageToJSON` — upload triggers `POST /Home/UploadImage`, which uploads to Supabase then calls the AI service.

### User Secrets (example)

```bash
cd JsonSmith
dotnet user-secrets set "Supabase:SUPABASE_API_URL" "https://YOUR_REF.supabase.co"
dotnet user-secrets set "Supabase:SUPABASE_API_KEY" "YOUR_SERVICE_ROLE_KEY"
dotnet user-secrets set "Supabase:SUPABASE_BUCKET_NAME" "your-bucket-id"
dotnet user-secrets set "JsonSmithAI:BASE_URL" "http://127.0.0.1:8000/api/v1/"
dotnet user-secrets set "JsonSmithAI:API_KEY" "your-ai-api-key"
```

User Secrets override `appsettings.json` in Development.

## Run with Docker

Build from the **repository root** (the Dockerfile expects a `JsonSmith/` project folder next to the build context):

```bash
docker build -f JsonSmith/Dockerfile -t jsonsmith .
docker run --rm -p 8080:8080 ^
  -e Supabase__SUPABASE_API_URL="https://YOUR_REF.supabase.co" ^
  -e Supabase__SUPABASE_API_KEY="YOUR_SERVICE_ROLE_KEY" ^
  -e Supabase__SUPABASE_BUCKET_NAME="your-bucket-id" ^
  -e JsonSmithAI__BASE_URL="http://host.docker.internal:8000/api/v1/" ^
  -e JsonSmithAI__API_KEY="your-ai-api-key" ^
  jsonsmith
```

On Linux/macOS, use `\` for line continuation and adjust `host.docker.internal` if the AI service runs elsewhere.

The container listens on **8080** (HTTP) per the Dockerfile / ASP.NET port defaults.

## Solution layout

| Path | Role |
|------|------|
| `JsonSmith.slnx` | Solution entry (single web project). |
| `JsonSmith/` | ASP.NET Core MVC app (controllers, views, services). |
| `JsonSmith/Services/SupabaseService.cs` | Storage upload + signed URL. |
| `JsonSmith/Services/JsonSmithAIService.cs` | Calls external `extract-json` API. |
| `JsonSmith/Dockerfile` | Multi-stage .NET 10 image. |

## Security notes

- Do **not** commit real `SUPABASE_API_KEY` (service role) or `API_KEY` values; use User Secrets or environment variables in CI/production.
- Restrict bucket policies appropriately; the service role key bypasses Row Level Security for data APIs—treat it like root access to your project.

## License

Copyright © 2026 shahoodzee. All rights reserved.

This repository is a personal/portfolio project. No license is granted.
You may view the code on GitHub, but you may not copy, modify, distribute,
or use it for any purpose without prior written permission.
