"use strict";
// ส่วน "เรื่องเล่าจากทาสแมว" ในหน้าแรก: แสดงเรื่องที่แอดมินอนุมัติแล้ว + ฟอร์มส่งเรื่องใหม่ (ผ่าน API)
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/stories.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/stories.js ใหม่
(() => {
    const section = document.querySelector('#tales');
    const list = document.querySelector('#tales-list');
    const form = document.querySelector('#tale-form');
    const catInput = document.querySelector('#tale-cat');
    const authorInput = document.querySelector('#tale-author');
    const storyInput = document.querySelector('#tale-story');
    const honeypot = document.querySelector('#tale-website');
    const counter = document.querySelector('#tale-count');
    const submitBtn = document.querySelector('#tale-submit');
    const status = document.querySelector('#tale-status');
    if (!section || !list || !form || !catInput || !authorInput || !storyInput || !honeypot || !counter || !submitBtn || !status)
        return;
    // เว็บจริงยังไม่มี API: ปล่อยส่วนนี้ซ่อนไว้ (ใน HTML ใส่ hidden ไว้ตั้งแต่แรก)
    if (!API_BASE)
        return;
    const api = API_BASE;
    section.hidden = false;
    const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    // ===================== รายการเรื่องเล่า =====================
    // สร้างการ์ด 1 ใบ: ใช้ textContent ทุกช่อง ข้อความที่คนพิมพ์มาจะแสดงเป็นตัวหนังสือเสมอ ไม่ถูกตีความเป็นโค้ด
    const storyCard = (s) => {
        const card = document.createElement('article');
        card.className = 'tale-card';
        const text = document.createElement('p');
        text.className = 'tale-text';
        text.textContent = s.story;
        const who = document.createElement('p');
        who.className = 'tale-who';
        const cat = document.createElement('strong');
        cat.textContent = `🐱 ${s.catName}`;
        const meta = document.createElement('span');
        meta.textContent = `เล่าโดย ${s.authorName} · ${dateFormat.format(new Date(s.createdAt))}`;
        who.append(cat, meta);
        card.append(text, who);
        return card;
    };
    const showListMessage = (message) => {
        const p = document.createElement('p');
        p.className = 'tales-empty';
        p.textContent = message;
        list.replaceChildren(p);
    };
    const loadStories = async () => {
        showListMessage('กำลังโหลดเรื่องเล่า... 🐾');
        try {
            const res = await fetch(`${api}/stories`);
            if (!res.ok)
                throw new Error(String(res.status));
            const stories = await res.json();
            if (stories.length === 0) {
                showListMessage('ยังไม่มีเรื่องเล่า มาเป็นคนแรกที่เล่าเรื่องน้องกัน!');
                return;
            }
            list.replaceChildren(...stories.map(storyCard));
        }
        catch (err) {
            showListMessage('โหลดเรื่องเล่าไม่สำเร็จ 😿 ลองรีเฟรชหน้าอีกครั้งนะ');
        }
    };
    // ===================== ฟอร์มส่งเรื่อง =====================
    // นับตัวอักษรแบบเดียวกับ API (ไม่นับช่องว่างหน้า-หลัง)
    const updateCounter = () => {
        counter.textContent = `${storyInput.value.trim().length.toLocaleString('th-TH')}/1,000 ตัวอักษร`;
    };
    const setStatus = (kind, message) => {
        status.className = `tale-status ${kind}`;
        status.textContent = message;
    };
    storyInput.addEventListener('input', updateCounter);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ช่องดักบอท: คนมองไม่เห็นช่องนี้ ถ้ามีค่าแปลว่าบอทกรอก ทำเป็นส่งสำเร็จแต่ไม่ส่งจริง
        if (honeypot.value) {
            form.reset();
            updateCounter();
            setStatus('is-success', 'ได้รับเรื่องแล้ว 🐾');
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังส่ง...';
        setStatus('', '');
        try {
            const res = await fetch(`${api}/stories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ catName: catInput.value, authorName: authorInput.value, story: storyInput.value }),
            });
            const data = await res.json();
            if (res.ok) {
                form.reset();
                updateCounter();
                setStatus('is-success', data.message);
            }
            else {
                setStatus('is-error', data.message); // เช่น "เล่าอีกนิดนะ อย่างน้อย 20 ตัวอักษร"
            }
        }
        catch (err) {
            setStatus('is-error', 'ส่งไม่สำเร็จ 😿 เช็กอินเทอร์เน็ตแล้วลองใหม่อีกครั้งนะ');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งเรื่องเล่า';
    });
    updateCounter();
    loadStories();
})();
