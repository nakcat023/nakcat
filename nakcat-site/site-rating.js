"use strict";
// ให้คะแนนเว็บโดยรวม "ชอบเว็บ nakcat แค่ไหน?"
// - ส่งคะแนน + ความเห็นผ่าน Netlify Forms เหมือนเดิม (ความเห็นส่งเข้าอีเมลเจ้าของเว็บ) และจำไว้ว่าให้คะแนนแล้ว
// - ส่งคะแนนเข้า API ของเรา (โฟลเดอร์ api) เพื่อคิดค่าเฉลี่ยมาแสดง ถ้า API ไม่ตอบ ฟอร์มก็ยังใช้ได้ตามปกติ
// ไฟล์ต้นฉบับคือ src/site-rating.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/site-rating.js ใหม่
(() => {
    // API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
    const siteForm = document.querySelector('#site-rating-form');
    const siteSubmit = document.querySelector('#site-rating-submit');
    const siteStatus = document.querySelector('#site-rating-status');
    const siteSummary = document.querySelector('#site-rating-summary');
    if (!siteForm || !siteSubmit || !siteStatus || !siteSummary)
        return;
    const siteKey = 'nakcat-site-rating';
    const siteFaces = { 1: '😿', 2: '😾', 3: '🐱', 4: '😺', 5: '😻' };
    // เปิดจากไฟล์ในเครื่องไม่มี Netlify ให้ส่ง จึงข้ามการส่งเพื่อให้ทดสอบหน้าตาได้
    const isLocalPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const siteThanks = (score) => {
        siteForm.classList.add('is-done');
        siteStatus.className = 'feedback-status is-success';
        siteStatus.textContent = `${siteFaces[score] || '🐾'} ขอบคุณที่ให้คะแนนนะ ทุกความเห็นช่วยให้ nakcat ดีขึ้น`;
    };
    // ===================== ค่าเฉลี่ยจาก API =====================
    const showSummary = (summary) => {
        siteSummary.textContent = summary.count === 0
            ? '⭐ ยังไม่มีใครให้คะแนน มาเป็นคนแรกกัน!'
            : `⭐ ${summary.average.toFixed(1)} จาก 5 · ให้คะแนนแล้ว ${summary.count.toLocaleString('th-TH')} คน`;
        siteSummary.hidden = false;
    };
    // ขอค่าเฉลี่ยจาก API มาแสดง (ไม่สำเร็จก็ซ่อนไว้เฉยๆ)
    const loadSummary = async () => {
        if (!API_BASE)
            return;
        try {
            const res = await fetch(`${API_BASE}/ratings/summary`);
            if (!res.ok)
                return;
            const summary = await res.json();
            showSummary(summary);
        }
        catch (err) { }
    };
    // ส่งคะแนนเข้า API แล้วแสดงค่าเฉลี่ยใหม่ที่ API ตอบกลับมา (ไม่สำเร็จก็ไม่เป็นไร)
    const sendToApi = async (score) => {
        if (!API_BASE)
            return;
        try {
            const res = await fetch(`${API_BASE}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score }),
            });
            if (!res.ok)
                return;
            const summary = await res.json();
            showSummary(summary);
        }
        catch (err) { }
    };
    loadSummary();
    // ===================== ฟอร์ม =====================
    let siteSaved = null;
    try {
        siteSaved = localStorage.getItem(siteKey);
    }
    catch (e) { }
    if (siteSaved)
        siteThanks(siteSaved);
    siteForm.addEventListener('change', (e) => {
        if (e.target instanceof HTMLInputElement && e.target.name === 'score')
            siteSubmit.disabled = false;
    });
    // ข้อมูลในฟอร์มแบบที่ Netlify Forms รับ (ข้ามช่องที่เป็นไฟล์ ซึ่งฟอร์มนี้ไม่มีอยู่แล้ว)
    const formBody = () => {
        const params = new URLSearchParams();
        new FormData(siteForm).forEach((value, key) => {
            if (typeof value === 'string')
                params.append(key, value);
        });
        return params.toString();
    };
    siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const score = siteForm.querySelector('input[name="score"]:checked')?.value ?? '';
        if (!score)
            return;
        siteSubmit.disabled = true;
        siteSubmit.textContent = 'กำลังส่ง...';
        try {
            if (!isLocalPreview) {
                const res = await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formBody(),
                });
                if (!res.ok)
                    throw new Error(String(res.status));
            }
            try {
                localStorage.setItem(siteKey, score);
            }
            catch (err) { }
            siteThanks(score);
            sendToApi(Number(score)); // ส่งหลัง Netlify สำเร็จเท่านั้น กดซ้ำตอนส่งไม่สำเร็จจะได้ไม่นับซ้ำ
        }
        catch (err) {
            siteStatus.className = 'feedback-status is-error';
            siteStatus.textContent = 'ส่งไม่สำเร็จ 😿 ลองกดอีกครั้งนะ';
            siteSubmit.disabled = false;
        }
        siteSubmit.textContent = 'ส่งคะแนน';
    });
})();
