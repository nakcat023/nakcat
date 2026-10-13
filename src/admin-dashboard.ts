// แท็บ "📊 ภาพรวม" ในหน้าแอดมิน: วาดตัวเลขสรุป กราฟคนเข้า 14 วัน และตารางหน้า/เกม/บทความ จากข้อมูล /admin/overview
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
    games: { game: string; plays: number; ratingCount: number; ratingAverage: number }[];
    articles: { article: string; up: number; down: number }[];
}

// ชื่อภาษาคนของรหัสต่างๆ (รหัสต้องตรงกับ Known ใน api/InsightsEndpoints.cs)
const dashNames: Record<string, string> = {
    'index': 'หน้าแรก',
    'article-first24': '24 ชั่วโมงแรกเมื่อแมวมาถึงบ้าน',
    'article-sleep': 'ศิลปะการนอนของแมว',
    'article-language': 'ภาษาลับของเจ้าเหมียว',
    'article-home': 'บ้านที่แมวอยากอยู่',
    'breed-match': '🧬 แมวพันธุ์ไหนเหมาะกับคุณ',
    'personality': '😼 แมวของคุณเป็นสายไหน',
    'true-or-false': '🧠 จริงหรือมั่ว?',
    'memory-match': '🃏 จับคู่การ์ดแมว',
    'name-generator': '🎲 สุ่มชื่อแมว',
    'cat-says': '🗣️ ถ้าแมวพูดได้',
    'mobile': '📱 มือถือ / แท็บเล็ต',
    'desktop': '💻 คอมพิวเตอร์',
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

// กราฟแท่งแนวนอน: ชื่อ + แท่ง + ตัวเลข (เรียงมากไปน้อย)
const dashBars = (rows: { name: string; count: number }[], unit: string): HTMLElement => {
    const sorted = [...rows].sort((a, b) => b.count - a.count);
    const max: number = Math.max(1, ...sorted.map((r) => r.count));
    const list: HTMLElement = dashEl('ul', 'dash-bars');
    sorted.forEach((r) => {
        const row: HTMLElement = dashEl('li', 'dash-bar-row');
        const track: HTMLElement = dashEl('span', 'dash-bar-track');
        const bar: HTMLElement = dashEl('span', 'dash-bar');
        bar.style.width = `${(r.count / max) * 100}%`;
        track.append(bar);
        row.append(dashEl('span', 'dash-bar-name', dashName(r.name)), track, dashEl('span', 'dash-bar-value', `${dashNum(r.count)} ${unit}`));
        list.append(row);
    });
    return list;
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
        .map((g) => [dashName(g.game), dashNum(g.plays), g.ratingCount ? `⭐ ${g.ratingAverage.toFixed(1)}` : '–', dashNum(g.ratingCount)]);
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
        dashCard('มินิเกม', 'เล่นจบ = จำนวนครั้งที่เห็นหน้าผลลัพธ์ใน 30 วันล่าสุด · ดาว = ตั้งแต่เริ่มเก็บ',
            dashTable(['เกม', 'เล่นจบ', 'ดาวเฉลี่ย', 'คนให้ดาว'], games)),
        dashCard('บทความ', 'บทความนี้มีประโยชน์ไหม? (เหตุผลตอนกด 👎 อ่านได้ในแท็บ 💬 ความเห็น)',
            dashTable(['บทความ', '👍', '👎', 'มีประโยชน์'], articles)),
        dashEl('p', 'dash-privacy', '🔒 นับแบบไม่เก็บตัวตน: ไม่มี IP ไม่มีชื่อ เก็บแค่ตัวเลขรวมรายวัน · "คน" = เบราว์เซอร์ที่เข้าเว็บในวันนั้น (เครื่องเดียวกันเข้าหลายรอบนับ 1)'),
    );
    return root;
}
