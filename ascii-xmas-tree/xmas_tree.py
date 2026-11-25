"""
ต้นคริสต์มาสตัวอักษร (ASCII art) แบบเคลื่อนไหว

ทั้งฉากคือตารางช่องตัวอักษร COLS × ROWS ช่อง เก็บเป็น numpy array สองชุด
    chars  ช่องนี้เป็นตัวอักษรอะไร (เก็บเป็นเลขตำแหน่งใน CHARSET)
    cols   ช่องนี้สีอะไร (RGB ค่า 0..1)
ทุกเฟรมเราวาดของทับกันลงตารางนี้
    ฉากหลัง → ดาว → พลุ → ซานต้า → ดาวตก → ต้นไม้ → ของขวัญ → แมว → ดาวบนยอด → หิมะ → ข้อความ
แล้วค่อยแปลงทั้งตารางเป็นภาพทีเดียว ส่งให้ pygame แสดง

ปุ่มลัด
    Space   ยิงพลุเพิ่ม 1 ลูก
    คลิก     บนฟ้า = พลุแตกตรงนั้น, บนแมว = แมวร้องเหมียว
    L       เปลี่ยนโหมดไฟ (หลากสี / สีทอง / ไล่สีรุ้ง / ตามจังหวะ)
    F       เต็มจอ / ออกจากเต็มจอ
    Esc     ปิดโปรแกรม

รันแบบไม่เปิดหน้าต่าง (เอาไว้เช็กภาพ):
    SDL_VIDEODRIVER=dummy python xmas_tree.py --seconds 8 --screenshot shot.png
ลองดูช่วงนับถอยหลังกับพลุปิดท้ายโดยไม่ต้องรอถึงวันจริง:
    python xmas_tree.py --now "2026-12-24 23:59:45"
"""

import argparse
import math
import os
import time
from datetime import datetime, timedelta

import numpy as np
import pygame

# ------------------------------------------------------------------ ขนาดฉาก
COLS, ROWS = 136, 60          # จำนวนช่องตัวอักษร แนวนอน × แนวตั้ง
CW, CH = 7, 12                # ช่องหนึ่งกว้าง × สูง กี่พิกเซล
W, H = COLS * CW, ROWS * CH   # ขนาดหน้าต่าง 952 × 720
ASPECT = CH / CW              # ช่องสูงกว่ากว้าง จะทำอะไรให้กลมต้องยืดแกน x ด้วยค่านี้
FPS = 30

HORIZON = 34                  # แถวที่ท้องฟ้าจบ พื้นหิมะเริ่ม
CX = COLS // 2                # แกนกลางต้นคริสต์มาส
TREE_TOP, TREE_BASE = 11, 51  # แถวยอดต้นกับแถวโคนต้น
STAR_CY = 8                   # แถวกลางของดาวบนยอด
MOON_Y, MOON_X, MOON_R = 7.0, 18.0, 4.3

# ตัวอักษรทั้งหมดที่ใช้ในฉาก ตำแหน่งในสตริงคือเลขที่เก็บใน chars (ช่องว่าง = 0 = ไม่วาดอะไร)
CHARSET = "".join(dict.fromkeys(
    " .,:;'`-~_=+*^/\\|<>()[]{}!?@#%&"
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"))
CI = {c: i for i, c in enumerate(CHARSET)}

# ชุดสีที่ใช้ซ้ำ
GOLD = np.array([1.00, 0.78, 0.25])
RED = np.array([0.92, 0.16, 0.16])
WHITE = np.array([0.92, 0.94, 1.00])
BLUE = np.array([0.30, 0.50, 1.00])
GREEN = np.array([0.14, 0.74, 0.22])
PURPLE = np.array([0.80, 0.35, 0.95])
LIGHT_COLORS = np.array([[1.0, 0.22, 0.22], [1.0, 0.85, 0.25], [0.35, 0.6, 1.0],
                         [1.0, 0.45, 0.85], [0.95, 0.97, 1.0], [0.45, 1.0, 0.55]])
FIREWORK_COLORS = np.array([[1.0, 0.28, 0.28], [1.0, 0.82, 0.25], [0.38, 0.62, 1.0], [1.0, 0.42, 0.85],
                            [0.45, 1.0, 0.55], [0.72, 0.48, 1.0], [1.0, 0.58, 0.18], [0.9, 0.95, 1.0]])

# โหมดไฟบนต้น กด L เพื่อสลับ
LIGHT_MODES = ["classic", "warm", "rainbow", "beat"]
BPM = 120   # จังหวะของโหมด beat

# พิกัดแถว/คอลัมน์ของทุกช่อง ใช้คำนวณรูปทรงแบบทีเดียวทั้งตาราง
YY, XX = np.mgrid[0:ROWS, 0:COLS]


def clamp01(v):
    return min(max(v, 0.0), 1.0)


def ease_out(v):
    """เริ่มเร็วแล้วค่อย ๆ ช้าลงตอนจบ"""
    return 1 - (1 - clamp01(v)) ** 3


def to_idx(text):
    """แปลงสตริงเป็นอาร์เรย์เลขตัวอักษร (ตัวที่ไม่รู้จักกลายเป็นช่องว่าง)"""
    return np.array([CI.get(c, 0) for c in text], np.int16)


def hue_rgb(h):
    """แปลงเฉดสี 0..1 เป็น RGB สีสด ๆ (ใช้ทำสีรุ้ง)"""
    h = np.asarray(h, np.float64)[..., None] * 6
    return np.concatenate([np.clip(np.abs(h - 3) - 1, 0, 1),
                           np.clip(2 - np.abs(h - 2), 0, 1),
                           np.clip(2 - np.abs(h - 4), 0, 1)], -1)


# ------------------------------------------------------------------ ตัวอักษร → ภาพ
def build_glyphs():
    """วาดตัวอักษรทุกตัวเป็นสีขาวขนาดพอดีช่อง เก็บเป็นหน้ากากความสว่าง 0..1 ไว้ใช้ทุกเฟรม"""
    font = pygame.font.SysFont("consolas,dejavusansmono,couriernew,monospace", 13, bold=True)
    masks = np.zeros((len(CHARSET), CH, CW), np.float32)
    for i, ch in enumerate(CHARSET):
        if ch == " ":
            continue
        glyph = font.render(ch, True, (255, 255, 255))
        glyph = pygame.transform.smoothscale(glyph, (CW, CH))
        masks[i] = pygame.surfarray.array_alpha(glyph).T / 255.0
    return masks


def compose(chars, cols, masks):
    """เอาหน้ากากตัวอักษรของแต่ละช่องคูณสีของช่องนั้น ได้ภาพเต็มจอในคำสั่งเดียว"""
    img = masks[chars][..., None] * cols[:, :, None, None, :]   # (ROWS, COLS, CH, CW, 3)
    img = img.transpose(0, 2, 1, 3, 4).reshape(H, W, 3)          # เรียงเป็นพิกเซล (H, W, 3)
    img = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    return np.ascontiguousarray(img.swapaxes(0, 1))              # pygame ใช้แกน (x, y)


GLOW_WY = (1, 2, 1)          # น้ำหนักเบลอแนวตั้ง
GLOW_WX = (1, 2, 3, 2, 1)    # น้ำหนักเบลอแนวนอน (ช่องแคบกว่า เลยต้องกว้างกว่า แสงจะฟุ้งเป็นวงกลม)


def add_glow(screen, cols, glow, strength=1.4):
    """ทำแสงฟุ้งรอบของที่เรืองแสง (ไฟ ดาว พลุ)
    เบลอบนตารางช่องเล็ก ๆ แล้วขยายเป็นเต็มจอ ถูกกว่าเบลอภาพใหญ่มาก
    ใช้น้ำหนักแบบยอดแหลมตรงกลาง ถ้าเฉลี่ยเท่ากันทุกช่อง พอขยายแล้วแสงจะเป็นสี่เหลี่ยม"""
    src = cols * glow[..., None]
    pad = np.pad(src, ((1, 1), (2, 2), (0, 0)))
    blur = sum(wy * wx * pad[dy:dy + ROWS, dx:dx + COLS]
               for dy, wy in enumerate(GLOW_WY) for dx, wx in enumerate(GLOW_WX)) / 36
    small = (np.clip(blur * strength, 0, 1) * 255).astype(np.uint8)
    surf = pygame.surfarray.make_surface(np.ascontiguousarray(small.swapaxes(0, 1)))
    surf = pygame.transform.smoothscale(surf, (W, H))
    screen.blit(surf, (0, 0), special_flags=pygame.BLEND_RGB_ADD)


def draw_text(chars, cols, glow, text, row, col, colors, gl=0.15):
    """เขียนข้อความลงตารางทีละตัว colors เป็นสีเดียว (3,) หรือสีต่อตัวอักษร (len, 3) ก็ได้"""
    colors = np.broadcast_to(np.asarray(colors, np.float32), (len(text), 3))
    for k, ch in enumerate(text):
        c = col + k
        if ch != " " and 0 <= c < COLS and 0 <= row < ROWS:
            chars[row, c] = CI.get(ch, 0)
            cols[row, c] = colors[k]
            glow[row, c] = gl


# ------------------------------------------------------------------ ฉากหลัง (สร้างครั้งเดียว)
def forest(chars, cols, rng, base, count, heights, tone, avoid_center=False):
    """ปลูกต้นสนสามเหลี่ยมเรียงเป็นแนว ต้นที่ปลูกทีหลังจะบังต้นที่ปลูกก่อน"""
    tone = np.array(tone)
    for _ in range(count):
        if avoid_center:   # ชั้นหน้าสุดปลูกแค่สองข้าง ไม่ให้รกหลังต้นคริสต์มาส
            x0 = rng.uniform(-4, CX - 34) if rng.random() < 0.5 else rng.uniform(CX + 34, COLS + 4)
        else:
            x0 = rng.uniform(-4, COLS + 4)
        top = base - rng.integers(heights[0], heights[1] + 1)
        depth = YY - top                                    # ห่างจากยอดลงมากี่แถว
        half = depth * rng.uniform(0.38, 0.55) + 0.9 * (depth % 3 == 2)   # ขอบหยักเป็นกิ่ง
        m = (depth >= 0) & (YY <= base) & (np.abs(XX - x0) <= half)
        if not m.any():
            continue
        chars[m] = rng.choice(to_idx("^AM#%"), m.sum(), p=[0.3, 0.25, 0.15, 0.2, 0.1])
        chars[m & (depth == 0)] = CI["^"]
        edge = np.abs(XX - x0) / np.maximum(half, 0.5)       # 0 กลางต้น → 1 ขอบต้น
        shade = (1.0 - 0.35 * edge) * rng.uniform(0.75, 1.15, (ROWS, COLS)) * rng.uniform(0.85, 1.1)
        cols[m] = tone * shade[m][:, None]


def build_background(rng):
    chars = np.zeros((ROWS, COLS), np.int16)
    cols = np.zeros((ROWS, COLS, 3), np.float32)

    # ท้องฟ้า ไล่สีจากเกือบดำด้านบนไปน้ำเงินเข้มที่ขอบฟ้า โรยจุดจาง ๆ ให้มีเนื้อ
    sky = YY < HORIZON
    k = (YY / HORIZON)[..., None]
    sky_col = (1 - k) * np.array([0.03, 0.04, 0.10]) + k * np.array([0.08, 0.13, 0.32])
    chars[sky & (rng.random((ROWS, COLS)) < 0.18)] = CI["."]
    cols[sky] = sky_col[sky]

    # พระจันทร์มุมซ้ายบน มีแสงจาง ๆ รอบดวง
    d = np.hypot((XX - MOON_X) / ASPECT, YY - MOON_Y)
    halo = (d >= MOON_R) & (d < MOON_R + 3)
    chars[halo] = CI["."]
    cols[halo] = np.array([0.55, 0.50, 0.30]) * ((MOON_R + 3 - d[halo]) / 3 * 0.8)[:, None]
    disc = d < MOON_R
    crater = disc & (rng.random((ROWS, COLS)) < 0.22)
    chars[disc] = CI["@"]
    chars[crater] = CI["%"]
    moon_shade = (1 - 0.35 * (d / MOON_R) ** 2) * np.where(crater, 0.75, 1.0)
    cols[disc] = np.array([1.0, 0.93, 0.62]) * moon_shade[disc][:, None]

    # พื้นหิมะ ใช้คลื่น sin หลายชั้นปนสุ่มทำเป็นลอนหิมะ แล้วเลือกตัวอักษรตามความสว่าง
    ground = YY >= HORIZON
    depth = np.clip((YY - HORIZON) / (ROWS - HORIZON), 0, 1)[..., None]
    wave = (0.5 + 0.22 * np.sin(XX * 0.21 + YY * 0.9) + 0.14 * np.sin(XX * 0.05 - YY * 0.35)
            + 0.22 * (rng.random((ROWS, COLS)) - 0.5))
    wave = np.clip(wave, 0, 0.999)
    ramp = to_idx(".,-~=+*#")
    gcol = (1 - depth) * np.array([0.06, 0.12, 0.36]) + depth * np.array([0.32, 0.48, 0.90])
    gcol = gcol * (0.55 + 0.7 * wave)[..., None]
    chars[ground] = ramp[(wave * len(ramp)).astype(int)][ground]
    cols[ground] = gcol[ground]

    # ป่าสนสีน้ำเงินสามชั้น ชั้นไกลมืดและเตี้ย ชั้นใกล้สว่างและสูง
    forest(chars, cols, rng, HORIZON + 1, 48, (5, 10), (0.05, 0.10, 0.30))
    forest(chars, cols, rng, HORIZON + 3, 30, (7, 13), (0.08, 0.17, 0.46))
    forest(chars, cols, rng, HORIZON + 6, 16, (11, 18), (0.12, 0.25, 0.64), avoid_center=True)

    # เงาบนหิมะใต้ต้นไม้ กล่องของขวัญ และแมว
    shadow = 1 - 0.55 * np.exp(-(((XX - CX + 4) / 40) ** 2 + ((YY - 57) / 2.5) ** 2))
    cols *= shadow[..., None]
    return chars, cols


def build_sky_stars(rng, n=55):
    """ดาวบนฟ้าที่กะพริบ (ไม่ให้ทับพระจันทร์ และเว้นแถวบนสุดไว้ให้ข้อความนับถอยหลัง)"""
    ys = rng.integers(3, HORIZON - 8, n * 3)
    xs = rng.integers(0, COLS, n * 3)
    ok = np.hypot((xs - MOON_X) / ASPECT, ys - MOON_Y) > MOON_R + 4
    ys, xs = ys[ok][:n], xs[ok][:n]
    return dict(y=ys, x=xs, ch=rng.choice(to_idx(".+*"), len(ys), p=[0.6, 0.3, 0.1]),
                phase=rng.uniform(0, 2 * np.pi, len(ys)), speed=rng.uniform(1, 3, len(ys)))


# ------------------------------------------------------------------ ต้นคริสต์มาส (สร้างครั้งเดียว)
def build_tree(rng):
    dx = XX - CX
    mask = np.zeros((ROWS, COLS), bool)
    rel = np.zeros((ROWS, COLS))       # 0 = กลางต้น, 1 = ขอบต้น
    shadow = np.ones((ROWS, COLS))     # ชั้นล่างที่โดนชายชั้นบนบังจะมืดลง

    # ต้นไม้ซ้อนกันสี่ชั้น: (แถวบน, แถวล่าง, ครึ่งความกว้างด้านบน, ครึ่งความกว้างด้านล่าง)
    tiers = [(11, 23, 1, 11), (18, 34, 4, 17), (28, 44, 7, 23), (38, 51, 10, 28)]
    prev_bot = None
    for top, bot, w0, w1 in tiers:
        half = w0 + (w1 - w0) * (YY - top) / (bot - top) + 1.3 * ((YY - top) % 3 == 2)
        m = (YY >= top) & (YY <= bot) & (np.abs(dx) <= half) & ~mask   # ชั้นบนอยู่หน้าชั้นล่าง
        rel[m] = (np.abs(dx) / half)[m]
        if prev_bot is not None:
            s = np.where(YY > prev_bot, 1 - 0.45 * np.exp(-(YY - prev_bot) / 2.0), 0.55)
            shadow[m] = s[m]
        mask |= m
        prev_bot = bot

    chars = np.zeros((ROWS, COLS), np.int16)
    chars[mask] = rng.choice(to_idx("^*#+%"), mask.sum(), p=[0.34, 0.2, 0.26, 0.12, 0.08])
    edge = mask & (rel > 0.86)
    chars[edge & (dx < 0)] = CI["/"]
    chars[edge & (dx > 0)] = CI["\\"]

    # แสงมาจากซ้ายบน ขอบนอกมืดกว่าตรงกลาง ปลายกิ่งมีหิมะเกาะขาว ๆ
    shade = ((0.5 + 0.5 * (1 - rel) ** 0.6) * rng.uniform(0.8, 1.15, (ROWS, COLS))
             * shadow * (1 - 0.25 * dx / 28))
    cols = np.zeros((ROWS, COLS, 3), np.float32)
    cols[mask] = GREEN * shade[mask][:, None]
    cols[edge] = cols[edge] * 0.85 + WHITE * 0.12

    # สายรุ้งสีทองพาดเฉียงสลับทิศ
    garland = np.zeros((ROWS, COLS), bool)
    for g0, slope in [(19, 0.28), (29, -0.26), (39, 0.24), (47, -0.22)]:
        gy = g0 + slope * dx + 0.9 * np.sin(dx * 0.3)
        garland |= mask & (np.abs(YY - gy) < 0.5) & (rel < 0.95)

    # สุ่มตำแหน่งลูกบอลกับหลอดไฟ ให้ห่างกันพอสมควร
    free = mask & ~garland & (rel < 0.85)
    ys, xs = np.nonzero(free)
    taken = np.zeros((ROWS, COLS), bool)
    spots = []
    for i in rng.permutation(len(ys)):
        y, x = ys[i], xs[i]
        if taken[max(y - 1, 0):y + 2, max(x - 2, 0):x + 3].any():
            continue
        taken[y, x] = True
        spots.append((y, x))
        if len(spots) >= 125:
            break
    spots = np.array(spots)
    orn, lit = spots[:42], spots[42:]

    palette = np.array([RED, GOLD, BLUE, WHITE * 0.9, PURPLE])
    tree_y, tree_x = np.nonzero(mask)
    trunk = (YY >= TREE_BASE + 1) & (YY <= TREE_BASE + 4) & (np.abs(dx) <= 3)
    trunk_y, trunk_x = np.nonzero(trunk)
    trunk_shade = 0.6 + 0.4 * (1 - np.abs(trunk_x - CX) / 3)
    gar_y, gar_x = np.nonzero(garland)
    n_lit = len(lit)
    chase = rng.random(n_lit) < 0.5   # ครึ่งหนึ่งกะพริบมั่ว อีกครึ่งไล่เป็นคลื่นจากยอดลงโคน
    return dict(
        y=tree_y, x=tree_x, ch=chars[tree_y, tree_x], col=cols[tree_y, tree_x],
        trunk_y=trunk_y, trunk_x=trunk_x,
        trunk_ch=rng.choice(to_idx("#|"), len(trunk_y), p=[0.7, 0.3]),
        trunk_col=np.array([0.45, 0.26, 0.11]) * trunk_shade[:, None],
        gar_y=gar_y, gar_x=gar_x,
        orn_y=orn[:, 0], orn_x=orn[:, 1],
        orn_ch=rng.choice(to_idx("o@O"), len(orn), p=[0.45, 0.35, 0.2]),
        orn_col=palette[rng.integers(0, len(palette), len(orn))],
        lit_y=lit[:, 0], lit_x=lit[:, 1],
        lit_color=rng.integers(0, len(LIGHT_COLORS), n_lit),
        lit_phase=np.where(chase, -lit[:, 0] * 0.45, rng.uniform(0, 2 * np.pi, n_lit)),
        lit_speed=np.where(chase, 3.0, rng.uniform(1.5, 4.5, n_lit)),
    )


# ดาวบนยอด: '#' คือแกนกลาง ที่เหลือคือแฉก
STAR = [
    "    |    ",
    " \\  |  / ",
    "  \\###/  ",
    "--#####--",
    "  /###\\  ",
    " /  |  \\ ",
    "    |    ",
]


def build_star():
    ys, xs, ch, kind = [], [], [], []
    for r, line in enumerate(STAR):
        for c, s in enumerate(line):
            if s == " ":
                continue
            ys.append(STAR_CY - 3 + r)
            xs.append(CX - 4 + c)
            ch.append(CI[s])
            # 0 = แกนกลาง, 1 = แฉกด้านใน, 2 = ปลายแฉก (กะพริบแรงสุด)
            kind.append(0 if s == "#" else 2 if max(abs(r - 3), abs(c - 4)) >= 3 else 1)
    return dict(y=np.array(ys), x=np.array(xs), ch=np.array(ch, np.int16), kind=np.array(kind))


# กล่องของขวัญ: (คอลัมน์ซ้าย, แถวบน, กว้าง, สูง, สีกล่อง, สีริบบิ้น) ทุกกล่องวางบนแถว 57
GIFTS = [
    (CX - 34, 50, 14, 8, RED, GOLD),
    (CX - 19, 53, 10, 5, GOLD, RED),
    (CX - 8, 54, 9, 4, BLUE, WHITE),
    (CX + 4, 52, 12, 6, WHITE, RED),
    (CX + 18, 49, 14, 9, RED, WHITE),
]


def build_gifts(rng):
    gifts = []
    for x0, y0, w, h, box, ribbon in GIFTS:
        front = w - 2                      # สองคอลัมน์ขวาสุดคือด้านข้างกล่อง ทำให้มืดกว่า
        rc, rr = x0 + front // 2, y0 + h // 2
        ys, xs, ch, col = [], [], [], []
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                side = x >= x0 + front
                c, k = ("=", box * 1.15) if y == y0 else ("#", box * rng.uniform(0.85, 1.0))
                k = k * (1 - 0.25 * (y - y0) / h)
                if x == rc and not side:
                    c, k = "|", ribbon
                if y == rr:
                    c, k = ("+" if x == rc else "-" if side else "="), ribbon
                if side:
                    k = k * 0.6
                ys.append(y)
                xs.append(x)
                ch.append(CI[c])
                col.append(k)
        for i, c in enumerate(">8<"):     # โบว์บนฝากล่อง
            ys.append(y0 - 1)
            xs.append(rc - 1 + i)
            ch.append(CI[c])
            col.append(ribbon)
        gifts.append(dict(y=np.array(ys), x=np.array(xs), ch=np.array(ch, np.int16), col=np.array(col)))
    return gifts


def sprite_cells(art, code):
    """แปลงรูปตัวอักษรหลายบรรทัด + รหัสสีที่วางตรงกัน เป็นรายการ (แถว, คอลัมน์, ตัวอักษร, รหัสสี)"""
    cells = []
    for r, (line, kinds) in enumerate(zip(art, code)):
        for c, ch in enumerate(line):
            if ch != " ":
                cells.append((r, c, ch, kinds[c] if c < len(kinds) else " "))
    return cells


# ------------------------------------------------------------------ แมว
CAT_X, CAT_Y = CX - 46, 52      # มุมซ้ายบนของแมว นั่งข้างกล่องของขวัญใบซ้ายสุด
# รหัสสี: b ขน, i ขนด้านใน, e ตา, n จมูก, p ปาก, w หนวด, f เท้า
CAT_ART = [
    "  /\\_/\\  ",
    " (:o.o:) ",
    " (>:^:<) ",
    " /:::::\\ ",
    "(::|:|::)",
    " ^^---^^ ",
]
CAT_CODE = [
    "  bbbbb  ",
    " bieneib ",
    " bwipiwb ",
    " biiiiib ",
    "biibibiib",
    " ffbbbff ",
]
# หางสามท่า (4 แถว × 4 คอลัมน์) วางต่อจากด้านขวาของตัว สลับไปมาเป็นการกระดิกหาง
CAT_TAILS = [
    ["    ", "  ) ", " /  ", "/   "],
    ["  ( ", "  | ", " /  ", "/   "],
    [" (  ", " |  ", " |  ", "/   "],
]
CAT_COLORS = {
    "b": (1.0, 0.6, 0.22), "i": (0.62, 0.36, 0.13), "e": (0.55, 1.0, 0.45), "n": (1.0, 0.55, 0.65),
    "p": (1.0, 0.55, 0.65), "w": (0.95, 0.95, 0.95), "f": (1.0, 0.82, 0.6),
}


def make_meow():
    """สร้างเสียงเหมียวจากคลื่น sin (ไม่ต้องมีไฟล์เสียง) เสียงขึ้นสูงแล้วลง ใส่เสียงสั่นนิด ๆ"""
    init = pygame.mixer.get_init()
    if not init:
        return None
    rate, _, channels = init
    dur = 0.6
    tt = np.arange(int(rate * dur)) / rate
    p = tt / dur
    pitch = (520 + 280 * np.sin(np.pi * np.clip(p * 1.3, 0, 1)) - 140 * p) * (1 + 0.02 * np.sin(2 * np.pi * 6 * tt))
    phase = 2 * np.pi * np.cumsum(pitch) / rate
    bright = np.sin(np.pi * np.clip(p * 1.2, 0, 1))     # กลางเสียงสว่าง ("เมี้ยว") ท้ายเสียงทุ้ม ("ว")
    wave = (np.sin(phase) + 0.6 * bright * np.sin(2 * phase)
            + 0.35 * bright * np.sin(3 * phase) + 0.2 * bright ** 2 * np.sin(4 * phase))
    env = np.clip(p / 0.08, 0, 1) * np.clip((1 - p) / 0.4, 0, 1) ** 1.5
    pcm = (wave / np.abs(wave).max() * env * 0.45 * 32767).astype(np.int16)
    if channels > 1:
        pcm = np.repeat(pcm[:, None], channels, 1)
    return pygame.sndarray.make_sound(np.ascontiguousarray(pcm))


class Cat:
    """แมวนั่งข้างกล่องของขวัญ กระดิกหาง กะพริบตา คลิกแล้วร้องเหมียว"""

    APPEAR = 4.7   # โผล่มาตอนกล่องของขวัญหล่นครบ

    def __init__(self, rng):
        self.rng = rng
        self.body = sprite_cells(CAT_ART, CAT_CODE)
        self.tails = [sprite_cells(f, ["bbbb"] * 4) for f in CAT_TAILS]
        self.next_blink = 6.0
        self.blink_until = 0.0
        self.happy_until = 0.0
        self.bubble = ""
        self.bubble_until = 0.0
        self.next_chirp = 20.0
        self.sound = None

    def hit(self, cx, cy):
        return CAT_X - 1 <= cx <= CAT_X + 13 and CAT_Y - 2 <= cy <= CAT_Y + 6

    def meow(self, t):
        self.happy_until = self.bubble_until = t + 1.6
        self.bubble = self.rng.choice(["meow~", "meow!", "nyaa~", "mew?"])
        if self.sound is None:   # สร้างเสียงครั้งแรกที่ใช้ (False = เครื่องนี้ไม่มีลำโพง/เปิดเสียงไม่ได้)
            sound = make_meow()
            self.sound = sound if sound is not None else False
        if self.sound:
            self.sound.play()

    def update(self, t):
        if t >= self.next_blink:
            self.blink_until = t + 0.15
            self.next_blink = t + self.rng.uniform(2.5, 5.5)
        if t >= self.next_chirp:   # บางทีก็ส่งเสียงเองแบบไม่มีเสียงจริง
            self.bubble, self.bubble_until = self.rng.choice(["mrrp", "purr~", "..zzz"]), t + 1.8
            self.next_chirp = t + self.rng.uniform(18, 32)

    def draw(self, chars, cols, glow, t):
        if t < self.APPEAR:
            return
        a = ease_out((t - self.APPEAR) / 0.6)
        eye = "^" if t < self.happy_until else "-" if t < self.blink_until else "o"
        tail = self.tails[[0, 1, 2, 1][int(t * 4) % 4]]
        for r, c, ch, k in self.body + [(r + 2, c + 8, ch, k) for r, c, ch, k in tail]:
            if k == "e":
                ch = eye
            y, x = CAT_Y + r, CAT_X + c
            chars[y, x] = CI[ch]
            cols[y, x] = np.array(CAT_COLORS[k]) * a
            if k == "e":
                glow[y, x] = 0.4 * a
        if t < self.bubble_until:
            draw_text(chars, cols, glow, self.bubble, CAT_Y - 2, CAT_X + 1, (1.0, 0.95, 0.85), 0.2)


# ------------------------------------------------------------------ ซานต้ากับดาวตก
# ซานต้าขี่เลื่อน บินจากซ้ายไปขวา (กวางอยู่ข้างหน้า กวางตัวหน้าสุดจมูกแดง)
# รหัสสี: r แดง, w ขาว, g ทอง, b น้ำตาล, n จมูกแดงเรืองแสง
SANTA_ART = [
    "  ^      Y     Y     Y  ",
    " (o)_  _(o>  _(o>  _(o@ ",
    "(____)~/ \\~~~/ \\~~~/ \\  ",
]
SANTA_CODE = [
    "  r      b     b     b  ",
    " rwrg  bbbb  bbbb  bbbn ",
    "rggggrgbbbgggbbbgggbbb  ",
]
SANTA_W = len(SANTA_ART[0])
SANTA_COLORS = {"r": (0.95, 0.2, 0.2), "w": (1.0, 0.95, 0.9), "g": (1.0, 0.78, 0.3),
                "b": (0.68, 0.45, 0.25), "n": (1.0, 0.15, 0.15)}


class Santa:
    """ซานต้าบินผ่านฟ้าเป็นครั้งคราว เส้นทางตัดหน้าพระจันทร์พอดี"""
    SPEED = 13.0   # คอลัมน์ต่อวินาที

    def __init__(self, rng, first=9.0):
        self.rng = rng
        self.cells = sprite_cells(SANTA_ART, SANTA_CODE)
        self.x = None
        self.y = 0.0
        self.next = first

    def update(self, dt, t, fireworks):
        if self.x is None:
            if t >= self.next:
                self.x = -float(SANTA_W)
            return
        self.x += self.SPEED * dt
        p = (self.x + SANTA_W) / (COLS + SANTA_W)
        self.y = 8.0 - 4.5 * p + 0.5 * math.sin(t * 4)   # ไต่ขึ้นช้า ๆ และโยกขึ้นลงนิดหน่อย
        # ฝุ่นวิเศษสีทองโปรยตามหลังเลื่อน
        n = 2
        fireworks.add(self.x + self.rng.uniform(0, 2, n), self.y + 2.5, self.rng.uniform(-3, -1, n),
                      self.rng.uniform(0.5, 2, n), self.rng.uniform(0.8, 1.4, n), GOLD, 2, 1.5, 2.0)
        if self.x > COLS + 2:
            self.x = None
            self.next = t + self.rng.uniform(25, 45)

    def draw(self, chars, cols, glow):
        if self.x is None:
            return
        x0, y0 = int(round(self.x)), int(round(self.y))
        for r, c, ch, k in self.cells:
            x, y = x0 + c, y0 + r
            if 0 <= x < COLS and 0 <= y < ROWS:
                chars[y, x] = CI[ch]
                cols[y, x] = SANTA_COLORS[k]
                glow[y, x] = 1.0 if k == "n" else 0.15


class Meteors:
    """ดาวตกพาดฟ้าเป็นครั้งคราว"""

    def __init__(self, rng):
        self.rng = rng
        self.items = []                    # [x, y, vx, vy, age, life]
        self.next = rng.uniform(3, 7)

    def update(self, dt, t):
        r = self.rng
        if t >= self.next:
            self.items.append([r.uniform(15, COLS - 15), r.uniform(3, 10), r.choice([-1, 1]) * r.uniform(35, 55),
                               r.uniform(9, 16), 0.0, r.uniform(0.5, 0.8)])
            self.next = t + r.uniform(4, 10)
        for m in self.items:
            m[0] += m[2] * dt
            m[1] += m[3] * dt
            m[4] += dt
        self.items = [m for m in self.items if m[4] < m[5]]

    def draw(self, chars, cols, glow):
        for x, y, vx, vy, age, life in self.items:
            fade = min(1.0, (life - age) / 0.25, age / 0.08)   # ค่อย ๆ โผล่และค่อย ๆ หาย
            slope = abs(vy * CH) / abs(vx * CW)                 # ความชันบนจอจริง
            tail = "-" if slope < 0.4 else ("\\" if vx > 0 else "/")
            for k in range(11, -1, -1):                         # วาดจากหางมาหัว หัวจะได้อยู่บนสุด
                ix, iy = int(round(x - vx * k * 0.012)), int(round(y - vy * k * 0.012))
                if 0 <= ix < COLS and 0 <= iy < HORIZON - 3:
                    b = fade * (1 - k / 12)
                    chars[iy, ix] = CI["*" if k == 0 else tail]
                    cols[iy, ix] = (0.9 * b, 0.95 * b, b)
                    glow[iy, ix] = 0.8 * b


# ------------------------------------------------------------------ พลุ
# ฟอนต์ 5×7 สำหรับพลุตัวอักษร (# = มีสะเก็ด)
FONT = {
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
}


def text_points(word, sx=1.6, sy=1.0):
    """จุดของตัวอักษรทั้งคำ คืน (จุด x,y หน่วยช่อง, ลำดับตัวอักษรของแต่ละจุด)"""
    pts, letter = [], []
    width = 6 * len(word) - 1
    for i, ch in enumerate(word):
        for r, line in enumerate(FONT.get(ch, FONT["O"])):
            for c, on in enumerate(line):
                if on == "#":
                    pts.append(((i * 6 + c - (width - 1) / 2) * sx, (r - 3) * sy))
                    letter.append(i)
    return np.array(pts), np.array(letter)


def heart_points(n=70, s=0.42):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x = 16 * np.sin(a) ** 3
    y = 13 * np.cos(a) - 5 * np.cos(2 * a) - 2 * np.cos(3 * a) - np.cos(4 * a)
    return np.column_stack([x * s * ASPECT, -(y + 2.5) * s])


def star_points(outer=7.0, inner=2.9, per_edge=7):
    ang = -np.pi / 2 + np.arange(10) * np.pi / 5
    rad = np.where(np.arange(10) % 2 == 0, outer, inner)
    vx, vy = rad * np.cos(ang), rad * np.sin(ang)
    pts = []
    for i in range(10):
        j = (i + 1) % 10
        for f in np.linspace(0, 1, per_edge, endpoint=False):
            pts.append((vx[i] + (vx[j] - vx[i]) * f, vy[i] + (vy[j] - vy[i]) * f))
    pts = np.array(pts)
    return np.column_stack([pts[:, 0] * ASPECT, pts[:, 1]])


def cat_face_points():
    """หน้าแมว: หัวกลม หูสองข้าง ตา จมูก ปาก หนวด (หน่วยแถว แล้วค่อยยืดแกน x)"""
    def line(p, q, n):
        f = np.linspace(0, 1, n)[:, None]
        return np.array(p) + (np.array(q) - np.array(p)) * f

    R = 5.5
    a = np.linspace(0, 2 * np.pi, 44, endpoint=False)
    parts = [np.column_stack([R * np.cos(a), R * np.sin(a)])]
    for side in (-1, 1):   # -1 = ซ้าย, 1 = ขวา (กระจกกัน)
        b1 = (side * R * abs(math.cos(math.radians(150))), -R * math.sin(math.radians(150)))   # โคนหูด้านนอก
        b2 = (side * R * abs(math.cos(math.radians(110))), -R * math.sin(math.radians(110)))   # โคนหูด้านใน
        apex = (side * 4.6, -9.0)                                                                # ปลายหู
        parts += [line(b1, apex, 6), line(apex, b2, 6)]
        parts += [np.array([[side * 2.1, -1.0], [side * 2.1, -0.6]])]                   # ตา
        parts += [line((side * 2.8, 1.2), (side * 8.2, 0.2), 5), line((side * 2.8, 1.9), (side * 8.2, 2.8), 5)]
    parts += [np.array([[0, 0.8], [-0.8, 1.8], [0, 1.5], [0.8, 1.8]])]                   # จมูกกับปาก
    pts = np.concatenate(parts)
    return np.column_stack([pts[:, 0] * ASPECT, pts[:, 1] + 1.0])


class Fireworks:
    """จรวดพุ่งขึ้นจากแนวป่า ถึงจุดสูงสุดแล้วแตกเป็นสะเก็ด"""
    ROCKET_GRAVITY = 18.0   # แถว/วินาที²
    # คอลัมน์ในตารางสะเก็ด (หนึ่งแถวต่อหนึ่งสะเก็ด)
    X, Y, VX, VY, AGE, LIFE, R, G, B, KIND, DRAG, GRAV = range(12)
    # KIND: 0 ปกติ, 1 กะพริบแปล๊บ ๆ, 2 ประกายหางจรวด/ฝุ่น, 3 รูปทรง (ค้างให้เห็นรูปนานหน่อย)
    LEVELS = [0.12, 0.3, 0.5, 0.75]
    LEVEL_CHARS = to_idx(".:+*@")          # สะเก็ดยิ่งมอดยิ่งเปลี่ยนตัวอักษรเล็กลง
    SHAPES = ["heart", "cat", "star", "text"]

    def __init__(self, rng, start=4.5):
        self.rng = rng
        self.rockets = []                   # [x, y, vx, vy]
        self.p = np.zeros((0, 12), np.float32)
        self.next_launch = start
        self.rate = (0.6, 1.7)              # ยิงห่างกันกี่วินาที (สุ่มในช่วงนี้) Countdown ปรับค่านี้
        self.shape_chance = 0.25            # โอกาสที่ลูกนั้นจะเป็นพลุรูปทรง
        self.words = ["XMAS", "JOY", "LOVE", "MEOW"]

    def add(self, x, y, vx, vy, life, colors, kind, drag, grav):
        """เพิ่มสะเก็ดชุดใหม่ ค่าที่เป็นตัวเลขเดียวจะใช้กับทุกสะเก็ดในชุด"""
        n = len(vx)
        f = lambda v: np.broadcast_to(np.asarray(v, np.float32), (n,))
        colors = np.broadcast_to(np.asarray(colors, np.float32), (n, 3))
        new = np.column_stack([f(x), f(y), f(vx), f(vy), np.zeros(n, np.float32), f(life),
                               colors, f(kind), f(drag), f(grav)])
        self.p = np.concatenate([self.p, new.astype(np.float32)])

    def launch(self, x=None):
        rng = self.rng
        if x is None:   # ยิงจากสองข้าง ไม่ให้บังต้นไม้
            x = rng.uniform(6, CX - 30) if rng.random() < 0.5 else rng.uniform(CX + 30, COLS - 6)
        y0 = HORIZON + 1
        target = rng.uniform(5, 17)
        vy = -math.sqrt(2 * self.ROCKET_GRAVITY * (y0 - target))   # ความเร็วต้นที่พอดีจะไปถึงความสูงนี้
        self.rockets.append([x, y0, rng.uniform(-1.5, 1.5), vy])

    def explode(self, x, y, style=None):
        rng = self.rng
        if style is None and rng.random() < self.shape_chance:
            style = rng.choice(self.SHAPES)
        if style in self.SHAPES:
            self.explode_shape(x, y, style)
            return
        style = style or rng.choice(["peony", "ring", "willow", "multi", "crackle"], p=[0.32, 0.18, 0.16, 0.2, 0.14])
        n = int(rng.integers(90, 150))
        angle = rng.uniform(0, 2 * np.pi, n)
        smax = rng.uniform(10, 15)
        if style == "ring":
            speed = smax * rng.uniform(0.92, 1.0, n)
        else:
            speed = smax * np.sqrt(rng.uniform(0.15, 1.0, n))   # กระจายเต็มวง เป็นลูกบอลไฟ
        life = rng.uniform(1.2, 2.0, n)
        drag, kind = 1.6, 0
        colors = FIREWORK_COLORS[rng.integers(len(FIREWORK_COLORS))]
        if style == "multi":
            pick = rng.choice(len(FIREWORK_COLORS), 3, replace=False)
            colors = FIREWORK_COLORS[pick[rng.integers(0, 3, n)]]
        elif style == "willow":       # สีทอง อยู่นาน ร่วงลงเหมือนกิ่งหลิว
            colors, drag = (1.0, 0.72, 0.28), 2.4
            life *= 1.6
        elif style == "crackle":      # สีขาว กะพริบแปล๊บ ๆ
            colors, kind = (0.95, 0.95, 1.0), 1
        self.add(x, y, np.cos(angle) * speed * ASPECT, np.sin(angle) * speed, life, colors, kind, drag, 5.0)

    def explode_shape(self, x, y, style, word=None):
        """พลุรูปทรง: ให้แต่ละสะเก็ดพุ่งไปหยุดตรงจุดของรูปพอดี
        (มีแรงต้าน drag สะเก็ดที่ออกตัวด้วยความเร็ว v จะไปได้ไกล v/drag จึงตั้ง v = ระยะ × drag)"""
        rng = self.rng
        letter = None
        if style == "text":
            pts, letter = text_points(word or rng.choice(self.words))
        elif style == "heart":
            pts = heart_points()
        elif style == "cat":
            pts = cat_face_points()
        else:
            pts = star_points()
        pts = pts + rng.uniform(-0.25, 0.25, pts.shape)
        half_w = np.abs(pts[:, 0]).max() + 1
        half_h = np.abs(pts[:, 1]).max() + 1
        x = float(np.clip(x, half_w, COLS - half_w))         # ไม่ให้รูปล้นจอ
        y = float(np.clip(y, half_h, HORIZON - half_h - 2))
        n = len(pts)
        if style == "text":   # ตัวอักษรแต่ละตัวคนละสี
            start = rng.integers(len(FIREWORK_COLORS))
            colors = FIREWORK_COLORS[(start + letter) % len(FIREWORK_COLORS)]
        else:
            colors = {"heart": (1.0, 0.3, 0.5), "cat": (1.0, 0.65, 0.25), "star": (1.0, 0.85, 0.3)}[style]
        drag = 2.4
        self.add(x, y, pts[:, 0] * drag, pts[:, 1] * drag, rng.uniform(2.3, 2.8, n), colors, 3, drag, 0.8)

    def update(self, dt, t, auto=True):
        rng = self.rng
        if auto and t >= self.next_launch:
            self.launch()
            if rng.random() < 0.25:
                self.launch()
            self.next_launch = t + rng.uniform(*self.rate)

        trail, flying = [], []
        for r in self.rockets:
            r[0] += r[2] * dt
            r[1] += r[3] * dt
            r[3] += self.ROCKET_GRAVITY * dt
            trail.append((r[0] + rng.uniform(-0.3, 0.3), r[1] + 0.5))   # ประกายไฟหางจรวด
            if r[3] >= -1.0:   # ช้าจนเกือบหยุด แปลว่าถึงยอดแล้ว
                self.explode(r[0], r[1])
            else:
                flying.append(r)
        self.rockets = flying
        if trail:
            tx, ty = np.array(trail).T
            n = len(tx)
            self.add(tx, ty, rng.uniform(-1, 1, n), rng.uniform(1, 3, n), rng.uniform(0.3, 0.6, n),
                     (1.0, 0.65, 0.3), 2, 3.0, 5.0)

        p = self.p
        if len(p) == 0:
            return
        slow = np.exp(-p[:, self.DRAG] * dt)
        p[:, self.VX] *= slow
        p[:, self.VY] = p[:, self.VY] * slow + p[:, self.GRAV] * dt
        p[:, self.X] += p[:, self.VX] * dt
        p[:, self.Y] += p[:, self.VY] * dt
        p[:, self.AGE] += dt
        alive = (p[:, self.AGE] < p[:, self.LIFE]) & (p[:, self.Y] < ROWS + 2) & \
                (p[:, self.X] > -5) & (p[:, self.X] < COLS + 5)
        self.p = p[alive]

    def draw(self, chars, cols, glow):
        p = self.p
        if len(p):
            left = np.clip(1 - p[:, self.AGE] / p[:, self.LIFE], 0, 1)
            kind = p[:, self.KIND]
            b = np.where(kind == 3, left ** 0.5, left ** 1.3)   # รูปทรงสว่างค้างนานกว่า
            crackle = kind == 1
            b[crackle] *= self.rng.random(crackle.sum()) > 0.35
            b[kind == 2] *= 0.6
            flash = np.clip(1 - p[:, self.AGE] / 0.15, 0, 1)[:, None]     # เพิ่งแตกจะขาวจ้าก่อน
            col = (p[:, self.R:self.B + 1] * (1 - flash) + flash) * (0.25 + 0.85 * b)[:, None]
            ix, iy = np.rint(p[:, self.X]).astype(int), np.rint(p[:, self.Y]).astype(int)
            ok = (ix >= 0) & (ix < COLS) & (iy >= 0) & (iy < ROWS) & (b > 0.03)
            # เรียงจากมืดไปสว่าง ช่องที่มีหลายสะเก็ด ตัวที่สว่างสุดจะถูกเขียนทีหลังสุด
            order = np.argsort(b[ok])
            ix, iy, b, col = ix[ok][order], iy[ok][order], b[ok][order], col[ok][order]
            brighter = col.max(1) > cols[iy, ix].max(1)                 # สะเก็ดจาง ๆ ไม่ไปทับของที่สว่างกว่า
            ix, iy, b, col = ix[brighter], iy[brighter], b[brighter], col[brighter]
            chars[iy, ix] = self.LEVEL_CHARS[np.digitize(b, self.LEVELS)]
            cols[iy, ix] = col
            glow[iy, ix] = np.maximum(glow[iy, ix], b)
        for x, y, _, _ in self.rockets:
            ix, iy = int(round(x)), int(round(y))
            if 0 <= ix < COLS and 0 <= iy < ROWS:
                chars[iy, ix] = CI["|"]
                cols[iy, ix] = (1.0, 0.9, 0.65)
                glow[iy, ix] = 0.8


# ------------------------------------------------------------------ นับถอยหลัง
def countdown_state(now):
    """ดูว่าตอนนี้อยู่ช่วงไหน คืน (โหมด, ข้อความ, วินาทีที่เหลือ, ปีใหม่ที่กำลังจะถึง)
    โหมด: count = กำลังนับถอยหลัง, xmas = วันคริสต์มาส, newyear = วันปีใหม่"""
    year = now.year if now.month == 1 else now.year + 1
    if now.month == 12 and now.day == 25:
        return "xmas", "MERRY CHRISTMAS!", 0.0, year
    if now.month == 1 and now.day == 1:
        return "newyear", f"HAPPY NEW YEAR {now.year}!", 0.0, year
    xmas = datetime(now.year, 12, 25)
    target, label = (xmas, "CHRISTMAS") if now < xmas else (datetime(now.year + 1, 1, 1), "NEW YEAR")
    left = (target - now).total_seconds()
    s = int(left)
    d, h, m, sec = s // 86400, s % 86400 // 3600, s % 3600 // 60, s % 60
    days = f"{d} DAY{'S' if d > 1 else ''} " if d else ""
    return "count", f"{label} IN {days}{h:02}:{m:02}:{sec:02}", left, year


class Countdown:
    """ข้อความนับถอยหลังบนฟ้า 10 วิสุดท้ายพลุเป็นตัวเลข ถึงเวลาแล้วจุดพลุรัวปิดท้าย"""

    def __init__(self, fireworks):
        self.fw = fireworks
        self.mode = None
        self.text = ""
        self.last_sec = None
        self.finale_until = -1.0

    def update(self, now, t):
        mode, self.text, left, year = countdown_state(now)
        fw = self.fw
        if mode != "count" and self.mode == "count":       # เพิ่งถึงเวลาพอดี
            self.finale_until = t + 40
            words = ("XMAS", "JOY") if mode == "xmas" else (str(year), "HAPPY")
            fw.explode_shape(30, 13, "text", words[0])
            fw.explode_shape(COLS - 30, 13, "text", words[1])
        if mode == "count" and left <= 10.5:               # 10 วิสุดท้าย พลุเป็นตัวเลข
            sec = math.ceil(left)
            if sec != self.last_sec and sec >= 1:
                fw.explode_shape(30 if sec % 2 else COLS - 30, 14, "text", str(sec))
            self.last_sec = sec
        self.mode = mode

        # ช่วงไหนยิงถี่แค่ไหน
        if t < self.finale_until:
            fw.rate, fw.shape_chance = (0.08, 0.25), 0.4
        elif mode != "count":
            fw.rate, fw.shape_chance = (0.35, 0.9), 0.4
        elif left <= 10.5:
            fw.rate, fw.shape_chance = (2.0, 3.0), 0.0      # หลบให้ตัวเลขนับถอยหลังเด่น
        else:
            fw.rate, fw.shape_chance = (0.6, 1.7), 0.25
        new_year_time = (now.month == 12 and now.day >= 26) or (now.month == 1 and now.day == 1)
        fw.words = [str(year), "HAPPY", "NEW", "YEAR", "JOY"] if new_year_time else ["XMAS", "JOY", "LOVE", "MEOW"]

    def draw(self, chars, cols, glow, t):
        text = self.text
        col = CX - len(text) // 2
        if self.mode == "count":
            draw_text(chars, cols, glow, text, 1, col, (1.0, 0.85, 0.5), 0.15)
        else:   # วันจริง ข้อความไล่สีรุ้ง
            draw_text(chars, cols, glow, text, 1, col, hue_rgb((np.arange(len(text)) * 0.07 - t * 0.5) % 1), 0.5)


# ------------------------------------------------------------------ วาดแต่ละเฟรม
def draw_sky_stars(chars, cols, glow, stars, t):
    b = 0.3 + 0.7 * (0.5 + 0.5 * np.sin(t * stars["speed"] + stars["phase"]))
    chars[stars["y"], stars["x"]] = stars["ch"]
    cols[stars["y"], stars["x"]] = np.array([0.8, 0.85, 1.0]) * b[:, None]
    glow[stars["y"], stars["x"]] = 0.3 * b


def light_state(tr, t, mode):
    """ความสว่าง (0..1) กับสีของหลอดไฟทุกดวง ตามโหมดที่เลือก"""
    ly, lx = tr["lit_y"], tr["lit_x"]
    n = len(ly)
    if mode == "warm":       # สีทองอุ่น ๆ กะพริบเบา ๆ
        b = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(t * tr["lit_speed"] * 0.4 + tr["lit_phase"]))
        color = np.tile([1.0, 0.8, 0.45], (n, 1))
    elif mode == "rainbow":  # สีรุ้งไหลจากยอดลงโคน
        b = 0.75 + 0.25 * np.sin(t * 6 + tr["lit_phase"])
        color = hue_rgb((ly * 0.035 + (lx - CX) * 0.012 - t * 0.35) % 1)
    elif mode == "beat":     # แบ่งไฟเป็น 4 กลุ่ม ติดทีละกลุ่มตามจังหวะ ทุกจังหวะแรกของห้องติดพร้อมกันหมด
        beat = t * BPM / 60
        ph, k = beat % 1, int(beat)
        on = (np.arange(n) % 4) == (k % 4)
        b = np.where(on, math.exp(-ph * 3), 0.06)
        if k % 4 == 0:
            b = np.maximum(b, math.exp(-ph * 5))
        color = LIGHT_COLORS[tr["lit_color"]]
    else:                    # classic: สว่าง-ดับตาม sin ยกกำลังสอง ทุก 3 วิสีเลื่อนไปหนึ่งสี
        b = (0.5 + 0.5 * np.sin(t * tr["lit_speed"] + tr["lit_phase"])) ** 2
        color = LIGHT_COLORS[(tr["lit_color"] + int(t / 3)) % len(LIGHT_COLORS)]
    return b, color


def draw_tree(chars, cols, glow, tr, t, light_mode):
    # ลำต้นมีตั้งแต่แรก
    chars[tr["trunk_y"], tr["trunk_x"]] = tr["trunk_ch"]
    cols[tr["trunk_y"], tr["trunk_x"]] = tr["trunk_col"]

    # ช่วงเปิดฉาก ใบไม้ค่อย ๆ โผล่จากโคนขึ้นไปถึงยอด
    reveal = TREE_BASE - (TREE_BASE - TREE_TOP + 1) * ease_out(t / 2.2)
    vis = tr["y"] >= reveal
    chars[tr["y"][vis], tr["x"][vis]] = tr["ch"][vis]
    cols[tr["y"][vis], tr["x"][vis]] = tr["col"][vis]

    # ของตกแต่งค่อย ๆ สว่างขึ้นหลังต้นไม้ขึ้นเต็มต้น
    a = ease_out((t - 2.3) / 1.2)
    if a <= 0:
        return

    # สายรุ้งสีทอง มีประกายวิ่งไปตามสาย
    gy, gx = tr["gar_y"], tr["gar_x"]
    s = (0.6 + 0.4 * np.sin(gx * 0.7 - t * 5 + gy)) * a
    chars[gy, gx] = CI["~"]
    cols[gy, gx] = GOLD * s[:, None]
    glow[gy, gx] = 0.25 * s

    # ลูกบอล
    chars[tr["orn_y"], tr["orn_x"]] = tr["orn_ch"]
    cols[tr["orn_y"], tr["orn_x"]] = tr["orn_col"] * a
    glow[tr["orn_y"], tr["orn_x"]] = 0.3 * a

    # หลอดไฟ
    b, color = light_state(tr, t, light_mode)
    ly, lx = tr["lit_y"], tr["lit_x"]
    chars[ly, lx] = np.where(b > 0.55, CI["*"], np.where(b > 0.2, CI["+"], CI["."]))
    cols[ly, lx] = color * ((0.18 + 0.82 * b) * a)[:, None]
    glow[ly, lx] = 1.2 * b * a


def draw_star(chars, cols, glow, star, t):
    if t < 2.8:
        return
    pop = 1 + 1.5 * math.exp(-(t - 2.8) * 4)          # แวบสว่างตอนเพิ่งโผล่
    kind = star["kind"]
    b = np.where(kind == 0, 1.0, np.where(kind == 1, 0.8 + 0.2 * math.sin(t * 3),
                                          0.25 + 0.75 * (0.5 + 0.5 * math.sin(t * 5))))
    base = np.where((kind == 0)[:, None], [1.0, 0.95, 0.65], [1.0, 0.8, 0.28])
    chars[star["y"], star["x"]] = star["ch"]
    cols[star["y"], star["x"]] = base * (b * pop)[:, None]
    glow[star["y"], star["x"]] = b * pop


def draw_gifts(chars, cols, gifts, t):
    for i, g in enumerate(gifts):
        start = 3.2 + 0.3 * i                         # ทยอยหล่นลงมาทีละกล่อง
        if t < start:
            continue
        drop = int(round((1 - ease_out((t - start) / 0.45)) * -8))
        y = g["y"] + drop
        ok = y >= 0
        chars[y[ok], g["x"][ok]] = g["ch"][ok]
        cols[y[ok], g["x"][ok]] = g["col"][ok]


# ------------------------------------------------------------------ โปรแกรมหลัก
def main():
    ap = argparse.ArgumentParser(description="ต้นคริสต์มาสตัวอักษร")
    ap.add_argument("--seconds", type=float, default=0, help="รันกี่วินาทีแล้วปิดเอง (0 = ไม่ปิดเอง)")
    ap.add_argument("--screenshot", help="เซฟเฟรมสุดท้ายเป็นไฟล์ png ก่อนปิด")
    ap.add_argument("--seed", type=int, default=2026, help="เลขสุ่มตั้งต้น เปลี่ยนเลขแล้วป่ากับของตกแต่งจะเปลี่ยนตาม")
    ap.add_argument("--now", help='แกล้งทำเป็นว่าตอนนี้เป็นเวลานี้ เช่น "2026-12-24 23:59:45" ไว้ลองดูพลุปิดท้าย')
    ap.add_argument("--lights", choices=LIGHT_MODES, default="classic", help="โหมดไฟตอนเริ่ม")
    args = ap.parse_args()

    pygame.mixer.pre_init(44100, -16, 1)
    pygame.init()
    headless = os.environ.get("SDL_VIDEODRIVER") == "dummy"
    # SCALED ให้หน้าต่างขยายตามจอ และกด F เต็มจอได้
    screen = pygame.display.set_mode((W, H), 0 if headless else pygame.SCALED)
    pygame.display.set_caption("ต้นคริสต์มาสตัวอักษร")

    rng = np.random.default_rng(args.seed)
    masks = build_glyphs()
    bg_chars, bg_cols = build_background(rng)
    sky_stars = build_sky_stars(rng)
    tree = build_tree(rng)
    star = build_star()
    gifts = build_gifts(rng)
    snow = Snow(rng)
    fireworks = Fireworks(rng)
    santa = Santa(rng)
    meteors = Meteors(rng)
    cat = Cat(rng)
    countdown = Countdown(fireworks)
    start_now = datetime.fromisoformat(args.now) if args.now else datetime.now()

    light_mode = LIGHT_MODES.index(args.lights)
    message, message_until = "space: firework   click: firework / pet the cat   L: lights   F: fullscreen   esc: quit", 9.0

    clock = pygame.time.Clock()
    t, frames, started = 0.0, 0, time.perf_counter()
    running = True
    while running:
        dt = min(clock.tick(FPS) / 1000, 0.1)   # ถ้าเครื่องกระตุกนาน ไม่ให้ของกระโดดไกล
        t += dt
        frames += 1
        for e in pygame.event.get():
            if e.type == pygame.QUIT or (e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE):
                running = False
            elif e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE:
                fireworks.launch()
            elif e.type == pygame.KEYDOWN and e.key == pygame.K_f:
                pygame.display.toggle_fullscreen()
            elif e.type == pygame.KEYDOWN and e.key == pygame.K_l:
                light_mode = (light_mode + 1) % len(LIGHT_MODES)
                message, message_until = f"lights: {LIGHT_MODES[light_mode]}", t + 2.5
            elif e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                cx, cy = e.pos[0] / CW, e.pos[1] / CH
                if t >= Cat.APPEAR and cat.hit(cx, cy):
                    cat.meow(t)
                else:
                    fireworks.explode(cx, cy)

        countdown.update(start_now + timedelta(seconds=t), t)
        snow.update(dt, t)
        fireworks.update(dt, t)
        santa.update(dt, t, fireworks)
        meteors.update(dt, t)
        cat.update(t)

        # เริ่มจากฉากหลังเสมอ แล้ววาดทับไล่จากไกลมาใกล้
        chars = bg_chars.copy()
        cols = bg_cols.copy()
        glow = np.zeros((ROWS, COLS), np.float32)
        draw_sky_stars(chars, cols, glow, sky_stars, t)
        fireworks.draw(chars, cols, glow)
        santa.draw(chars, cols, glow)
        meteors.draw(chars, cols, glow)
        draw_tree(chars, cols, glow, tree, t, LIGHT_MODES[light_mode])
        draw_gifts(chars, cols, gifts, t)
        cat.draw(chars, cols, glow, t)
        draw_star(chars, cols, glow, star, t)
        snow.draw(chars, cols, glow)
        countdown.draw(chars, cols, glow, t)
        if t < message_until:
            fade = clamp01(message_until - t)
            draw_text(chars, cols, glow, message, ROWS - 1, 2, (0.9 * fade, 0.92 * fade, fade), 0)

        pygame.surfarray.blit_array(screen, compose(chars, cols, masks))
        add_glow(screen, cols, glow)
        pygame.display.flip()

        if args.seconds and t >= args.seconds:
            if args.screenshot:
                pygame.image.save(screen, args.screenshot)
            running = False

    elapsed = time.perf_counter() - started
    print(f"วาดไป {frames} เฟรมใน {elapsed:.1f} วินาที (เฉลี่ย {frames / elapsed:.1f} fps)")
    pygame.quit()


# ------------------------------------------------------------------ หิมะ
class Snow:
    """เกล็ดหิมะ เกล็ดที่ตกเร็วถือว่าอยู่ใกล้ เลยให้ใหญ่และสว่างกว่า"""

    def __init__(self, rng, n=360):
        self.rng = rng
        self.x = rng.uniform(0, COLS, n)
        self.y = rng.uniform(0, ROWS, n)
        self.vy = rng.uniform(2.5, 9.0, n)              # แถวต่อวินาที
        self.phase = rng.uniform(0, 2 * np.pi, n)
        near = (self.vy - 2.5) / 6.5
        self.ch = np.where(near > 0.85, CI["*"], np.where(near > 0.6, CI["+"], CI["."]))
        self.bright = 0.45 + 0.55 * near

    def update(self, dt, t):
        wind = 1.2 * math.sin(t * 0.23)                 # ลมเปลี่ยนทิศช้า ๆ
        self.y += self.vy * dt
        self.x = (self.x + (wind + 1.2 * np.sin(t * 1.4 + self.phase)) * 1.5 * dt) % COLS
        fallen = self.y >= ROWS                          # ตกถึงพื้นแล้วไปเริ่มใหม่ด้านบน
        self.y[fallen] -= ROWS + self.rng.uniform(0, 4, fallen.sum())
        self.x[fallen] = self.rng.uniform(0, COLS, fallen.sum())

    def draw(self, chars, cols, glow):
        iy = np.floor(self.y).astype(int)
        ix = np.floor(self.x).astype(int) % COLS
        ok = (iy >= 0) & (iy < ROWS)
        iy, ix = iy[ok], ix[ok]
        chars[iy, ix] = self.ch[ok]
        cols[iy, ix] = WHITE * self.bright[ok][:, None]
        glow[iy, ix] = 0.12 * self.bright[ok]


if __name__ == "__main__":
    main()
