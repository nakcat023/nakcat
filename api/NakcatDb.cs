using Microsoft.EntityFrameworkCore;

// ตัวแทนฐานข้อมูลของ nakcat: แต่ละ DbSet คือ 1 ตาราง
public class NakcatDb : DbContext
{
    public NakcatDb(DbContextOptions<NakcatDb> options) : base(options)
    {
    }

    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<CatStory> CatStories => Set<CatStory>();
}
// (หมายเหตุ: PostgreSQL จำได้เองว่าเวลาเป็น UTC จึงไม่ต้องมีตัวแปลงเวลาแบบตอนใช้ SQLite แล้ว)

// คะแนนรีวิวเว็บ 1 ครั้ง = 1 แถวในตาราง Ratings
public class Rating
{
    public int Id { get; set; }                 // เลขประจำแถว ฐานข้อมูลใส่ให้เอง (1, 2, 3, ...)
    public int Score { get; set; }              // คะแนน 1–5
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
}

// สถานะของเรื่องเล่า: เลือกได้ 3 แบบนี้เท่านั้น
public enum StoryStatus
{
    Pending,   // รอแอดมินตรวจ (ค่าเริ่มต้น)
    Approved,  // อนุมัติแล้ว ขึ้นเว็บได้
    Rejected,  // ไม่อนุมัติ
}
