"use strict";
// ที่อยู่ของ API หลังบ้าน (โฟลเดอร์ api) ใช้ร่วมกันทุกไฟล์ที่คุยกับ API
// ต้องโหลดไฟล์นี้ (api.js) ก่อนไฟล์อื่นที่ใช้ API_BASE
// ไฟล์ต้นฉบับคือ src/api.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/api.js ใหม่
// เว็บจริง (Netlify): ใช้ API บน Render / เปิดในเครื่อง: ใช้ API ที่รัน dotnet run ไว้ (localhost:5080)
// API บน Render แบบฟรีจะหลับถ้าไม่มีคนใช้ 15 นาที ครั้งแรกที่เรียกอาจรอเกือบ 1 นาที
const API_BASE = location.hostname === 'nakcat.netlify.app' ? 'https://nakcat-api.onrender.com' : 'http://localhost:5080';
