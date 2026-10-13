// หน้าแอดมิน (admin.html): ดู / อนุมัติ / ไม่อนุมัติ เรื่องเล่าแมว ต้องใส่รหัสแอดมินของ API
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/admin.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/admin.js ใหม่

// สถานะเรื่องเล่า (ต้องตรงกับ enum StoryStatus ใน api/NakcatDb.cs)
type StoryStatus = 'Pending' | 'Approved' | 'Rejected';

// เรื่องเล่า 1 เรื่องแบบเต็ม ที่ API ส่งให้แอดมิน (ต้องตรงกับ class CatStory ใน api/NakcatDb.cs)
interface AdminStory {
    id: number;
    catName: string;
    authorName: string;
    story: string;
    status: StoryStatus;
    createdAt: string;
    reviewedAt: string | null;
}

(() => {
    const loginForm = document.querySelector<HTMLFormElement>('#admin-login');
    const keyInput = document.querySelector<HTMLInputElement>('#admin-key');
    const loginMsg = document.querySelector<HTMLElement>('#admin-login-msg');
    const panel = document.querySelector<HTMLElement>('#admin-panel');
    const tabs = document.querySelectorAll<HTMLButtonElement>('.admin-tab');
    const logoutBtn = document.querySelector<HTMLButtonElement>('#admin-logout');
    const msg = document.querySelector<HTMLElement>('#admin-msg');
    const list = document.querySelector<HTMLElement>('#admin-list');
    if (!loginForm || !keyInput || !loginMsg || !panel || !logoutBtn || !msg || !list) return;

    if (!API_BASE) {
        loginMsg.textContent = 'ยังไม่ได้ตั้งที่อยู่ API (ดู src/api.ts)';
        loginForm.querySelector('button')?.setAttribute('disabled', '');
        return;
    }
    const api: string = API_BASE;

    // จำรหัสไว้เฉพาะแท็บนี้ (sessionStorage): ปิดเบราว์เซอร์แล้วต้องใส่ใหม่
    const KEY_STORE: string = 'nakcat-admin-key';
    let adminKey: string = '';
    try { adminKey = sessionStorage.getItem(KEY_STORE) ?? ''; } catch (e) {}

    let current: StoryStatus = 'Pending';
    const labels: Record<StoryStatus, string> = { Pending: 'รอตรวจ', Approved: 'อนุมัติแล้ว', Rejected: 'ไม่อนุมัติ' };
    const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

    // เรียก API พร้อมแนบรหัสแอดมินใน header
    const callApi = (path: string, method: 'GET' | 'POST' = 'GET'): Promise<Response> =>
        fetch(`${api}${path}`, { method, headers: { 'X-Admin-Key': adminKey } });

    const showLogin = (message: string): void => {
        adminKey = '';
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) {}
        panel.hidden = true;
        loginForm.hidden = false;
        loginMsg.textContent = message;
        keyInput.value = '';
        keyInput.focus();
    };

    const setMsg = (message: string): void => {
        msg.textContent = message;
    };

    // การ์ดเรื่องเล่า 1 ใบ พร้อมปุ่มเปลี่ยนสถานะ (ข้อความจากผู้ใช้ใส่ด้วย textContent เสมอ)
    const storyCard = (s: AdminStory): HTMLElement => {
        const card: HTMLElement = document.createElement('article');
        card.className = 'admin-story';

        const head: HTMLElement = document.createElement('p');
        head.className = 'admin-story-head';
        const cat: HTMLElement = document.createElement('strong');
        cat.textContent = `#${s.id} 🐱 ${s.catName}`;
        const meta: HTMLElement = document.createElement('span');
        meta.textContent = `เล่าโดย ${s.authorName} · ส่งเมื่อ ${dateFormat.format(new Date(s.createdAt))}`;
        head.append(cat, meta);

        const text: HTMLElement = document.createElement('p');
        text.className = 'admin-story-text';
        text.textContent = s.story;

        const actions: HTMLElement = document.createElement('div');
        actions.className = 'admin-actions';
        if (s.status !== 'Approved') actions.append(actionButton(s, 'approve', '✅ อนุมัติ ขึ้นเว็บ', card));
        if (s.status !== 'Rejected') actions.append(actionButton(s, 'reject', s.status === 'Approved' ? '🙈 ซ่อนจากเว็บ' : '❌ ไม่อนุมัติ', card));

        card.append(head, text, actions);
        return card;
    };

    const actionButton = (s: AdminStory, action: 'approve' | 'reject', label: string, card: HTMLElement): HTMLButtonElement => {
        const btn: HTMLButtonElement = document.createElement('button');
        btn.type = 'button';
        btn.className = `admin-btn is-${action}`;
        btn.textContent = label;
        btn.addEventListener('click', async () => {
            card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            try {
                const res: Response = await callApi(`/admin/stories/${s.id}/${action}`, 'POST');
                if (res.status === 401) { showLogin('รหัสหมดอายุหรือไม่ถูกต้อง ใส่ใหม่อีกครั้งนะ'); return; }
                if (!res.ok) throw new Error(String(res.status));
                // เรื่องนี้ย้ายไปอยู่แท็บอื่นแล้ว เอาออกจากรายการนี้
                card.remove();
                updateCount();
            } catch (err) {
                setMsg(`เปลี่ยนสถานะเรื่อง #${s.id} ไม่สำเร็จ 😿 ลองใหม่อีกครั้ง`);
                card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            }
        });
        return btn;
    };

    const updateCount = (): void => {
        const count: number = list.querySelectorAll('.admin-story').length;
        setMsg(count === 0 ? `ไม่มีเรื่องในหมวด "${labels[current]}" 🎉` : `${labels[current]} ${count} เรื่อง`);
    };

    const loadStories = async (): Promise<void> => {
        list.replaceChildren();
        setMsg('กำลังโหลด...');
        try {
            const res: Response = await callApi(`/admin/stories?status=${current}`);
            if (res.status === 401) { showLogin('รหัสไม่ถูกต้อง ลองใหม่อีกครั้งนะ'); return; }
            if (!res.ok) throw new Error(String(res.status));
            const stories: AdminStory[] = await res.json();
            list.replaceChildren(...stories.map(storyCard));
            updateCount();
        } catch (err) {
            setMsg('ติดต่อ API ไม่ได้ 😿 เปิด API ไว้หรือยัง (cd api แล้ว dotnet run)');
        }
    };

    const showPanel = (): void => {
        loginForm.hidden = true;
        panel.hidden = false;
        loadStories();
    };

    // ===================== ปุ่มต่างๆ =====================
    loginForm.addEventListener('submit', (e: SubmitEvent) => {
        e.preventDefault();
        adminKey = keyInput.value.trim();
        if (!adminKey) return;
        try { sessionStorage.setItem(KEY_STORE, adminKey); } catch (err) {}
        loginMsg.textContent = '';
        showPanel();
    });

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            current = (tab.dataset.status as StoryStatus | undefined) ?? 'Pending';
            tabs.forEach((t) => {
                t.classList.toggle('is-active', t === tab);
                t.setAttribute('aria-pressed', String(t === tab));
            });
            loadStories();
        });
    });

    logoutBtn.addEventListener('click', () => showLogin('ออกจากระบบแล้ว'));

    if (adminKey) showPanel();
})();
