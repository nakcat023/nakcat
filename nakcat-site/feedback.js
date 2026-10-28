"use strict";
// แบบประเมินท้ายบทความ: ส่งโหวต (+ เหตุผลตอนกด 👎) เข้า API และจำไว้ในเบราว์เซอร์ว่าโหวตแล้ว จะได้ไม่ถามซ้ำ
// แอดมินดูผลโหวตได้ในแท็บ "📊 ภาพรวม" และอ่านเหตุผลได้ในแท็บ "💬 ความเห็น"
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts (หน้าบทความต้องโหลด api.js ก่อน feedback.js)
// ไฟล์ต้นฉบับคือ src/feedback.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/feedback.js ใหม่
(() => {
    const form = document.querySelector('.feedback-card');
    const articleInput = form?.querySelector('input[name="article"]');
    const voteInput = form?.querySelector('input[name="vote"]');
    const more = form?.querySelector('.feedback-more');
    const status = form?.querySelector('.feedback-status');
    const submitBtn = more?.querySelector('button[type="submit"]');
    const comment = more?.querySelector('textarea');
    const honeypot = form?.querySelector('input[name="bot-field"]');
    // หน้าที่ไม่มีแบบประเมิน (เช่นหน้าแรก) หรือหาชิ้นไหนไม่เจอ ก็ไม่ต้องทำอะไรต่อ
    if (!form || !articleInput || !voteInput || !more || !status || !submitBtn || !comment || !honeypot)
        return;
    const voteBtns = form.querySelectorAll('.vote-btn');
    const storeKey = `nakcat-feedback-${articleInput.value}`;
    const showThanks = (vote) => {
        form.classList.add('is-done');
        status.className = 'feedback-status is-success';
        status.textContent = vote === 'up'
            ? 'ขอบคุณที่บอกเรานะ จะเขียนเรื่องดีๆ แบบนี้อีก'
            : 'ขอบคุณสำหรับความเห็นนะ เราจะเอาไปปรับให้ดีขึ้น';
    };
    let saved = null;
    try {
        saved = localStorage.getItem(storeKey);
    }
    catch (e) { }
    if (saved) {
        showThanks(saved);
        return;
    }
    const send = async () => {
        voteBtns.forEach((b) => { b.disabled = true; });
        submitBtn.disabled = true;
        status.className = 'feedback-status';
        status.textContent = 'กำลังส่ง...';
        const stopNotice = onSlowApi(() => { status.textContent = API_WAKING; });
        let failText = 'ส่งไม่สำเร็จ ลองกดอีกครั้งนะ';
        try {
            // ช่องดักบอท: มีค่า = บอทกรอก ข้ามการส่งจริงไปเลย
            if (!honeypot.value) {
                const res = await fetch(`${API_BASE}/article-feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ article: articleInput.value, vote: voteInput.value, comment: comment.value }),
                });
                if (!res.ok) {
                    // API บอกเหตุผลมาด้วย (เช่น ความเห็นยาวเกิน หรือกดถี่ไป) ใช้อันนั้นแทนข้อความกลางๆ
                    try {
                        failText = (await res.json()).message ?? failText;
                    }
                    catch (e) { }
                    throw new Error(String(res.status));
                }
            }
            try {
                localStorage.setItem(storeKey, voteInput.value);
            }
            catch (e) { }
            showThanks(voteInput.value);
        }
        catch (err) {
            status.className = 'feedback-status is-error';
            status.textContent = failText;
            voteBtns.forEach((b) => { b.disabled = false; });
            submitBtn.disabled = false;
        }
        finally {
            stopNotice();
        }
    };
    // 👍 ส่งทันที / 👎 เปิดช่องให้บอกเหตุผล (ไม่บังคับกรอก)
    voteBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            voteInput.value = btn.dataset.vote ?? '';
            voteBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            if (btn.dataset.vote === 'up') {
                more.hidden = true;
                send();
            }
            else {
                more.hidden = false;
                comment.focus();
            }
        });
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        send();
    });
})();
