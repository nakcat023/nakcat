"use strict";
// ฟอร์ม "ติดต่อเรา" ในหน้าแรก: ส่งชื่อ อีเมล ข้อความ เข้า API แล้วแอดมินอ่านได้ในแท็บ "✉️ ข้อความ"
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/contact.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/contact.js ใหม่
(() => {
    const form = document.querySelector('#contact-form');
    const status = document.querySelector('#form-status');
    const submitBtn = document.querySelector('#contact-submit');
    const honeypot = form?.querySelector('input[name="bot-field"]');
    if (!form || !status || !submitBtn || !honeypot)
        return;
    const field = (name) => form.querySelector(`[name="${name}"]`)?.value ?? '';
    const setStatus = (kind, message) => {
        status.className = `form-note ${kind}`;
        status.textContent = message;
    };
    const failMessage = 'ส่งไม่สำเร็จ 😿 ลองใหม่อีกครั้ง หรือทักมาทาง Instagram, Facebook หรือ TikTok ได้เลย';
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ช่องดักบอท: คนมองไม่เห็นช่องนี้ ถ้ามีค่าแปลว่าบอทกรอก ทำเป็นส่งสำเร็จแต่ไม่ส่งจริง
        if (honeypot.value) {
            form.reset();
            setStatus('is-success', 'ส่งข้อความเรียบร้อยแล้ว ขอบคุณมากนะ 🐾');
            return;
        }
        if (!API_BASE) {
            setStatus('is-error', failMessage);
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังส่ง...';
        status.className = 'form-note';
        try {
            const res = await fetch(`${API_BASE}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: field('name'), email: field('email'), message: field('message') }),
            });
            const data = await res.json();
            if (res.ok)
                form.reset();
            setStatus(res.ok ? 'is-success' : 'is-error', data.message); // ไม่ผ่าน เช่น "อีเมลดูไม่ถูกต้อง ลองเช็กอีกทีนะ"
        }
        catch (err) {
            setStatus('is-error', failMessage);
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งข้อความ';
    });
})();
