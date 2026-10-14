"use strict";
// ให้คะแนนเว็บโดยรวม "ชอบเว็บ nakcat แค่ไหน?"
// - ส่งคะแนน + ความเห็นเข้า API ของเรา (โฟลเดอร์ api) แอดมินอ่านความเห็นได้ในแท็บ "💬 ความเห็น"
// - API ตอบค่าเฉลี่ยใหม่กลับมาแสดง และจำไว้ในเครื่องว่าให้คะแนนแล้ว จะได้ไม่ถามซ้ำ
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
    const siteThanks = (score) => {
        siteForm.classList.add('is-done');
        siteStatus.className = 'feedback-status is-success';
        siteStatus.textContent = `${siteFaces[score] || ''} ขอบคุณที่ให้คะแนนนะ ทุกความเห็นช่วยให้ nakcat ดีขึ้น`;
    };
    // ===================== ค่าเฉลี่ยจาก API =====================
    const showSummary = (summary) => {
        siteSummary.textContent = summary.count === 0
            ? 'ยังไม่มีใครให้คะแนน มาเป็นคนแรกกัน!'
            : `★ ${summary.average.toFixed(1)} จาก 5 · ให้คะแนนแล้ว ${summary.count.toLocaleString('th-TH')} คน`;
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
    siteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const score = siteForm.querySelector('input[name="score"]:checked')?.value ?? '';
        const comment = siteForm.querySelector('textarea[name="comment"]')?.value ?? '';
        const honeypot = siteForm.querySelector('input[name="bot-field"]')?.value ?? '';
        if (!score)
            return;
        // ช่องดักบอท: มีค่า = บอทกรอก ทำเป็นส่งสำเร็จแต่ไม่ส่งจริง
        if (honeypot) {
            siteThanks(score);
            return;
        }
        siteSubmit.disabled = true;
        siteSubmit.textContent = 'กำลังส่ง...';
        try {
            if (!API_BASE)
                throw new Error('no api');
            const res = await fetch(`${API_BASE}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: Number(score), comment }),
            });
            if (!res.ok)
                throw new Error(String(res.status));
            const summary = await res.json();
            showSummary(summary);
            try {
                localStorage.setItem(siteKey, score);
            }
            catch (err) { }
            siteThanks(score);
        }
        catch (err) {
            siteStatus.className = 'feedback-status is-error';
            siteStatus.textContent = 'ส่งไม่สำเร็จ ลองกดอีกครั้งนะ';
            siteSubmit.disabled = false;
        }
        siteSubmit.textContent = 'ส่งคะแนน';
    });
})();
