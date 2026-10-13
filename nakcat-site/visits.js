"use strict";
// ตัวนับคนเข้าเว็บแบบไม่เก็บตัวตน: บอก API แค่ว่า "เปิดหน้าไหน / มือถือหรือคอม / วันนี้เพิ่งเข้าครั้งแรกไหม"
// ไม่ส่งชื่อ ไม่ส่งอีเมล ไม่ฝังคุกกี้ติดตาม ฝั่ง API ก็เก็บแค่ตัวเลขรวมรายวัน (ตาราง DailyStats)
// + ตัวนับเหตุการณ์อื่นๆ (เล่นเกมจบ ผลลัพธ์เกม กดแชร์ เปิดถาม-ตอบ) ที่ track() ใน index.html ส่งมาทางเหตุการณ์ nakcat:track
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/visits.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/visits.js ใหม่
(() => {
    if (!API_BASE)
        return;
    const api = API_BASE;
    // ส่งแบบไม่รอผล: นับไม่ได้ก็ไม่เป็นไร ไม่ให้กระทบการใช้เว็บ
    // keepalive = ถึงคนจะกดไปหน้าอื่นทันที คำขอนี้ก็ยังส่งจนจบ
    const send = (path, body) => {
        fetch(`${api}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true,
        }).catch(() => { });
    };
    // หน้าไหน: "/" หรือ "/index.html" = index, "/article-sleep.html" หรือ "/article-sleep" = article-sleep
    const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') || 'index';
    // จอสัมผัสเป็นหลัก = มือถือ/แท็บเล็ต, ใช้เมาส์ = คอม
    const device = window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
    // "คนเข้าวันนี้" = เบราว์เซอร์ที่เปิดเว็บครั้งแรกของวัน (จำแค่วันที่ล่าสุดไว้ในเครื่อง ไม่มีรหัสประจำตัว)
    const DAY_KEY = 'nakcat-last-visit-day';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()); // เช่น 2026-10-13
    let lastDay = null;
    try {
        lastDay = localStorage.getItem(DAY_KEY);
    }
    catch (e) { }
    const newVisitor = lastDay !== today;
    try {
        localStorage.setItem(DAY_KEY, today);
    }
    catch (e) { }
    send('/visits', { page, device, newVisitor });
    document.addEventListener('nakcat:track', (e) => {
        const keys = e.detail;
        if (keys.length > 0)
            send('/events', { keys });
    });
})();
