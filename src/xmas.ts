// ต้นคริสต์มาสตัวอักษร (ASCII art) บน canvas
// แปลงมาจาก ascii-xmas-tree/xmas_tree.py (เวอร์ชัน Python + numpy + pygame) หลักการเหมือนกันทุกอย่าง
//   ทั้งฉากคือตารางช่องตัวอักษร COLS × ROWS ช่อง
//   chars = ช่องนี้เป็นตัวอักษรอะไร, cols = สีของช่อง (RGB 0..1), glow = ช่องนี้เรืองแสงแค่ไหน
//   ทุกเฟรมวาดของทับกันลงตาราง
//     ฉากหลัง → ดาว → พลุ → ซานต้า → ดาวตก → ต้นไม้ → ของขวัญ → แมว → ดาวบนยอด → หิมะ → ข้อความ
//   แล้วแปลงทั้งตารางเป็นพิกเซลทีเดียว
// ลองดูช่วงนับถอยหลังกับพลุปิดท้ายโดยไม่ต้องรอวันจริง: xmas.html?now=2026-12-24T23:59:45
// ห่อทั้งไฟล์ไว้ในฟังก์ชัน ชื่อตัวแปรจะได้ไม่ชนกับสคริปต์อื่นของเว็บ
(() => {
    const canvas = document.getElementById('xmas-canvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // ---------------------------------------------------------------- ขนาดฉาก
    const COLS = 136, ROWS = 60;      // จำนวนช่องตัวอักษร แนวนอน × แนวตั้ง
    const CW = 7, CH = 12;            // ช่องหนึ่งกว้าง × สูง กี่พิกเซล
    const W = COLS * CW, H = ROWS * CH, N = COLS * ROWS;
    const ASPECT = CH / CW;           // ช่องสูงกว่ากว้าง จะทำอะไรให้กลมต้องยืดแกน x ด้วยค่านี้
    const HORIZON = 34;               // แถวที่ท้องฟ้าจบ พื้นหิมะเริ่ม
    const CX = COLS >> 1;             // แกนกลางต้นคริสต์มาส
    const TREE_TOP = 11, TREE_BASE = 51, STAR_CY = 8;
    const MOON_Y = 7, MOON_X = 18, MOON_R = 4.3;
    canvas.width = W;
    canvas.height = H;

    type RGB = readonly [number, number, number];
    const GOLD: RGB = [1, 0.78, 0.25];
    const RED: RGB = [0.92, 0.16, 0.16];
    const WHITE: RGB = [0.92, 0.94, 1];
    const BLUE: RGB = [0.3, 0.5, 1];
    const GREEN: RGB = [0.14, 0.74, 0.22];
    const PURPLE: RGB = [0.8, 0.35, 0.95];
    const LIGHT_COLORS: RGB[] = [[1, 0.22, 0.22], [1, 0.85, 0.25], [0.35, 0.6, 1], [1, 0.45, 0.85], [0.95, 0.97, 1], [0.45, 1, 0.55]];
    const FIREWORK_COLORS: RGB[] = [[1, 0.28, 0.28], [1, 0.82, 0.25], [0.38, 0.62, 1], [1, 0.42, 0.85],
        [0.45, 1, 0.55], [0.72, 0.48, 1], [1, 0.58, 0.18], [0.9, 0.95, 1]];

    // โหมดไฟบนต้น สลับด้วยปุ่มใต้ภาพ
    const LIGHT_MODES = ['classic', 'warm', 'rainbow', 'beat'] as const;
    const LIGHT_LABELS = ['ไฟหลากสี', 'ไฟสีทอง', 'ไฟสีรุ้ง', 'ไฟตามจังหวะ'];
    const BPM = 120;   // จังหวะของโหมด beat

    // ตัวอักษรทั้งหมดที่ใช้ ตำแหน่งในสตริงคือเลขที่เก็บใน chars (0 = ช่องว่าง ไม่วาด)
    const CHARSET = Array.from(new Set(" .,:;'`-~_=+*^/\\|<>()[]{}!?@#%&"
        + '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')).join('');
    const CI: Record<string, number> = {};
    for (let i = 0; i < CHARSET.length; i++) CI[CHARSET[i]] = i;
    const idx = (s: string) => Array.from(s, (c) => CI[c] ?? 0);

    // ---------------------------------------------------------------- ตัวช่วย
    // สุ่มแบบกำหนดเลขตั้งต้น (mulberry32) เปิดกี่ครั้งป่ากับของตกแต่งก็หน้าตาเดิม
    let seed = 2026;
    function rnd(): number {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const uniform = (a: number, b: number) => a + (b - a) * rnd();
    const randInt = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));   // รวม b ด้วย
    function pick<T>(items: readonly T[], weights?: readonly number[]): T {
        if (!weights) return items[Math.floor(rnd() * items.length)];
        let r = rnd();
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r < 0) return items[i];
        }
        return items[items.length - 1];
    }
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
    const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;   // เริ่มเร็วแล้วค่อย ๆ ช้าลงตอนจบ
    // แปลงเฉดสี 0..1 เป็น RGB สีสด ๆ (ใช้ทำสีรุ้ง)
    function hue(h: number): RGB {
        const x = (((h % 1) + 1) % 1) * 6;
        return [clamp01(Math.abs(x - 3) - 1), clamp01(2 - Math.abs(x - 2)), clamp01(2 - Math.abs(x - 4))];
    }

    // ตารางของเฟรมปัจจุบัน
    const chars = new Uint8Array(N);
    const cols = new Float32Array(N * 3);
    const glow = new Float32Array(N);

    function put(i: number, ch: number, r: number, g: number, b: number, gl = -1): void {
        chars[i] = ch;
        cols[i * 3] = r;
        cols[i * 3 + 1] = g;
        cols[i * 3 + 2] = b;
        if (gl >= 0) glow[i] = gl;
    }
    function putAt(row: number, col: number, ch: number, c: RGB, k = 1, gl = -1): void {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
        put(row * COLS + col, ch, c[0] * k, c[1] * k, c[2] * k, gl);
    }
    // เขียนข้อความลงตารางทีละตัว color เป็นสีเดียวหรือฟังก์ชันคืนสีของตัวที่ n ก็ได้
    function drawText(text: string, row: number, col: number, color: RGB | ((n: number) => RGB), gl = 0.15): void {
        Array.from(text).forEach((ch, n) => {
            if (ch !== ' ') putAt(row, col + n, CI[ch] ?? 0, typeof color === 'function' ? color(n) : color, 1, gl);
        });
    }

    // ---------------------------------------------------------------- ตัวอักษร → พิกเซล
    // วาดตัวอักษรแต่ละตัวเป็นสีขาวขนาดพอดีช่อง เก็บความเข้มไว้ใช้ทุกเฟรม
    function buildGlyphs(): Float32Array {
        const masks = new Float32Array(CHARSET.length * CW * CH);
        const g = document.createElement('canvas');
        g.width = CW;
        g.height = CH;
        const gc = g.getContext('2d', { willReadFrequently: true });
        if (!gc) return masks;
        gc.font = 'bold 12px Consolas, "DejaVu Sans Mono", Menlo, "Courier New", monospace';
        gc.textAlign = 'center';
        gc.textBaseline = 'middle';
        gc.fillStyle = '#fff';
        for (let k = 1; k < CHARSET.length; k++) {
            gc.clearRect(0, 0, CW, CH);
            gc.fillText(CHARSET[k], CW / 2, CH / 2 + 1);
            const d = gc.getImageData(0, 0, CW, CH).data;
            for (let p = 0; p < CW * CH; p++) masks[k * CW * CH + p] = d[p * 4 + 3] / 255;
        }
        return masks;
    }
    const masks = buildGlyphs();

    const image = ctx.createImageData(W, H);
    const px = image.data;
    const px32 = new Uint32Array(px.buffer);

    // เอาหน้ากากตัวอักษรของแต่ละช่องคูณสีของช่องนั้น แล้ววางลงภาพเต็มจอ
    function compose(): void {
        px32.fill(0xff000000);   // ดำทึบ (alpha = 255)
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const i = row * COLS + col;
                const ch = chars[i];
                if (!ch) continue;
                const r = cols[i * 3] * 255, g = cols[i * 3 + 1] * 255, b = cols[i * 3 + 2] * 255;
                if (r + g + b < 1) continue;
                let m = ch * CW * CH;
                let p = (row * CH * W + col * CW) * 4;
                for (let y = 0; y < CH; y++, p += W * 4) {
                    for (let x = 0; x < CW; x++, m++) {
                        const a = masks[m];
                        if (a === 0) continue;
                        const q = p + x * 4;
                        px[q] = r * a;          // Uint8ClampedArray ตัดค่าเกิน 255 ให้เอง
                        px[q + 1] = g * a;
                        px[q + 2] = b * a;
                    }
                }
            }
        }
        ctx!.putImageData(image, 0, 0);
    }

    // แสงฟุ้งรอบของที่เรืองแสง: เบลอบนตารางช่องเล็ก ๆ แล้วให้เบราว์เซอร์ขยายเป็นเต็มจอ
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = COLS;
    glowCanvas.height = ROWS;
    const gctx = glowCanvas.getContext('2d');
    const glowImage = gctx?.createImageData(COLS, ROWS);
    // น้ำหนักเบลอแบบยอดแหลมตรงกลาง (ถ้าเฉลี่ยเท่ากันทุกช่อง พอขยายแล้วแสงจะเป็นสี่เหลี่ยม)
    // แนวนอนกว้างกว่าแนวตั้ง เพราะช่องแคบกว่า แสงจึงฟุ้งเป็นวงกลม
    const GLOW_WY = [1, 2, 1];
    const GLOW_WX = [1, 2, 3, 2, 1];
    function addGlow(strength = 1.4): void {
        if (!gctx || !glowImage) return;
        const out = glowImage.data;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                let r = 0, g = 0, b = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const yy = row + dy;
                    if (yy < 0 || yy >= ROWS) continue;
                    for (let dx = -2; dx <= 2; dx++) {
                        const xx = col + dx;
                        if (xx < 0 || xx >= COLS) continue;
                        const j = yy * COLS + xx;
                        const k = glow[j] * GLOW_WY[dy + 1] * GLOW_WX[dx + 2];
                        if (k === 0) continue;
                        r += cols[j * 3] * k;
                        g += cols[j * 3 + 1] * k;
                        b += cols[j * 3 + 2] * k;
                    }
                }
                const q = (row * COLS + col) * 4;
                const s = (255 * strength) / 36;
                out[q] = r * s;
                out[q + 1] = g * s;
                out[q + 2] = b * s;
                out[q + 3] = 255;
            }
        }
        gctx.putImageData(glowImage, 0, 0);
        ctx!.save();
        ctx!.globalCompositeOperation = 'lighter';
        ctx!.imageSmoothingEnabled = true;
        ctx!.imageSmoothingQuality = 'high';
        ctx!.drawImage(glowCanvas, 0, 0, W, H);
        ctx!.restore();
    }

    // ---------------------------------------------------------------- ฉากหลัง (สร้างครั้งเดียว)
    const bgChars = new Uint8Array(N);
    const bgCols = new Float32Array(N * 3);

    function bgPut(i: number, ch: number, r: number, g: number, b: number): void {
        bgChars[i] = ch;
        bgCols[i * 3] = r;
        bgCols[i * 3 + 1] = g;
        bgCols[i * 3 + 2] = b;
    }

    // ปลูกต้นสนสามเหลี่ยมเรียงเป็นแนว ต้นที่ปลูกทีหลังจะบังต้นที่ปลูกก่อน
    function forest(base: number, count: number, hLo: number, hHi: number, tone: RGB, avoidCenter = false): void {
        const needles = idx('^AM#%');
        for (let n = 0; n < count; n++) {
            let x0: number;
            if (avoidCenter) {   // ชั้นหน้าสุดปลูกแค่สองข้าง ไม่ให้รกหลังต้นคริสต์มาส
                x0 = rnd() < 0.5 ? uniform(-4, CX - 34) : uniform(CX + 34, COLS + 4);
            } else {
                x0 = uniform(-4, COLS + 4);
            }
            const top = base - randInt(hLo, hHi);
            const slope = uniform(0.38, 0.55);
            const treeShade = uniform(0.85, 1.1);
            for (let row = Math.max(top, 0); row <= base && row < ROWS; row++) {
                const depth = row - top;
                const half = depth * slope + (depth % 3 === 2 ? 0.9 : 0);   // ขอบหยักเป็นกิ่ง
                for (let col = Math.max(0, Math.ceil(x0 - half)); col <= Math.min(COLS - 1, Math.floor(x0 + half)); col++) {
                    const edge = Math.abs(col - x0) / Math.max(half, 0.5);
                    const s = (1 - 0.35 * edge) * uniform(0.75, 1.15) * treeShade;
                    const ch = depth === 0 ? CI['^'] : pick(needles, [0.3, 0.25, 0.15, 0.2, 0.1]);
                    bgPut(row * COLS + col, ch, tone[0] * s, tone[1] * s, tone[2] * s);
                }
            }
        }
    }

    function buildBackground(): void {
        const ramp = idx('.,-~=+*#');
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const i = row * COLS + col;
                if (row < HORIZON) {
                    // ท้องฟ้า ไล่สีจากเกือบดำด้านบนไปน้ำเงินเข้มที่ขอบฟ้า โรยจุดจาง ๆ ให้มีเนื้อ
                    const k = row / HORIZON;
                    const ch = rnd() < 0.18 ? CI['.'] : 0;
                    bgPut(i, ch, 0.03 + 0.05 * k, 0.04 + 0.09 * k, 0.1 + 0.22 * k);
                    // พระจันทร์มุมซ้ายบน มีแสงจาง ๆ รอบดวง
                    const d = Math.hypot((col - MOON_X) / ASPECT, row - MOON_Y);
                    if (d < MOON_R) {
                        const crater = rnd() < 0.22;
                        const s = (1 - 0.35 * (d / MOON_R) ** 2) * (crater ? 0.75 : 1);
                        bgPut(i, crater ? CI['%'] : CI['@'], s, 0.93 * s, 0.62 * s);
                    } else if (d < MOON_R + 3) {
                        const s = ((MOON_R + 3 - d) / 3) * 0.8;
                        bgPut(i, CI['.'], 0.55 * s, 0.5 * s, 0.3 * s);
                    }
                } else {
                    // พื้นหิมะ ใช้คลื่น sin หลายชั้นปนสุ่มทำเป็นลอน แล้วเลือกตัวอักษรตามความสว่าง
                    const depth = clamp01((row - HORIZON) / (ROWS - HORIZON));
                    let wave = 0.5 + 0.22 * Math.sin(col * 0.21 + row * 0.9) + 0.14 * Math.sin(col * 0.05 - row * 0.35)
                        + 0.22 * (rnd() - 0.5);
                    wave = clamp(wave, 0, 0.999);
                    const s = 0.55 + 0.7 * wave;
                    bgPut(i, ramp[Math.floor(wave * ramp.length)],
                        (0.06 + 0.26 * depth) * s, (0.12 + 0.36 * depth) * s, (0.36 + 0.54 * depth) * s);
                }
            }
        }
        // ป่าสนสีน้ำเงินสามชั้น ชั้นไกลมืดและเตี้ย ชั้นใกล้สว่างและสูง
        forest(HORIZON + 1, 48, 5, 10, [0.05, 0.1, 0.3]);
        forest(HORIZON + 3, 30, 7, 13, [0.08, 0.17, 0.46]);
        forest(HORIZON + 6, 16, 11, 18, [0.12, 0.25, 0.64], true);
        // เงาบนหิมะใต้ต้นไม้ กล่องของขวัญ และแมว
        for (let i = 0; i < N; i++) {
            const row = Math.floor(i / COLS), col = i % COLS;
            const s = 1 - 0.55 * Math.exp(-(((col - CX + 4) / 40) ** 2 + ((row - 57) / 2.5) ** 2));
            bgCols[i * 3] *= s;
            bgCols[i * 3 + 1] *= s;
            bgCols[i * 3 + 2] *= s;
        }
    }

    // ดาวบนฟ้าที่กะพริบ (ไม่ให้ทับพระจันทร์ และเว้นแถวบนสุดไว้ให้ข้อความนับถอยหลัง)
    type SkyStar = { i: number; ch: number; phase: number; speed: number };
    function buildSkyStars(n = 55): SkyStar[] {
        const list: SkyStar[] = [];
        const kinds = idx('.+*');
        while (list.length < n) {
            const row = randInt(3, HORIZON - 9), col = randInt(0, COLS - 1);
            if (Math.hypot((col - MOON_X) / ASPECT, row - MOON_Y) <= MOON_R + 4) continue;
            list.push({ i: row * COLS + col, ch: pick(kinds, [0.6, 0.3, 0.1]), phase: uniform(0, Math.PI * 2), speed: uniform(1, 3) });
        }
        return list;
    }

    // ---------------------------------------------------------------- ต้นคริสต์มาส (สร้างครั้งเดียว)
    type Cell = { row: number; col: number; ch: number; c: RGB };
    type Light = { i: number; row: number; col: number; n: number; color: number; phase: number; speed: number };
    const tree = {
        leaves: [] as Cell[],
        trunk: [] as Cell[],
        garland: [] as Cell[],
        ornaments: [] as Cell[],
        lights: [] as Light[],
    };

    function buildTree(): void {
        const mask = new Uint8Array(N);
        const rel = new Float32Array(N);              // 0 = กลางต้น, 1 = ขอบต้น
        const shadow = new Float32Array(N).fill(1);   // ชั้นล่างที่โดนชายชั้นบนบังจะมืดลง
        // ต้นไม้ซ้อนกันสี่ชั้น: [แถวบน, แถวล่าง, ครึ่งความกว้างด้านบน, ครึ่งความกว้างด้านล่าง]
        const tiers = [[11, 23, 1, 11], [18, 34, 4, 17], [28, 44, 7, 23], [38, 51, 10, 28]];
        let prevBot = -1;
        for (const [top, bot, w0, w1] of tiers) {
            for (let row = top; row <= bot; row++) {
                const half = w0 + ((w1 - w0) * (row - top)) / (bot - top) + ((row - top) % 3 === 2 ? 1.3 : 0);
                for (let col = 0; col < COLS; col++) {
                    const i = row * COLS + col;
                    const dx = Math.abs(col - CX);
                    if (dx > half || mask[i]) continue;   // ชั้นบนอยู่หน้าชั้นล่าง
                    mask[i] = 1;
                    rel[i] = dx / half;
                    if (prevBot >= 0) shadow[i] = row > prevBot ? 1 - 0.45 * Math.exp(-(row - prevBot) / 2) : 0.55;
                }
            }
            prevBot = bot;
        }

        const needles = idx('^*#+%');
        const garlands = [[19, 0.28], [29, -0.26], [39, 0.24], [47, -0.22]];   // สายรุ้งสีทองพาดเฉียงสลับทิศ
        const free: number[] = [];
        for (let i = 0; i < N; i++) {
            if (!mask[i]) continue;
            const row = Math.floor(i / COLS), col = i % COLS, dx = col - CX;
            const edge = rel[i] > 0.86;
            const ch = edge ? (dx < 0 ? CI['/'] : CI['\\']) : pick(needles, [0.34, 0.2, 0.26, 0.12, 0.08]);
            // แสงมาจากซ้ายบน ขอบนอกมืดกว่าตรงกลาง ปลายกิ่งมีหิมะเกาะขาว ๆ
            const s = (0.5 + 0.5 * (1 - rel[i]) ** 0.6) * uniform(0.8, 1.15) * shadow[i] * (1 - (0.25 * dx) / 28);
            let c: RGB = [GREEN[0] * s, GREEN[1] * s, GREEN[2] * s];
            if (edge) c = [c[0] * 0.85 + WHITE[0] * 0.12, c[1] * 0.85 + WHITE[1] * 0.12, c[2] * 0.85 + WHITE[2] * 0.12];
            tree.leaves.push({ row, col, ch, c });

            const onGarland = rel[i] < 0.95 && garlands.some(([g0, slope]) =>
                Math.abs(row - (g0 + slope * dx + 0.9 * Math.sin(dx * 0.3))) < 0.5);
            if (onGarland) tree.garland.push({ row, col, ch: CI['~'], c: GOLD });
            else if (rel[i] < 0.85) free.push(i);
        }

        // สุ่มตำแหน่งลูกบอลกับหลอดไฟ ให้ห่างกันพอสมควร
        for (let k = free.length - 1; k > 0; k--) {
            const j = Math.floor(rnd() * (k + 1));
            [free[k], free[j]] = [free[j], free[k]];
        }
        const taken = new Uint8Array(N);
        const spots: number[] = [];
        for (const i of free) {
            const row = Math.floor(i / COLS), col = i % COLS;
            let busy = false;
            for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, ROWS - 1) && !busy; y++) {
                for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, COLS - 1); x++) {
                    if (taken[y * COLS + x]) { busy = true; break; }
                }
            }
            if (busy) continue;
            taken[i] = 1;
            spots.push(i);
            if (spots.length >= 125) break;
        }
        const palette: RGB[] = [RED, GOLD, BLUE, [0.83, 0.85, 0.9], PURPLE];
        const balls = idx('o@O');
        spots.forEach((i, n) => {
            const row = Math.floor(i / COLS), col = i % COLS;
            if (n < 42) {
                tree.ornaments.push({ row, col, ch: pick(balls, [0.45, 0.35, 0.2]), c: pick(palette) });
            } else {
                // ครึ่งหนึ่งกะพริบมั่ว อีกครึ่งไล่เป็นคลื่นจากยอดลงโคน
                const chase = rnd() < 0.5;
                tree.lights.push({
                    i, row, col, n: n - 42, color: randInt(0, LIGHT_COLORS.length - 1),
                    phase: chase ? -row * 0.45 : uniform(0, Math.PI * 2),
                    speed: chase ? 3 : uniform(1.5, 4.5),
                });
            }
        });

        // ลำต้น
        for (let row = TREE_BASE + 1; row <= TREE_BASE + 4; row++) {
            for (let col = CX - 3; col <= CX + 3; col++) {
                const s = 0.6 + 0.4 * (1 - Math.abs(col - CX) / 3);
                tree.trunk.push({ row, col, ch: rnd() < 0.7 ? CI['#'] : CI['|'], c: [0.45 * s, 0.26 * s, 0.11 * s] });
            }
        }
    }

    // ดาวบนยอด: '#' คือแกนกลาง ที่เหลือคือแฉก
    const STAR = [
        '    |    ',
        ' \\  |  / ',
        '  \\###/  ',
        '--#####--',
        '  /###\\  ',
        ' /  |  \\ ',
        '    |    ',
    ];
    type StarCell = { i: number; ch: number; kind: number };
    const star: StarCell[] = [];
    STAR.forEach((line, r) => {
        Array.from(line).forEach((s, c) => {
            if (s === ' ') return;
            // 0 = แกนกลาง, 1 = แฉกด้านใน, 2 = ปลายแฉก (กะพริบแรงสุด)
            const kind = s === '#' ? 0 : Math.max(Math.abs(r - 3), Math.abs(c - 4)) >= 3 ? 2 : 1;
            star.push({ i: (STAR_CY - 3 + r) * COLS + CX - 4 + c, ch: CI[s], kind });
        });
    });

    // กล่องของขวัญ: [คอลัมน์ซ้าย, แถวบน, กว้าง, สูง, สีกล่อง, สีริบบิ้น] ทุกกล่องวางบนแถว 57
    const GIFTS: [number, number, number, number, RGB, RGB][] = [
        [CX - 34, 50, 14, 8, RED, GOLD],
        [CX - 19, 53, 10, 5, GOLD, RED],
        [CX - 8, 54, 9, 4, BLUE, WHITE],
        [CX + 4, 52, 12, 6, WHITE, RED],
        [CX + 18, 49, 14, 9, RED, WHITE],
    ];
    const gifts: Cell[][] = [];
    function buildGifts(): void {
        for (const [x0, y0, w, h, box, ribbon] of GIFTS) {
            const cells: Cell[] = [];
            const front = w - 2;   // สองคอลัมน์ขวาสุดคือด้านข้างกล่อง ทำให้มืดกว่า
            const rc = x0 + (front >> 1), rr = y0 + (h >> 1);
            for (let y = y0; y < y0 + h; y++) {
                for (let x = x0; x < x0 + w; x++) {
                    const side = x >= x0 + front;
                    let ch = '#';
                    let k = (y === y0 ? 1.15 : uniform(0.85, 1)) * (1 - (0.25 * (y - y0)) / h);
                    let c: RGB = box;
                    if (y === y0) ch = '=';   // ฝากล่อง
                    if (x === rc && !side) { ch = '|'; c = ribbon; k = 1; }
                    if (y === rr) { ch = x === rc ? '+' : side ? '-' : '='; c = ribbon; k = 1; }
                    if (side) k *= 0.6;
                    cells.push({ row: y, col: x, ch: CI[ch], c: [c[0] * k, c[1] * k, c[2] * k] });
                }
            }
            Array.from('>8<').forEach((ch, n) => cells.push({ row: y0 - 1, col: rc - 1 + n, ch: CI[ch], c: ribbon }));   // โบว์
            gifts.push(cells);
        }
    }

    // แปลงรูปตัวอักษรหลายบรรทัด + รหัสสีที่วางตรงกัน เป็นรายการช่อง
    type SpriteCell = { r: number; c: number; ch: string; k: string };
    function spriteCells(art: string[], code: string[]): SpriteCell[] {
        const out: SpriteCell[] = [];
        art.forEach((line, r) => Array.from(line).forEach((ch, c) => {
            if (ch !== ' ') out.push({ r, c, ch, k: code[r][c] ?? ' ' });
        }));
        return out;
    }

    // ---------------------------------------------------------------- แมว
    const CAT_X = CX - 46, CAT_Y = 52;   // มุมซ้ายบนของแมว นั่งข้างกล่องของขวัญใบซ้ายสุด
    const CAT_APPEAR = 4.7;              // โผล่มาตอนกล่องของขวัญหล่นครบ
    // รหัสสี: b ขน, i ขนด้านใน, e ตา, n จมูก, p ปาก, w หนวด, f เท้า
    const catBody = spriteCells([
        '  /\\_/\\  ',
        ' (:o.o:) ',
        ' (>:^:<) ',
        ' /:::::\\ ',
        '(::|:|::)',
        ' ^^---^^ ',
    ], [
        '  bbbbb  ',
        ' bieneib ',
        ' bwipiwb ',
        ' biiiiib ',
        'biibibiib',
        ' ffbbbff ',
    ]);
    // หางสามท่า วางต่อจากด้านขวาของตัว สลับไปมาเป็นการกระดิกหาง
    const catTails = [
        ['    ', '  ) ', ' /  ', '/   '],
        ['  ( ', '  | ', ' /  ', '/   '],
        [' (  ', ' |  ', ' |  ', '/   '],
    ].map((f) => spriteCells(f, ['bbbb', 'bbbb', 'bbbb', 'bbbb']).map((s) => ({ ...s, r: s.r + 2, c: s.c + 8 })));
    const CAT_COLORS: Record<string, RGB> = {
        b: [1, 0.6, 0.22], i: [0.62, 0.36, 0.13], e: [0.55, 1, 0.45], n: [1, 0.55, 0.65],
        p: [1, 0.55, 0.65], w: [0.95, 0.95, 0.95], f: [1, 0.82, 0.6],
    };
    const cat = { nextBlink: 6, blinkUntil: 0, happyUntil: 0, bubble: '', bubbleUntil: 0, nextChirp: 20 };
    const catHit = (cx: number, cy: number) => cx >= CAT_X - 1 && cx <= CAT_X + 13 && cy >= CAT_Y - 2 && cy <= CAT_Y + 6;

    // เสียงเหมียวสร้างสด ๆ จาก Web Audio: คลื่นฟันเลื่อยผ่านฟิลเตอร์ เสียงขึ้นสูงแล้วลง
    let audio: AudioContext | null = null;
    function meowSound(): void {
        try {
            audio ??= new AudioContext();
            const a = audio, t0 = a.currentTime;
            const osc = a.createOscillator();
            const filter = a.createBiquadFilter();
            const gain = a.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(480, t0);
            osc.frequency.linearRampToValueAtTime(780, t0 + 0.18);
            osc.frequency.linearRampToValueAtTime(420, t0 + 0.6);
            filter.type = 'bandpass';
            filter.Q.value = 3;
            filter.frequency.setValueAtTime(900, t0);                      // "ม"
            filter.frequency.linearRampToValueAtTime(2200, t0 + 0.15);     // "เอี๊ยะ"
            filter.frequency.linearRampToValueAtTime(700, t0 + 0.6);       // "ว"
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
            osc.connect(filter).connect(gain).connect(a.destination);
            osc.start(t0);
            osc.stop(t0 + 0.7);
        } catch {
            // เบราว์เซอร์ไม่รองรับเสียงก็ข้ามไป ยังเห็นข้อความ meow อยู่
        }
    }
    function catMeow(t: number): void {
        cat.happyUntil = cat.bubbleUntil = t + 1.6;
        cat.bubble = pick(['meow~', 'meow!', 'nyaa~', 'mew?']);
        meowSound();
    }
    function updateCat(t: number): void {
        if (t >= cat.nextBlink) {
            cat.blinkUntil = t + 0.15;
            cat.nextBlink = t + uniform(2.5, 5.5);
        }
        if (t >= cat.nextChirp) {   // บางทีก็ส่งเสียงเอง (แค่ข้อความ ไม่มีเสียงจริง)
            cat.bubble = pick(['mrrp', 'purr~', '..zzz']);
            cat.bubbleUntil = t + 1.8;
            cat.nextChirp = t + uniform(18, 32);
        }
    }
    function drawCat(t: number): void {
        if (t < CAT_APPEAR) return;
        const a = easeOut((t - CAT_APPEAR) / 0.6);
        const eye = t < cat.happyUntil ? '^' : t < cat.blinkUntil ? '-' : 'o';
        const tail = catTails[[0, 1, 2, 1][Math.floor(t * 4) % 4]];
        for (const s of [...catBody, ...tail]) {
            const ch = s.k === 'e' ? eye : s.ch;
            putAt(CAT_Y + s.r, CAT_X + s.c, CI[ch], CAT_COLORS[s.k], a, s.k === 'e' ? 0.4 * a : -1);
        }
        if (t < cat.bubbleUntil) drawText(cat.bubble, CAT_Y - 2, CAT_X + 1, [1, 0.95, 0.85], 0.2);
    }

    // ---------------------------------------------------------------- ซานต้ากับดาวตก
    // ซานต้าขี่เลื่อน บินจากซ้ายไปขวา (กวางอยู่ข้างหน้า ตัวหน้าสุดจมูกแดง)
    // รหัสสี: r แดง, w ขาว, g ทอง, b น้ำตาล, n จมูกแดงเรืองแสง
    const SANTA_ART = [
        '  ^      Y     Y     Y  ',
        ' (o)_  _(o>  _(o>  _(o@ ',
        '(____)~/ \\~~~/ \\~~~/ \\  ',
    ];
    const SANTA_W = SANTA_ART[0].length;
    const santaCells = spriteCells(SANTA_ART, [
        '  r      b     b     b  ',
        ' rwrg  bbbb  bbbb  bbbn ',
        'rggggrgbbbgggbbbgggbbb  ',
    ]);
    const SANTA_COLORS: Record<string, RGB> = {
        r: [0.95, 0.2, 0.2], w: [1, 0.95, 0.9], g: [1, 0.78, 0.3], b: [0.68, 0.45, 0.25], n: [1, 0.15, 0.15],
    };
    const santa = { x: NaN, y: 0, next: 9 };   // x = NaN แปลว่ายังไม่บิน
    function updateSanta(dt: number, t: number): void {
        if (Number.isNaN(santa.x)) {
            if (t >= santa.next) santa.x = -SANTA_W;
            return;
        }
        santa.x += 13 * dt;   // คอลัมน์ต่อวินาที
        const p = (santa.x + SANTA_W) / (COLS + SANTA_W);
        santa.y = 8 - 4.5 * p + 0.5 * Math.sin(t * 4);   // ไต่ขึ้นช้า ๆ และโยกขึ้นลงนิดหน่อย ผ่านหน้าพระจันทร์พอดี
        for (let k = 0; k < 2; k++) {   // ฝุ่นวิเศษสีทองโปรยตามหลังเลื่อน
            sparks.push({ x: santa.x + uniform(0, 2), y: santa.y + 2.5, vx: uniform(-3, -1), vy: uniform(0.5, 2), age: 0,
                life: uniform(0.8, 1.4), c: GOLD, kind: 2, drag: 1.5, grav: 2 });
        }
        if (santa.x > COLS + 2) {
            santa.x = NaN;
            santa.next = t + uniform(25, 45);
        }
    }
    function drawSanta(): void {
        if (Number.isNaN(santa.x)) return;
        const x0 = Math.round(santa.x), y0 = Math.round(santa.y);
        for (const s of santaCells) putAt(y0 + s.r, x0 + s.c, CI[s.ch], SANTA_COLORS[s.k], 1, s.k === 'n' ? 1 : 0.15);
    }

    // ดาวตกพาดฟ้าเป็นครั้งคราว
    type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number };
    let meteors: Meteor[] = [];
    let nextMeteor = uniform(3, 7);
    function updateMeteors(dt: number, t: number): void {
        if (t >= nextMeteor) {
            meteors.push({ x: uniform(15, COLS - 15), y: uniform(3, 10), vx: (rnd() < 0.5 ? -1 : 1) * uniform(35, 55),
                vy: uniform(9, 16), age: 0, life: uniform(0.5, 0.8) });
            nextMeteor = t + uniform(4, 10);
        }
        for (const m of meteors) {
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.age += dt;
        }
        meteors = meteors.filter((m) => m.age < m.life);
    }
    function drawMeteors(): void {
        for (const m of meteors) {
            const fade = Math.min(1, (m.life - m.age) / 0.25, m.age / 0.08);   // ค่อย ๆ โผล่และค่อย ๆ หาย
            const slope = Math.abs(m.vy * CH) / Math.abs(m.vx * CW);          // ความชันบนจอจริง
            const tail = slope < 0.4 ? '-' : m.vx > 0 ? '\\' : '/';
            for (let k = 11; k >= 0; k--) {                                    // วาดจากหางมาหัว หัวจะได้อยู่บนสุด
                const col = Math.round(m.x - m.vx * k * 0.012), row = Math.round(m.y - m.vy * k * 0.012);
                if (row >= HORIZON - 3) continue;
                const b = fade * (1 - k / 12);
                putAt(row, col, CI[k === 0 ? '*' : tail], [0.9, 0.95, 1], b, 0.8 * b);
            }
        }
    }

    // ---------------------------------------------------------------- หิมะ
    // เกล็ดที่ตกเร็วถือว่าอยู่ใกล้ เลยให้ใหญ่และสว่างกว่า
    const SNOW = 360;
    const snowX = new Float32Array(SNOW), snowY = new Float32Array(SNOW), snowV = new Float32Array(SNOW);
    const snowPhase = new Float32Array(SNOW), snowBright = new Float32Array(SNOW), snowCh = new Uint8Array(SNOW);
    for (let k = 0; k < SNOW; k++) {
        snowX[k] = uniform(0, COLS);
        snowY[k] = uniform(0, ROWS);
        snowV[k] = uniform(2.5, 9);   // แถวต่อวินาที
        snowPhase[k] = uniform(0, Math.PI * 2);
        const near = (snowV[k] - 2.5) / 6.5;
        snowCh[k] = near > 0.85 ? CI['*'] : near > 0.6 ? CI['+'] : CI['.'];
        snowBright[k] = 0.45 + 0.55 * near;
    }
    function updateSnow(dt: number, t: number): void {
        const wind = 1.2 * Math.sin(t * 0.23);   // ลมเปลี่ยนทิศช้า ๆ
        for (let k = 0; k < SNOW; k++) {
            snowY[k] += snowV[k] * dt;
            snowX[k] = (((snowX[k] + (wind + 1.2 * Math.sin(t * 1.4 + snowPhase[k])) * 1.5 * dt) % COLS) + COLS) % COLS;
            if (snowY[k] >= ROWS) {   // ตกถึงพื้นแล้วไปเริ่มใหม่ด้านบน
                snowY[k] -= ROWS + uniform(0, 4);
                snowX[k] = uniform(0, COLS);
            }
        }
    }
    function drawSnow(): void {
        for (let k = 0; k < SNOW; k++) {
            const row = Math.floor(snowY[k]);
            if (row < 0 || row >= ROWS) continue;
            const b = snowBright[k];
            put(row * COLS + (Math.floor(snowX[k]) % COLS), snowCh[k], WHITE[0] * b, WHITE[1] * b, WHITE[2] * b, 0.12 * b);
        }
    }

    // ---------------------------------------------------------------- พลุ
    // kind: 0 ปกติ, 1 กะพริบแปล๊บ ๆ, 2 ประกายหางจรวด/ฝุ่น, 3 รูปทรง (ค้างให้เห็นรูปนานหน่อย)
    type Rocket = { x: number; y: number; vx: number; vy: number };
    type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; c: RGB; kind: number; drag: number; grav: number };
    type Shape = 'heart' | 'cat' | 'star' | 'text';
    const ROCKET_GRAVITY = 18;   // แถว/วินาที²
    let rockets: Rocket[] = [];
    let sparks: Spark[] = [];
    const fw = {
        nextLaunch: 4.5,
        rate: [0.6, 1.7] as [number, number],   // ยิงห่างกันกี่วินาที (สุ่มในช่วงนี้) นับถอยหลังจะปรับค่านี้
        shapeChance: 0.25,                       // โอกาสที่ลูกนั้นจะเป็นพลุรูปทรง
        words: ['XMAS', 'JOY', 'LOVE', 'MEOW'],
    };
    const LEVEL_CHARS = idx('.:+*@');   // สะเก็ดยิ่งมอดยิ่งเปลี่ยนตัวอักษรเล็กลง

    // ฟอนต์ 5×7 สำหรับพลุตัวอักษร (# = มีสะเก็ด)
    const FONT: Record<string, string[]> = {
        '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
        '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
        '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
        '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
        '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
        '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
        '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
        '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
        '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
        '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
        A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
        E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
        H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
        J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
        L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
        M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
        N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
        O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
        P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
        R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
        S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
        V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
        W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
        X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
        Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    };

    type Pt = [number, number, number];   // x (คอลัมน์), y (แถว), ลำดับตัวอักษร (ใช้กับพลุตัวอักษร)
    function textPoints(word: string, sx = 1.6, sy = 1): Pt[] {
        const pts: Pt[] = [];
        const width = 6 * word.length - 1;
        Array.from(word).forEach((ch, i) => {
            (FONT[ch] ?? FONT.O).forEach((line, r) => Array.from(line).forEach((on, c) => {
                if (on === '#') pts.push([(i * 6 + c - (width - 1) / 2) * sx, (r - 3) * sy, i]);
            }));
        });
        return pts;
    }
    function heartPoints(n = 70, s = 0.42): Pt[] {
        const pts: Pt[] = [];
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const x = 16 * Math.sin(a) ** 3;
            const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
            pts.push([x * s * ASPECT, -(y + 2.5) * s, 0]);
        }
        return pts;
    }
    function starPoints(outer = 7, inner = 2.9, perEdge = 7): Pt[] {
        const vx: number[] = [], vy: number[] = [];
        for (let i = 0; i < 10; i++) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 === 0 ? outer : inner;
            vx.push(r * Math.cos(ang));
            vy.push(r * Math.sin(ang));
        }
        const pts: Pt[] = [];
        for (let i = 0; i < 10; i++) {
            const j = (i + 1) % 10;
            for (let k = 0; k < perEdge; k++) {
                const f = k / perEdge;
                pts.push([(vx[i] + (vx[j] - vx[i]) * f) * ASPECT, vy[i] + (vy[j] - vy[i]) * f, 0]);
            }
        }
        return pts;
    }
    // หน้าแมว: หัวกลม หูสองข้าง ตา จมูก ปาก หนวด (หน่วยแถว แล้วค่อยยืดแกน x)
    function catFacePoints(): Pt[] {
        const raw: [number, number][] = [];
        const line = (p: [number, number], q: [number, number], n: number) => {
            for (let k = 0; k < n; k++) {
                const f = k / (n - 1);
                raw.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
            }
        };
        const R = 5.5;
        for (let k = 0; k < 44; k++) {
            const a = (k / 44) * Math.PI * 2;
            raw.push([R * Math.cos(a), R * Math.sin(a)]);
        }
        const rad = (d: number) => (d * Math.PI) / 180;
        for (const side of [-1, 1]) {   // -1 = ซ้าย, 1 = ขวา (กระจกกัน)
            const b1: [number, number] = [side * R * Math.abs(Math.cos(rad(150))), -R * Math.sin(rad(150))];   // โคนหูด้านนอก
            const b2: [number, number] = [side * R * Math.abs(Math.cos(rad(110))), -R * Math.sin(rad(110))];   // โคนหูด้านใน
            const apex: [number, number] = [side * 4.6, -9];                                                   // ปลายหู
            line(b1, apex, 6);
            line(apex, b2, 6);
            raw.push([side * 2.1, -1], [side * 2.1, -0.6]);   // ตา
            line([side * 2.8, 1.2], [side * 8.2, 0.2], 5);    // หนวด
            line([side * 2.8, 1.9], [side * 8.2, 2.8], 5);
        }
        raw.push([0, 0.8], [-0.8, 1.8], [0, 1.5], [0.8, 1.8]);   // จมูกกับปาก
        return raw.map(([x, y]) => [x * ASPECT, y + 1, 0]);
    }

    function launch(): void {
        const x = rnd() < 0.5 ? uniform(6, CX - 30) : uniform(CX + 30, COLS - 6);   // ยิงจากสองข้าง ไม่ให้บังต้นไม้
        const y0 = HORIZON + 1;
        const target = uniform(5, 17);
        // ความเร็วต้นที่พอดีจะขึ้นไปถึงความสูงนี้
        rockets.push({ x, y: y0, vx: uniform(-1.5, 1.5), vy: -Math.sqrt(2 * ROCKET_GRAVITY * (y0 - target)) });
    }

    function explode(x: number, y: number): void {
        if (rnd() < fw.shapeChance) {
            explodeShape(x, y, pick<Shape>(['heart', 'cat', 'star', 'text']));
            return;
        }
        const style = pick(['peony', 'ring', 'willow', 'multi', 'crackle'], [0.32, 0.18, 0.16, 0.2, 0.14]);
        const n = randInt(90, 149);
        const smax = uniform(10, 15);
        const main = pick(FIREWORK_COLORS);
        const trio = [pick(FIREWORK_COLORS), pick(FIREWORK_COLORS), pick(FIREWORK_COLORS)];
        for (let k = 0; k < n; k++) {
            const a = uniform(0, Math.PI * 2);
            // แบบวงแหวนทุกสะเก็ดเร็วเท่ากัน แบบอื่นกระจายเต็มวงเป็นลูกบอลไฟ
            const speed = style === 'ring' ? smax * uniform(0.92, 1) : smax * Math.sqrt(uniform(0.15, 1));
            let life = uniform(1.2, 2), drag = 1.6, kind = 0, c = main;
            if (style === 'multi') c = pick(trio);
            else if (style === 'willow') { c = [1, 0.72, 0.28]; life *= 1.6; drag = 2.4; }   // สีทอง ร่วงลงเหมือนกิ่งหลิว
            else if (style === 'crackle') { c = [0.95, 0.95, 1]; kind = 1; }                // สีขาว กะพริบแปล๊บ ๆ
            sparks.push({ x, y, vx: Math.cos(a) * speed * ASPECT, vy: Math.sin(a) * speed, age: 0, life, c, kind, drag, grav: 5 });
        }
    }

    // พลุรูปทรง: ให้แต่ละสะเก็ดพุ่งไปหยุดตรงจุดของรูปพอดี
    // (มีแรงต้าน drag สะเก็ดที่ออกตัวด้วยความเร็ว v จะไปได้ไกล v/drag จึงตั้ง v = ระยะ × drag)
    function explodeShape(x: number, y: number, style: Shape, word?: string): void {
        const pts = style === 'text' ? textPoints(word ?? pick(fw.words))
            : style === 'heart' ? heartPoints() : style === 'cat' ? catFacePoints() : starPoints();
        let halfW = 0, halfH = 0;
        for (const p of pts) {
            p[0] += uniform(-0.25, 0.25);
            p[1] += uniform(-0.25, 0.25);
            halfW = Math.max(halfW, Math.abs(p[0]) + 1);
            halfH = Math.max(halfH, Math.abs(p[1]) + 1);
        }
        x = clamp(x, halfW, COLS - halfW);           // ไม่ให้รูปล้นจอ
        y = clamp(y, halfH, HORIZON - halfH - 2);
        const start = randInt(0, FIREWORK_COLORS.length - 1);
        const single: RGB = style === 'heart' ? [1, 0.3, 0.5] : style === 'cat' ? [1, 0.65, 0.25] : [1, 0.85, 0.3];
        const drag = 2.4;
        for (const [dx, dy, letter] of pts) {
            // ตัวอักษรแต่ละตัวคนละสี
            const c = style === 'text' ? FIREWORK_COLORS[(start + letter) % FIREWORK_COLORS.length] : single;
            sparks.push({ x, y, vx: dx * drag, vy: dy * drag, age: 0, life: uniform(2.3, 2.8), c, kind: 3, drag, grav: 0.8 });
        }
    }

    function updateFireworks(dt: number, t: number): void {
        if (t >= fw.nextLaunch) {
            launch();
            if (rnd() < 0.25) launch();
            fw.nextLaunch = t + uniform(fw.rate[0], fw.rate[1]);
        }
        const flying: Rocket[] = [];
        for (const r of rockets) {
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.vy += ROCKET_GRAVITY * dt;
            // ประกายไฟหางจรวด
            sparks.push({ x: r.x + uniform(-0.3, 0.3), y: r.y + 0.5, vx: uniform(-1, 1), vy: uniform(1, 3), age: 0,
                life: uniform(0.3, 0.6), c: [1, 0.65, 0.3], kind: 2, drag: 3, grav: 5 });
            if (r.vy >= -1) explode(r.x, r.y);   // ช้าจนเกือบหยุด แปลว่าถึงยอดแล้ว
            else flying.push(r);
        }
        rockets = flying;
        for (const s of sparks) {
            const slow = Math.exp(-s.drag * dt);
            s.vx *= slow;
            s.vy = s.vy * slow + s.grav * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.age += dt;
        }
        sparks = sparks.filter((s) => s.age < s.life && s.y < ROWS + 2 && s.x > -5 && s.x < COLS + 5);
    }

    function drawFireworks(): void {
        const lit: { i: number; b: number; r: number; g: number; bl: number }[] = [];
        for (const s of sparks) {
            const left = clamp01(1 - s.age / s.life);
            let b = s.kind === 3 ? left ** 0.5 : left ** 1.3;   // รูปทรงสว่างค้างนานกว่า
            if (s.kind === 1 && rnd() < 0.35) b = 0;
            if (s.kind === 2) b *= 0.6;
            const col = Math.round(s.x), row = Math.round(s.y);
            if (b <= 0.03 || col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
            const flash = clamp01(1 - s.age / 0.15);   // เพิ่งแตกจะขาวจ้าก่อน
            const k = 0.25 + 0.85 * b;
            lit.push({ i: row * COLS + col, b,
                r: (s.c[0] * (1 - flash) + flash) * k, g: (s.c[1] * (1 - flash) + flash) * k, bl: (s.c[2] * (1 - flash) + flash) * k });
        }
        // เรียงจากมืดไปสว่าง ช่องที่มีหลายสะเก็ด ตัวที่สว่างสุดจะถูกเขียนทีหลังสุด
        lit.sort((a, b) => a.b - b.b);
        for (const p of lit) {
            const i = p.i;
            // สะเก็ดจาง ๆ ไม่ไปทับของที่สว่างกว่า
            if (Math.max(p.r, p.g, p.bl) <= Math.max(cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2])) continue;
            const level = p.b > 0.75 ? 4 : p.b > 0.5 ? 3 : p.b > 0.3 ? 2 : p.b > 0.12 ? 1 : 0;
            put(i, LEVEL_CHARS[level], p.r, p.g, p.bl, Math.max(glow[i], p.b));
        }
        for (const r of rockets) putAt(Math.round(r.y), Math.round(r.x), CI['|'], [1, 0.9, 0.65], 1, 0.8);
    }

    // ---------------------------------------------------------------- นับถอยหลัง
    // ดูว่าตอนนี้อยู่ช่วงไหน: count = กำลังนับถอยหลัง, xmas = วันคริสต์มาส, newyear = วันปีใหม่
    type Mode = 'count' | 'xmas' | 'newyear';
    function countdownState(now: Date): { mode: Mode; text: string; left: number; year: number } {
        const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
        const year = m === 1 ? y : y + 1;   // ปีใหม่ที่กำลังจะถึง
        if (m === 12 && d === 25) return { mode: 'xmas', text: 'MERRY CHRISTMAS!', left: 0, year };
        if (m === 1 && d === 1) return { mode: 'newyear', text: `HAPPY NEW YEAR ${y}!`, left: 0, year };
        const xmas = new Date(y, 11, 25);
        const [target, label] = now < xmas ? [xmas, 'CHRISTMAS'] : [new Date(y + 1, 0, 1), 'NEW YEAR'];
        const left = (target.getTime() - now.getTime()) / 1000;
        const s = Math.floor(left);
        const days = Math.floor(s / 86400);
        const two = (v: number) => String(v).padStart(2, '0');
        const dayText = days ? `${days} DAY${days > 1 ? 'S' : ''} ` : '';
        return {
            mode: 'count', left, year,
            text: `${label} IN ${dayText}${two(Math.floor((s % 86400) / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`,
        };
    }

    // ?now=2026-12-24T23:59:45 ทำเป็นว่าตอนนี้เป็นเวลานั้น ไว้ลองดูพลุปิดท้าย
    const fakeNow = new URLSearchParams(location.search).get('now');
    const fakeTime = fakeNow ? new Date(fakeNow).getTime() : NaN;
    const clockOffset = Number.isNaN(fakeTime) ? 0 : fakeTime - Date.now();
    const countdown = { mode: '' as Mode | '', text: '', lastSec: -1, finaleUntil: -1 };

    function updateCountdown(t: number): void {
        const st = countdownState(new Date(Date.now() + clockOffset));
        countdown.text = st.text;
        if (st.mode !== 'count' && countdown.mode === 'count') {   // เพิ่งถึงเวลาพอดี
            countdown.finaleUntil = t + 40;
            const words = st.mode === 'xmas' ? ['XMAS', 'JOY'] : [String(st.year), 'HAPPY'];
            explodeShape(30, 13, 'text', words[0]);
            explodeShape(COLS - 30, 13, 'text', words[1]);
        }
        if (st.mode === 'count' && st.left <= 10.5) {               // 10 วิสุดท้าย พลุเป็นตัวเลข
            const sec = Math.ceil(st.left);
            if (sec !== countdown.lastSec && sec >= 1) explodeShape(sec % 2 ? 30 : COLS - 30, 14, 'text', String(sec));
            countdown.lastSec = sec;
        }
        countdown.mode = st.mode;

        // ช่วงไหนยิงถี่แค่ไหน
        if (t < countdown.finaleUntil) { fw.rate = [0.08, 0.25]; fw.shapeChance = 0.4; }
        else if (st.mode !== 'count') { fw.rate = [0.35, 0.9]; fw.shapeChance = 0.4; }
        else if (st.left <= 10.5) { fw.rate = [2, 3]; fw.shapeChance = 0; }   // หลบให้ตัวเลขนับถอยหลังเด่น
        else { fw.rate = [0.6, 1.7]; fw.shapeChance = 0.25; }
        const now = new Date(Date.now() + clockOffset);
        const newYearTime = (now.getMonth() === 11 && now.getDate() >= 26) || (now.getMonth() === 0 && now.getDate() === 1);
        fw.words = newYearTime ? [String(st.year), 'HAPPY', 'NEW', 'YEAR', 'JOY'] : ['XMAS', 'JOY', 'LOVE', 'MEOW'];
    }

    function drawCountdown(t: number): void {
        const text = countdown.text;
        const col = CX - Math.floor(text.length / 2);
        if (countdown.mode === 'count') drawText(text, 1, col, [1, 0.85, 0.5], 0.15);
        else drawText(text, 1, col, (n) => hue(n * 0.07 - t * 0.5), 0.5);   // วันจริง ข้อความไล่สีรุ้ง
    }

    // ---------------------------------------------------------------- วาดแต่ละเฟรม
    function drawSkyStars(list: SkyStar[], t: number): void {
        for (const s of list) {
            const b = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
            put(s.i, s.ch, 0.8 * b, 0.85 * b, b, 0.3 * b);
        }
    }

    function drawCells(cells: Cell[], k = 1, gl = -1, rowShift = 0): void {
        for (const c of cells) putAt(c.row + rowShift, c.col, c.ch, c.c, k, gl);
    }

    let lightMode = 0;
    // ความสว่าง (0..1) กับสีของหลอดไฟดวงนี้ ตามโหมดที่เลือก
    function lightState(l: Light, t: number): [number, RGB] {
        const mode = LIGHT_MODES[lightMode];
        if (mode === 'warm') {   // สีทองอุ่น ๆ กะพริบเบา ๆ
            return [0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * l.speed * 0.4 + l.phase)), [1, 0.8, 0.45]];
        }
        if (mode === 'rainbow') {   // สีรุ้งไหลจากยอดลงโคน
            return [0.75 + 0.25 * Math.sin(t * 6 + l.phase), hue(l.row * 0.035 + (l.col - CX) * 0.012 - t * 0.35)];
        }
        if (mode === 'beat') {   // แบ่งไฟเป็น 4 กลุ่ม ติดทีละกลุ่มตามจังหวะ ทุกจังหวะแรกของห้องติดพร้อมกันหมด
            const beat = (t * BPM) / 60, ph = beat % 1, k = Math.floor(beat);
            let b = l.n % 4 === k % 4 ? Math.exp(-ph * 3) : 0.06;
            if (k % 4 === 0) b = Math.max(b, Math.exp(-ph * 5));
            return [b, LIGHT_COLORS[l.color]];
        }
        // classic: สว่าง-ดับตาม sin ยกกำลังสอง ทุก 3 วิสีเลื่อนไปหนึ่งสี
        return [(0.5 + 0.5 * Math.sin(t * l.speed + l.phase)) ** 2, LIGHT_COLORS[(l.color + Math.floor(t / 3)) % LIGHT_COLORS.length]];
    }

    function drawTree(t: number): void {
        drawCells(tree.trunk);   // ลำต้นมีตั้งแต่แรก

        // ช่วงเปิดฉาก ใบไม้ค่อย ๆ โผล่จากโคนขึ้นไปถึงยอด
        const reveal = TREE_BASE - (TREE_BASE - TREE_TOP + 1) * easeOut(t / 2.2);
        for (const c of tree.leaves) if (c.row >= reveal) putAt(c.row, c.col, c.ch, c.c);

        // ของตกแต่งค่อย ๆ สว่างขึ้นหลังต้นไม้ขึ้นเต็มต้น
        const a = easeOut((t - 2.3) / 1.2);
        if (a <= 0) return;

        // สายรุ้งสีทอง มีประกายวิ่งไปตามสาย
        for (const g of tree.garland) {
            const s = (0.6 + 0.4 * Math.sin(g.col * 0.7 - t * 5 + g.row)) * a;
            putAt(g.row, g.col, g.ch, GOLD, s, 0.25 * s);
        }
        drawCells(tree.ornaments, a, 0.3 * a);   // ลูกบอล

        for (const l of tree.lights) {   // หลอดไฟ
            const [b, c] = lightState(l, t);
            const k = (0.18 + 0.82 * b) * a;
            put(l.i, b > 0.55 ? CI['*'] : b > 0.2 ? CI['+'] : CI['.'], c[0] * k, c[1] * k, c[2] * k, 1.2 * b * a);
        }
    }

    function drawStar(t: number): void {
        if (t < 2.8) return;
        const pop = 1 + 1.5 * Math.exp(-(t - 2.8) * 4);   // แวบสว่างตอนเพิ่งโผล่
        for (const s of star) {
            const b = s.kind === 0 ? 1 : s.kind === 1 ? 0.8 + 0.2 * Math.sin(t * 3) : 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 5));
            const k = b * pop;
            if (s.kind === 0) put(s.i, s.ch, k, 0.95 * k, 0.65 * k, k);
            else put(s.i, s.ch, k, 0.8 * k, 0.28 * k, k);
        }
    }

    function drawGifts(t: number): void {
        gifts.forEach((cells, n) => {
            const start = 3.2 + 0.3 * n;   // ทยอยหล่นลงมาทีละกล่อง
            if (t < start) return;
            drawCells(cells, 1, -1, Math.round((1 - easeOut((t - start) / 0.45)) * -8));
        });
    }

    // ---------------------------------------------------------------- เริ่มทำงาน
    buildBackground();
    const skyStars = buildSkyStars();
    buildTree();
    buildGifts();

    function render(t: number): void {
        // เริ่มจากฉากหลังเสมอ แล้ววาดทับไล่จากไกลมาใกล้
        chars.set(bgChars);
        cols.set(bgCols);
        glow.fill(0);
        drawSkyStars(skyStars, t);
        drawFireworks();
        drawSanta();
        drawMeteors();
        drawTree(t);
        drawGifts(t);
        drawCat(t);
        drawStar(t);
        drawSnow();
        drawCountdown(t);
        compose();
        addGlow();
    }

    const toggleBtn = document.getElementById('xmas-toggle');
    const fireBtn = document.getElementById('xmas-fire');
    const lightsBtn = document.getElementById('xmas-lights');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // คนที่ตั้งเครื่องให้ลดภาพเคลื่อนไหว ให้เห็นภาพนิ่งตอนต้นไม้แต่งเสร็จแล้ว กดเล่นเองได้
    let t = reduceMotion ? 6 : 0;
    let last = 0;
    let playing = false;

    function frame(now: number): void {
        if (!playing) return;
        const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;   // แท็บถูกพักนาน ๆ ไม่ให้ของกระโดดไกล
        last = now;
        t += dt;
        updateCountdown(t);
        updateSnow(dt, t);
        updateFireworks(dt, t);
        updateSanta(dt, t);
        updateMeteors(dt, t);
        updateCat(t);
        render(t);
        requestAnimationFrame(frame);
    }

    function setPlaying(on: boolean): void {
        playing = on;
        if (toggleBtn) toggleBtn.textContent = on ? 'หยุดไว้ก่อน' : 'เล่นต่อ';
        if (on) {
            last = 0;
            requestAnimationFrame(frame);
        }
    }

    toggleBtn?.addEventListener('click', () => setPlaying(!playing));
    fireBtn?.addEventListener('click', () => {
        launch();
        if (!playing) setPlaying(true);
    });
    lightsBtn?.addEventListener('click', () => {
        lightMode = (lightMode + 1) % LIGHT_MODES.length;
        lightsBtn.textContent = LIGHT_LABELS[lightMode];
        if (!playing) render(t);
    });
    // คลิกหรือแตะบนภาพ: โดนแมวแมวร้องเหมียว นอกนั้นพลุแตกตรงนั้น
    canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * COLS, cy = ((e.clientY - rect.top) / rect.height) * ROWS;
        if (t >= CAT_APPEAR && catHit(cx, cy)) catMeow(t);
        else explode(cx, cy);
        if (!playing) setPlaying(true);
    });

    updateCountdown(t);
    render(t);
    setPlaying(!reduceMotion);
    if (reduceMotion && toggleBtn) toggleBtn.textContent = 'เล่นแอนิเมชัน';
})();
