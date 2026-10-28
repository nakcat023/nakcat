"use strict";
// ที่อยู่ของ API หลังบ้าน (โฟลเดอร์ api) ใช้ร่วมกันทุกไฟล์ที่คุยกับ API
// ต้องโหลดไฟล์นี้ (api.js) ก่อนไฟล์อื่นที่ใช้ API_BASE
// ไฟล์ต้นฉบับคือ src/api.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/api.js ใหม่
// เว็บจริง (Netlify): ใช้ API บน Render / เปิดในเครื่อง: ใช้ API ที่รัน dotnet run ไว้ (localhost:5080)
// API บน Render แบบฟรีจะหลับถ้าไม่มีคนใช้ 15 นาที ครั้งแรกที่เรียกอาจรอเกือบ 1 นาที
const API_BASE = location.hostname === 'nakcat.netlify.app' ? 'https://nakcat-api.onrender.com' : 'http://localhost:5080';
// ข้อความบอกคนใช้ตอน API ยังหลับอยู่ (ใช้คู่กับ onSlowApi)
//   = ช่องว่างที่ห้ามตัดบรรทัด กันจอมือถือตัด "1" กับ "นาที" ไว้คนละบรรทัด
const API_WAKING = 'ระบบกำลังตื่น รอสักครู่นะ ครั้งแรกอาจนานถึง 1 นาที';
// ปกติ API ตอบใน 1-3 วินาที ถ้าเกิน 4 วินาทียังเงียบ แปลว่าน่าจะหลับอยู่ ให้เรียก show (ขึ้นข้อความ API_WAKING)
// ได้ฟังก์ชันคืนมา: เรียกตอน fetch จบ (สำเร็จหรือไม่ก็ตาม) เพื่อยกเลิก ถ้ายังไม่ถึง 4 วินาทีข้อความจะไม่ขึ้นเลย
function onSlowApi(show, ms = 4000) {
    const timer = setTimeout(show, ms);
    return () => clearTimeout(timer);
}
