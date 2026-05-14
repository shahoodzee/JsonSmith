var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.Configure<JsonSmith.Models.SupabaseSettings>(
    builder.Configuration.GetSection("Supabase"));
builder.Services.AddScoped<JsonSmith.Services.ISupabaseService, JsonSmith.Services.SupabaseService>();

builder.Services.Configure<JsonSmith.Models.JsonSmithAISettings>(
    builder.Configuration.GetSection("JsonSmithAI"));
builder.Services.AddHttpClient<JsonSmith.Services.IJsonSmithAIService, JsonSmith.Services.JsonSmithAIService>();

builder.Services.AddControllersWithViews();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
