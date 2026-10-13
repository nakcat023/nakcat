// หลังบ้านของเว็บ nakcat: API ที่หน้าเว็บจะเรียกใช้ผ่าน fetch()
// รันในเครื่อง: เปิด Terminal ที่โฟลเดอร์ api แล้วพิมพ์ dotnet run

using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
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
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST", "PUT", "DELETE")));

// กันกดรัว / บอทยิงซ้ำ: ทุกปุ่มที่ "เขียน" ข้อมูล (ส่งเรื่อง ให้คะแนน กดถูกใจ บันทึกคะแนนเกม ส่งข้อความ)
// รวมกันได้ไม่เกิน 60 ครั้งต่อนาทีต่อ 1 เครื่อง (นับจาก IP) เกินแล้วตอบ 429 ให้รอก่อน
// ตัวนับคนเข้าเว็บ / เกมที่เล่นจบ แยกโควตาเป็นของตัวเอง (120 ครั้งต่อนาที) จะได้ไม่ไปกินโควตาปุ่มอื่น
// (IP ใช้แค่นับโควตาในหน่วยความจำชั่วคราว ไม่ได้บันทึกลงฐานข้อมูล)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, token) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
        new ErrorResponse("กดถี่ไปนิดนึง รอสักครู่แล้วลองใหม่นะ 🐾"), token));
    options.AddPolicy("writes", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("tracking", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) }));
});

// บน Render มีเครื่องกลาง (proxy) รับคำขอแทนเรา IP จริงของคนเข้าเว็บจึงอยู่ใน header X-Forwarded-For
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseCors();
app.UseRateLimiter();

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

// รับคะแนนใหม่ 1 คะแนน: หน้าเว็บส่ง {"score": 5, "comment": "อยากได้เกมเพิ่ม"} มา (comment ไม่ส่งก็ได้)
app.MapPost("/ratings", async (RatingRequest request, NakcatDb db) =>
{
    if (request.Score < 1 || request.Score > 5)
    {
        return Results.BadRequest(new ErrorResponse("คะแนนต้องอยู่ระหว่าง 1 ถึง 5"));
    }
    string comment = request.Comment?.Trim() ?? "";
    if (comment.Length > 1000)
    {
        return Results.BadRequest(new ErrorResponse("ความเห็นยาวเกิน 1,000 ตัวอักษร"));
    }
    db.Ratings.Add(new Rating { Score = request.Score, Comment = comment == "" ? null : comment, CreatedAt = DateTime.UtcNow });
    await db.SaveChangesAsync();
    return Results.Ok(await GetSummary(db));
}).RequireRateLimiting("writes");

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
}).RequireRateLimiting("writes");

// เปิด http://localhost:5080/stories ได้เรื่องที่อนุมัติแล้ว 20 เรื่องล่าสุด (ไม่ส่งเรื่องที่รอตรวจออกไป)
// /stories?sort=popular = เรียงตามยอดถูกใจ (เท่ากันเอาเรื่องที่ขึ้นเว็บทีหลังก่อน)
app.MapGet("/stories", async (NakcatDb db, string? sort) =>
{
    IQueryable<CatStory> approved = db.CatStories.Where(s => s.Status == StoryStatus.Approved);
    IQueryable<CatStory> ordered = sort == "popular"
        ? approved.OrderByDescending(s => s.Likes).ThenByDescending(s => s.ReviewedAt)
        : approved.OrderByDescending(s => s.ReviewedAt);
    return await ordered
        .Take(20)
        .Select(s => new PublicStory(s.Id, s.CatName, s.AuthorName, s.Story, s.CreatedAt, s.Likes))
        .ToListAsync();
});

// กดถูกใจ / ยกเลิกถูกใจ เรื่องเล่า (เฉพาะเรื่องที่ขึ้นเว็บแล้ว)
app.MapPost("/stories/{id:int}/like", (int id, NakcatDb db) => ChangeStoryLikes(id, 1, db)).RequireRateLimiting("writes");
app.MapPost("/stories/{id:int}/unlike", (int id, NakcatDb db) => ChangeStoryLikes(id, -1, db)).RequireRateLimiting("writes");

async Task<IResult> ChangeStoryLikes(int id, int change, NakcatDb db)
{
    // บวก/ลบในฐานข้อมูลทีเดียว (ไม่อ่านค่ามาบวกแล้วเขียนกลับ) ถ้ามีคนกดพร้อมกันหลายคน ตัวเลขจะไม่หาย
    // เงื่อนไข Likes + change >= 0 กันไม่ให้ติดลบ
    await db.CatStories
        .Where(s => s.Id == id && s.Status == StoryStatus.Approved && s.Likes + change >= 0)
        .ExecuteUpdateAsync(setters => setters.SetProperty(s => s.Likes, s => s.Likes + change));
    CatStory? story = await db.CatStories.AsNoTracking()
        .FirstOrDefaultAsync(s => s.Id == id && s.Status == StoryStatus.Approved);
    if (story == null)
    {
        return Results.NotFound(new ErrorResponse($"ไม่พบเรื่องเลขที่ {id}"));
    }
    return Results.Ok(new StoryLikes(story.Id, story.Likes));
}

// ===================== หัวใจสายพันธุ์แมว =====================

// เปิด http://localhost:5080/breeds/likes ได้จำนวนหัวใจของทุกพันธุ์ เช่น {"Bengal": 12, "Korat": 5, ...}
app.MapGet("/breeds/likes", async (NakcatDb db) =>
    await db.BreedLikes.ToDictionaryAsync(b => b.Breed, b => b.Count));

// กดหัวใจ / เอาหัวใจออก (ชื่อพันธุ์ที่มีช่องว่าง หน้าเว็บส่งมาแบบ Scottish%20Fold)
app.MapPost("/breeds/{breed}/like", (string breed, NakcatDb db) => ChangeBreedLikes(breed, 1, db)).RequireRateLimiting("writes");
app.MapPost("/breeds/{breed}/unlike", (string breed, NakcatDb db) => ChangeBreedLikes(breed, -1, db)).RequireRateLimiting("writes");

async Task<IResult> ChangeBreedLikes(string breed, int change, NakcatDb db)
{
    await db.BreedLikes
        .Where(b => b.Breed == breed && b.Count + change >= 0)
        .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.Count, b => b.Count + change));
    BreedLike? row = await db.BreedLikes.AsNoTracking().FirstOrDefaultAsync(b => b.Breed == breed);
    if (row == null)
    {
        return Results.NotFound(new ErrorResponse("ไม่รู้จักแมวพันธุ์นี้"));
    }
    return Results.Ok(new BreedLikeCount(row.Breed, row.Count));
}

// ===================== กระดานคะแนนเกมจับคู่การ์ดแมว =====================

// เปิด http://localhost:5080/memory-scores ได้ 10 อันดับแรก
app.MapGet("/memory-scores", async (NakcatDb db) => await TopScores(db));

// บันทึกคะแนนใหม่: หน้าเว็บส่ง {"playerName": "แน็ก", "moves": 9, "seconds": 31} มา ได้อันดับ + กระดานล่าสุดกลับไป
app.MapPost("/memory-scores", async (ScoreRequest request, NakcatDb db) =>
{
    string name = request.PlayerName?.Trim() ?? "";
    string? error = ValidateScore(name, request.Moves, request.Seconds);
    if (error != null)
    {
        return Results.BadRequest(new ErrorResponse(error));
    }

    var score = new MemoryScore
    {
        PlayerName = name,
        Moves = request.Moves,
        Seconds = request.Seconds,
        CreatedAt = DateTime.UtcNow,
    };
    db.MemoryScores.Add(score);
    await db.SaveChangesAsync();

    // อันดับ = จำนวนคนที่ทำได้ดีกว่า + 1 (ครั้งน้อยกว่า หรือครั้งเท่ากันแต่เร็วกว่า)
    int better = await db.MemoryScores.CountAsync(s =>
        s.Moves < score.Moves || (s.Moves == score.Moves && s.Seconds < score.Seconds));
    return Results.Ok(new ScoreSaved(score.Id, better + 1, await TopScores(db)));
}).RequireRateLimiting("writes");

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

// แก้เรื่อง (เช่น แก้คำผิด) ส่งมาแบบเดียวกับตอนส่งเรื่องใหม่ ตรวจด้วยกฎเดียวกัน
app.MapPut("/admin/stories/{id:int}", async (int id, StoryRequest body, HttpRequest request, NakcatDb db) =>
{
    if (!IsAdmin(request)) return Results.Unauthorized();
    CatStory? story = await db.CatStories.FindAsync(id);
    if (story == null)
    {
        return Results.NotFound(new ErrorResponse($"ไม่พบเรื่องเลขที่ {id}"));
    }
    string catName = body.CatName?.Trim() ?? "";
    string author = body.AuthorName?.Trim() ?? "";
    string text = body.Story?.Trim() ?? "";
    string? error = ValidateStory(catName, author, text);
    if (error != null)
    {
        return Results.BadRequest(new ErrorResponse(error));
    }
    story.CatName = catName;
    story.AuthorName = author == "" ? "ทาสแมวนิรนาม" : author;
    story.Story = text;
    await db.SaveChangesAsync();
    return Results.Ok(story);
});

// ลบเรื่องทิ้งถาวร (ต่างจาก "ไม่อนุมัติ" ที่ยังเก็บไว้ดูย้อนหลังได้)
app.MapDelete("/admin/stories/{id:int}", async (int id, HttpRequest request, NakcatDb db) =>
{
    if (!IsAdmin(request)) return Results.Unauthorized();
    int deleted = await db.CatStories.Where(s => s.Id == id).ExecuteDeleteAsync();
    return deleted == 0 ? Results.NotFound(new ErrorResponse($"ไม่พบเรื่องเลขที่ {id}")) : Results.NoContent();
});

// ลบคะแนนเกมที่ไม่เหมาะสม (เช่น ชื่อหยาบ หรือคะแนนที่ดูโกง)
app.MapDelete("/admin/memory-scores/{id:int}", async (int id, HttpRequest request, NakcatDb db) =>
{
    if (!IsAdmin(request)) return Results.Unauthorized();
    int deleted = await db.MemoryScores.Where(s => s.Id == id).ExecuteDeleteAsync();
    return deleted == 0 ? Results.NotFound(new ErrorResponse($"ไม่พบคะแนนเลขที่ {id}")) : Results.NoContent();
});

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

// ข้อความติดต่อ ดาวให้เกม โหวตบทความ ตัวนับคนเข้าเว็บ และหน้าภาพรวมแอดมิน (อยู่ในไฟล์ InsightsEndpoints.cs)
app.MapInsights(IsAdmin);

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

// ตรวจคะแนนเกม: เกมมี 6 คู่ ต่อให้เปิดถูกทุกครั้งก็ต้องใช้อย่างน้อย 6 ครั้ง และคนจริงเปิด 12 ใบไม่ทันใน 3 วินาที
static string? ValidateScore(string name, int moves, int seconds)
{
    if (name == "") return "ใส่ชื่อที่จะขึ้นกระดานด้วยนะ";
    if (name.Length > 20) return "ชื่อยาวเกิน 20 ตัวอักษร";
    if (moves < 6 || moves > 200) return "จำนวนครั้งไม่ถูกต้อง";
    if (seconds < 3 || seconds > 3600) return "เวลาที่ใช้ไม่ถูกต้อง";
    return null;
}

// 10 อันดับแรก: ครั้งน้อยสุดก่อน ถ้าเท่ากันดูเวลา ถ้ายังเท่ากันใครทำได้ก่อนอยู่บน
static async Task<List<PublicScore>> TopScores(NakcatDb db) =>
    await db.MemoryScores
        .OrderBy(s => s.Moves).ThenBy(s => s.Seconds).ThenBy(s => s.CreatedAt)
        .Take(10)
        .Select(s => new PublicScore(s.Id, s.PlayerName, s.Moves, s.Seconds, s.CreatedAt))
        .ToListAsync();

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
    Npgsql.NpgsqlConnectionStringBuilder result;
    if (value.StartsWith("postgres://") || value.StartsWith("postgresql://"))
    {
        var uri = new Uri(value);
        string[] user = uri.UserInfo.Split(':', 2);
        result = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(user[0]),
            Password = user.Length > 1 ? Uri.UnescapeDataString(user[1]) : "",
            SslMode = Npgsql.SslMode.Require, // เชื่อมต่อแบบเข้ารหัสเสมอ
        };
    }
    else
    {
        result = new Npgsql.NpgsqlConnectionStringBuilder(value);
    }
    // ปิดการล็อกอินแบบ Kerberos (GSS) ที่ Neon ไม่ได้ใช้ ไม่งั้นบน Render จะ error หาไฟล์ libgssapi_krb5.so.2 ไม่เจอ
    result.GssEncryptionMode = Npgsql.GssEncryptionMode.Disable;
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
record RatingRequest(int Score, string? Comment);
record RatingSummary(int Count, double Average);
record ErrorResponse(string Message);
record StoryRequest(string? CatName, string? AuthorName, string? Story); // ? = หน้าเว็บอาจไม่ส่งช่องนี้มา
record StorySubmitted(int Id, string Message);
record PublicStory(int Id, string CatName, string AuthorName, string Story, DateTime CreatedAt, int Likes);
record StoryLikes(int Id, int Likes);
record BreedLikeCount(string Breed, int Count);
record ScoreRequest(string? PlayerName, int Moves, int Seconds);
record PublicScore(int Id, string PlayerName, int Moves, int Seconds, DateTime CreatedAt);
record ScoreSaved(int Id, int Rank, List<PublicScore> Top);
