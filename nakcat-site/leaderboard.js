"use strict";
// กระดานคะแนนเกม "จับคู่การ์ดแมว": โผล่ในหน้าผลลัพธ์หลังเล่นจบ ให้ใส่ชื่อบันทึกคะแนน + ดู 10 อันดับแรก (ผ่าน API)
// minigames.js ส่งเหตุการณ์ nakcat:memory-done มาพร้อมผลเกม แล้วไฟล์นี้เติมกระดานลงกล่อง #mem-board
// API_BASE (ที่อยู่ของ API) มาจาก src/api.ts
// ไฟล์ต้นฉบับคือ src/leaderboard.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/leaderboard.js ใหม่
(() => {
    if (!API_BASE)
        return;
    const api = API_BASE;
    const NAME_KEY = 'nakcat-player-name'; // จำชื่อไว้ เล่นรอบหน้าไม่ต้องพิมพ์ใหม่
    const medals = ['🥇', '🥈', '🥉'];
    // วาดรายชื่อ 10 อันดับ: ชื่อคนเล่นใส่ด้วย textContent เสมอ (เป็นข้อความที่คนพิมพ์มา)
    const renderList = (list, top, myId) => {
        if (top.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'board-empty';
            empty.textContent = 'ยังไม่มีใครบันทึกคะแนน มาเป็นคนแรกกัน!';
            list.replaceChildren(empty);
            return;
        }
        list.replaceChildren(...top.map((s, i) => {
            const row = document.createElement('li');
            if (s.id === myId)
                row.className = 'is-me';
            const rank = document.createElement('span');
            rank.className = 'board-rank';
            rank.textContent = medals[i] ?? String(i + 1);
            const name = document.createElement('span');
            name.className = 'board-name';
            name.textContent = s.id === myId ? `${s.playerName} (คุณ)` : s.playerName;
            const score = document.createElement('span');
            score.className = 'board-score';
            score.textContent = `${s.moves} ครั้ง · ${s.seconds} วิ`;
            row.append(rank, name, score);
            return row;
        }));
    };
    document.addEventListener('nakcat:memory-done', async (e) => {
        const result = e.detail;
        const board = document.querySelector('#mem-board');
        if (!board)
            return;
        const title = document.createElement('h4');
        title.className = 'board-title';
        title.textContent = 'กระดานคะแนน 10 อันดับแรก';
        const form = document.createElement('form');
        form.className = 'board-form';
        const input = document.createElement('input');
        input.maxLength = 20;
        input.required = true;
        input.setAttribute('autocomplete', 'nickname');
        input.placeholder = 'ชื่อที่จะขึ้นกระดาน';
        input.setAttribute('aria-label', 'ชื่อที่จะขึ้นกระดานคะแนน');
        try {
            input.value = localStorage.getItem(NAME_KEY) ?? '';
        }
        catch (err) { }
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'btn';
        saveBtn.textContent = 'บันทึกคะแนน';
        form.append(input, saveBtn);
        const status = document.createElement('p');
        status.className = 'board-status';
        status.setAttribute('aria-live', 'polite');
        const list = document.createElement('ol');
        list.className = 'board-list';
        const loading = document.createElement('li');
        loading.className = 'board-empty';
        loading.textContent = 'กำลังโหลดกระดานคะแนน...';
        list.append(loading);
        board.replaceChildren(title, form, status, list);
        board.hidden = false;
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const playerName = input.value.trim();
            if (!playerName)
                return;
            try {
                localStorage.setItem(NAME_KEY, playerName);
            }
            catch (err) { }
            saveBtn.disabled = true;
            saveBtn.textContent = 'กำลังบันทึก...';
            status.className = 'board-status';
            status.textContent = '';
            const stopNotice = onSlowApi(() => { status.textContent = API_WAKING; });
            try {
                const res = await fetch(`${api}/memory-scores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerName, moves: result.moves, seconds: result.seconds }),
                });
                if (res.ok) {
                    const saved = await res.json();
                    form.remove(); // บันทึกได้ครั้งเดียวต่อ 1 รอบที่เล่น
                    status.className = 'board-status is-success';
                    status.textContent = saved.rank <= 10
                        ? `คุณได้อันดับที่ ${saved.rank}!`
                        : `บันทึกแล้ว! ตอนนี้อยู่อันดับที่ ${saved.rank} อีกนิดจะติด 10 อันดับแรก ลองอีกรอบนะ`;
                    renderList(list, saved.top, saved.id);
                    return;
                }
                const data = await res.json();
                status.className = 'board-status is-error';
                status.textContent = data.message; // เช่น "ชื่อยาวเกิน 20 ตัวอักษร"
            }
            catch (err) {
                status.className = 'board-status is-error';
                status.textContent = 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ';
            }
            finally {
                stopNotice();
            }
            saveBtn.disabled = false;
            saveBtn.textContent = 'บันทึกคะแนน';
        });
        const stopNotice = onSlowApi(() => { loading.textContent = API_WAKING; });
        try {
            const res = await fetch(`${api}/memory-scores`);
            if (!res.ok)
                throw new Error(String(res.status));
            renderList(list, await res.json(), null);
        }
        catch (err) {
            loading.textContent = 'โหลดกระดานคะแนนไม่สำเร็จ';
        }
        finally {
            stopNotice();
        }
    });
})();
