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
    const sortButtons = document.querySelectorAll('.tales-sort [data-sort]');
    if (!section || !list || !form || !catInput || !authorInput || !storyInput || !honeypot || !counter || !submitBtn || !status)
        return;
    // เว็บจริงยังไม่มี API: ปล่อยส่วนนี้ซ่อนไว้ (ใน HTML ใส่ hidden ไว้ตั้งแต่แรก)
    if (!API_BASE)
        return;
    const api = API_BASE;
    section.hidden = false;
    const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    let sort = 'latest';
    // เรื่องที่เครื่องนี้กดถูกใจไว้ (เก็บเลข id) กันกดซ้ำ และให้ปุ่มขึ้นสีถูกต้องตอนเปิดเว็บครั้งหน้า
    const LIKED_KEY = 'nakcat-liked-stories';
    let liked = [];
    try {
        liked = JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]');
    }
    catch (e) { }
    const saveLiked = () => {
        try {
            localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
        }
        catch (e) { }
    };
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
        cat.textContent = `แมว: ${s.catName}`;
        const meta = document.createElement('span');
        meta.textContent = `เล่าโดย ${s.authorName} · ${dateFormat.format(new Date(s.createdAt))}`;
        who.append(cat, meta, likeButton(s));
        card.append(text, who);
        return card;
    };
    // ปุ่มถูกใจ ♡ 3 / ♥ 4: เปลี่ยนตัวเลขบนจอทันที แล้วค่อยบอก API (ถ้าไม่สำเร็จค่อยย้อนกลับ)
    const likeButton = (s) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tale-like';
        let count = s.likes;
        const show = () => {
            const on = liked.includes(s.id);
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', `ถูกใจเรื่องของ ${s.catName} (${count} คน)`);
            btn.textContent = `${on ? '♥' : '♡'} ${count.toLocaleString('th-TH')}`;
        };
        btn.addEventListener('click', async () => {
            const action = liked.includes(s.id) ? 'unlike' : 'like';
            const before = count;
            liked = action === 'like' ? [...liked, s.id] : liked.filter((id) => id !== s.id);
            count = Math.max(0, count + (action === 'like' ? 1 : -1));
            saveLiked();
            show();
            btn.disabled = true;
            try {
                const res = await fetch(`${api}/stories/${s.id}/${action}`, { method: 'POST' });
                if (!res.ok)
                    throw new Error(String(res.status));
                const data = await res.json();
                count = data.likes;
            }
            catch (err) {
                liked = action === 'like' ? liked.filter((id) => id !== s.id) : [...liked, s.id];
                count = before;
                saveLiked();
            }
            btn.disabled = false;
            show();
        });
        show();
        return btn;
    };
    // retry = ใส่ปุ่ม "ลองอีกครั้ง" ไว้ใต้ข้อความ (ใช้ตอนโหลดไม่สำเร็จ)
    const showListMessage = (message, retry = false) => {
        const p = document.createElement('p');
        p.className = 'tales-empty';
        p.textContent = message;
        if (retry) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-ghost tales-retry';
            btn.textContent = 'ลองอีกครั้ง';
            btn.addEventListener('click', () => { loadStories(); });
            p.append(btn);
        }
        list.replaceChildren(p);
    };
    const loadStories = async () => {
        showListMessage('กำลังโหลดเรื่องเล่า...');
        const stopNotice = onSlowApi(() => showListMessage(API_WAKING));
        try {
            const res = await fetch(`${api}/stories?sort=${sort}`);
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
            showListMessage('โหลดเรื่องเล่าไม่สำเร็จ', true);
        }
        finally {
            stopNotice();
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
    // ===================== เรียงเรื่อง: ล่าสุด / ยอดนิยม =====================
    sortButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const picked = btn.dataset.sort === 'popular' ? 'popular' : 'latest';
            if (picked === sort)
                return;
            sort = picked;
            sortButtons.forEach((b) => {
                b.classList.toggle('is-active', b === btn);
                b.setAttribute('aria-pressed', String(b === btn));
            });
            loadStories();
        });
    });
    storyInput.addEventListener('input', updateCounter);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ช่องดักบอท: คนมองไม่เห็นช่องนี้ ถ้ามีค่าแปลว่าบอทกรอก ทำเป็นส่งสำเร็จแต่ไม่ส่งจริง
        if (honeypot.value) {
            form.reset();
            updateCounter();
            setStatus('is-success', 'ได้รับเรื่องแล้ว');
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังส่ง...';
        setStatus('', '');
        const stopNotice = onSlowApi(() => setStatus('', API_WAKING));
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
            setStatus('is-error', 'ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะ');
        }
        finally {
            stopNotice();
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'ส่งเรื่องเล่า';
    });
    updateCounter();
    loadStories();
})();
