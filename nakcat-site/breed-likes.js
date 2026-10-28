"use strict";
// หัวใจรวมของแต่ละสายพันธุ์ (นับจากทุกคนที่เข้าเว็บ ผ่าน API) แสดงในการ์ดแกลเลอรี และในหน้าต่างข้อมูลพันธุ์
// ปุ่มหัวใจเดิมยังทำงานเหมือนเดิม (app.js เก็บรายการโปรดในเครื่อง) ไฟล์นี้แค่ฟังว่ามีการกด แล้วบอก API ให้นับ
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/breed-likes.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/breed-likes.js ใหม่
(() => {
    const grid = document.querySelector('#gallery-grid');
    const dialogContent = document.querySelector('#dialog-content');
    if (!grid || !dialogContent)
        return;
    const api = API_BASE;
    // พันธุ์ที่เครื่องนี้ "นับหัวใจให้แล้ว" กันนับซ้ำเวลากดเปิด-ปิดหรือรีเฟรชหน้า
    const COUNTED_KEY = 'nakcat-breed-likes-counted';
    let counted = [];
    try {
        counted = JSON.parse(localStorage.getItem(COUNTED_KEY) ?? '[]');
    }
    catch (e) { }
    const saveCounted = () => {
        try {
            localStorage.setItem(COUNTED_KEY, JSON.stringify(counted));
        }
        catch (e) { }
    };
    let counts = null; // null = ยังโหลดจาก API ไม่เสร็จ
    // ===================== ป้ายจำนวนหัวใจ =====================
    const breedOf = (btn) => btn?.dataset.fav?.slice('breed:'.length) ?? '';
    // หาป้ายเดิม ถ้าไม่มีก็สร้างใหม่แล้ววางตามที่บอก
    const badge = (parent, place) => {
        let el = parent.querySelector('.breed-likes');
        if (!el) {
            el = document.createElement('span');
            el.className = 'breed-likes';
            place(el);
        }
        return el;
    };
    const paint = () => {
        if (!counts)
            return;
        const all = counts;
        // การ์ดในแกลเลอรี: ใส่ใต้ชื่อภาษาอังกฤษ
        grid.querySelectorAll('.gallery-cell').forEach((cell) => {
            const card = cell.querySelector('.gallery-card');
            const breed = breedOf(cell.querySelector('.fav-btn'));
            if (!card || !(breed in all))
                return;
            // ยังไม่มีใครกดหัวใจ ก็ไม่ต้องโชว์ "♥ 0" ให้ดูเหมือนไม่มีคนเข้า
            if (all[breed] === 0) {
                card.querySelector('.breed-likes')?.remove();
                return;
            }
            badge(card, (el) => card.append(el)).textContent = `♥ ${all[breed].toLocaleString('th-TH')}`;
        });
        // หน้าต่างข้อมูลพันธุ์: ใส่ข้างปุ่ม "บันทึกไว้"
        const pill = dialogContent.querySelector('.fav-pill');
        const breed = breedOf(pill);
        if (pill && breed in all) {
            if (all[breed] === 0) {
                dialogContent.querySelector('.breed-likes')?.remove();
                return;
            }
            badge(dialogContent, (el) => pill.after(el)).textContent = `♥ ${all[breed].toLocaleString('th-TH')} คนชอบพันธุ์นี้`;
        }
    };
    // แกลเลอรีวาดการ์ดใหม่ทุกครั้งที่เปลี่ยนตัวกรอง / เปิดหน้าต่างพันธุ์ใหม่ ก็ใส่ป้ายใหม่ให้
    new MutationObserver(paint).observe(grid, { childList: true });
    new MutationObserver(paint).observe(dialogContent, { childList: true });
    // ===================== นับหัวใจ =====================
    const send = async (breed, action) => {
        // เปลี่ยนตัวเลขบนจอทันที ไม่ต้องรอ API (ถ้าไม่สำเร็จค่อยย้อนกลับ)
        const change = action === 'like' ? 1 : -1;
        counted = action === 'like' ? [...counted, breed] : counted.filter((b) => b !== breed);
        saveCounted();
        if (counts && breed in counts)
            counts[breed] = Math.max(0, counts[breed] + change);
        paint();
        try {
            const res = await fetch(`${api}/breeds/${encodeURIComponent(breed)}/${action}`, { method: 'POST' });
            if (!res.ok)
                throw new Error(String(res.status));
            const data = await res.json();
            if (counts)
                counts[data.breed] = data.count;
        }
        catch (err) {
            counted = action === 'like' ? counted.filter((b) => b !== breed) : [...counted, breed];
            saveCounted();
            if (counts && breed in counts)
                counts[breed] = Math.max(0, counts[breed] - change);
        }
        paint();
    };
    document.addEventListener('nakcat:fav-change', (e) => {
        const { key, on } = e.detail;
        if (!key.startsWith('breed:'))
            return;
        const breed = key.slice('breed:'.length);
        const isCounted = counted.includes(breed);
        if (on && !isCounted)
            send(breed, 'like');
        if (!on && isCounted)
            send(breed, 'unlike');
    });
    // หัวใจที่กดไว้ก่อนมีระบบนับ (หรือกดตอนเน็ตหลุด) ให้ตรงกับรายการโปรดในเครื่อง
    const syncWithFavs = () => {
        let favBreeds = [];
        try {
            const favs = JSON.parse(localStorage.getItem('nakcat-favs') ?? '[]'); // ตัวเดียวกับ FAV_KEY ใน app.js
            favBreeds = favs.filter((f) => f.key.startsWith('breed:')).map((f) => f.key.slice('breed:'.length));
        }
        catch (e) { }
        favBreeds.filter((b) => !counted.includes(b)).forEach((b) => send(b, 'like'));
        counted.filter((b) => !favBreeds.includes(b)).forEach((b) => send(b, 'unlike'));
    };
    const load = async () => {
        try {
            const res = await fetch(`${api}/breeds/likes`);
            if (!res.ok)
                return;
            counts = await res.json();
            paint();
            syncWithFavs();
        }
        catch (err) {
            // โหลดไม่ได้ก็แค่ไม่แสดงตัวเลข ปุ่มหัวใจยังใช้ได้ปกติ
        }
    };
    load();
})();
