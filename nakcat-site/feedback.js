"use strict";
// แบบประเมินท้ายบทความ: ส่งผ่าน Netlify Forms และจำไว้ในเบราว์เซอร์ว่าโหวตแล้ว จะได้ไม่ถามซ้ำ
// ไฟล์ต้นฉบับคือ src/feedback.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/feedback.js ใหม่
(() => {
    const form = document.querySelector('.feedback-card');
    const articleInput = form?.querySelector('input[name="article"]');
    const voteInput = form?.querySelector('input[name="vote"]');
    const more = form?.querySelector('.feedback-more');
    const status = form?.querySelector('.feedback-status');
    const submitBtn = more?.querySelector('button[type="submit"]');
    const comment = more?.querySelector('textarea');
    // หน้าที่ไม่มีแบบประเมิน (เช่นหน้าแรก) หรือหาชิ้นไหนไม่เจอ ก็ไม่ต้องทำอะไรต่อ
    if (!form || !articleInput || !voteInput || !more || !status || !submitBtn || !comment)
        return;
    const voteBtns = form.querySelectorAll('.vote-btn');
    const storeKey = `nakcat-feedback-${articleInput.value}`;
    // เปิดจากไฟล์ในเครื่องไม่มี Netlify ให้ส่ง จึงข้ามการส่งเพื่อให้ทดสอบหน้าตาได้
    const isLocalPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const showThanks = (vote) => {
        form.classList.add('is-done');
        status.className = 'feedback-status is-success';
        status.textContent = vote === 'up'
            ? 'ขอบคุณที่บอกเรานะ 😻 จะเขียนเรื่องดีๆ แบบนี้อีก'
            : 'ขอบคุณสำหรับความเห็นนะ 🐾 เราจะเอาไปปรับให้ดีขึ้น';
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
    // แปลงข้อมูลในฟอร์มเป็นข้อความแบบที่ Netlify Forms รับ (ข้ามช่องที่เป็นไฟล์ ซึ่งฟอร์มนี้ไม่มีอยู่แล้ว)
    const formBody = () => {
        const params = new URLSearchParams();
        new FormData(form).forEach((value, key) => {
            if (typeof value === 'string')
                params.append(key, value);
        });
        return params.toString();
    };
    const send = async () => {
        voteBtns.forEach((b) => { b.disabled = true; });
        submitBtn.disabled = true;
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
                localStorage.setItem(storeKey, voteInput.value);
            }
            catch (e) { }
            showThanks(voteInput.value);
        }
        catch (err) {
            status.className = 'feedback-status is-error';
            status.textContent = 'ส่งไม่สำเร็จ 😿 ลองกดอีกครั้งนะ';
            voteBtns.forEach((b) => { b.disabled = false; });
            submitBtn.disabled = false;
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
