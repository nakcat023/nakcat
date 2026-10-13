"use strict";
// หน้าแอดมิน (admin.html): ภาพรวมเว็บ ข้อความติดต่อ ความเห็น เรื่องเล่าแมว (อนุมัติ / แก้ / ลบ) และกระดานคะแนนเกม
// ต้องใส่รหัสแอดมินของ API · ส่วนวาดหน้าภาพรวมอยู่ใน src/admin-dashboard.ts
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/admin.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/admin.js ใหม่
(() => {
    const loginForm = document.querySelector('#admin-login');
    const keyInput = document.querySelector('#admin-key');
    const loginMsg = document.querySelector('#admin-login-msg');
    const panel = document.querySelector('#admin-panel');
    const tabs = document.querySelectorAll('.admin-tab');
    const logoutBtn = document.querySelector('#admin-logout');
    const msg = document.querySelector('#admin-msg');
    const list = document.querySelector('#admin-list');
    if (!loginForm || !keyInput || !loginMsg || !panel || !logoutBtn || !msg || !list)
        return;
    if (!API_BASE) {
        loginMsg.textContent = 'ยังไม่ได้ตั้งที่อยู่ API (ดู src/api.ts)';
        loginForm.querySelector('button')?.setAttribute('disabled', '');
        return;
    }
    const api = API_BASE;
    // จำรหัสไว้เฉพาะแท็บนี้ (sessionStorage): ปิดเบราว์เซอร์แล้วต้องใส่ใหม่
    const KEY_STORE = 'nakcat-admin-key';
    let adminKey = '';
    try {
        adminKey = sessionStorage.getItem(KEY_STORE) ?? '';
    }
    catch (e) { }
    let current = 'Overview';
    const labels = {
        Overview: 'ภาพรวม', Messages: 'ข้อความ', Comments: 'ความเห็น',
        Pending: 'รอตรวจ', Approved: 'อนุมัติแล้ว', Rejected: 'ไม่อนุมัติ', Scores: 'กระดานจับคู่การ์ด',
    };
    const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    // เรียก API พร้อมแนบรหัสแอดมินใน header (ถ้ามี body ส่งไปเป็น JSON)
    const callApi = (path, method = 'GET', body) => fetch(`${api}${path}`, {
        method,
        headers: body === undefined ? { 'X-Admin-Key': adminKey } : { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const showLogin = (message) => {
        adminKey = '';
        try {
            sessionStorage.removeItem(KEY_STORE);
        }
        catch (e) { }
        panel.hidden = true;
        loginForm.hidden = false;
        loginMsg.textContent = message;
        keyInput.value = '';
        keyInput.focus();
    };
    const setMsg = (message) => {
        msg.textContent = message;
    };
    // การ์ดเรื่องเล่า 1 ใบ พร้อมปุ่มเปลี่ยนสถานะ (ข้อความจากผู้ใช้ใส่ด้วย textContent เสมอ)
    const storyCard = (s) => {
        const card = document.createElement('article');
        card.className = 'admin-story';
        const head = document.createElement('p');
        head.className = 'admin-story-head';
        const cat = document.createElement('strong');
        cat.textContent = `#${s.id} 🐱 ${s.catName}`;
        const meta = document.createElement('span');
        meta.textContent = `เล่าโดย ${s.authorName} · ส่งเมื่อ ${dateFormat.format(new Date(s.createdAt))}`
            + (s.status === 'Approved' ? ` · ♥ ${s.likes} คนถูกใจ` : '');
        head.append(cat, meta);
        const text = document.createElement('p');
        text.className = 'admin-story-text';
        text.textContent = s.story;
        const actions = document.createElement('div');
        actions.className = 'admin-actions';
        if (s.status !== 'Approved')
            actions.append(actionButton(s, 'approve', '✅ อนุมัติ ขึ้นเว็บ', card));
        if (s.status !== 'Rejected')
            actions.append(actionButton(s, 'reject', s.status === 'Approved' ? '🙈 ซ่อนจากเว็บ' : '❌ ไม่อนุมัติ', card));
        actions.append(editButton(s, card), deleteButton(`/admin/stories/${s.id}`, `ลบเรื่อง #${s.id} (${s.catName}) ถาวรเลยไหม? ลบแล้วกู้คืนไม่ได้นะ`, card));
        card.append(head, text, actions);
        return card;
    };
    const actionButton = (s, action, label, card) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `admin-btn is-${action}`;
        btn.textContent = label;
        btn.addEventListener('click', async () => {
            card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            try {
                const res = await callApi(`/admin/stories/${s.id}/${action}`, 'POST');
                if (res.status === 401) {
                    showLogin('รหัสหมดอายุหรือไม่ถูกต้อง ใส่ใหม่อีกครั้งนะ');
                    return;
                }
                if (!res.ok)
                    throw new Error(String(res.status));
                // เรื่องนี้ย้ายไปอยู่แท็บอื่นแล้ว เอาออกจากรายการนี้
                card.remove();
                updateCount();
                refreshBadges();
            }
            catch (err) {
                setMsg(`เปลี่ยนสถานะเรื่อง #${s.id} ไม่สำเร็จ 😿 ลองใหม่อีกครั้ง`);
                card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            }
        });
        return btn;
    };
    // ปุ่ม "แก้ไข": เปลี่ยนการ์ดเป็นฟอร์ม กดบันทึกแล้ววาดการ์ดใหม่ด้วยข้อมูลที่แก้แล้ว
    const editButton = (s, card) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-btn';
        btn.textContent = '✏️ แก้ไข';
        btn.addEventListener('click', () => card.replaceWith(editForm(s, card)));
        return btn;
    };
    const editForm = (s, card) => {
        const form = document.createElement('form');
        form.className = 'admin-story admin-edit';
        const field = (label, input) => {
            const wrap = document.createElement('label');
            wrap.append(label, input);
            return wrap;
        };
        const catInput = document.createElement('input');
        catInput.maxLength = 40;
        catInput.value = s.catName;
        const authorInput = document.createElement('input');
        authorInput.maxLength = 40;
        authorInput.value = s.authorName;
        const storyInput = document.createElement('textarea');
        storyInput.maxLength = 1000;
        storyInput.value = s.story;
        const error = document.createElement('p');
        error.className = 'admin-login-msg';
        error.setAttribute('aria-live', 'polite');
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'admin-btn is-approve';
        save.textContent = '💾 บันทึก';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'admin-btn';
        cancel.textContent = 'ยกเลิก';
        cancel.addEventListener('click', () => form.replaceWith(card));
        const actions = document.createElement('div');
        actions.className = 'admin-actions';
        actions.append(save, cancel);
        const title = document.createElement('p');
        title.className = 'admin-story-head';
        const strong = document.createElement('strong');
        strong.textContent = `✏️ แก้เรื่อง #${s.id}`;
        title.append(strong);
        form.append(title, field('ชื่อน้องแมว', catInput), field('ชื่อคนเล่า', authorInput), field('เรื่องเล่า', storyInput), error, actions);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            save.disabled = true;
            error.textContent = '';
            try {
                const res = await callApi(`/admin/stories/${s.id}`, 'PUT', { catName: catInput.value, authorName: authorInput.value, story: storyInput.value });
                if (res.status === 401) {
                    showLogin('รหัสหมดอายุหรือไม่ถูกต้อง ใส่ใหม่อีกครั้งนะ');
                    return;
                }
                if (res.ok) {
                    const updated = await res.json();
                    form.replaceWith(storyCard(updated));
                    setMsg(`แก้เรื่อง #${s.id} แล้ว ✅`);
                    return;
                }
                const data = await res.json();
                error.textContent = data.message; // เช่น "เล่าอีกนิดนะ อย่างน้อย 20 ตัวอักษร"
            }
            catch (err) {
                error.textContent = 'บันทึกไม่สำเร็จ 😿 ลองใหม่อีกครั้ง';
            }
            save.disabled = false;
        });
        setTimeout(() => storyInput.focus());
        return form;
    };
    // ปุ่ม "ลบถาวร": ถามก่อนเสมอ เพราะลบแล้วกู้คืนไม่ได้ (ใช้ได้ทั้งเรื่องเล่าและคะแนนเกม)
    const deleteButton = (path, question, card) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-btn is-reject';
        btn.textContent = '🗑️ ลบถาวร';
        btn.addEventListener('click', async () => {
            if (!confirm(question))
                return;
            card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            try {
                const res = await callApi(path, 'DELETE');
                if (res.status === 401) {
                    showLogin('รหัสหมดอายุหรือไม่ถูกต้อง ใส่ใหม่อีกครั้งนะ');
                    return;
                }
                if (!res.ok && res.status !== 404)
                    throw new Error(String(res.status)); // 404 = มีคนลบไปก่อนแล้ว
                // กระดานคะแนน: โหลดใหม่ ให้อันดับเรียงใหม่และอันดับที่ 11 ขยับขึ้นมา
                if (current === 'Scores') {
                    loadTab();
                    return;
                }
                card.remove();
                updateCount();
                refreshBadges();
            }
            catch (err) {
                setMsg('ลบไม่สำเร็จ 😿 ลองใหม่อีกครั้ง');
                card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            }
        });
        return btn;
    };
    // แถวคะแนนเกม 1 แถว: ชื่อคนเล่นใส่ด้วย textContent เสมอ
    const scoreCard = (s, rank) => {
        const card = document.createElement('article');
        card.className = 'admin-story admin-score';
        const head = document.createElement('p');
        head.className = 'admin-story-head';
        const name = document.createElement('strong');
        name.textContent = `อันดับ ${rank} · ${s.playerName}`;
        const meta = document.createElement('span');
        meta.textContent = `${s.moves} ครั้ง · ${s.seconds} วินาที · ${dateFormat.format(new Date(s.createdAt))}`;
        head.append(name, meta);
        card.append(head, deleteButton(`/admin/memory-scores/${s.id}`, `ลบคะแนนของ "${s.playerName}" ออกจากกระดานไหม?`, card));
        return card;
    };
    // ข้อความติดต่อ 1 ใบ: ยังไม่อ่าน = มีแถบสีส้ม · ตอบทางอีเมลได้เลย (เปิดโปรแกรมอีเมลของเครื่อง)
    const messageCard = (m) => {
        const card = document.createElement('article');
        card.className = `admin-story admin-message${m.isRead ? '' : ' is-unread'}`;
        const head = document.createElement('p');
        head.className = 'admin-story-head';
        const name = document.createElement('strong');
        name.textContent = `${m.isRead ? '' : '🆕 '}${m.name}`;
        const email = document.createElement('a');
        email.href = `mailto:${m.email}`;
        email.textContent = m.email;
        const when = document.createElement('span');
        when.textContent = dateFormat.format(new Date(m.createdAt));
        head.append(name, email, when);
        const text = document.createElement('p');
        text.className = 'admin-story-text';
        text.textContent = m.message;
        const markRead = async () => {
            if (!card.classList.contains('is-unread'))
                return;
            const res = await callApi(`/admin/messages/${m.id}/read`, 'POST');
            if (res.status === 401) {
                showLogin('รหัสหมดอายุหรือไม่ถูกต้อง ใส่ใหม่อีกครั้งนะ');
                return;
            }
            if (!res.ok)
                return;
            card.classList.remove('is-unread');
            name.textContent = m.name;
            readBtn.remove();
            refreshBadges();
        };
        const reply = document.createElement('a');
        reply.className = 'admin-btn is-approve';
        reply.href = `mailto:${m.email}?subject=${encodeURIComponent('ตอบกลับจาก nakcat 🐾')}`;
        reply.textContent = '↩️ ตอบทางอีเมล';
        reply.addEventListener('click', () => { markRead(); });
        const readBtn = document.createElement('button');
        readBtn.type = 'button';
        readBtn.className = 'admin-btn';
        readBtn.textContent = '✓ อ่านแล้ว';
        readBtn.addEventListener('click', () => { markRead(); });
        const actions = document.createElement('div');
        actions.className = 'admin-actions';
        actions.append(reply);
        if (!m.isRead)
            actions.append(readBtn);
        actions.append(deleteButton(`/admin/messages/${m.id}`, `ลบข้อความจาก "${m.name}" ถาวรเลยไหม?`, card));
        card.append(head, text, actions);
        return card;
    };
    // ความเห็น 1 ใบ: บอกว่ามาจากไหน (ให้คะแนนเว็บ / บทความไหน) + ข้อความ (ไม่มีชื่อคนเขียน)
    const commentCard = (c) => {
        const card = document.createElement('article');
        card.className = 'admin-story';
        const head = document.createElement('p');
        head.className = 'admin-story-head';
        const where = document.createElement('strong');
        where.textContent = c.kind === 'site'
            ? `⭐ ให้คะแนนเว็บ ${c.score}/5`
            : `📖 ${dashName(c.topic)} · ${c.vote === 'up' ? '👍 มีประโยชน์' : '👎 ยังไม่ค่อย'}`;
        const when = document.createElement('span');
        when.textContent = dateFormat.format(new Date(c.createdAt));
        head.append(where, when);
        const text = document.createElement('p');
        text.className = 'admin-story-text';
        text.textContent = c.text;
        card.append(head, text);
        return card;
    };
    // ตัวเลขบนแท็บ เช่น "✉️ ข้อความ 2" "⏳ รอตรวจ 1" (0 = ซ่อน)
    const setBadges = (pending, unread) => {
        const show = (tab, n) => {
            const badge = document.querySelector(`.admin-tab[data-status="${tab}"] .tab-badge`);
            if (!badge)
                return;
            badge.textContent = String(n);
            badge.hidden = n === 0;
        };
        show('Pending', pending);
        show('Messages', unread);
    };
    const refreshBadges = async () => {
        try {
            const res = await callApi('/admin/overview');
            if (!res.ok)
                return;
            const data = await res.json();
            setBadges(data.pendingStories, data.unreadMessages);
        }
        catch (err) { }
    };
    const updateCount = () => {
        const count = list.querySelectorAll('.admin-story').length;
        if (current === 'Messages') {
            setMsg(count === 0 ? 'ยังไม่มีข้อความติดต่อ' : `ข้อความ ${count} รายการ (ใหม่สุดอยู่บน)`);
            return;
        }
        if (current === 'Comments') {
            setMsg(count === 0 ? 'ยังไม่มีใครเขียนความเห็น' : `ความเห็น ${count} รายการ จากการให้คะแนนเว็บและโหวตบทความ (ใหม่สุดอยู่บน)`);
            return;
        }
        if (current === 'Scores') {
            setMsg(count === 0 ? 'ยังไม่มีใครบันทึกคะแนนเกมจับคู่การ์ดแมว' : '10 อันดับแรกของเกมจับคู่การ์ดแมว (ลบแล้วอันดับถัดไปจะขยับขึ้นมาแทน)');
            return;
        }
        setMsg(count === 0 ? `ไม่มีเรื่องในหมวด "${labels[current]}" 🎉` : `${labels[current]} ${count} เรื่อง`);
    };
    // เปิดแท็บ (ใช้ทั้งตอนกดแท็บ และตอนกดตัวเลขในหน้าภาพรวม)
    const selectTab = (tab) => {
        current = tab;
        tabs.forEach((t) => {
            const on = t.dataset.status === tab;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-pressed', String(on));
        });
        loadTab();
    };
    // ขอข้อมูลของแท็บที่เปิดอยู่จาก API แล้ววาดลง #admin-list
    const getJson = async (path) => {
        const res = await callApi(path);
        if (res.status === 401) {
            showLogin('รหัสไม่ถูกต้อง ลองใหม่อีกครั้งนะ');
            return null;
        }
        if (!res.ok)
            throw new Error(String(res.status));
        return res.json();
    };
    const loadTab = async () => {
        list.replaceChildren();
        setMsg('กำลังโหลด... (ถ้า API หลับอยู่ อาจรอเกือบ 1 นาที)');
        try {
            if (current === 'Overview') {
                const data = await getJson('/admin/overview');
                if (!data)
                    return;
                setBadges(data.pendingStories, data.unreadMessages);
                list.replaceChildren(renderOverview(data, (tab) => selectTab(tab)));
                setMsg(`อัปเดตล่าสุด ${dateFormat.format(new Date())}`);
                return;
            }
            if (current === 'Messages') {
                const messages = await getJson('/admin/messages');
                if (!messages)
                    return;
                list.replaceChildren(...messages.map(messageCard));
                updateCount();
                return;
            }
            if (current === 'Comments') {
                const comments = await getJson('/admin/comments');
                if (!comments)
                    return;
                list.replaceChildren(...comments.map(commentCard));
                updateCount();
                return;
            }
            if (current === 'Scores') {
                // กระดานคะแนนดูได้ทุกคนอยู่แล้ว (ไม่ต้องใช้รหัส) แต่ปุ่มลบต้องใช้รหัส
                const res = await fetch(`${api}/memory-scores`);
                if (!res.ok)
                    throw new Error(String(res.status));
                const scores = await res.json();
                list.replaceChildren(...scores.map((s, i) => scoreCard(s, i + 1)));
                updateCount();
                return;
            }
            const stories = await getJson(`/admin/stories?status=${current}`);
            if (!stories)
                return;
            list.replaceChildren(...stories.map(storyCard));
            updateCount();
        }
        catch (err) {
            setMsg('ติดต่อ API ไม่ได้ 😿 เปิด API ไว้หรือยัง (cd api แล้ว dotnet run)');
        }
    };
    const showPanel = () => {
        loginForm.hidden = true;
        panel.hidden = false;
        selectTab('Overview');
    };
    // ===================== ปุ่มต่างๆ =====================
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        adminKey = keyInput.value.trim();
        if (!adminKey)
            return;
        try {
            sessionStorage.setItem(KEY_STORE, adminKey);
        }
        catch (err) { }
        loginMsg.textContent = '';
        showPanel();
    });
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => selectTab(tab.dataset.status ?? 'Overview'));
    });
    logoutBtn.addEventListener('click', () => showLogin('ออกจากระบบแล้ว'));
    if (adminKey)
        showPanel();
})();
