// หลังบ้านของเว็บ nakcat: API ที่หน้าเว็บจะเรียกใช้ผ่าน fetch()
// รันในเครื่อง: เปิด Terminal ที่โฟลเดอร์ api แล้วพิมพ์ dotnet run

using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// JSON: ส่งสถานะเป็นคำ ("Pending") แทนตัวเลข (0) อ่านง่ายกว่า
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// ฐานข้อมูล PostgreSQL บน Neon: ที่อยู่ + รหัสผ่านเป็นความลับ จึงไม่อยู่ใน appsettings.json
// - ในเครื่อง: เก็บใน user-secrets (dotnet user-secrets set "ConnectionStrings:Nakcat" "...")
// - บน Render: ตั้งเป็น Environment Variable ชื่อ ConnectionStrings__Nakcat
string connectionString = builder.Configuration.GetConnectionString("Nakcat")
    ?? throw new InvalidOperationException("ยังไม่ได้ตั้งที่อยู่ฐานข้อมูล ConnectionStrings:Nakcat (ดูคอมเมนต์ใน Program.cs)");
builder.Services.AddDbContext<NakcatDb>(options => options.UseNpgsql(ToNpgsqlConnectionString(connectionString)));

// CORS: อนุญาตให้หน้าเว็บจากที่อยู่ในรายการ AllowedOrigins (ใน appsettings) เรียก API นี้ได้
string[] allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST")));

var app = builder.Build();
app.UseCors();

// เปิดโปรแกรมแล้วสร้าง/อัปเดตตารางในฐานข้อมูลให้ตรงกับโค้ดล่าสุด (ตามไฟล์ในโฟลเดอร์ Migrations)
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<NakcatDb>().Database.Migrate();
}

// เปิด http://localhost:5080/ ได้ข้อความทักทาย
app.MapGet("/", () => "สวัสดีจาก API ของ nakcat 🐾");

// เปิด http://localhost:5080/cat-age/3 ได้อายุแมวเทียบเป็นอายุคน (ตอบกลับเป็น JSON)
app.MapGet("/cat-age/{years:int}", (int years) =>
{
    int humanYears = ToHumanAge(years);
    return new CatAge(years, humanYears);
});

// ===================== คะแนนรีวิวเว็บ "ชอบเว็บ nakcat แค่ไหน?" =====================

// รับคะแนนใหม่ 1 คะแนน: หน้าเว็บส่ง {"score": 5} มา
app.MapPost("/ratings", async (RatingRequest request, NakcatDb db) =>
{
    if (request.Score < 1 || request.Score > 5)
    {
        return Results.BadRequest(new ErrorResponse("คะแนนต้องอยู่ระหว่าง 1 ถึง 5"));
    }
    db.Ratings.Add(new Rating { Score = request.Score, CreatedAt = DateTime.UtcNow });
    await db.SaveChangesAsync();
    return Results.Ok(await GetSummary(db));
});

// เปิด http://localhost:5080/ratings/summary ได้ค่าเฉลี่ยและจำนวนคนที่ให้คะแนน
app.MapGet("/ratings/summary", async (NakcatDb db) => await GetSummary(db));

// ===================== เรื่องเล่าแมว =====================

// รับเรื่องใหม่: เก็บไว้เป็น "รอตรวจ" ยังไม่ขึ้นเว็บจนกว่าแอดมินจะอนุมัติ
app.MapPost("/stories", async (StoryRequest request, NakcatDb db) =>
{
    string catName = request.CatName?.Trim() ?? "";
    string author = request.AuthorName?.Trim() ?? "";
    string text = request.Story?.Trim() ?? "";

    string? error = ValidateStory(catName, author, text);
    if (error != null)
    {
        return Results.BadRequest(new ErrorResponse(error));
    }

    var story = new CatStory
    {
        CatName = catName,
        AuthorName = author == "" ? "ทาสแมวนิรนาม" : author,
        Story = text,
        Status = StoryStatus.Pending,
        CreatedAt = DateTime.UtcNow,
    };
    db.CatStories.Add(story);
    await db.SaveChangesAsync();
    return Results.Ok(new StorySubmitted(story.Id, "ได้รับเรื่องแล้ว 🐾 แอดมินจะอ่านก่อนขึ้นเว็บนะ"));
});

// เปิด http://localhost:5080/stories ได้เรื่องที่อนุมัติแล้ว 20 เรื่องล่าสุด (ไม่ส่งเรื่องที่รอตรวจออกไป)
app.MapGet("/stories", async (NakcatDb db) =>
    await db.CatStories
        .Where(s => s.Status == StoryStatus.Approved)
        .OrderByDescending(s => s.ReviewedAt)
        .Take(20)
        .Select(s => new PublicStory(s.Id, s.CatName, s.AuthorName, s.Story, s.CreatedAt))
        .ToListAsync());

// ===================== แอดมิน (ต้องส่งรหัสมาใน header ชื่อ X-Admin-Key) =====================
// รหัสแอดมิน: ในเครื่องอยู่ใน appsettings.Development.json / ตอนออนไลน์ตั้งเป็นค่าลับบน Render
// ห้ามใส่รหัสจริงใน appsettings.json เพราะไฟล์นั้นเป็นของทุกที่
string? adminKey = app.Configuration["AdminKey"];

bool IsAdmin(HttpRequest request)
{
    if (string.IsNullOrEmpty(adminKey)) return false; // ยังไม่ได้ตั้งรหัส = ปิดหน้าแอดมินไว้เลย
    string sent = request.Headers["X-Admin-Key"].ToString();
    // เทียบแบบใช้เวลาเท่ากันเสมอ คนนอกจะเดารหัสจากความเร็วในการตอบไม่ได้
    return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sent), Encoding.UTF8.GetBytes(adminKey));
}

// ดูเรื่องตามสถานะ (ไม่บอกสถานะ = เรื่องที่รอตรวจ) เรื่องเก่าสุดขึ้นก่อน
// เช่น /admin/stories หรือ /admin/stories?status=Approved
app.MapGet("/admin/stories", async (HttpRequest request, NakcatDb db, StoryStatus? status) =>
{
    if (!IsAdmin(request)) return Results.Unauthorized();
    StoryStatus wanted = status ?? StoryStatus.Pending;
    List<CatStory> stories = await db.CatStories
        .Where(s => s.Status == wanted)
        .OrderBy(s => s.CreatedAt)
        .ToListAsync();
    return Results.Ok(stories);
});

// อนุมัติ / ไม่อนุมัติ เรื่องตามเลข Id
app.MapPost("/admin/stories/{id:int}/approve", (int id, HttpRequest request, NakcatDb db) =>
    Review(id, StoryStatus.Approved, request, db));
app.MapPost("/admin/stories/{id:int}/reject", (int id, HttpRequest request, NakcatDb db) =>
    Review(id, StoryStatus.Rejected, request, db));

async Task<IResult> Review(int id, StoryStatus newStatus, HttpRequest request, NakcatDb db)
{
    if (!IsAdmin(request)) return Results.Unauthorized();
    CatStory? story = await db.CatStories.FindAsync(id);
    if (story == null)
    {
        return Results.NotFound(new ErrorResponse($"ไม่พบเรื่องเลขที่ {id}"));
    }
    story.Status = newStatus;
    story.ReviewedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(story);
}

app.Run();

// ตรวจเรื่องที่ส่งมา: ถูกต้องคืน null / ผิดคืนข้อความบอกว่าผิดตรงไหน
static string? ValidateStory(string catName, string author, string story)
{
    if (catName == "") return "ใส่ชื่อน้องแมวด้วยนะ";
    if (catName.Length > 40) return "ชื่อแมวยาวเกิน 40 ตัวอักษร";
    if (author.Length > 40) return "ชื่อคนเล่ายาวเกิน 40 ตัวอักษร";
    if (story.Length < 20) return "เล่าอีกนิดนะ อย่างน้อย 20 ตัวอักษร";
    if (story.Length > 1000) return "เรื่องยาวเกิน 1,000 ตัวอักษร";
    return null;
}

// สรุปคะแนนทั้งหมด: มีกี่คน เฉลี่ยเท่าไร (ปัดทศนิยม 1 ตำแหน่ง)
static async Task<RatingSummary> GetSummary(NakcatDb db)
{
    int count = await db.Ratings.CountAsync();
    double average = count == 0 ? 0 : Math.Round(await db.Ratings.AverageAsync(r => r.Score), 1);
    return new RatingSummary(count, average);
}

// Neon ให้ที่อยู่แบบ postgresql://ชื่อผู้ใช้:รหัสผ่าน@host/ชื่อฐานข้อมูล?sslmode=require
// แต่ Npgsql (ตัวคุยกับ PostgreSQL ของ C#) อ่านแบบ Host=...;Username=...;Password=... จึงแปลงให้
// ถ้าใส่มาเป็นแบบ Host=... อยู่แล้วก็ใช้ตามนั้นเลย
static string ToNpgsqlConnectionString(string value)
{
    if (!value.StartsWith("postgres://") && !value.StartsWith("postgresql://")) return value;
    var uri = new Uri(value);
    string[] user = uri.UserInfo.Split(':', 2);
    var result = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(user[0]),
        Password = user.Length > 1 ? Uri.UnescapeDataString(user[1]) : "",
        SslMode = Npgsql.SslMode.Require, // เชื่อมต่อแบบเข้ารหัสเสมอ
    };
    return result.ConnectionString;
}

// อายุแมว (ปี) → อายุคน (ปี): 1 ปี ≈ 15, 2 ปี ≈ 24 จากนั้น +4 ต่อปี (สูตรเดียวกับหน้าเว็บ)
static int ToHumanAge(int years)
{
    if (years <= 0) return 0;
    if (years == 1) return 15;
    return 24 + (years - 2) * 4;
}

// แบบฟอร์มของข้อมูลที่รับเข้า/ส่งกลับ (คล้าย interface ใน TypeScript)
record CatAge(int CatYears, int HumanYears);
record RatingRequest(int Score);
record RatingSummary(int Count, double Average);
record ErrorResponse(string Message);
record StoryRequest(string? CatName, string? AuthorName, string? Story); // ? = หน้าเว็บอาจไม่ส่งช่องนี้มา
record StorySubmitted(int Id, string Message);
record PublicStory(int Id, string CatName, string AuthorName, string Story, DateTime CreatedAt);
