// มินิเกมจับคู่การ์ดแมว และเครื่องสุ่มชื่อแมว
// ใช้ breeds, shareBar, gameRating, track จากสคริปต์หลักใน index.html
(() => {
    const shuffle = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    // ===================== จับคู่การ์ดแมว =====================
    const memoryBody = document.querySelector('#memory-body');
    let memOpen;
    let memMoves;
    let memMatched;
    let memStart;
    let memTimer;
    let memLock;

    function renderMemory() {
        const picks = shuffle(breeds).slice(0, 6);
        const deck = shuffle([...picks, ...picks]);
        memOpen = [];
        memMoves = 0;
        memMatched = 0;
        memStart = null;
        memLock = false;
        clearInterval(memTimer);
        memoryBody.innerHTML = `
            <div class="mem-status">
                <span>เปิดไป <strong id="mem-moves">0</strong> ครั้ง</span>
                <span>จับคู่ได้ <strong id="mem-pairs">0</strong>/6</span>
                <span>⏱️ <strong id="mem-time">0</strong> วินาที</span>
            </div>
            <div class="mem-grid">
                ${deck.map((b) => `
                    <button type="button" class="mem-card" data-key="${b.en}" aria-label="การ์ดคว่ำอยู่">
                        <span class="mem-inner">
                            <span class="mem-back" aria-hidden="true">🐾</span>
                            <span class="mem-front">
                                <img src="${b.img}" alt="">
                                <small>${b.name}</small>
                            </span>
                        </span>
                    </button>`).join('')}
            </div>`;
        memoryBody.querySelectorAll('.mem-card').forEach((card) => card.addEventListener('click', () => flipCard(card)));
    }

    function flipCard(card) {
        if (memLock || card.classList.contains('is-open')) return;
        if (!memStart) {
            memStart = Date.now();
            memTimer = setInterval(() => {
                const t = memoryBody.querySelector('#mem-time');
                if (t) t.textContent = Math.floor((Date.now() - memStart) / 1000);
            }, 250);
        }
        card.classList.add('is-open');
        card.setAttribute('aria-label', card.querySelector('small').textContent);
        memOpen.push(card);
        if (memOpen.length < 2) return;
        memMoves++;
        memoryBody.querySelector('#mem-moves').textContent = memMoves;
        const [a, b] = memOpen;
        memOpen = [];
        if (a.dataset.key === b.dataset.key) {
            memMatched++;
            memoryBody.querySelector('#mem-pairs').textContent = memMatched;
            a.classList.add('is-matched');
            b.classList.add('is-matched');
            if (memMatched === 6) {
                clearInterval(memTimer);
                setTimeout(memoryResult, 800);
            }
        } else {
            memLock = true;
            setTimeout(() => {
                [a, b].forEach((c) => {
                    c.classList.remove('is-open');
                    c.setAttribute('aria-label', 'การ์ดคว่ำอยู่');
                });
                memLock = false;
            }, 850);
        }
    }

    function memoryResult() {
        const secs = Math.floor((Date.now() - memStart) / 1000);
        track('plays:memory-match');
        const rank = memMoves <= 8 ? ['🧠', 'ความจำระดับเทพ', 'จำแม่นยิ่งกว่าแมวจำเวลาข้าว']
            : memMoves <= 12 ? ['😺', 'ความจำดีมาก', 'จับคู่คล่องสุดๆ อีกนิดเดียวก็ระดับเทพ']
            : ['😹', 'ขอฝึกอีกนิด', 'สนุกได้ก็พอ ลองอีกรอบ รับรองเร็วขึ้นแน่'];
        memoryBody.innerHTML = `
            <div class="quiz-result">
                <span class="quiz-result-emoji">${rank[0]}</span>
                <p class="quiz-result-label">จับคู่ครบ 6 คู่ใน</p>
                <h3>${memMoves} ครั้ง</h3>
                <p><strong>${rank[1]}</strong> · ${rank[2]} (ใช้เวลา ${secs} วินาที)</p>
                <div class="result-actions">
                    <button type="button" class="btn" id="mem-restart">เล่นอีกครั้ง</button>
                </div>
                <div class="board" id="mem-board" hidden></div>
                ${shareBar({ text: `ฉันจับคู่การ์ดแมวครบ 6 คู่ใน ${memMoves} ครั้ง ได้ฉายา "${rank[1]}" ${rank[0]} มาแข่งความจำกัน!`, emoji: rank[0], label: 'จับคู่การ์ดแมว ครบใน', title: `${memMoves} ครั้ง`, sub: `ฉายา "${rank[1]}" · ใช้เวลา ${secs} วินาที` })}
                ${gameRating('memory-match')}
            </div>`;
        memoryBody.querySelector('#mem-restart').addEventListener('click', renderMemory);
        // กระดานคะแนน (leaderboard.js) รอฟังเหตุการณ์นี้ แล้วเติมลงกล่อง #mem-board
        document.dispatchEvent(new CustomEvent('nakcat:memory-done', { detail: { moves: memMoves, seconds: secs } }));
    }

    renderMemory();

    // ===================== สุ่มชื่อแมว =====================
    const nameBody = document.querySelector('#names-body');
    const nameGroups = [
        { id: 'food', label: 'หมวดอาหาร', names: [
            ['ข้าวปั้น', 'กลมๆ ขาวๆ น่าบีบ'], ['บัวลอย', 'นุ่มนิ่ม หวานละมุน'], ['ทองหยอด', 'สีส้มทอง หวานเจี๊ยบ'], ['ขนมปัง', 'ท่านั่งก้อนขนมปังเป๊ะ'],
            ['ส้มโอ', 'ตัวกลม ขนสีส้มอ่อน'], ['มะพร้าว', 'ขาวข้างใน แข็งข้างนอก'], ['ชาไทย', 'สีส้มนม ใครเห็นก็หลง'], ['ลาเต้', 'สีน้ำตาลนมละมุน'],
            ['โมจิ', 'ยืดได้ หนึบได้ เหมือนแมวนอน'], ['เต้าหู้', 'ขาวนวล เนื้อเนียน'], ['ข้าวเหนียว', 'ติดเจ้าของหนึบหนับ'], ['พุดดิ้ง', 'สั่นดุ๊กดิ๊กเวลาเดิน'],
            ['ไข่ตุ๋น', 'นุ่ม อุ่น ปลอบใจเก่ง'], ['คุกกี้', 'มีจุดๆ ทั้งตัว'], ['ขนมจีบ', 'ตัวเล็ก หน้าจีบน่ารัก'], ['ซาลาเปา', 'แก้มป่อง ตัวกลมฟู'],
        ] },
        { id: 'lucky', label: 'หมวดสายมู', names: [
            ['เฮงเฮง', 'เข้าบ้านแล้วเฮงทั้งปี'], ['มั่งมี', 'ขอให้เจ้าของมั่งมีศรีสุข'], ['ทองคำ', 'แมวสีทองเรียกทรัพย์'], ['นำโชค', 'ไปไหนโชคดีไปนั่น'],
            ['เงินล้าน', 'ตั้งไว้เป็นกำลังใจ'], ['มณี', 'ล้ำค่าดั่งอัญมณี'], ['ปังปัง', 'ชีวิตปังทุกด้าน'], ['รวยเฮง', 'สองคำมงคลในชื่อเดียว'],
            ['ศรีสุข', 'บ้านอบอุ่น มีแต่ความสุข'], ['มงคล', 'ชื่อดี ชีวิตดี'], ['ดวงดี', 'ใครอุ้มแล้วดวงขึ้น'], ['ไหมทอง', 'ขนนุ่มดั่งไหมทองคำ'],
            ['โชคดี', 'ตรงๆ ไม่ต้องตีความ'], ['ฟ้าประทาน', 'ของขวัญจากฟ้า'], ['ร่ำรวย', 'เรียกเงินเข้ากระเป๋า'], ['มีทรัพย์', 'แมวกวักในตำนาน'],
        ] },
        { id: 'english', label: 'หมวดภาษาอังกฤษ', names: [
            ['Milo', 'ซน ขี้เล่น เป็นมิตร'], ['Luna', 'แปลว่าพระจันทร์ ชอบตื่นตอนดึก'], ['Oliver', 'หนุ่มสุภาพผู้ดีอังกฤษ'], ['Leo', 'สิงโตตัวน้อยในบ้าน'],
            ['Coco', 'สีน้ำตาลช็อกโกแลต'], ['Bella', 'แปลว่างดงาม'], ['Simba', 'ราชาตัวจิ๋ว'], ['Nala', 'เจ้าหญิงคู่ใจซิมบ้า'],
            ['Pepper', 'ขาวแซมดำเหมือนพริกไทย'], ['Ginger', 'แมวส้มตัวแสบ'], ['Shadow', 'ตามติดเจ้าของเป็นเงา'], ['Biscuit', 'กรอบนอกนุ่มใน'],
            ['Cleo', 'สง่างามแบบราชินีอียิปต์'], ['Oreo', 'ขาวดำสุดคลาสสิก'], ['Maple', 'หวานแบบน้ำเชื่อมเมเปิล'], ['Pumpkin', 'กลม ส้ม อบอุ่น'],
        ] },
        { id: 'funny', label: 'หมวดกวนๆ', names: [
            ['เจ้าหนี้', 'มาทวงข้าวตรงเวลาทุกวัน'], ['บอส', 'ใครเป็นทาสใครเป็นนาย รู้กันอยู่'], ['หัวหน้าห้อง', 'คุมทุกคนในบ้าน'], ['ผู้ว่า', 'ตรวจพื้นที่ทุกซอกทุกมุม'],
            ['เสี่ย', 'ใช้ชีวิตหรูกว่าเจ้าของ'], ['คุณนาย', 'ไม่ทำอะไรนอกจากสวย'], ['ท่านประธาน', 'นั่งหัวโต๊ะทุกมื้อ'], ['ไอ้ต้าว', 'ทั้งรักทั้งหมั่นไส้'],
            ['ตัวป่วน', 'ทำของตกเป็นงานอดิเรก'], ['ซุปตาร์', 'ถ่ายรูปขึ้นทุกมุม'], ['พี่ใหญ่', 'เล็กแต่ใจใหญ่'], ['นายพล', 'สั่งการด้วยสายตา'],
            ['ขี้เซา', 'นอน 16 ชั่วโมงไม่พอ'], ['เจ๊', 'เสียงดังที่สุดในบ้าน'], ['คุณชาย', 'เลือกกินยิ่งกว่าใคร'], ['หนี้ก้อนโต', 'ค่าขนมทั้งเดือนหมดที่ตัวนี้'],
        ] },
    ];
    let nameGroup = 'all';
    let lastName = null;

    function pickName() {
        const pool = nameGroups
            .filter((g) => nameGroup === 'all' || g.id === nameGroup)
            .flatMap((g) => g.names.map(([name, note]) => ({ name, note, group: g.label })));
        let pick;
        do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && lastName && pick.name === lastName);
        lastName = pick.name;
        return pick;
    }

    function renderNames(pick) {
        if (pick) track('plays:name-generator'); // ได้ชื่อใหม่ 1 ชื่อ = เล่น 1 ครั้ง
        const chips = [['all', 'ทุกหมวด'], ...nameGroups.map((g) => [g.id, g.label])];
        nameBody.innerHTML = `
            <div class="name-chips" role="group" aria-label="เลือกหมวดชื่อ">
                ${chips.map(([id, label]) => `<button type="button" class="gallery-filter${id === nameGroup ? ' is-active' : ''}" data-group="${id}" aria-pressed="${id === nameGroup}">${label}</button>`).join('')}
            </div>
            <div class="name-card${pick ? ' is-picked' : ''}" aria-live="polite">
                ${pick ? `
                    <p class="name-group">${pick.group}</p>
                    <p class="name-value">${pick.name}</p>
                    <p class="name-note">${pick.note}</p>
                    <button type="button" class="fav-btn fav-pill" data-fav="name:${pick.name}" data-fav-title="${pick.name}" data-fav-off="เก็บชื่อนี้" data-fav-on="เก็บแล้ว" aria-pressed="false"><span class="fav-heart" aria-hidden="true">♡</span> <span class="fav-text">เก็บชื่อนี้</span></button>`
                : '<p class="name-empty">เลือกหมวดแล้วกดสุ่มได้เลย</p>'}
            </div>
            <div class="result-actions">
                <button type="button" class="btn" id="name-roll">${pick ? 'สุ่มอีกชื่อ' : 'สุ่มชื่อเลย'}</button>
            </div>
            ${pick ? `<div class="quiz-result">${shareBar({ text: `ได้ชื่อแมวว่า "${pick.name}" (${pick.note}) ลองสุ่มชื่อแมวของคุณดู`, emoji: '🐱', label: 'ชื่อแมวของฉันคือ', title: pick.name, sub: pick.note })}${gameRating('name-generator')}</div>` : ''}`;
        nameBody.querySelectorAll('[data-group]').forEach((btn) => btn.addEventListener('click', () => {
            nameGroup = btn.dataset.group;
            renderNames(pickName());
        }));
        nameBody.querySelector('#name-roll').addEventListener('click', () => renderNames(pickName()));
    }

    renderNames(null);
})();
