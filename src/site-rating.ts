// ให้คะแนนเว็บโดยรวม "ชอบเว็บ nakcat แค่ไหน?"
// - ส่งคะแนน + ความเห็นเข้า API ของเรา (โฟลเดอร์ api) แอดมินอ่านความเห็นได้ในแท็บ "💬 ความเห็น"
// - API ตอบค่าเฉลี่ยใหม่กลับมาแสดง และจำไว้ในเครื่องว่าให้คะแนนแล้ว จะได้ไม่ถามซ้ำ
// ไฟล์ต้นฉบับคือ src/site-rating.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/site-rating.js ใหม่

// ข้อมูลที่ API ส่งกลับมา (ต้องตรงกับ record RatingSummary ใน api/Program.cs)
interface RatingSummary {
    count: number;   // ให้คะแนนแล้วกี่คน
    average: number; // ค่าเฉลี่ย เช่น 4.7
}

(() => {
    // API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
    const siteForm = document.querySelector<HTMLFormElement>('#site-rating-form');
    const siteSubmit = document.querySelector<HTMLButtonElement>('#site-rating-submit');
    const siteStatus = document.querySelector<HTMLElement>('#site-rating-status');
    const siteSummary = document.querySelector<HTMLElement>('#site-rating-summary');
    if (!siteForm || !siteSubmit || !siteStatus || !siteSummary) return;

    const siteKey: string = 'nakcat-site-rating';
    const siteFaces: Record<string, string> = { 1: '😿', 2: '😾', 3: '🐱', 4: '😺', 5: '😻' };

    const siteThanks = (score: string): void => {
        siteForm.classList.add('is-done');
        siteStatus.className = 'feedback-status is-success';
        siteStatus.textContent = `${siteFaces[score] || ''} ขอบคุณที่ให้คะแนนนะ ทุกความเห็นช่วยให้ nakcat ดีขึ้น`;
    };

    // ===================== ค่าเฉลี่ยจาก API =====================
    const showSummary = (summary: RatingSummary): void => {
        siteSummary.textContent = summary.count === 0
            ? 'ยังไม่มีใครให้คะแนน มาเป็นคนแรกกัน!'
            : `★ ${summary.average.toFixed(1)} จาก 5 · ให้คะแนนแล้ว ${summary.count.toLocaleString('th-TH')} คน`;
        siteSummary.hidden = false;
    };

    // ขอค่าเฉลี่ยจาก API มาแสดง (ไม่สำเร็จก็ซ่อนไว้เฉยๆ)
    const loadSummary = async (): Promise<void> => {
        if (!API_BASE) return;
        try {
            const res: Response = await fetch(`${API_BASE}/ratings/summary`);
            if (!res.ok) return;
            const summary: RatingSummary = await res.json();
            showSummary(summary);
        } catch (err) {}
    };

    loadSummary();

    // ===================== ฟอร์ม =====================
    let siteSaved: string | null = null;
    try { siteSaved = localStorage.getItem(siteKey); } catch (e) {}
    if (siteSaved) siteThanks(siteSaved);

    siteForm.addEventListener('change', (e: Event) => {
        if (e.target instanceof HTMLInputElement && e.target.name === 'score') siteSubmit.disabled = false;
    });

    siteForm.addEventListener('submit', async (e: SubmitEvent) => {
        e.preventDefault();
        const score: string = siteForm.querySelector<HTMLInputElement>('input[name="score"]:checked')?.value ?? '';
        const comment: string = siteForm.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')?.value ?? '';
        const honeypot: string = siteForm.querySelector<HTMLInputElement>('input[name="bot-field"]')?.value ?? '';
        if (!score) return;
        // ช่องดักบอท: มีค่า = บอทกรอก ทำเป็นส่งสำเร็จแต่ไม่ส่งจริง
        if (honeypot) { siteThanks(score); return; }
        siteSubmit.disabled = true;
        siteSubmit.textContent = 'กำลังส่ง...';
        try {
            if (!API_BASE) throw new Error('no api');
            const res: Response = await fetch(`${API_BASE}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: Number(score), comment }),
            });
            if (!res.ok) throw new Error(String(res.status));
            const summary: RatingSummary = await res.json();
            showSummary(summary);
            try { localStorage.setItem(siteKey, score); } catch (err) {}
            siteThanks(score);
        } catch (err) {
            siteStatus.className = 'feedback-status is-error';
            siteStatus.textContent = 'ส่งไม่สำเร็จ ลองกดอีกครั้งนะ';
            siteSubmit.disabled = false;
        }
        siteSubmit.textContent = 'ส่งคะแนน';
    });
})();
