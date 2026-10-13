using Microsoft.EntityFrameworkCore;

// ตัวแทนฐานข้อมูลของ nakcat: แต่ละ DbSet คือ 1 ตาราง
public class NakcatDb : DbContext
{
    public NakcatDb(DbContextOptions<NakcatDb> options) : base(options)
    {
    }

    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<CatStory> CatStories => Set<CatStory>();
    public DbSet<BreedLike> BreedLikes => Set<BreedLike>();
    public DbSet<MemoryScore> MemoryScores => Set<MemoryScore>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<GameRating> GameRatings => Set<GameRating>();
    public DbSet<ArticleFeedback> ArticleFeedbacks => Set<ArticleFeedback>();
    public DbSet<DailyStat> DailyStats => Set<DailyStat>();

    // ตั้งค่าตารางเพิ่มเติมที่บอกผ่าน property เฉยๆ ไม่ได้
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ตาราง BreedLikes ใช้ชื่อพันธุ์เป็นกุญแจ (ไม่มีเลข Id) และใส่ทุกพันธุ์ไว้ตั้งแต่สร้างตาราง หัวใจเริ่มที่ 0
        modelBuilder.Entity<BreedLike>().HasKey(b => b.Breed);
        modelBuilder.Entity<BreedLike>().HasData(BreedLike.AllBreeds.Select(name => new BreedLike { Breed = name, Count = 0 }));

        // ตาราง DailyStats ใช้ "วัน + ชื่อตัวนับ" คู่กันเป็นกุญแจ (1 วัน มีตัวนับแต่ละชื่อได้แถวเดียว)
        modelBuilder.Entity<DailyStat>().HasKey(s => new { s.Day, s.Key });
    }
}
// (หมายเหตุ: PostgreSQL จำได้เองว่าเวลาเป็น UTC จึงไม่ต้องมีตัวแปลงเวลาแบบตอนใช้ SQLite แล้ว)

// คะแนนรีวิวเว็บ 1 ครั้ง = 1 แถวในตาราง Ratings
public class Rating
{
    public int Id { get; set; }                 // เลขประจำแถว ฐานข้อมูลใส่ให้เอง (1, 2, 3, ...)
    public int Score { get; set; }              // คะแนน 1–5
    public string? Comment { get; set; }        // ความเห็นเพิ่มเติม (ไม่กรอกก็ได้ = null)
    public DateTime CreatedAt { get; set; }     // เวลาที่ส่ง (เวลาสากล UTC)
}

// เรื่องเล่าแมวที่คนส่งมา 1 เรื่อง = 1 แถวในตาราง CatStories
public class CatStory
{
    public int Id { get; set; }
    public string CatName { get; set; } = "";       // ชื่อแมว
    public string AuthorName { get; set; } = "";    // ชื่อคนเล่า
    public string Story { get; set; } = "";         // ตัวเรื่อง
    public StoryStatus Status { get; set; }         // สถานะ: รอตรวจ / อนุมัติ / ไม่อนุมัติ
    public DateTime CreatedAt { get; set; }         // เวลาที่ส่ง (UTC)
    public DateTime? ReviewedAt { get; set; }       // เวลาที่แอดมินตรวจ (ยังไม่ตรวจ = null)
    public int Likes { get; set; }                  // จำนวนคนที่กดถูกใจ
}

// หัวใจรวมของแมว 1 พันธุ์ = 1 แถวในตาราง BreedLikes
public class BreedLike
{
    public string Breed { get; set; } = "";     // ชื่อพันธุ์ภาษาอังกฤษ เช่น "Scottish Fold"
    public int Count { get; set; }              // จำนวนคนที่กดหัวใจ

    // ต้องตรงกับช่อง en ของ breeds ใน nakcat-site/index.html (เพิ่มพันธุ์ใหม่ = เพิ่มที่นี่ แล้วสร้าง migration ใหม่)
    public static readonly string[] AllBreeds =
    [
        "Abyssinian", "American Shorthair", "Australian Mist", "Bengal", "Birman", "British Shorthair",
        "Burmilla", "Chinchilla Persian", "Exotic Shorthair", "Khao Manee", "Korat", "Maine Coon",
        "Munchkin", "Norwegian Forest", "Ocicat", "Persian", "RagaMuffin", "Ragdoll",
        "Russian Blue", "Scottish Fold", "Siamese", "Sphynx",
    ];
}

// คะแนนเกมจับคู่การ์ดแมว 1 ครั้ง = 1 แถวในตาราง MemoryScores (ยิ่งใช้ครั้งน้อย ยิ่งอันดับดี)
public class MemoryScore
{
    public int Id { get; set; }
    public string PlayerName { get; set; } = "";    // ชื่อที่ขึ้นกระดานคะแนน
    public int Moves { get; set; }                  // จำนวนครั้งที่เปิดการ์ด (เปิด 2 ใบ = 1 ครั้ง)
    public int Seconds { get; set; }                // เวลาที่ใช้ (ใช้ตัดสินตอนจำนวนครั้งเท่ากัน)
    public DateTime CreatedAt { get; set; }         // เวลาที่บันทึก (UTC)
}

// สถานะของเรื่องเล่า: เลือกได้ 3 แบบนี้เท่านั้น
public enum StoryStatus
{
    Pending,   // รอแอดมินตรวจ (ค่าเริ่มต้น)
    Approved,  // อนุมัติแล้ว ขึ้นเว็บได้
    Rejected,  // ไม่อนุมัติ
}

// ข้อความจากฟอร์ม "ติดต่อเรา" 1 ข้อความ = 1 แถวในตาราง ContactMessages
// มีชื่อและอีเมลที่คนส่งตั้งใจให้ไว้ เพื่อให้เราตอบกลับได้ ดูได้เฉพาะในหน้าแอดมินเท่านั้น
public class ContactMessage
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }            // แอดมินเปิดอ่านแล้วหรือยัง
}

// ดาวที่ให้หลังเล่นเกมจบ ("เกมนี้สนุกไหม?") 1 ครั้ง = 1 แถว
public class GameRating
{
    public int Id { get; set; }
    public string Game { get; set; } = "";      // รหัสเกม เช่น "memory-match" (ดูรายชื่อใน Known.Games)
    public int Stars { get; set; }              // 1–5 ดาว
    public DateTime CreatedAt { get; set; }
}

// โหวตท้ายบทความ ("บทความนี้มีประโยชน์ไหม?") 1 ครั้ง = 1 แถว
public class ArticleFeedback
{
    public int Id { get; set; }
    public string Article { get; set; } = "";   // รหัสบทความ เช่น "article-sleep"
    public string Vote { get; set; } = "";      // "up" = มีประโยชน์ / "down" = ยังไม่ค่อย
    public string? Comment { get; set; }        // เหตุผลตอนกด 👎 (ไม่กรอกก็ได้)
    public DateTime CreatedAt { get; set; }
}

// ตัวนับรายวัน: เก็บแค่ตัวเลขรวม ไม่เก็บว่าใครเข้า (ไม่มี IP ไม่มีชื่อ)
// เช่น วันที่ 2026-10-13 + "views:index" = 57 → วันนั้นหน้าแรกถูกเปิด 57 ครั้ง
public class DailyStat
{
    public DateOnly Day { get; set; }           // วันตามเวลาไทย
    public string Key { get; set; } = "";       // ชื่อตัวนับ เช่น visitors, views:<หน้า>, plays:<เกม> (ดูทั้งหมดใน Known.EventKeys)
    public int Count { get; set; }
}
