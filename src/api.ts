// ที่อยู่ของ API หลังบ้าน (โฟลเดอร์ api) ใช้ร่วมกันทุกไฟล์ที่คุยกับ API
// ต้องโหลดไฟล์นี้ (api.js) ก่อนไฟล์อื่นที่ใช้ API_BASE
// ไฟล์ต้นฉบับคือ src/api.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/api.js ใหม่

// ในเครื่อง: localhost:5080 / เว็บจริง: ยังไม่มี API (null) จะใส่ที่อยู่ Render ตอนขั้นที่ 7
const API_BASE: string | null = location.hostname === 'nakcat.netlify.app' ? null : 'http://localhost:5080';
