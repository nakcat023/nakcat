// ข้อมูลที่หน้าเว็บส่งมาให้ "ดูหลังบ้าน": ข้อความติดต่อ ดาวให้เกม โหวตบทความ ตัวนับคนเข้าเว็บ และตัวนับเหตุการณ์ (เกม แชร์ ถาม-ตอบ)
// + หน้าภาพรวมของแอดมินที่รวมทุกอย่างไว้ที่เดียว
// แยกไฟล์ออกมาจาก Program.cs จะได้ไม่ยาวเกินไป (Program.cs เรียกใช้ด้วย app.MapInsights(IsAdmin))

using System.Net.Mail;
using Microsoft.EntityFrameworkCore;

public static class InsightsEndpoints
{
    public static void MapInsights(this WebApplication app, Func<HttpRequest, bool> isAdmin)
    {
        // ===================== ฝั่งคนเข้าเว็บ: ส่งข้อมูลเข้ามา =====================

        // ฟอร์ม "ติดต่อเรา": {"name": "...", "email": "...", "message": "..."}
        app.MapPost("/contact", async (ContactRequest request, NakcatDb db) =>
        {
            string name = request.Name?.Trim() ?? "";
            string email = request.Email?.Trim() ?? "";
            string message = request.Message?.Trim() ?? "";
            string? error = ValidateContact(name, email, message);
            if (error != null)
            {
                return Results.BadRequest(new ErrorResponse(error));
            }
            db.ContactMessages.Add(new ContactMessage { Name = name, Email = email, Message = message, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok(new ErrorResponse("ส่งข้อความเรียบร้อยแล้ว ขอบคุณมากนะ 🐾 เราจะตอบกลับทางอีเมลโดยเร็ว"));
        }).RequireRateLimiting("writes");

        // ดาวหลังเล่นเกมจบ: {"game": "memory-match", "stars": 5}
        app.MapPost("/game-ratings", async (GameRatingRequest request, NakcatDb db) =>
        {
            if (!Known.Games.Contains(request.Game)) return Results.BadRequest(new ErrorResponse("ไม่รู้จักเกมนี้"));
            if (request.Stars < 1 || request.Stars > 5) return Results.BadRequest(new ErrorResponse("ดาวต้องอยู่ระหว่าง 1 ถึง 5"));
            db.GameRatings.Add(new GameRating { Game = request.Game!, Stars = request.Stars, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireRateLimiting("writes");

        // โหวตท้ายบทความ: {"article": "article-sleep", "vote": "down", "comment": "อยากให้มีรูปเยอะขึ้น"}
        app.MapPost("/article-feedback", async (ArticleFeedbackRequest request, NakcatDb db) =>
        {
            string comment = request.Comment?.Trim() ?? "";
            if (!Known.Articles.Contains(request.Article)) return Results.BadRequest(new ErrorResponse("ไม่รู้จักบทความนี้"));
            if (request.Vote is not ("up" or "down")) return Results.BadRequest(new ErrorResponse("โหวตไม่ถูกต้อง"));
            if (comment.Length > 1000) return Results.BadRequest(new ErrorResponse("ความเห็นยาวเกิน 1,000 ตัวอักษร"));
            db.ArticleFeedbacks.Add(new ArticleFeedback
            {
                Article = request.Article!,
                Vote = request.Vote,
                Comment = comment == "" ? null : comment,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireRateLimiting("writes");

        // นับคนเข้าเว็บ (ส่งมาทุกครั้งที่เปิดหน้า): {"page": "index", "device": "mobile", "newVisitor": true}
        // newVisitor = เบราว์เซอร์นี้เพิ่งเข้าครั้งแรกของวัน (หน้าเว็บจำวันที่ไว้เอง) ใช้นับ "วันนี้มีกี่คน"
        app.MapPost("/visits", async (VisitRequest request, NakcatDb db) =>
        {
            if (!Known.Pages.Contains(request.Page) || request.Device is not ("mobile" or "desktop"))
            {
                return Results.BadRequest(new ErrorResponse("ข้อมูลไม่ถูกต้อง"));
            }
            await Bump(db, $"views:{request.Page}");
            if (request.NewVisitor)
            {
                await Bump(db, "visitors");
                await Bump(db, $"device:{request.Device}");
            }
            return Results.NoContent();
        }).RequireRateLimiting("tracking");

        // ตัวนับเหตุการณ์อื่นๆ (เล่นเกมจบ ผลลัพธ์เกม กดแชร์ เปิดอ่านถาม-ตอบ): {"keys": ["plays:true-or-false", "truth-score:8", ...]}
        // ส่งหลายตัวนับในคำขอเดียวได้ ทุกชื่อต้องอยู่ในรายการที่อนุญาต (Known.EventKeys) ไม่งั้นปฏิเสธทั้งคำขอ
        app.MapPost("/events", async (EventsRequest request, NakcatDb db) =>
        {
            string[] keys = request.Keys ?? [];
            if (keys.Length == 0 || keys.Length > 25 || !keys.All(Known.EventKeys.Contains))
            {
                return Results.BadRequest(new ErrorResponse("ข้อมูลไม่ถูกต้อง"));
            }
            foreach (string key in keys)
            {
                await Bump(db, key);
            }
            return Results.NoContent();
        }).RequireRateLimiting("tracking");

        // ===================== ฝั่งแอดมิน (ต้องส่ง X-Admin-Key มา) =====================

        // ภาพรวมทั้งเว็บในคำขอเดียว: คนเข้า 14 วันล่าสุด / ตัวนับอื่นๆ 30 วันล่าสุด / ดาว โหวต กระดานคะแนน ตั้งแต่เริ่มเก็บ / งานที่รอทำ
        app.MapGet("/admin/overview", async (HttpRequest request, NakcatDb db) =>
        {
            if (!isAdmin(request)) return Results.Unauthorized();

            DateOnly today = ThaiToday();
            DateOnly from14 = today.AddDays(-13);
            DateOnly from30 = today.AddDays(-29);
            // ตัวนับ 30 วันมีไม่กี่ร้อยแถว ดึงมาทีเดียวแล้วรวมในโปรแกรมเลย
            List<DailyStat> stats = await db.DailyStats.Where(s => s.Day >= from30).ToListAsync();
            int Sum(Func<DailyStat, bool> match) => stats.Where(match).Sum(s => s.Count);
            int Count(string key) => Sum(s => s.Key == key);
            List<NamedCount> Counts(IEnumerable<string> names, string prefix) =>
                names.Select(n => new NamedCount(n, Count($"{prefix}{n}"))).ToList();

            List<DailyVisits> daily = Enumerable.Range(0, 14)
                .Select(i => from14.AddDays(i))
                .Select(day => new DailyVisits(
                    day,
                    Sum(s => s.Day == day && s.Key == "visitors"),
                    Sum(s => s.Day == day && s.Key.StartsWith("views:"))))
                .ToList();

            List<NamedCount> pages = Counts(Known.Pages, "views:");
            List<NamedCount> devices = Counts(["mobile", "desktop"], "device:");

            var ratingsByGame = await db.GameRatings
                .GroupBy(r => r.Game)
                .Select(g => new { Game = g.Key, Count = g.Count(), Average = g.Average(r => r.Stars) })
                .ToListAsync();
            List<GameStats> games = Known.Games.Select(game =>
            {
                var r = ratingsByGame.FirstOrDefault(x => x.Game == game);
                return new GameStats(game, Count($"plays:{game}"), Count($"shares:{game}"), r?.Count ?? 0, Math.Round(r?.Average ?? 0, 1));
            }).ToList();

            // จริงหรือมั่ว: คะแนนเฉลี่ย / ได้เต็มกี่ครั้ง / แต่ละข้อตอบถูก-ผิดกี่ครั้ง
            var scores = Enumerable.Range(0, Known.TruthQuestions.Length + 1)
                .Select(score => (Score: score, Times: Count($"truth-score:{score}")))
                .ToList();
            int truthFinished = scores.Sum(x => x.Times);
            var truth = new TruthStats(
                truthFinished,
                Known.TruthQuestions.Length,
                truthFinished == 0 ? 0 : Math.Round((double)scores.Sum(x => x.Score * x.Times) / truthFinished, 1),
                scores[^1].Times,
                Known.TruthQuestions.Select(q => new TruthQuestion(q, Count($"truth-right:{q}"), Count($"truth-wrong:{q}"))).ToList());

            // ผลลัพธ์ที่ออก: แมวพันธุ์ไหนเหมาะกับคุณ (เฉพาะพันธุ์ที่เคยออก เรียงมากไปน้อย) / แมวของคุณเป็นสายไหน
            List<NamedCount> breedResults = Counts(BreedLike.AllBreeds, "result:breed-match:")
                .Where(c => c.Count > 0).OrderByDescending(c => c.Count).Take(8).ToList();
            List<NamedCount> personalityResults = Counts(Known.Personalities, "result:personality:");

            // กระดานจับคู่การ์ด: บันทึกไว้กี่คน + อันดับ 1 ตอนนี้
            var memory = new MemorySummary(
                await db.MemoryScores.CountAsync(),
                await db.MemoryScores
                    .OrderBy(s => s.Moves).ThenBy(s => s.Seconds).ThenBy(s => s.CreatedAt)
                    .Select(s => new PublicScore(s.Id, s.PlayerName, s.Moves, s.Seconds, s.CreatedAt))
                    .FirstOrDefaultAsync());

            var votesByArticle = await db.ArticleFeedbacks
                .GroupBy(f => f.Article)
                .Select(g => new { Article = g.Key, Up = g.Count(f => f.Vote == "up"), Down = g.Count(f => f.Vote == "down") })
                .ToListAsync();
            List<ArticleVotes> articles = Known.Articles.Select(article =>
            {
                var v = votesByArticle.FirstOrDefault(x => x.Article == article);
                return new ArticleVotes(article, v?.Up ?? 0, v?.Down ?? 0);
            }).ToList();

            int siteCount = await db.Ratings.CountAsync();
            double siteAverage = siteCount == 0 ? 0 : Math.Round(await db.Ratings.AverageAsync(r => r.Score), 1);

            return Results.Ok(new Overview(
                today,
                await db.CatStories.CountAsync(s => s.Status == StoryStatus.Pending),
                await db.ContactMessages.CountAsync(m => !m.IsRead),
                new RatingSummary(siteCount, siteAverage),
                daily, pages, devices, games, Counts(Known.ShareChannels, "share-via:"),
                truth, breedResults, personalityResults, memory, articles, Counts(Known.Faqs, "faq:")));
        });

        // ข้อความติดต่อ ใหม่สุดขึ้นก่อน
        app.MapGet("/admin/messages", async (HttpRequest request, NakcatDb db) =>
        {
            if (!isAdmin(request)) return Results.Unauthorized();
            return Results.Ok(await db.ContactMessages.OrderByDescending(m => m.CreatedAt).Take(200).ToListAsync());
        });

        // ทำเครื่องหมายว่าอ่านแล้ว
        app.MapPost("/admin/messages/{id:int}/read", async (int id, HttpRequest request, NakcatDb db) =>
        {
            if (!isAdmin(request)) return Results.Unauthorized();
            int updated = await db.ContactMessages.Where(m => m.Id == id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(m => m.IsRead, true));
            return updated == 0 ? Results.NotFound(new ErrorResponse($"ไม่พบข้อความเลขที่ {id}")) : Results.NoContent();
        });

        // ลบข้อความทิ้งถาวร
        app.MapDelete("/admin/messages/{id:int}", async (int id, HttpRequest request, NakcatDb db) =>
        {
            if (!isAdmin(request)) return Results.Unauthorized();
            int deleted = await db.ContactMessages.Where(m => m.Id == id).ExecuteDeleteAsync();
            return deleted == 0 ? Results.NotFound(new ErrorResponse($"ไม่พบข้อความเลขที่ {id}")) : Results.NoContent();
        });

        // ความเห็นทั้งหมดที่คนพิมพ์มา (จากการให้คะแนนเว็บ + โหวตบทความ) รวมเป็นรายการเดียว ใหม่สุดขึ้นก่อน
        app.MapGet("/admin/comments", async (HttpRequest request, NakcatDb db) =>
        {
            if (!isAdmin(request)) return Results.Unauthorized();
            List<AdminComment> site = await db.Ratings
                .Where(r => r.Comment != null)
                .OrderByDescending(r => r.CreatedAt).Take(100)
                .Select(r => new AdminComment("site", "เว็บ nakcat", r.Score, null, r.Comment!, r.CreatedAt))
                .ToListAsync();
            List<AdminComment> article = await db.ArticleFeedbacks
                .Where(f => f.Comment != null)
                .OrderByDescending(f => f.CreatedAt).Take(100)
                .Select(f => new AdminComment("article", f.Article, null, f.Vote, f.Comment!, f.CreatedAt))
                .ToListAsync();
            return Results.Ok(site.Concat(article).OrderByDescending(c => c.CreatedAt).Take(100));
        });
    }

    // "วันนี้" ตามเวลาไทย (UTC+7 ทั้งปี ไม่มีเปลี่ยนเวลาตามฤดู) เซิร์ฟเวอร์ Render ใช้เวลา UTC
    static DateOnly ThaiToday() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    // บวก 1 ให้ตัวนับของวันนี้: ถ้ายังไม่มีแถวให้สร้างใหม่ (= 1) ถ้ามีแล้วให้ +1 ทำในคำสั่งเดียว คนกดพร้อมกันตัวเลขก็ไม่หาย
    // (ON CONFLICT เป็นคำสั่งเฉพาะของ PostgreSQL จึงเขียนเป็น SQL ตรงๆ)
    static Task<int> Bump(NakcatDb db, string key) =>
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "DailyStats" ("Day", "Key", "Count") VALUES ({ThaiToday()}, {key}, 1)
            ON CONFLICT ("Day", "Key") DO UPDATE SET "Count" = "DailyStats"."Count" + 1
            """);

    // ตรวจฟอร์มติดต่อ: ถูกต้องคืน null / ผิดคืนข้อความบอกว่าผิดตรงไหน
    static string? ValidateContact(string name, string email, string message)
    {
        if (name == "") return "ใส่ชื่อด้วยนะ";
        if (name.Length > 60) return "ชื่อยาวเกิน 60 ตัวอักษร";
        if (email.Length > 120 || !MailAddress.TryCreate(email, out _) || !email.Contains('.')) return "อีเมลดูไม่ถูกต้อง ลองเช็กอีกทีนะ";
        if (message.Length < 5) return "เขียนข้อความอีกนิดนะ";
        if (message.Length > 2000) return "ข้อความยาวเกิน 2,000 ตัวอักษร";
        return null;
    }
}

// รายชื่อที่ยอมรับ: กันคนส่งชื่อมั่วๆ เข้ามาสร้างตัวนับขยะ (เพิ่มเกม/บทความใหม่ = เพิ่มชื่อที่นี่ด้วย)
public static class Known
{
    // ต้องตรงกับ gameRating('...') ในหน้าเว็บ
    public static readonly string[] Games = ["breed-match", "personality", "true-or-false", "memory-match", "name-generator", "cat-says"];
    // ต้องตรงกับ <input name="article" value="..."> ในหน้าบทความ
    public static readonly string[] Articles = ["article-first24", "article-sleep", "article-language", "article-home"];
    // หน้าที่นับคนเข้า = หน้าแรก + ทุกบทความ (ไม่นับหน้าแอดมิน)
    public static readonly string[] Pages = ["index", .. Articles];
    // ผลลัพธ์ของเกม "แมวของคุณเป็นสายไหน" (ต้องตรงกับ quizResults ใน index.html)
    public static readonly string[] Personalities = ["sleep", "play", "cuddle", "explore"];
    // รหัสคำถามเกม "จริงหรือมั่ว?" (ต้องตรงกับ id ใน truthFacts ใน index.html) จำนวนข้อ = คะแนนเต็ม
    public static readonly string[] TruthQuestions = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"];
    // รหัสหัวข้อถาม-ตอบ (ต้องตรงกับ data-faq ใน index.html)
    public static readonly string[] Faqs = ["f1", "f2", "f3", "f4", "f5", "f6"];
    // ช่องทางแชร์ (ต้องตรงกับ data-via ของปุ่มแชร์)
    public static readonly string[] ShareChannels = ["facebook", "x", "story", "copy"];

    // ชื่อตัวนับทั้งหมดที่ /events ยอมรับ สร้างครั้งเดียวตอนเปิดโปรแกรม
    public static readonly HashSet<string> EventKeys =
    [
        .. Games.Select(g => $"plays:{g}"),
        .. Games.Select(g => $"shares:{g}"),
        .. ShareChannels.Select(c => $"share-via:{c}"),
        .. BreedLike.AllBreeds.Select(b => $"result:breed-match:{b}"),
        .. Personalities.Select(p => $"result:personality:{p}"),
        .. Enumerable.Range(0, TruthQuestions.Length + 1).Select(score => $"truth-score:{score}"),
        .. TruthQuestions.Select(q => $"truth-right:{q}"),
        .. TruthQuestions.Select(q => $"truth-wrong:{q}"),
        .. Faqs.Select(f => $"faq:{f}"),
    ];
}

// แบบฟอร์มข้อมูลที่รับเข้า / ส่งกลับ
record ContactRequest(string? Name, string? Email, string? Message);
record GameRatingRequest(string? Game, int Stars);
record ArticleFeedbackRequest(string? Article, string? Vote, string? Comment);
record VisitRequest(string? Page, string? Device, bool NewVisitor);
record EventsRequest(string[]? Keys);
record DailyVisits(DateOnly Day, int Visitors, int Views);
record NamedCount(string Name, int Count);
record GameStats(string Game, int Plays, int Shares, int RatingCount, double RatingAverage);
record TruthQuestion(string Id, int Right, int Wrong);
record TruthStats(int Finished, int MaxScore, double AverageScore, int Perfect, List<TruthQuestion> Questions);
record MemorySummary(int Saved, PublicScore? Best);
record ArticleVotes(string Article, int Up, int Down);
record Overview(DateOnly Today, int PendingStories, int UnreadMessages, RatingSummary Site,
    List<DailyVisits> Daily, List<NamedCount> Pages, List<NamedCount> Devices,
    List<GameStats> Games, List<NamedCount> ShareChannels,
    TruthStats Truth, List<NamedCount> BreedResults, List<NamedCount> PersonalityResults, MemorySummary Memory,
    List<ArticleVotes> Articles, List<NamedCount> Faq);
record AdminComment(string Kind, string Topic, int? Score, string? Vote, string Text, DateTime CreatedAt);
