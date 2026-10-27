// แท็บ "📊 ภาพรวม" ในหน้าแอดมิน: วาดตัวเลขสรุป กราฟคนเข้า 14 วัน หน้า/อุปกรณ์ เกม ผลลัพธ์เกม บทความ ถาม-ตอบ จากข้อมูล /admin/overview
// ไฟล์นี้มีแค่ "วิธีวาด" ส่วนการเรียก API และสลับแท็บอยู่ใน src/admin.ts (admin.html โหลดไฟล์นี้ก่อน admin.js)
// ไฟล์ต้นฉบับคือ src/admin-dashboard.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/admin-dashboard.js ใหม่

// ข้อมูลที่ /admin/overview ส่งมา (ต้องตรงกับ record Overview ใน api/InsightsEndpoints.cs)
interface OverviewData {
    today: string; // เช่น "2026-10-13"
    pendingStories: number;
    unreadMessages: number;
    site: { count: number; average: number };
    daily: { day: string; visitors: number; views: number }[];
    pages: { name: string; count: number }[];
    devices: { name: string; count: number }[];
    games: { game: string; plays: number; shares: number; ratingCount: number; ratingAverage: number }[];
    shareChannels: { name: string; count: number }[];
    truth: { finished: number; maxScore: number; averageScore: number; perfect: number; questions: { id: string; right: number; wrong: number }[] };
    breedResults: { name: string; count: number }[];
    personalityResults: { name: string; count: number }[];
    memory: { saved: number; best: { playerName: string; moves: number; seconds: number } | null };
    articles: { article: string; up: number; down: number }[];
    faq: { name: string; count: number }[];
}

// ชื่อภาษาคนของรหัสต่างๆ (รหัสต้องตรงกับ Known ใน api/InsightsEndpoints.cs)
const dashNames: Record<string, string> = {
    'index': 'หน้าแรก',
    'article-first24': '24 ชั่วโมงแรกเมื่อแมวมาถึงบ้าน',
    'article-sleep': 'ศิลปะการนอนของแมว',
    'article-language': 'ภาษาลับของเจ้าเหมียว',
    'article-home': 'บ้านที่แมวอยากอยู่',
    'article-health': 'พาน้องไปหาหมอในปีแรก',
    'article-food': 'อาหารแมว กินอะไร วันละเท่าไร',
    'article-buy': 'ซื้อแมวพันธุ์จากฟาร์ม ดูอะไรก่อนจ่ายเงิน',
    'breed-match': '🧬 แมวพันธุ์ไหนเหมาะกับคุณ',
    'personality': '😼 แมวของคุณเป็นสายไหน',
    'true-or-false': '🧠 จริงหรือมั่ว?',
    'memory-match': '🃏 จับคู่การ์ดแมว',
    'name-generator': '🎲 สุ่มชื่อแมว',
    'cat-says': '🗣️ ถ้าแมวพูดได้',
    'mobile': '📱 มือถือ / แท็บเล็ต',
    'desktop': '💻 คอมพิวเตอร์',
    // ช่องทางแชร์ (data-via ของปุ่มแชร์)
    'facebook': 'Facebook', 'x': 'X', 'story': 'IG Story', 'copy': 'คัดลอกข้อความ',
    // ผลเกม "แมวของคุณเป็นสายไหน" (quizResults ใน index.html)
    'sleep': '😴 สายนอน', 'play': '😼 สายป่วน', 'cuddle': '😻 สายอ้อน', 'explore': '🧐 สายสำรวจ',
    // ผลเกม "แมวพันธุ์ไหนเหมาะกับคุณ" (breeds ใน index.html)
    'Abyssinian': 'อะบิสซิเนียน', 'American Shorthair': 'อเมริกัน ช็อตแฮร์', 'Australian Mist': 'ออสเตรเลียน มิสท์',
    'Bengal': 'เบงกอล', 'Birman': 'เบอร์แมน', 'British Shorthair': 'บริติช ช็อตแฮร์', 'Burmilla': 'เบอร์มิลล่า',
    'Chinchilla Persian': 'ชินชิลล่า', 'Exotic Shorthair': 'เอ็กซอติก ช็อตแฮร์', 'Khao Manee': 'ขาวมณี',
    'Korat': 'โคราช (สีสวาด)', 'Maine Coon': 'เมนคูน', 'Munchkin': 'มันช์กิ้น', 'Norwegian Forest': 'นอร์วีเจียน ฟอเรสต์',
    'Ocicat': 'โอซีแคท', 'Persian': 'เปอร์เซีย', 'RagaMuffin': 'แร็กามัฟฟิน', 'Ragdoll': 'แร็กดอลล์',
    'Russian Blue': 'รัสเซียนบลู', 'Scottish Fold': 'สก็อตติช โฟลด์', 'Siamese': 'วิเชียรมาศ', 'Sphynx': 'สฟิงซ์',
    // คำถามเกม "จริงหรือมั่ว?" (id ใน truthFacts ใน index.html) พร้อมเฉลย
    't1': 'แมวโตทุกตัวดื่มนมวัวได้สบาย (มั่ว)',
    't2': 'หนวดแมวช่วยกะระยะได้ (จริง)',
    't3': 'แมวตกจากที่สูงไม่เป็นอะไรเสมอ (มั่ว)',
    't4': 'แมวรับรสหวานไม่ได้ (จริง)',
    't5': 'ครางครืดๆ = มีความสุขเสมอ (มั่ว)',
    't6': 'ดอกลิลลี่อันตรายต่อแมวมาก (จริง)',
    't7': 'แมวทุกตัวเกลียดน้ำ (มั่ว)',
    't8': 'แมวโตร้องเหมียวคุยกันเอง (มั่ว)',
    't9': 'แมวขาวตาฟ้าเสี่ยงหูหนวกกว่า (จริง)',
    't10': 'แมวมีเหงื่อออกทางอุ้งเท้า (จริง)',
    // หัวข้อถาม-ตอบ (data-faq ใน index.html)
    'f1': 'ทำไมแมวชอบเอาเท้านวดผ้าห่ม?',
    'f2': 'ทำไมแมวถึงรักกล่องกระดาษ?',
    'f3': 'แมวนอนวันละกี่ชั่วโมงถึงจะปกติ?',
    'f4': 'เสียงครางครืดๆ แปลว่ามีความสุขเสมอไหม?',
    'f5': 'ทำไมแมวเอาหัวมาชนเรา?',
    'f6': 'อาหารอะไรที่ห้ามให้แมวกิน?',
    'f7': 'ควรรับลูกแมวตอนอายุเท่าไร?',
    'f8': 'อยู่คอนโดเลี้ยงแมวได้ไหม?',
    'f9': 'ทิ้งน้องไว้บ้านคนเดียวได้นานแค่ไหน?',
    'f10': 'จำเป็นต้องทำหมันไหม?',
};
const dashName = (code: string): string => dashNames[code] ?? code;

// สร้างแท็ก HTML พร้อม class และข้อความ (ใช้ textContent เสมอ)
const dashEl = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string = '', text: string = ''): HTMLElementTagNameMap[K] => {
    const node: HTMLElementTagNameMap[K] = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
};
const dashNum = (n: number): string => n.toLocaleString('th-TH');

// การ์ด 1 ใบ มีหัวข้อ + คำอธิบายเล็กๆ
const dashCard = (title: string, note: string, ...content: HTMLElement[]): HTMLElement => {
    const card: HTMLElement = dashEl('section', 'dash-card');
    card.append(dashEl('h3', 'dash-title', title));
    if (note) card.append(dashEl('p', 'dash-note', note));
    card.append(...content);
    return card;
};

// ตัวเลขใหญ่ 1 ช่อง (กดได้ถ้าส่ง onClick มา เช่น "เรื่องรอตรวจ" กดแล้วไปแท็บรอตรวจ)
const dashTile = (label: string, value: string, sub: string, onClick?: () => void): HTMLElement => {
    const tile: HTMLElement = onClick ? dashEl('button', 'dash-tile is-link') : dashEl('div', 'dash-tile');
    if (onClick) {
        (tile as HTMLButtonElement).type = 'button';
        tile.addEventListener('click', onClick);
    }
    tile.append(dashEl('span', 'dash-tile-label', label), dashEl('strong', 'dash-tile-value', value), dashEl('span', 'dash-tile-sub', sub));
    return tile;
};

// กราฟแท่งแนวตั้ง: คนเข้าแต่ละวัน (ชี้/แตะแท่งเพื่อดูตัวเลข)
const dashDailyChart = (daily: OverviewData['daily'], today: string): HTMLElement => {
    const max: number = Math.max(1, ...daily.map((d) => d.visitors));
    const chart: HTMLElement = dashEl('div', 'dash-cols');
    chart.setAttribute('role', 'list');
    const dayFormat = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
    daily.forEach((d) => {
        const date: Date = new Date(`${d.day}T00:00:00`);
        const tip: string = `${dayFormat.format(date)} · ${dashNum(d.visitors)} คน · เปิดดู ${dashNum(d.views)} หน้า`;
        const col: HTMLElement = dashEl('div', `dash-col${d.day === today ? ' is-today' : ''}`);
        col.setAttribute('role', 'listitem');
        col.tabIndex = 0;
        col.setAttribute('aria-label', tip);
        col.dataset.tip = tip;
        const track: HTMLElement = dashEl('span', 'dash-col-track');
        // ตัวเลขบนแท่ง: ใส่เฉพาะวันนี้กับวันที่คนเยอะสุด ไม่ให้รก (วันอื่นชี้ดูได้)
        if (d.visitors > 0 && (d.day === today || d.visitors === max)) track.append(dashEl('span', 'dash-col-value', dashNum(d.visitors)));
        const bar: HTMLElement = dashEl('span', 'dash-col-bar');
        bar.style.height = `${(d.visitors / max) * 100}%`;
        track.append(bar);
        col.append(track, dashEl('span', 'dash-col-day', String(date.getDate())));
        chart.append(col);
    });
    return chart;
};

// ยังไม่มีข้อมูล: บอกตรงๆ ดีกว่าโชว์แท่งว่างๆ
const dashEmpty = (): HTMLElement => dashEl('p', 'dash-empty', 'ยังไม่มีข้อมูลใน 30 วันล่าสุด');

// กราฟแท่งแนวนอน 1 แถว: ชื่อ | แท่ง (ยาวตาม fraction 0–1) | ข้อความตัวเลข
const dashBarRow = (name: string, fraction: number, value: string): HTMLElement => {
    const row: HTMLElement = dashEl('li', 'dash-bar-row');
    const track: HTMLElement = dashEl('span', 'dash-bar-track');
    const bar: HTMLElement = dashEl('span', 'dash-bar');
    bar.style.width = `${Math.min(1, fraction) * 100}%`;
    track.append(bar);
    row.append(dashEl('span', 'dash-bar-name', name), track, dashEl('span', 'dash-bar-value', value));
    return row;
};

// กราฟแท่งแนวนอน: ชื่อ + แท่ง + ตัวเลข (เรียงมากไปน้อย แท่งยาวสุด = ค่ามากสุด)
const dashBars = (rows: { name: string; count: number }[], unit: string): HTMLElement => {
    if (rows.every((r) => r.count === 0)) return dashEmpty();
    const sorted = [...rows].sort((a, b) => b.count - a.count);
    const max: number = Math.max(1, ...sorted.map((r) => r.count));
    const list: HTMLElement = dashEl('ul', 'dash-bars');
    sorted.forEach((r) => list.append(dashBarRow(dashName(r.name), r.count / max, `${dashNum(r.count)} ${unit}`)));
    return list;
};

// ส่วนย่อยในการ์ด: หัวข้อเล็ก + เนื้อหา
const dashSub = (title: string, ...content: HTMLElement[]): HTMLElement => {
    const sub: HTMLElement = dashEl('div', 'dash-sub');
    sub.append(dashEl('h4', 'dash-sub-title', title), ...content);
    return sub;
};

// เกม "จริงหรือมั่ว?": ตัวเลขสรุป + ทุกข้อเรียงจากตอบผิดบ่อยสุด (แท่ง = % ที่ตอบผิด)
const dashTruth = (truth: OverviewData['truth']): HTMLElement[] => {
    if (truth.finished === 0) return [dashEmpty()];
    const summary: HTMLElement = dashEl('p', 'dash-sub-summary',
        `เล่นจบ ${dashNum(truth.finished)} ครั้ง · คะแนนเฉลี่ย ${truth.averageScore.toFixed(1)}/${truth.maxScore} · `
        + `ได้เต็ม ${dashNum(truth.perfect)} ครั้ง (${Math.round((truth.perfect / truth.finished) * 100)}%)`);
    const answered = truth.questions
        .map((q) => ({ ...q, total: q.right + q.wrong }))
        .filter((q) => q.total > 0)
        .sort((a, b) => b.wrong / b.total - a.wrong / a.total);
    const list: HTMLElement = dashEl('ul', 'dash-bars is-wrap'); // ชื่อข้อยาว ให้ขึ้นบรรทัดใหม่ได้ ไม่ตัดเฉลยทิ้ง
    answered.forEach((q) => list.append(dashBarRow(dashName(q.id), q.wrong / q.total,
        `ผิด ${Math.round((q.wrong / q.total) * 100)}% จาก ${dashNum(q.total)}`)));
    return [summary, dashEl('p', 'dash-note', 'ข้อที่ตอบผิดบ่อย = เรื่องที่คนยังเข้าใจผิด เอาไปเขียนบทความต่อได้'), list];
};

// ตารางธรรมดา: หัวตาราง + แถว (แต่ละช่องเป็นข้อความ)
const dashTable = (head: string[], rows: string[][]): HTMLElement => {
    const wrap: HTMLElement = dashEl('div', 'dash-table-wrap');
    const table: HTMLTableElement = dashEl('table', 'dash-table');
    const thead: HTMLTableSectionElement = dashEl('thead');
    const headRow: HTMLTableRowElement = dashEl('tr');
    head.forEach((h) => headRow.append(dashEl('th', '', h)));
    thead.append(headRow);
    const tbody: HTMLTableSectionElement = dashEl('tbody');
    rows.forEach((cells) => {
        const tr: HTMLTableRowElement = dashEl('tr');
        cells.forEach((c) => tr.append(dashEl('td', '', c)));
        tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
};

// วาดหน้าภาพรวมทั้งหมด: go('Pending') / go('Messages') = สลับไปแท็บนั้น
function renderOverview(data: OverviewData, go: (tab: string) => void): HTMLElement {
    const todayStats = data.daily.find((d) => d.day === data.today) ?? { visitors: 0, views: 0 };
    const week = data.daily.slice(-7);
    const weekVisitors: number = week.reduce((sum, d) => sum + d.visitors, 0);

    const tiles: HTMLElement = dashEl('div', 'dash-tiles');
    tiles.append(
        dashTile('คนเข้าวันนี้', dashNum(todayStats.visitors), `เปิดดู ${dashNum(todayStats.views)} หน้า`),
        dashTile('7 วันล่าสุด', dashNum(weekVisitors), 'คน (นับวันละครั้งต่อเครื่อง)'),
        dashTile('เรื่องรอตรวจ', dashNum(data.pendingStories), data.pendingStories ? 'กดเพื่อไปอ่าน →' : 'ไม่มีค้าง 🎉', () => go('Pending')),
        dashTile('ข้อความใหม่', dashNum(data.unreadMessages), data.unreadMessages ? 'กดเพื่อไปอ่าน →' : 'อ่านครบแล้ว', () => go('Messages')),
        dashTile('คะแนนเว็บ', data.site.count ? `⭐ ${data.site.average.toFixed(1)}` : '–', `จาก ${dashNum(data.site.count)} คน`),
    );

    const games: string[][] = [...data.games]
        .sort((a, b) => b.plays - a.plays)
        .map((g) => [dashName(g.game), dashNum(g.plays), dashNum(g.shares), g.ratingCount ? `⭐ ${g.ratingAverage.toFixed(1)}` : '–', dashNum(g.ratingCount)]);
    const shareTotal: number = data.shareChannels.reduce((sum, c) => sum + c.count, 0);
    const shareLine: HTMLElement = dashEl('p', 'dash-sub-summary', shareTotal === 0
        ? 'ยังไม่มีใครกดแชร์ใน 30 วันล่าสุด'
        : `กดแชร์ผ่าน: ${[...data.shareChannels].sort((a, b) => b.count - a.count).map((c) => `${dashName(c.name)} ${dashNum(c.count)}`).join(' · ')}`);

    // กระดานจับคู่การ์ด: สรุปสั้นๆ + ปุ่มไปแท็บกระดาน
    const best = data.memory.best;
    const memoryLine: HTMLElement = dashEl('p', 'dash-sub-summary', data.memory.saved === 0
        ? 'ยังไม่มีใครบันทึกคะแนน'
        : `บันทึกแล้ว ${dashNum(data.memory.saved)} คน · อันดับ 1 ตอนนี้: ${best?.playerName} (${best?.moves} ครั้ง · ${best?.seconds} วิ)`);
    const toBoard: HTMLButtonElement = dashEl('button', 'admin-btn', '🏆 ไปที่กระดาน →');
    toBoard.type = 'button';
    toBoard.addEventListener('click', () => go('Scores'));

    const results: HTMLElement = dashEl('div', 'dash-subs');
    results.append(
        dashSub('🧠 จริงหรือมั่ว?', ...dashTruth(data.truth)),
        dashSub('🧬 แมวพันธุ์ไหนเหมาะกับคุณ · พันธุ์ที่ออกบ่อย', data.breedResults.length ? dashBars(data.breedResults, 'ครั้ง') : dashEmpty()),
        dashSub('😼 แมวของคุณเป็นสายไหน · สายที่ออกบ่อย', dashBars(data.personalityResults, 'ครั้ง')),
        dashSub('🃏 กระดานจับคู่การ์ด', memoryLine, toBoard),
    );
    const articles: string[][] = data.articles.map((a) => {
        const total: number = a.up + a.down;
        return [dashName(a.article), dashNum(a.up), dashNum(a.down), total ? `${Math.round((a.up / total) * 100)}%` : '–'];
    });

    const pair: HTMLElement = dashEl('div', 'dash-pair');
    pair.append(
        dashCard('หน้าที่คนเปิดดู', '30 วันล่าสุด', dashBars(data.pages, 'ครั้ง')),
        dashCard('เข้าจากอุปกรณ์อะไร', 'นับคนเข้า 30 วันล่าสุด', dashBars(data.devices, 'คน')),
    );

    const root: HTMLElement = dashEl('div', 'dash');
    root.append(
        tiles,
        dashCard('คนเข้าเว็บ 14 วันล่าสุด', 'ชี้หรือแตะที่แท่งเพื่อดูตัวเลขของแต่ละวัน', dashDailyChart(data.daily, data.today)),
        pair,
        dashCard('มินิเกม', 'เล่นจบ = ได้ผลลัพธ์ 1 ครั้ง (สุ่มชื่อ/แมวพูด นับทุกครั้งที่กดได้ผลใหม่) · เล่นจบและแชร์ = 30 วันล่าสุด · ดาว = ตั้งแต่เริ่มเก็บ',
            dashTable(['เกม', 'เล่นจบ', 'แชร์', 'ดาวเฉลี่ย', 'คนให้ดาว'], games), shareLine),
        dashCard('ผลลัพธ์เกม', '30 วันล่าสุด · เก็บแค่ผลรวม ไม่รู้ว่าใครได้ผลอะไร', results),
        dashCard('บทความ', 'บทความนี้มีประโยชน์ไหม? (เหตุผลตอนกด 👎 อ่านได้ในแท็บ 💬 ความเห็น)',
            dashTable(['บทความ', '👍', '👎', 'มีประโยชน์'], articles)),
        dashCard('ถาม-ตอบที่คนกดเปิดอ่าน', '30 วันล่าสุด · ข้อที่เปิดบ่อย = เรื่องที่คนสงสัย', dashBars(data.faq, 'ครั้ง')),
        dashEl('p', 'dash-privacy', '🔒 นับแบบไม่เก็บตัวตน: ไม่มี IP ไม่มีชื่อ เก็บแค่ตัวเลขรวมรายวัน · "คน" = เบราว์เซอร์ที่เข้าเว็บในวันนั้น (เครื่องเดียวกันเข้าหลายรอบนับ 1)'),
    );
    return root;
}
