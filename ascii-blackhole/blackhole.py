"""
หลุมดำกลืนโค้ด: แอนิเมชันตัวอักษร (ASCII) วนรอบละประมาณ 60 วินาที

ตัวอักษรทุกตัวบนจอคือ particle หนึ่งตัว เก็บเป็น numpy array ชุดเดียวใช้ทั้งเรื่อง
    ช่วง 1  ทะเลโค้ด        ตัวอักษรเรียงเป็นตาราง ไหลลงเป็นคอลัมน์
    ช่วง 2  หลุมดำถือกำเนิด  จุดดำโตขึ้นกลางจอ ตัวอักษรรอบ ๆ ถูกเลนส์ความโน้มถ่วงดันให้บิด
    ช่วง 3  ดูดกลืน          ตัวอักษรหลุดจากตาราง วนเป็นเกลียวเข้าหลุม ใกล้หลุมร้อนจนเป็นสีขาว
    ช่วง 4  ยุบตัวและระเบิด   หลุมหดเป็นจุด เงียบไปครู่หนึ่ง แล้วระเบิดพ่นตัวอักษรทั้งหมดออกมา
    ช่วง 5  กาแล็กซี         ตัวอักษรถูกพาไปเรียงเป็นแขนก้นหอย แล้วบินกลับเข้าตารางเริ่มรอบใหม่

ปุ่มลัด
    Space   ข้ามไปช่วงถัดไป              R      เริ่มใหม่
    คลิก     ช่วง 1-3 = หลุมดำเล็ก, ช่วง 5 = ซูเปอร์โนวา
    P       หยุด / เล่นต่อ                  + / -  ปรับความเร็ว
    L       เปิด / ปิดการวนรอบ             H      แสดง / ซ่อนแถบล่าง
    F       เต็มจอ                         Esc    ปิดโปรแกรม

รันแบบไม่เปิดหน้าต่าง (เอาไว้เช็กภาพ):
    SDL_VIDEODRIVER=dummy python blackhole.py --fast --seconds 20 --shots 5,12,20
กระโดดไปดูช่วงที่ต้องการเลย เช่นเริ่มที่วินาทีที่ 30:
    python blackhole.py --start-at 30
"""

import argparse
import math
import os
import sys
import time
from operator import itemgetter
from pathlib import Path

import numpy as np

# Windows สเกลจอ 125% จะทำให้หน้าต่าง 1920x1080 ใหญ่เกินจอ ต้องบอก SDL ว่าเราจัดการ DPI เอง (ต้องตั้งก่อน import pygame)
os.environ.setdefault("SDL_WINDOWS_DPI_AWARENESS", "permonitorv2")
import pygame  # noqa: E402  (ติดตั้งเป็น pygame-ce แต่ชื่อในโค้ดยังเป็น pygame)

# ================================================================== CONFIG (ปรับค่าตรงนี้ได้เลย)
RESOLUTION = (1920, 1080)       # ขนาดภาพ ถ้าจอเล็กกว่านี้จะเปิดเต็มจอแล้วย่อให้พอดีเอง
TARGET_FPS = 60
FONT_NAMES = "consolas,dejavusansmono,couriernew,monospace"   # ฟอนต์ตัวแรกที่เครื่องมีจะถูกใช้
FONT_SIZE = 16
CELL_W, CELL_H = 9, 16        # ช่องตารางกว้าง × สูง (พิกเซล) ช่องเล็กลง = ตัวอักษรมากขึ้น
# ระยะเวลาแต่ละช่วง (วินาที): ทะเลโค้ด, หลุมดำเกิด, ดูดกลืน, ยุบ+ระเบิด, กาแล็กซี
PHASE_SECONDS = [3.0, 7.0, 17.0, 5.0, 35.0]
LOOP = True                     # จบช่วง 5 แล้ววนกลับช่วง 1 เอง (กด L สลับได้)

MAX_PARTICLES = 16000          # เพดานจำนวนตัวอักษร
MIN_PARTICLES = 6000            # ถ้าเครื่องช้า ระบบจะลดจำนวนลงเอง แต่ไม่ต่ำกว่านี้
AUTO_REDUCE = True              # ลดจำนวนอัตโนมัติเมื่อ FPS ต่ำกว่าเป้า
PHYSICS_DT = 1 / 120            # ฟิสิกส์เดินทีละ 1/120 วิเสมอ ไม่ขึ้นกับ FPS
MAX_STEPS_PER_FRAME = 8

# ช่วง 1: ทะเลโค้ด
RAIN_SPEED = (35.0, 150.0)      # ความเร็วคอลัมน์ (พิกเซล/วิ) สุ่มในช่วงนี้
HEAD_SPEED = (230.0, 560.0)     # ความเร็วหัวคอลัมน์ที่สว่าง
HEAD_TAIL = 240.0               # หางหลังหัวคอลัมน์ยาวเท่าไร (พิกเซล)
RAIN_BASE = (0.06, 0.20)        # ความสว่างพื้นของตัวอักษรที่ไม่ได้อยู่ใกล้หัวคอลัมน์
GLITCH_EVERY = (0.35, 1.4)      # glitch เกิดห่างกันกี่วินาที

# ช่วง 2-3: หลุมดำ
HOLE_BIRTH_RADIUS = 36.0        # รัศมีหลุมตอนจบช่วง 2
HOLE_MAX_RADIUS = 100.0         # รัศมีหลุมตอนกลืนครบทุกตัว
LENS_FACTOR = 2.1               # รัศมีวงแหวนไอน์สไตน์ = ค่านี้ × รัศมีหลุม (ยิ่งมาก เลนส์ยิ่งแรง)
LENS_TWIST = 0.9                # บิดมุมตัวอักษรรอบหลุมมากแค่ไหน
PHOTON_RING = 1.22              # รัศมีวงแหวนแสงของหลุมดำเล็ก = ค่านี้ × รัศมีหลุม
DISK_BRIGHTNESS = 1.0           # ความสว่างของดิสก์รอบหลุมใหญ่ (ภาพแบบดิสก์พาดหน้า + โค้งบนล่าง)
DISK_SPARKS = 1600              # ตัวอักษรเรืองแสงที่โคจรอยู่ในดิสก์ตลอดเวลา (ทำให้ดิสก์ไม่นิ่ง)
DISK_SPIN = 1.8                 # ความเร็วโคจรของตัวอักษรในดิสก์ (วงในเร็วกว่าวงนอก)
DISK_LENS = 1.45               # ตัวอักษรด้านหลังหลุมถูกยกขึ้นเป็นโค้งเหนือหลุม ห่างจากกลางกี่เท่าของรัศมี
GM = 4.5e7                      # ค่าแรงโน้มถ่วง (พิกเซล³/วิ²)
GM_GROWTH = 1.5                 # กลืนครบแล้ว แรงดึงเพิ่มเป็น (1 + ค่านี้) เท่า
R_MIN = 22.0                    # ระยะต่ำสุดที่ใช้คิดแรง กันไม่ให้ตัวอักษรพุ่งแรงเกิน
MAX_SPEED = 2400.0
DRAG = 0.30                     # แรงหน่วง ทำให้วงโคจรหดเข้าเป็นเกลียว
TANGENTIAL = (0.5, 0.95)        # ความเร็วแนวสัมผัสตอนหลุด เทียบกับความเร็ววงโคจรวงกลม
RELEASE_SPAN = (0.3, 10.0)    # ตัวอักษรหลุดจากตาราง ตั้งแต่วินาทีที่เท่านี้ ถึงเท่านี้ของช่วง 3 (ใกล้ก่อนไกล)
HEAT_RANGE = 3.4                # ตัวอักษรเริ่มร้อน (เปลี่ยนสี) เมื่อเข้าใกล้หลุมไม่เกินกี่เท่าของรัศมี
DISK_TILT = 0.38                # ดิสก์เอียง: แกนตั้งถูกบีบเหลือเท่านี้
SPAGHETTI_SPEED = 650.0         # เร็วกว่านี้ ตัวอักษรยืดเป็นเส้นและมีหาง
TAIL_COUNT = 2                  # จำนวนเงาหางของตัวที่วิ่งเร็ว
SHAKE = 5.0                     # จอสั่นตอนใกล้จบช่วง 3 (พิกเซล)

# ช่วง 4: ยุบตัวและระเบิด
COLLAPSE_SECONDS = 1.2
DARK_SECONDS = 0.8
BLAST_SPEED = (220.0, 1500.0)
BLAST_DRAG = 1.1
BLAST_COOL = 2.2                # ตัวอักษรที่ระเบิดออกมาเย็นตัว (สีจาง) เร็วแค่ไหน (วินาที) ยิ่งมากยิ่งเรืองนาน
GALAXY_GATHER_DELAY = 2.5       # ต้นช่วง 5 ปล่อยให้ตัวอักษรลอยกระจายอีกกี่วินาทีก่อนเริ่มดูดเป็นกาแล็กซี
SHOCK_SPEED = 1150.0

# ช่วง 5: กาแล็กซี
GALAXY_ARMS = 3                 # จำนวนแขน (2-4 สวย)
GALAXY_RADIUS = 820.0           # รัศมีกาแล็กซี (พิกเซล แนวนอน)
GALAXY_TILT = 0.56              # กาแล็กซีเอียง: แกนตั้งถูกบีบเหลือเท่านี้
GALAXY_TURNS = 1.15             # แขนแต่ละเส้นวนกี่รอบ
GALAXY_SPIN = 0.22             # ความเร็วหมุนแกนกลาง (เรเดียน/วิ) วงนอกจะช้ากว่านี้
GALAXY_SPIN_RADIUS = 140.0      # ยิ่งค่านี้น้อย วงนอกยิ่งหมุนช้ากว่าวงใน
GALAXY_SPRING = 5.0             # แรงสปริงที่พาตัวอักษรไปที่แขน
GALAXY_SWIRL_TURNS = 0.9        # ตอนดูดเข้าเป็นกาแล็กซี หมุนวนกี่รอบก่อนเข้าที่ (0 = พุ่งเข้าตรง ๆ)
GALAXY_SWIRL_SECONDS = 7.0      # ใช้เวลาวนเข้าที่กี่วินาที
GALAXY_SWIRL_SPREAD = 0.7       # ตอนเริ่มวง เป้าอยู่ไกลกว่าตำแหน่งจริงกี่เท่า (วนจากวงนอกหดเข้ามา)
HOMING_SECONDS = 2.5            # ก่อนวนรอบ ใช้เวลาบินกลับเข้าตารางเท่านี้
BG_STARS = 650                 # ดาวพื้นหลังระยิบระยับ

# คลิกเมาส์
MINI_RADIUS = 12.0
MINI_GM = 2.6e6
MINI_CAPTURE = 150.0            # หลุมดำเล็กดึงตัวอักษรที่อยู่ห่างไม่เกินเท่านี้
MINI_LIFE = 2.6                 # ช่วง 1-2 หลุมเล็กอยู่ได้กี่วินาทีก่อนระเหย
SUPERNOVA_RADIUS = 170.0
SUPERNOVA_KICK = 900.0

GLOW_GAIN = 0.55                # ความแรงของแสงเรือง
COLORS = {
    "rain": [(0.10, 1.00, 0.35), (0.10, 0.95, 0.70), (0.20, 0.75, 1.00)],   # เขียว → ฟ้า
    "rain_head": [(0.75, 1.00, 0.85), (0.80, 0.95, 1.00)],
    "heat": [(0.85, 0.10, 0.04), (1.00, 0.42, 0.06), (1.00, 0.78, 0.32), (1.00, 1.00, 1.00)],
    "core": [(1.00, 0.98, 0.88), (1.00, 0.86, 0.55)],                      # แกนกาแล็กซี ขาวอมเหลือง
    # แขนกาแล็กซี: ฟ้าเขียว → ฟ้า → น้ำเงิน → ม่วง → บานเย็น → ชมพู (แต่ละตัวได้สีตามกลุ่มเมฆที่มันอยู่)
    "arms": [(0.15, 0.95, 0.85), (0.25, 0.70, 1.00), (0.32, 0.42, 1.00), (0.62, 0.35, 1.00), (0.95, 0.32, 0.85), (1.00, 0.45, 0.58)],
    "stars": [(0.85, 0.90, 1.00), (0.50, 0.95, 1.00), (1.00, 0.50, 0.80), (1.00, 0.70, 0.35), (1.00, 0.95, 0.70), (0.95, 0.95, 1.00)],
    # เมฆเนบิวลาพื้นหลังช่วงกาแล็กซี (สีพื้นกรมท่า + เมฆสามสี) ตั้งเป็น 0 ทั้งหมดถ้าอยากได้พื้นดำ
    "nebula_base": (0.020, 0.035, 0.11),
    "nebula": [(0.08, 0.75, 0.70), (0.85, 0.18, 0.60), (0.18, 0.25, 0.95)],
    "ring": (1.00, 0.86, 0.66),                                            # วงแหวนแสงรอบหลุมดำเล็ก
    "disk": [(1.00, 0.97, 0.90), (1.00, 0.82, 0.48), (1.00, 0.52, 0.18), (0.80, 0.20, 0.06)],  # ดิสก์หลุมใหญ่ ร้อน → เย็น
}

# ================================================================== ค่าที่คำนวณจาก CONFIG
W, H = RESOLUTION
CX, CY = W / 2, H / 2
COLS = W // CELL_W
ROWS = H // CELL_H
TOTAL_ROWS = ROWS + 2                 # เกินจอบนล่าง ให้ตอนตัวอักษรวนกลับขึ้นบนไม่เห็น
TOTAL_H = TOTAL_ROWS * CELL_H
X_MARGIN = (W - COLS * CELL_W) / 2

# สถานะของ particle แต่ละตัว
ATTACHED, FREE, SWALLOWED, HOMING, COLLAPSE, BLAST, GALAXY = range(7)
PHASE_NAMES = ["sea of code", "a black hole is born", "swallow", "collapse", "galaxy"]

NCH = 94                              # ตัวอักษร ASCII 33..126 (ไม่มีช่องว่าง)
NL = 12                               # ระดับความสว่างของ glyph ที่แคชไว้
LEVEL_B = ((np.arange(NL) + 1) / NL) ** 1.8
STREAK = np.array([ord(c) - 33 for c in "-\\|/"])   # ตัวอักษรยืดตามทิศ: แนวนอน, เฉียงลง, แนวตั้ง, เฉียงขึ้น


def gradient(stops, n):
    """ไล่สีผ่านจุดสีหลายจุด ได้ n สี"""
    stops = np.array(stops, np.float32)
    pos = np.linspace(0, len(stops) - 1, n)
    i = np.minimum(pos.astype(int), len(stops) - 2)
    f = (pos - i)[:, None]
    return stops[i] * (1 - f) + stops[i + 1] * f


# ตารางสีทั้งหมด ตัวอักษรแต่ละตัวเก็บแค่เลขลำดับสี (tone) แล้วแคชภาพตาม (ตัวอักษร, tone, ระดับความสว่าง)
_SEGMENTS = [("rain", 10), ("rain_head", 2), ("heat", 16), ("core", 6), ("arms", 12), ("stars", 6)]
PALETTE, SEG = [], {}
for _name, _n in _SEGMENTS:
    SEG[_name] = sum(len(p) for p in PALETTE)
    PALETTE.append(gradient(COLORS[_name], _n))
PALETTE = np.concatenate(PALETTE)
NT = len(PALETTE)
RAIN0, HEAD0, HEAT0, CORE0, ARM0, STAR0 = (SEG[k] for k in ("rain", "rain_head", "heat", "core", "arms", "stars"))


def smooth(x):
    """ค่อย ๆ เริ่ม ค่อย ๆ จบ (smoothstep) ใช้ได้ทั้งตัวเลขเดียวและ array"""
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def ease_out(x):
    return 1 - (1 - np.clip(x, 0.0, 1.0)) ** 3


# ================================================================== ตัวอักษรจากซอร์สโค้ด
def load_code_stream():
    """อ่านซอร์สโค้ดของไฟล์นี้และต้นคริสต์มาส เก็บเฉพาะตัวอักษร ASCII ที่มองเห็น (คอมเมนต์ภาษาไทยหลุดไปเอง)"""
    here = Path(__file__).resolve().parent
    text = ""
    for path in (here / "blackhole.py", here.parent / "ascii-xmas-tree" / "xmas_tree.py"):
        try:
            text += path.read_text(encoding="utf-8")
        except OSError:
            pass
    codes = np.frombuffer(text.encode("utf-8"), np.uint8)
    codes = codes[(codes >= 33) & (codes <= 126)].astype(np.int16) - 33
    if len(codes) < 1000:   # กันพลาดถ้าอ่านไฟล์ไม่ได้
        codes = np.frombuffer(b"def blackhole(): return swallow(code)" * 40, np.uint8).astype(np.int16) - 33
        codes = codes[codes >= 0]
    return codes


# ================================================================== ภาพที่เตรียมไว้ล่วงหน้า
def build_glyphs(font):
    """สร้างภาพตัวอักษรทุกตัว × ทุกสี × ทุกระดับความสว่าง ไว้ตั้งแต่เปิดโปรแกรม
    ระหว่างเล่นจะได้ไม่ต้อง render ฟอนต์อีกเลย (ประมาณ 54,000 ภาพเล็ก ใช้เวลาราวหนึ่งวินาที)"""
    gw, gh = font.size("M")
    masks = np.zeros((NCH, gw, gh), np.float32)
    for k in range(NCH):
        a = pygame.surfarray.array_alpha(font.render(chr(33 + k), True, (255, 255, 255)))
        w, h = min(a.shape[0], gw), min(a.shape[1], gh)
        masks[k, :w, :h] = a[:w, :h] / 255.0
    colors = (PALETTE[:, None, :] * LEVEL_B[None, :, None] * 255).astype(np.float32)   # (NT, NL, 3)
    glyphs = []
    make = pygame.surfarray.make_surface
    for k in range(NCH):
        arr = (masks[k][None, None, :, :, None] * colors[:, :, None, None, :]).astype(np.uint8)
        for tone in range(NT):
            for lvl in range(NL):
                glyphs.append(make(arr[tone, lvl]).convert())
    return glyphs, gw, gh


def make_ring_texture(size=256, rr=100.0):
    """วงแหวนแสงรอบหลุม: เส้นคมบาง ๆ บวกแสงฟุ้งด้านนอก (สร้างครั้งเดียว แล้วย่อขยายเอา)"""
    c = (size - 1) / 2
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.hypot(xx - c, yy - c)
    inside = d < rr
    sharp = np.exp(-((d - rr) / np.where(inside, 1.4, 2.4)) ** 2)
    halo = 0.35 * np.exp(-((d - rr) / np.where(inside, 3.0, 16.0)) ** 2)
    v = (sharp + halo)[..., None] * np.array(COLORS["ring"])
    return pygame.surfarray.make_surface((np.clip(v, 0, 1) * 255).astype(np.uint8)).convert()


DISK_TEX_R = 120          # รัศมีหลุมในภาพดิสก์ต้นฉบับ (พิกเซล) ตอนวาดจริงจะย่อขยายตามรัศมีหลุม


def make_disk_textures(seed=11):
    """ภาพหลุมดำแบบมีดิสก์ ดูจากด้านข้างเกือบขนานกับดิสก์ (สร้างครั้งเดียว)
    - ดิสก์บาง ๆ พาดผ่านหน้าหลุม ยาวออกไปซ้ายขวา
    - โค้งบน: ด้านหลังของดิสก์ที่แสงถูกความโน้มถ่วงบิดอ้อมขึ้นมาให้เห็น
    - โค้งล่าง: ใต้ดิสก์ที่แสงอ้อมลงมา (บางและจางกว่า)
    - วงแหวนแสงเส้นบางชิดขอบหลุม (แยกเป็นอีกภาพ จะได้ปรับความสว่างแยกกัน)
    หน่วยในสูตรคือ "เท่าของรัศมีหลุม" ฝั่งซ้ายสว่างกว่านิดหน่อยเพราะดิสก์หมุนเข้าหาเรา"""
    R = DISK_TEX_R
    tw, th = 10 * R, 6 * R
    xs = (np.arange(tw) - tw / 2 + 0.5) / R
    ys = (np.arange(th) - th / 2 + 0.5) / R
    u, v = np.meshgrid(xs, ys, indexing="ij")            # แกน x ก่อน ตามที่ pygame ใช้
    rho = np.hypot(u, v)
    rho_e = np.hypot(u / 1.12, v)                          # โค้งบนล่างแบนออกด้านข้างนิดหน่อย
    th_ang = np.arctan2(v, u)
    rng = np.random.default_rng(seed)

    # ริ้วตามแนววง: คลื่นหลายความถี่ซ้อนกัน แต่ละความถี่เลื่อนเฟสตามมุมไม่เท่ากัน
    streak = np.ones_like(u)
    for k in range(8):
        f, m, ph = rng.uniform(30, 110), rng.integers(1, 5), rng.uniform(0, 2 * np.pi)
        wob = rng.uniform(0.5, 2.0) * np.sin(th_ang * rng.integers(2, 6) + ph)   # ริ้วไม่กลมเป๊ะ
        streak += 0.035 * np.sin(rho_e * f + m * th_ang + wob)
    for k in range(4):   # เป็นปื้นสว่าง-มืดใหญ่ ๆ ไม่เรียบเท่ากันทั้งวง
        streak *= 1 + 0.16 * np.sin(th_ang * rng.integers(2, 7) + rng.uniform(0, 6.3)) * np.sin(rho_e * rng.uniform(4, 9) + rng.uniform(0, 6.3))
    band_streak = 1 + 0.15 * np.sin(u * 23.0) * np.sin(np.abs(u) * 6.3 + 1.3)

    dop = 1 + 0.35 * (-u / (rho + 0.5))                    # ด้านซ้ายพุ่งเข้าหาเรา สว่างกว่าชัด ๆ
    au = np.abs(u)
    thick = 0.022 + 0.03 * smooth((au - 1.0) / 0.8) * np.exp(-(au - 1.0) / 2.0)   # หน้าหลุมบางเฉียบ ข้าง ๆ หนาขึ้นนิดหน่อย
    thick = thick + 0.05 * np.exp(-((au - 2.1) / 0.9) ** 2)       # ตรงที่โค้งบนล่างมาบรรจบ แถบหนาขึ้นนุ่ม ๆ ให้รอยต่อกลืนกัน
    band = np.exp(-(v / thick) ** 2) * np.where(au < 1.7, 1.0, np.exp(-(au - 1.7) / 1.4)) * band_streak
    glow_band = 0.3 * np.exp(-(v / 0.12) ** 2) * np.exp(-np.maximum(au - 1.2, 0) / 2.0) * smooth((au - 0.9) / 0.3)
    # ขอบนอกของโค้งบานออกเป็นไหล่โค้งเว้าเมื่อเข้าใกล้แถบดิสก์ แล้วไหลลงไปรวมกับแถบ (ไม่ถูกตัดเป็นเส้นตรง)
    flare_up = 1.2 * np.exp(-np.maximum(-v, 0) / 0.30)
    upper = (smooth((rho_e - 1.30) / 0.22) * (1 - smooth((rho_e - 2.2 - flare_up) / (0.6 + 0.5 * flare_up)))
             * (0.55 + 0.45 * np.exp(-(rho_e - 1.34) / 0.45)) * np.exp(-np.maximum(rho_e - 2.3, 0) / 0.9)
             * smooth((0.10 - v) / 0.32))
    flare_lo = 0.55 * np.exp(-np.maximum(v, 0) / 0.22)
    lower = (0.42 * smooth((rho_e - 1.12) / 0.10) * (1 - smooth((rho_e - 1.42 - flare_lo) / (0.22 + 0.4 * flare_lo)))
             * (0.6 + 0.4 * np.exp(-(rho_e - 1.13) / 0.2)) * np.exp(-np.maximum(rho_e - 1.5, 0) / 0.6)
             * smooth((v + 0.08) / 0.3))
    edge = smooth((3.0 - np.abs(v)) / 1.0) * smooth((5.0 - au) / 1.2)   # จางหมดก่อนถึงขอบภาพ ไม่เห็นเป็นสี่เหลี่ยม
    halo = (0.12 * np.exp(-(rho / 1.9) ** 2) + 0.12 * np.exp(-((rho_e - 1.7) / 0.6) ** 2)) * edge
    shadow = rho < 1.0
    lit = (1.2 * band + glow_band + (upper + lower) * streak) * dop * edge
    lit = np.where(shadow, 1.3 * band, lit)               # ในหลุมดำเห็นแค่ดิสก์ด้านหน้าเป็นเส้นบางพาดผ่าน
    halo = np.where(shadow, 0.0, halo)

    # สีตามความร้อน: ใกล้หลุมขาวร้อน → ทอง → ส้ม → แดงเข้มที่ปลาย ฝั่งที่พุ่งเข้าหาเรา (ซ้าย) ขาวกว่า
    temp = np.clip((rho_e - 1.2) / 2.4 + 0.18 * u / (rho + 0.5) + 0.3 * smooth(v / 0.4), 0, 1)   # โค้งล่างอุ่นกว่า
    heat_stops = np.array(COLORS["disk"], np.float32)
    pos = temp * (len(heat_stops) - 1)
    i0 = np.minimum(pos.astype(int), len(heat_stops) - 2)
    f = (pos - i0)[..., None]
    col_disk = heat_stops[i0] * (1 - f) + heat_stops[i0 + 1] * f
    light = lit[..., None] * col_disk + halo[..., None] * np.array([1.0, 0.55, 0.25])
    light = 1 - np.exp(-1.35 * light)                                  # สว่างมากแล้วค่อย ๆ อิ่มเป็นสีขาว ไม่แตก
    disk = pygame.surfarray.make_surface((light * 255).astype(np.uint8)).convert()
    # แสงฟุ้ง (bloom): เบลอด้วยการย่อแล้วขยายกลับ บวกเข้าไปสองขนาด ให้เรืองนุ่ม ๆ รอบดิสก์
    size = disk.get_size()
    for div, gain in ((10, 75), (28, 50)):
        blur = pygame.transform.smoothscale(disk, (size[0] // div, size[1] // div))
        blur = pygame.transform.smoothscale(blur, size)
        blur.fill((gain, gain, gain), special_flags=pygame.BLEND_RGB_MULT)
        disk.blit(blur, (0, 0), special_flags=pygame.BLEND_RGB_ADD)

    ring = 0.95 * np.exp(-((rho - 1.04) / 0.016) ** 2) + 0.3 * np.exp(-((rho - 1.04) / 0.06) ** 2)
    ring = np.where(rho < 0.98, ring * 0.3, ring)
    ring_rgb = 1 - np.exp(-1.6 * ring[..., None] * np.array([1.0, 0.96, 0.9]))
    ring_s = pygame.surfarray.make_surface((ring_rgb * 255).astype(np.uint8)).convert()
    return disk, ring_s


def make_nebula(w, h, seed=5):
    """เมฆเนบิวลาเรืองจาง ๆ สำหรับพื้นหลังช่วงกาแล็กซี ขนาดเท่าบัฟเฟอร์แสงเรือง (แกน x ก่อน)
    ทำ noise จากตารางสุ่มเล็ก ๆ ขยายให้นุ่ม ซ้อนหลายขนาด แล้วตัดส่วนจางทิ้งให้เป็นก้อนเมฆ"""
    rng = np.random.default_rng(seed)

    def noise(cells):
        small = (rng.random((cells, max(2, cells * h // w))) * 255).astype(np.uint8)
        s = pygame.surfarray.make_surface(np.repeat(small[..., None], 3, 2))
        return pygame.surfarray.array3d(pygame.transform.smoothscale(s, (w, h)))[..., 0] / 255.0

    out = np.zeros((w, h, 3), np.float32) + np.array(COLORS["nebula_base"], np.float32)
    for color in COLORS["nebula"]:
        n = 0.55 * noise(5) + 0.3 * noise(11) + 0.15 * noise(23)
        cloud = np.clip((n - 0.47) / 0.35, 0, 1) ** 1.7
        out += cloud[..., None] * np.array(color, np.float32) * 0.55
    return out


def make_flash_texture(w, h):
    """แสงวาบตอนระเบิด: สว่างกลางจอ จางออกไปรอบ ๆ"""
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (w / 2))
    v = np.exp(-(d / 0.35) ** 2) + 0.25 * np.exp(-(d / 1.0) ** 2)
    arr = (np.clip(v, 0, 1) * 255).astype(np.uint8).T
    return pygame.surfarray.make_surface(np.repeat(arr[..., None], 3, 2)).convert()


# ================================================================== หลุมดำเล็กจากการคลิก
class Mini:
    """หลุมดำเล็กที่เกิดจากการคลิก ช่วง 1-2 อยู่สักพักแล้วระเหย ช่วง 3 ถูกดึงไปรวมกับหลุมใหญ่"""
    _next_id = 1

    def __init__(self, x, y, vx=0.0, vy=0.0):
        self.id = Mini._next_id
        Mini._next_id += 1
        self.x, self.y, self.vx, self.vy = x, y, vx, vy
        self.age = 0.0
        self.count = 0

    def radius(self):
        r = MINI_RADIUS * float(smooth(self.age / 0.4)) + 1.1 * math.sqrt(self.count)
        return r

    def gm(self):
        return MINI_GM * (1 + self.count / 150)


# ================================================================== ตัวจำลองทั้งเรื่อง
class Sim:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        rng = self.rng
        self.stream = load_code_stream()
        L = len(self.stream)

        # ตาราง: ทุกช่องคือ particle หนึ่งตัว
        cc, rr = np.meshgrid(np.arange(COLS), np.arange(TOTAL_ROWS))
        self.hcol = cc.ravel().astype(np.int32)
        self.hrow = rr.ravel().astype(np.int32)
        n = self.n = len(self.hcol)
        self.rank = rng.permutation(n)                   # ลำดับการตัดทิ้งเมื่อต้องลดจำนวน (สุ่มทั่วจอ)
        self.n_active = min(n, MAX_PARTICLES)

        # คอลัมน์
        self.col_speed = rng.uniform(*RAIN_SPEED, COLS)
        self.head_speed = rng.uniform(*HEAD_SPEED, COLS)
        self.head_period = TOTAL_H * rng.uniform(1.0, 1.9, COLS)
        self.col_tone = rng.integers(0, 10, COLS)
        self.col_off = rng.integers(0, L, COLS)
        self.base_b = rng.uniform(*RAIN_BASE, n)
        self.tone = (RAIN0 + self.col_tone[self.hcol]).astype(np.int32)

        # เป้าหมายบนกาแล็กซี (สุ่มครั้งเดียว)
        self.build_galaxy()
        # ดาวพื้นหลัง
        self.star_x = rng.uniform(0, W, BG_STARS)
        self.star_y = rng.uniform(0, H, BG_STARS)
        self.star_ch = rng.choice(np.array([ord(c) - 33 for c in ".'+*:"]), BG_STARS, p=[0.5, 0.15, 0.2, 0.08, 0.07])
        self.star_b = rng.uniform(0.15, 0.75, BG_STARS) ** 1.5
        self.star_phase = rng.uniform(0, 2 * np.pi, BG_STARS)
        self.star_speed = rng.uniform(0.8, 3.5, BG_STARS)
        self.star_tone = STAR0 + rng.choice(6, BG_STARS, p=[0.35, 0.15, 0.12, 0.1, 0.1, 0.18])
        bright = rng.random(BG_STARS) < 0.08                     # ดาวดวงใหญ่ไม่กี่ดวง มีแสงฟุ้งรอบตัว
        self.star_b = np.where(bright, rng.uniform(0.8, 1.0, BG_STARS), self.star_b)
        self.star_gw = np.where(bright, 1.4, 0.3)
        # ตัวอักษรที่โคจรในดิสก์รอบหลุมใหญ่ (หน่วยรัศมี = เท่าของรัศมีหลุม จึงโตตามหลุมเอง)
        self.sp_rho = 1.28 + 1.15 * rng.random(DISK_SPARKS) ** 1.6
        self.sp_th = rng.uniform(0, 2 * np.pi, DISK_SPARKS)
        self.sp_w = DISK_SPIN * self.sp_rho ** -1.5
        self.sp_ch = self.stream[rng.integers(0, L, DISK_SPARKS)]
        self.sp_b = rng.uniform(0.3, 1.0, DISK_SPARKS) ** 1.3

        self.reset()

    def build_galaxy(self):
        rng, n = self.rng, self.n
        kind = rng.choice(3, n, p=[0.15, 0.60, 0.25])     # 0 แกนกลาง, 1 แขน, 2 ฝุ่น
        r = np.zeros(n)
        th = rng.uniform(0, 2 * np.pi, n)
        b = np.zeros(n)
        tone = np.zeros(n, np.int32)
        a = 38.0
        th_max = GALAXY_TURNS * 2 * np.pi
        k_sp = math.log(GALAXY_RADIUS / a) / th_max      # r = a·e^(kθ)

        core = kind == 0
        nc = core.sum()
        r[core] = np.abs(rng.normal(0, 55, nc)) + 2
        b[core] = rng.uniform(0.5, 0.9, nc)
        tone[core] = CORE0 + np.clip((r[core] / 30).astype(int), 0, 5)

        arm = kind == 1
        na = arm.sum()
        u = rng.random(na) ** 0.8
        th_arm = u * th_max
        r[arm] = a * np.exp(k_sp * th_arm) * np.exp(rng.normal(0, 0.07, na))
        th[arm] = th_arm + 2 * np.pi * rng.integers(0, GALAXY_ARMS, na) / GALAXY_ARMS + rng.normal(0, 0.06 + 0.04 * u)
        b[arm] = rng.uniform(0.45, 0.95, na) * (1 - 0.35 * u)
        tone[arm] = ARM0 + np.clip((u * 7 + rng.uniform(0, 5, na)).astype(int), 0, 11)   # วงในฟ้า วงนอกม่วง

        dust = kind == 2
        nd = dust.sum()
        r[dust] = 30 + (GALAXY_RADIUS * 1.05 - 30) * rng.random(nd) ** 0.75
        b[dust] = rng.uniform(0.10, 0.26, nd)
        tone[dust] = ARM0 + rng.integers(0, 12, nd)

        # สีแขนกับฝุ่นเป็นหย่อม ๆ ตามตำแหน่ง (คลื่นหลายทิศซ้อนกัน) แทนไล่ตามระยะ พอหมุนแล้วหย่อมสีจะยืดเป็นริ้วตามแขน
        gx, gy = r * np.cos(th) / 260, r * np.sin(th) / 260
        field = np.zeros(n)
        for _ in range(4):
            a, ph = rng.uniform(0, np.pi), rng.uniform(0, 2 * np.pi)
            f = rng.uniform(0.7, 2.2)
            field += np.sin((gx * np.cos(a) + gy * np.sin(a)) * f * 2 * np.pi + ph)
        field = np.clip(0.5 + field / 5 + rng.normal(0, 0.08, n), 0, 0.999)
        colorful = kind != 0
        tone[colorful] = ARM0 + (field[colorful] * 12).astype(int)

        self.gal_kind, self.gal_r, self.gal_th0, self.gal_b, self.gal_tone = kind, r, th, b, tone
        self.gal_omega = GALAXY_SPIN / (1 + r / GALAXY_SPIN_RADIUS)
        self.gal_twinkle = np.where(rng.random(n) < 0.3, rng.uniform(1.5, 4.0, n), 0.0)
        self.gal_tw_phase = rng.uniform(0, 2 * np.pi, n)

    def reset(self):
        n = self.n
        self.state = np.full(n, ATTACHED, np.int8)
        self.owner = np.zeros(n, np.int32)           # 0 = หลุมใหญ่, อื่น ๆ = id ของหลุมเล็ก
        self.pos = np.zeros((n, 2))
        self.vel = np.zeros((n, 2))
        self.age = np.zeros(n)                        # เวลาตั้งแต่หลุดจากตาราง
        self.tilt_age = np.zeros(n)                   # เวลาที่อยู่ในดิสก์ (ใช้ค่อย ๆ เอียง)
        self.b0 = np.zeros(n)                         # ความสว่างตอนเพิ่งหลุด
        self.release_at = np.full(n, np.inf)
        self.home_p0 = np.zeros((n, 2))               # จุดเริ่มตอนบินกลับตาราง (และจุดเริ่มตอนยุบตัว)
        self.home_t0 = np.zeros(n)
        self.home_dur = np.ones(n)
        self.home_b = np.zeros(n)
        self.home_tone = self.tone.copy()             # สีตอนเริ่มบินกลับ (ค่อย ๆ เปลี่ยนเป็นสีทะเลโค้ดระหว่างทาง)
        self.curve = self.rng.uniform(-0.22, 0.22, n)
        self.gal_switch = np.zeros(n)
        self.boost = np.zeros(n)                      # สว่างพิเศษจากซูเปอร์โนวา
        self.lap = np.zeros(n, np.int64)
        self.ch = self.stream[(self.col_off[self.hcol] + self.hrow) % len(self.stream)].astype(np.int32)

        self.scroll = self.rng.uniform(0, TOTAL_H, COLS)
        self.head_y = self.rng.uniform(0, TOTAL_H * 2, COLS)
        self.phase, self.tp, self.t = 0, 0.0, 0.0
        self.rain = 1.0
        self.R_target = self.R = 0.0
        self.R_collapse = HOLE_BIRTH_RADIUS
        self.minis = []
        self.rings = []
        self.glitches = []
        self.next_glitch = 1.0
        self.blast_done = False
        self.blast_t = -99.0
        self.flash_t = -99.0
        self.gal_time = 0.0
        self.loop = LOOP
        self.swallowed = 0
        self.events = []                              # ข้อความที่อยากให้ main แสดง

    # ------------------------------------------------------------ ตำแหน่งในตาราง
    def grid_xy(self, idx):
        c = self.hcol[idx]
        yy = self.hrow[idx] * CELL_H + self.scroll[c]
        lap = np.floor(yy / TOTAL_H).astype(np.int64)
        x = X_MARGIN + c * CELL_W + CELL_W / 2
        y = yy - lap * TOTAL_H - CELL_H / 2
        return x.astype(np.float64), y, lap

    def lens(self, x, y):
        """เลนส์ความโน้มถ่วงแบบจุด: r' = (r + √(r² + 4E²)) / 2 แล้วบิดมุมเพิ่มตาม E/r
        ตัวอักษรถูกดันออกไปนอกวงแหวนไอน์สไตน์ (E) เสมอ จึงไม่มีตัวไหนอยู่ในขอบฟ้าเหตุการณ์"""
        E = LENS_FACTOR * self.R
        dx, dy = x - CX, y - CY
        r = np.hypot(dx, dy) + 1e-6
        r2 = (r + np.sqrt(r * r + 4 * E * E)) / 2
        ang = np.arctan2(dy, dx) + LENS_TWIST * (E / (r + 0.5 * E)) ** 2
        boost = 1 + 1.1 * np.exp(-(r2 - E) / (0.35 * E + 1))     # ตรงวงแหวนไอน์สไตน์ภาพถูกขยาย เลยสว่างกว่า
        return CX + r2 * np.cos(ang), CY + r2 * np.sin(ang), boost

    def attached_draw_xy(self, idx):
        x, y, _ = self.grid_xy(idx)
        if self.R > 0.5 and self.phase in (1, 2):
            x, y, _ = self.lens(x, y)
        return x, y

    def disk_squash(self, idx):
        return 1 - (1 - DISK_TILT) * smooth(self.tilt_age[idx] / 2.2)

    def gm_main(self):
        return GM * (1 + GM_GROWTH * self.swallowed / self.n)

    # ------------------------------------------------------------ เปลี่ยนช่วง
    def enter_phase(self, k):
        st = self.state
        self.phase, self.tp = k, 0.0
        self.events.append(f"phase {k + 1}: {PHASE_NAMES[k]}")
        if k == 0:
            # วนรอบใหม่ ใครยังไม่กลับเข้าตารางให้บินกลับ (กรณีกด Space ข้ามมา)
            m = ~np.isin(st, (ATTACHED, HOMING)) & ~((st == FREE) & (self.owner > 0))
            m &= ~((st == SWALLOWED) & (self.owner > 0))
            self.start_homing(np.nonzero(m)[0], HOMING_SECONDS)
            self.blast_done = False
            self.R_target = 0.0
        elif k == 2:
            # ตั้งเวลาให้ตัวอักษรหลุดจากตาราง ใกล้หลุมก่อน ไกลทีหลัง
            x, y, _ = self.grid_xy(np.arange(self.n))
            d = np.hypot(x - CX, y - CY) / math.hypot(CX, CY)
            a, b = RELEASE_SPAN
            self.release_at = a + (b - a) * d ** 0.85 + self.rng.uniform(0, 0.6, self.n)
            self.R = max(self.R, HOLE_BIRTH_RADIUS * 0.9)
        elif k == 3:
            for m in list(self.minis):
                self.merge_mini(m)
            # ที่เหลืออยู่นอกหลุมทั้งหมด ถูกดูดเข้าแบบเกลียวภายใน COLLAPSE_SECONDS
            idx = np.nonzero(st != SWALLOWED)[0]
            self.home_p0[idx] = self.draw_xy_of(idx)
            st[idx] = COLLAPSE
            self.R_collapse = self.R
        elif k == 4:
            if not self.blast_done:
                self.blast()
            idx = np.arange(self.n)
            st[idx] = GALAXY
            self.gal_switch = self.t + GALAXY_GATHER_DELAY + self.rng.uniform(0.2, 2.2, self.n)
            self.gal_time = 0.0
            self.minis.clear()

    def draw_xy_of(self, idx):
        """ตำแหน่งที่วาดอยู่บนจอตอนนี้ (ใช้ตอนเปลี่ยนสถานะ ให้ภาพต่อกันไม่กระโดด)"""
        out = self.pos[idx].copy()
        st = self.state[idx]
        att = st == ATTACHED
        if att.any():
            x, y = self.attached_draw_xy(idx[att])
            out[att, 0], out[att, 1] = x, y
        fr = st == FREE
        if fr.any() and self.phase >= 2:
            j = idx[fr]
            out[fr, 1] = CY + (self.pos[j, 1] - CY) * self.disk_squash(j)
        return out

    def start_homing(self, idx, dur, b=None):
        if len(idx) == 0:
            return
        self.home_p0[idx] = self.draw_xy_of(idx) if b is None else self.pos[idx]
        self.state[idx] = HOMING
        self.home_t0[idx] = self.t
        self.home_dur[idx] = dur
        self.home_b[idx] = 0.7 if b is None else b
        self.home_tone[idx] = self.tone[idx]
        self.owner[idx] = 0

    def blast(self):
        """ระเบิด: ทุกตัวพุ่งออกจากกลางจอด้วยความเร็วสุ่ม"""
        n, rng = self.n, self.rng
        ang = rng.uniform(0, 2 * np.pi, n)
        lo, hi = BLAST_SPEED
        speed = lo + (hi - lo) * rng.random(n) ** 1.6
        self.pos[:, 0] = CX + rng.normal(0, 4, n)
        self.pos[:, 1] = CY + rng.normal(0, 4, n)
        self.vel[:, 0] = np.cos(ang) * speed
        self.vel[:, 1] = np.sin(ang) * speed * 0.8
        self.state[:] = BLAST
        self.owner[:] = 0
        self.blast_done = True
        self.blast_t = self.flash_t = self.t
        self.R = self.R_target = 0.0
        self.minis.clear()
        self.add_ring(CX, CY, SHOCK_SPEED, 1.8, 460)

    def add_ring(self, x, y, speed, life, n):
        k = self.rng.integers(0, len(self.stream))
        chars = self.stream[(k + np.arange(n)) % len(self.stream)]
        self.rings.append(dict(x=x, y=y, t0=self.t, speed=speed, life=life,
                               ang=np.linspace(0, 2 * np.pi, n, endpoint=False), ch=chars))

    # ------------------------------------------------------------ คลิกเมาส์
    def click(self, x, y):
        ph = self.phase
        if ph in (0, 1, 2):
            vx = vy = 0.0
            if ph == 2:   # ช่วงดูดกลืน หลุมเล็กโคจรเข้าหาหลุมใหญ่
                dx, dy = x - CX, y - CY
                r = math.hypot(dx, dy) + 1
                v = 0.55 * math.sqrt(self.gm_main() / max(r, R_MIN))
                vx, vy = dy / r * v, -dx / r * v
            self.minis.append(Mini(x, y, vx, vy))
        elif ph == 4:
            self.supernova(x, y)

    def supernova(self, x, y):
        idx = np.nonzero(self.state == GALAXY)[0]
        d = self.pos[idx] - (x, y)
        r = np.hypot(d[:, 0], d[:, 1])
        hit = r < SUPERNOVA_RADIUS
        j, d, r = idx[hit], d[hit], r[hit]
        kick = SUPERNOVA_KICK * np.sqrt(1 - r / SUPERNOVA_RADIUS) * self.rng.uniform(0.6, 1.2, len(j))
        self.vel[j] += d / (r[:, None] + 1) * kick[:, None]
        self.boost[j] = np.maximum(self.boost[j], 1 - r / SUPERNOVA_RADIUS)
        self.add_ring(x, y, 420, 0.9, 110)

    def merge_mini(self, m):
        own = self.owner == m.id
        self.owner[own] = 0
        self.minis.remove(m)

    def evaporate_mini(self, m):
        own = np.nonzero(self.owner == m.id)[0]
        sw = own[self.state[own] == SWALLOWED]
        self.pos[sw] = (m.x, m.y) + self.rng.normal(0, 5, (len(sw), 2))
        self.start_homing(own, 1.6, b=0.85)
        self.add_ring(m.x, m.y, 300, 0.6, 60)
        self.minis.remove(m)

    # ------------------------------------------------------------ เดินฟิสิกส์หนึ่งก้าว
    def step(self, dt):
        self.t += dt
        self.tp += dt
        ph = self.phase
        dur = PHASE_SECONDS[ph]
        if self.tp >= dur and (ph != 4 or self.loop):
            self.enter_phase((ph + 1) % 5)
            ph = self.phase
            dur = PHASE_SECONDS[ph]
        tp, st = self.tp, self.state

        # ฝนโค้ด: ช่วง 2 ค่อย ๆ ช้าลง ช่วงอื่นเร็วปกติ
        target = 1.0 if ph == 0 else 1 - 0.8 * float(smooth(tp / dur)) if ph == 1 else 0.2
        self.rain += (target - self.rain) * (1 - math.exp(-dt / 0.6))
        self.scroll += self.col_speed * self.rain * dt
        self.head_y += self.head_speed * self.rain * dt
        if ph in (0, 1) and self.t >= self.next_glitch:
            y0 = self.rng.uniform(0, H)
            self.glitches.append((y0, y0 + self.rng.uniform(1, 5) * CELL_H,
                                  self.rng.choice([-1, 1]) * self.rng.uniform(12, 70),
                                  self.t + self.rng.uniform(0.07, 0.22), int(self.rng.integers(1 << 30))))
            self.next_glitch = self.t + self.rng.uniform(*GLITCH_EVERY) * (1 if ph == 0 else 2.5)
        self.glitches = [g for g in self.glitches if g[3] > self.t]

        # รัศมีหลุมใหญ่
        self.swallowed = int(np.count_nonzero((st == SWALLOWED) & (self.owner == 0)))
        if ph == 1:
            self.R_target = HOLE_BIRTH_RADIUS * (0.04 + 0.96 * float(smooth((tp - 0.2) / (dur - 0.5)))) if tp > 0.2 else 0.0
        elif ph == 2:
            self.R_target = HOLE_BIRTH_RADIUS + (HOLE_MAX_RADIUS - HOLE_BIRTH_RADIUS) * math.sqrt(self.swallowed / self.n)
        elif ph == 3:
            u = tp / COLLAPSE_SECONDS
            self.R_target = self.R_collapse * (1 - float(smooth(u))) + 2.0 * min(u, 1) if tp < COLLAPSE_SECONDS + DARK_SECONDS else 0.0
        elif ph in (0, 4):
            self.R_target = 0.0
        if ph == 3:
            self.R = self.R_target
        else:
            self.R += (self.R_target - self.R) * (1 - math.exp(-dt / 0.25))

        if ph == 3 and not self.blast_done and tp >= COLLAPSE_SECONDS + DARK_SECONDS:
            self.blast()

        self.step_minis(dt)

        # ช่วง 3: ถึงเวลาแล้วก็หลุดจากตาราง
        if ph == 2:
            rel = np.nonzero((st == ATTACHED) & (self.release_at <= tp))[0]
            if len(rel):
                self.release(rel, CX, CY, self.gm_main(), TANGENTIAL, owner=0)

        self.step_free(dt)
        self.step_homing()
        if ph == 3:
            self.step_collapse()
        self.step_blast_galaxy(dt)
        self.boost *= math.exp(-dt * 1.8)
        self.sp_th += self.sp_w * dt

    def star_vis(self):
        """ดาวพื้นหลังกับเมฆเนบิวลา: ค่อย ๆ ปรากฏตอนกาแล็กซีเริ่มก่อตัว จางไปตอนบินกลับเข้าตาราง"""
        if self.phase != 4:
            return 0.0
        vis = float(smooth((self.tp - GALAXY_GATHER_DELAY) / 4))
        if self.loop:
            vis *= 1 - float(smooth((self.tp - (PHASE_SECONDS[4] - HOMING_SECONDS)) / HOMING_SECONDS))
        return vis

    def growth(self, full_at):
        """หลุมโตเต็มที่แค่ไหน 0..1 ตามสัดส่วนตัวอักษรที่กลืนไปแล้ว (เต็มเมื่อกลืนได้ full_at ของทั้งหมด)
        ช่วงหลุมเกิดยังไม่ได้กลืนอะไร = 0, ตอนยุบตัว = 1"""
        if self.phase == 2:
            return float(smooth(self.swallowed / self.n / full_at))
        return 1.0 if self.phase == 3 else 0.0

    def ring_alpha(self):
        """วงแหวนแสง: ตอนเกิดจางมาก แล้วสว่างขึ้นตามที่กลืน"""
        if self.phase == 1:
            return 0.12 * float(smooth(self.R / HOLE_BIRTH_RADIUS))
        if self.phase == 2:
            return 0.12 + 0.88 * self.growth(0.35)
        return min(1.0, self.R / 12)

    def disk_alpha(self):
        """ดิสก์รอบหลุมใหญ่สว่างแค่ไหน: ตอนเกิดยังไม่มี ช่วงดูดกลืนค่อย ๆ ปรากฏตามจำนวนที่กลืน ตอนยุบตัวหรี่ลง"""
        ph, tp = self.phase, self.tp
        if ph == 1:
            a = 0.0
        elif ph == 2:
            falling = np.count_nonzero(self.state == FREE)
            a = self.growth(0.6) * (0.72 + 0.13 * min(1.0, falling / 1200))
        elif ph == 3:
            a = 0.7 * self.R / max(self.R_collapse, 1) if tp < COLLAPSE_SECONDS else 0.0
        else:
            a = 0.0
        return min(1.0, a * DISK_BRIGHTNESS)

    def release(self, idx, hx, hy, gm, tang, owner):
        x, y = self.attached_draw_xy(idx)
        b, _, _ = self.rain_look(idx, self.grid_xy(idx)[1])
        dx, dy = x - hx, y - hy
        r = np.hypot(dx, dy) + 1e-6
        v = np.sqrt(gm / np.maximum(r, R_MIN)) * self.rng.uniform(*tang, len(idx))
        self.pos[idx, 0], self.pos[idx, 1] = x, y
        self.vel[idx, 0] = dy / r * v - dx / r * v * 0.1     # หมุนทวนเข็ม และมีแรงเข้าศูนย์กลางนิดหน่อย
        self.vel[idx, 1] = -dx / r * v - dy / r * v * 0.1
        self.state[idx] = FREE
        self.owner[idx] = owner
        self.age[idx] = 0.0
        self.tilt_age[idx] = 0.0
        self.b0[idx] = np.clip(b, 0, 1)

    def step_minis(self, dt):
        ph = self.phase
        for m in list(self.minis):
            m.age += dt
            if ph in (0, 1) and m.age > MINI_LIFE:
                self.evaporate_mini(m)
                continue
            if ph == 2:
                dx, dy = CX - m.x, CY - m.y
                r = math.hypot(dx, dy) + 1e-6
                a = self.gm_main() / max(r, R_MIN) ** 2
                m.vx = (m.vx + dx / r * a * dt) * math.exp(-0.5 * dt)
                m.vy = (m.vy + dy / r * a * dt) * math.exp(-0.5 * dt)
                m.x += m.vx * dt
                m.y += m.vy * dt
                if r < self.R + m.radius():
                    self.merge_mini(m)
                    continue
            # ดึงตัวอักษรในตารางที่อยู่ใกล้ ๆ ให้หลุดออกมา
            if ph in (0, 1, 2) and (ph == 2 or m.age < MINI_LIFE - 0.7):
                att = np.nonzero(self.state == ATTACHED)[0]
                x, y = self.attached_draw_xy(att)
                near = np.hypot(x - m.x, y - m.y) < MINI_CAPTURE * min(1.0, 0.3 + m.age / 1.0)
                if near.any():
                    self.release(att[near], m.x, m.y, m.gm(), (0.35, 0.8), owner=m.id)

    def step_free(self, dt):
        idx = np.nonzero(self.state == FREE)[0]
        if len(idx) == 0:
            return
        ph = self.phase
        p, v = self.pos[idx], self.vel[idx]
        acc = np.zeros_like(p)
        drag = 0.9
        if ph == 2:
            d = (CX, CY) - p
            r = np.hypot(d[:, 0], d[:, 1]) + 1e-6
            rc = np.maximum(r, R_MIN)
            acc += d * (self.gm_main() / (r * rc * rc))[:, None]
            # ใกล้จบช่วง แรงหน่วงเพิ่มขึ้นเพื่อให้กลืนหมดทันเวลา
            drag = DRAG * (1 + 3.0 * float(smooth((self.tp - (PHASE_SECONDS[2] - 9)) / 8)))
            swallow_main = r < self.R * 0.85
        hole_hits = []
        for m in self.minis:
            d = (m.x, m.y) - p
            r = np.hypot(d[:, 0], d[:, 1]) + 1e-6
            rc = np.maximum(r, R_MIN * 0.5)
            acc += d * (m.gm() / (r * rc * rc))[:, None]
            hole_hits.append((m, r < m.radius() * 0.9))
        v = (v + acc * dt) * math.exp(-drag * dt)
        spd = np.hypot(v[:, 0], v[:, 1])
        v *= np.minimum(1, MAX_SPEED / (spd + 1e-6))[:, None]
        p = p + v * dt
        self.pos[idx], self.vel[idx] = p, v
        self.age[idx] += dt
        if ph == 2:
            self.tilt_age[idx] += dt
            sw = idx[swallow_main]
            self.state[sw] = SWALLOWED
            self.owner[sw] = 0
        for m, hit in hole_hits:
            j = idx[hit & (self.state[idx] == FREE)]
            self.state[j] = SWALLOWED
            self.owner[j] = m.id
            m.count += len(j)

    def step_homing(self):
        idx = np.nonzero(self.state == HOMING)[0]
        if len(idx) == 0:
            return
        u = np.clip((self.t - self.home_t0[idx]) / self.home_dur[idx], 0, 1)
        e = u * u * u * (u * (6 * u - 15) + 10)          # smootherstep ออกตัวนุ่มและเบรกนุ่ม
        tx, ty, _ = self.grid_xy(idx)
        p0 = self.home_p0[idx]
        ty = ty + np.round((p0[:, 1] - ty) / TOTAL_H) * TOTAL_H   # ตารางวนรอบ เลือกตำแหน่งเป้าที่ใกล้สุด
        dx, dy = tx - p0[:, 0], ty - p0[:, 1]
        arc = self.curve[idx] * np.sin(np.pi * u)          # บินเป็นเส้นโค้งนิด ๆ ไม่ใช่เส้นตรง
        self.pos[idx, 0] = p0[:, 0] + dx * e - dy * arc
        self.pos[idx, 1] = p0[:, 1] + dy * e + dx * arc
        done = idx[u >= 1]
        self.state[done] = ATTACHED

    def step_collapse(self):
        idx = np.nonzero(self.state == COLLAPSE)[0]
        if len(idx) == 0:
            return
        u = min(self.tp / COLLAPSE_SECONDS, 1.0)
        k = (1 - u) ** 2
        a = u * 2.4
        d = self.home_p0[idx] - (CX, CY)
        c, s = math.cos(a), math.sin(a)
        self.pos[idx, 0] = CX + (d[:, 0] * c + d[:, 1] * s) * k
        self.pos[idx, 1] = CY + (-d[:, 0] * s + d[:, 1] * c) * k
        if u >= 1:
            self.state[idx] = SWALLOWED
            self.owner[idx] = 0

    def step_blast_galaxy(self, dt):
        st = self.state
        idx = np.nonzero(st == BLAST)[0]
        if len(idx):
            self.vel[idx] *= math.exp(-BLAST_DRAG * dt)
            self.pos[idx] += self.vel[idx] * dt
        if self.phase != 4:
            return
        self.gal_time += dt
        idx = np.nonzero(st == GALAXY)[0]
        if len(idx) == self.n:
            idx = slice(None)   # ทุกตัวอยู่ในกาแล็กซี ใช้ทั้ง array เลย เร็วกว่าเลือกทีละตัว
        if len(self.gal_r[idx]):
            # สปริงพาไปหาเป้าบนแขนกาแล็กซี เป้าหมุนรอบกลาง วงในเร็วกว่าวงนอก
            tg = self.tp - GALAXY_GATHER_DELAY                  # ก่อนถึงเวลานี้ ปล่อยลอยกระจายไปก่อน
            s = float(smooth(tg / 3.5))
            # ดูดเข้าแบบหมุน: ช่วงแรกเป้าอยู่ไกลกว่าจริงและหมุนเร็ว แล้ววนเป็นเกลียวหดเข้ามาที่ตำแหน่งจริง
            x = min(max(tg, 0.0) / GALAXY_SWIRL_SECONDS, 1.0)
            e = x * x * (3 - 2 * x)
            de = 6 * x * (1 - x) / GALAXY_SWIRL_SECONDS
            extra = 2 * np.pi * GALAXY_SWIRL_TURNS
            r0 = self.gal_r[idx]
            w = self.gal_omega[idx]
            spread = 1 + GALAXY_SWIRL_SPREAD * (1 - e)
            r = r0 * spread
            ang = self.gal_th0[idx] + w * self.gal_time + extra * (e - 1)
            ang_dot = w + extra * de
            r_dot = -r0 * GALAXY_SWIRL_SPREAD * de
            ca, sa = np.cos(ang), np.sin(ang)
            tx, ty = CX + r * ca, CY + r * sa * GALAXY_TILT
            tvx = r_dot * ca - r * ang_dot * sa
            tvy = (r_dot * sa + r * ang_dot * ca) * GALAXY_TILT
            k = GALAXY_SPRING * s
            c = 2 * math.sqrt(GALAXY_SPRING) * math.sqrt(s) + 0.3 + 0.3 * s   # ระหว่างรอ หน่วงเบา ๆ ให้ลอยช้า ๆ
            p, v = self.pos[idx], self.vel[idx]
            ax = k * (tx - p[:, 0]) + c * (tvx * s - v[:, 0])
            ay = k * (ty - p[:, 1]) + c * (tvy * s - v[:, 1])
            v[:, 0] += ax * dt
            v[:, 1] += ay * dt
            self.vel[idx] = v
            self.pos[idx] = p + v * dt
        # ใกล้จบช่วง (ถ้าวนรอบอยู่) บินกลับเข้าตาราง ทุกตัวถึงพร้อมกันตอนจบช่วงพอดี
        dur = PHASE_SECONDS[4]
        if self.loop and self.tp >= dur - HOMING_SECONDS:
            stagger = (self.rank / self.n) * 0.5
            go = np.nonzero((st == GALAXY) & (self.tp >= dur - HOMING_SECONDS + stagger))[0]
            if len(go):
                b = self.gal_b[go]
                self.start_homing(go, max(dur - self.tp, 0.05), b=0.0)
                self.home_b[go] = b
                self.home_tone[go] = self.gal_tone[go]
                self.home_p0[go] = self.pos[go]

    def set_loop(self, on):
        self.loop = on
        dur = PHASE_SECONDS[4]
        if on and self.phase == 4 and self.tp > dur - HOMING_SECONDS:
            self.tp = dur - HOMING_SECONDS      # เพิ่งเปิดวนรอบ ให้เวลาบินกลับเต็ม ๆ

    # ------------------------------------------------------------ หน้าตาของตัวอักษร
    def rain_look(self, idx, y):
        """ความสว่าง สี และแสงเรืองของตัวอักษรในทะเลโค้ด หัวคอลัมน์สว่างสุด หางจางลง"""
        c = self.hcol[idx]
        d = (self.head_y[c] - y) % self.head_period[c]
        hb = np.exp(-d / HEAD_TAIL)
        base = self.base_b[idx]
        b = base + (1 - base) * hb ** 1.4
        tone = np.where(d < CELL_H * 1.3, HEAD0 + (c & 1), self.tone[idx])
        return b, tone, 0.04 + 0.55 * hb * hb

    def heat_of(self, x, y):
        """ความร้อน 0..1 ตามระยะห่างจากหลุม (ใกล้ = ร้อน)"""
        heat = np.zeros(len(x))
        holes = [(CX, CY, self.R)] if self.phase == 2 else []
        holes += [(m.x, m.y, m.radius()) for m in self.minis]
        for hx, hy, R in holes:
            if R > 0.5:
                r = np.hypot(x - hx, y - hy)
                heat = np.maximum(heat, np.clip((HEAT_RANGE * R - r) / ((HEAT_RANGE - 1) * R), 0, 1))
        return heat

    def visuals(self, tails, t_now):
        """รวบรวมทุกอย่างที่ต้องวาดเฟรมนี้ คืน x, y, ตัวอักษร, tone, ความสว่าง, แสงเรือง, อยู่หน้าหลุมไหม"""
        st, ph = self.state, self.phase
        act = self.rank < self.n_active
        parts = []

        def add(x, y, ch, tone, b, gw, front=None):
            n = len(x)
            parts.append((x, y, np.broadcast_to(ch, (n,)), np.broadcast_to(tone, (n,)),
                          np.broadcast_to(b, (n,)), np.broadcast_to(gw, (n,)),
                          np.zeros(n, bool) if front is None else front))

        # ตัวอักษรในตาราง
        i = np.nonzero((st == ATTACHED) & act)[0]
        if len(i):
            x, y, lap = self.grid_xy(i)
            changed = lap != self.lap[i]
            if changed.any():   # วนจากล่างกลับขึ้นบน ได้ตัวอักษรใหม่จากโค้ดถัดไป
                j = i[changed]
                self.lap[j] = lap[changed]
                self.ch[j] = self.stream[(self.col_off[self.hcol[j]] + self.hrow[j] - self.lap[j] * TOTAL_ROWS) % len(self.stream)]
            b, tone, gw = self.rain_look(i, y)
            ch = self.ch[i].copy()
            for y0, y1, dx, _, seed in self.glitches:
                g = (y >= y0) & (y < y1)
                if g.any():
                    x = np.where(g, x + dx, x)
                    ch[g] = self.stream[(i[g] * 7919 + seed) % len(self.stream)]
                    b = np.where(g, np.minimum(1, b * 1.6 + 0.25 * self.rng.random(len(b))), b)
                    tone = np.where(g, HEAD0 + 1, tone)
            if self.R > 0.5 and ph in (1, 2):
                x, y, boost = self.lens(x, y)
                b = b * boost
            add(x, y, ch, tone, b, gw)

        # ตัวอักษรที่หลุดออกมาลอยตามฟิสิกส์
        i = np.nonzero((st == FREE) & act)[0]
        if len(i):
            x, y = self.pos[i, 0], self.pos[i, 1]
            heat = self.heat_of(x, y)
            sq = self.disk_squash(i) if ph == 2 else np.ones(len(i))
            yd = CY + (y - CY) * sq
            if ph == 2 and self.R > 0.5:
                # ตัวอักษรด้านหลังหลุม (ครึ่งบน) ถูกเลนส์ยกขึ้นเป็นโค้งเหนือหลุม ด้านหน้าวิ่งผ่านหน้าหลุมตามปกติ
                dx, dy = x - CX, yd - CY
                w = smooth(-dy / (0.6 * self.R))
                r = np.hypot(dx, dy) + 1e-6
                E = DISK_LENS * self.R
                s = 1 + ((r + np.sqrt(r * r + 4 * E * E)) / (2 * r) - 1) * w
                x, yd = CX + dx * s, CY + dy * s
            target = 0.55 + 0.45 * heat
            b = self.b0[i] + (target - self.b0[i]) * smooth(self.age[i] / 0.5)
            tone = np.where(heat > 0.04, HEAT0 + (heat * 15.99).astype(int), self.tone[i])
            vx, vy = self.vel[i, 0], self.vel[i, 1] * sq
            spd = np.hypot(vx, vy)
            fast = spd > SPAGHETTI_SPEED
            sector = (((np.arctan2(vy, vx) + np.pi / 8) % np.pi) // (np.pi / 4)).astype(int) % 4
            ch = np.where(fast, STREAK[sector], self.ch[i])
            front = (yd > CY) & (self.tilt_age[i] > 0.8)
            gw = 0.10 + 0.5 * heat ** 1.5
            add(x, yd, ch, tone, b, gw, front)
            if tails and fast.any():   # spaghettification: เงาหางตามหลังตัวที่วิ่งเร็ว
                f = np.nonzero(fast)[0]
                stretch = np.clip(spd[f] / SPAGHETTI_SPEED, 1, 2.5)
                for k in range(1, TAIL_COUNT + 1):
                    off = 0.011 * k * stretch
                    add(x[f] - vx[f] * off, yd[f] - vy[f] * off, ch[f], tone[f], b[f] * 0.5 ** k, gw[f] * 0.5, front[f])

        # กำลังบินกลับเข้าตาราง
        i = np.nonzero((st == HOMING) & act)[0]
        if len(i):
            u = np.clip((self.t - self.home_t0[i]) / self.home_dur[i], 0, 1)
            gy = self.grid_xy(i)[1]
            br, _, _ = self.rain_look(i, gy)
            e = smooth(u)
            switch = 0.3 + 0.4 * self.rank[i] / self.n      # แต่ละตัวเปลี่ยนสีคนละจังหวะ ไม่เปลี่ยนพร้อมกันทั้งจอ
            tone = np.where(u > switch, self.tone[i], self.home_tone[i])
            add(self.pos[i, 0], self.pos[i, 1], self.ch[i], tone, self.home_b[i] + (br - self.home_b[i]) * e,
                0.2 * (1 - e) + 0.04)

        # ถูกดูดเข้าหลุมตอนยุบตัว
        i = np.nonzero((st == COLLAPSE) & act)[0]
        if len(i):
            x, y = self.pos[i, 0], self.pos[i, 1]
            r = np.hypot(x - CX, y - CY)
            heat = np.clip(1 - r / 500, 0, 1)
            add(x, y, self.ch[i], HEAT0 + (heat * 15.99).astype(int), 0.5 + 0.5 * heat, 0.2 + 0.8 * heat)

        # ระเบิด และกาแล็กซี
        i = np.nonzero(((st == BLAST) | (st == GALAXY)) & act)[0]
        if len(i):
            since = self.t - self.blast_t
            heat = math.exp(-since / BLAST_COOL)
            b_blast = 0.4 + 0.6 * heat
            tone_blast = HEAT0 + int(heat * 15.99)
            x, y = self.pos[i, 0], self.pos[i, 1]
            if ph == 4:
                sw = self.gal_switch[i]
                heat_sw = np.exp(-(sw - self.blast_t) / BLAST_COOL)
                e = smooth((self.t - sw) / 1.5)
                on = self.t >= sw
                tw = np.where(self.gal_twinkle[i] > 0,
                              0.75 + 0.25 * np.sin(self.t * self.gal_twinkle[i] + self.gal_tw_phase[i]), 1.0)
                b_gal = self.gal_b[i] * tw
                b_from = np.where(on, 0.4 + 0.6 * heat_sw, b_blast)
                b = np.where(on, b_from + (b_gal - b_from) * e, b_blast) + 0.8 * self.boost[i]
                tone = np.where(on, self.gal_tone[i], tone_blast)
                tone = np.where(self.boost[i] > 0.35, HEAT0 + 15, tone)
                kind = self.gal_kind[i]
                gw = np.where(on, np.where(kind == 0, 0.3, np.where(kind == 1, 0.32, 0.45)), 0.3 + heat) + self.boost[i]
                add(x, y, self.ch[i], tone, b, gw)
            else:
                add(x, y, self.ch[i], tone_blast, b_blast, 0.3 + heat)

        # ตัวอักษรที่โคจรในดิสก์: ด้านหน้าเป็นแถบบางผ่านหน้าหลุม ด้านหลังถูกยกขึ้นเป็นโค้งเหนือหลุม
        if ph in (1, 2, 3) and self.R > 0.5:
            a = self.disk_alpha()
            k = int(DISK_SPARKS * self.growth(0.7))           # ตัวที่โคจรค่อย ๆ เพิ่มจำนวนตามที่กลืน
            if a > 0.02 and k > 0:
                R, rho = self.R, self.sp_rho[:k]
                c, s = np.cos(self.sp_th[:k]), np.sin(self.sp_th[:k])
                back = s < 0
                lift = np.where(back, -s, 0.0)                    # 0 ที่ด้านข้าง (ต่อกับแถบหน้าเนียน) มากสุดด้านบน
                # ใกล้ด้านข้าง วงนอกบานออกเป็นไหล่ตามภาพดิสก์ ใช้กับทั้งด้านหน้าและหลัง ภาพเลยต่อกันตรงด้านข้าง
                flare = 0.7 * (1 - np.abs(s)) ** 3 * (rho - 1.28) / 1.15
                ri = rho + 0.15 * lift + flare
                x = CX + R * ri * c * (1 + 0.12 * lift)
                y = CY + R * np.where(back, ri * s, (rho + flare) * s * 0.06)
                heat = np.clip(1 - (rho - 1.28) / 1.3, 0, 1)
                b = self.sp_b[:k] * a * np.clip(1 - 0.35 * c, 0.4, 1.35)   # ฝั่งซ้ายสว่างกว่า
                ch = np.where(back, self.sp_ch[:k], STREAK[0])         # ด้านหน้าวิ่งแนวนอน เลยเป็นขีดยาว
                add(x, y, ch, HEAT0 + (heat * 15.99).astype(int), b, 0.18, ~back)
                # ภาพซ้อนบนโค้งล่าง: ดิสก์ด้านหลังที่แสงอ้อมลงมาใต้หลุม (ใช้ครึ่งหนึ่งของตัวด้านหลัง วงเล็กกว่าและจางกว่า)
                low = np.nonzero(back & (np.arange(k) % 2 == 0))[0]
                if len(low):
                    rl = 1.13 + (rho[low] - 1.28) * 0.32
                    xl = CX + R * rl * c[low] * (1 + 0.06 * lift[low])
                    yl = CY - R * rl * s[low]
                    bl = b[low] * 0.75 * smooth(lift[low] / 0.35)
                    add(xl, yl, self.sp_ch[:k][low], HEAT0 + (heat[low] * 15.99).astype(int), bl, 0.12)

        # วงแหวนคลื่นกระแทก
        for g in list(self.rings):
            u = (self.t - g["t0"]) / g["life"]
            if u >= 1:
                self.rings.remove(g)
                continue
            rad = g["speed"] * g["life"] * (1 - (1 - u) ** 2) / 2 + 4
            add(g["x"] + rad * np.cos(g["ang"]), g["y"] + rad * np.sin(g["ang"]) * 0.92, g["ch"],
                HEAT0 + int((1 - u) * 15.99), (1 - u) ** 1.2, 0.9 * (1 - u))

        # ดาวพื้นหลัง (ช่วงกาแล็กซีเท่านั้น)
        vis = self.star_vis()
        if vis > 0.01:
            b = self.star_b * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(self.t * self.star_speed + self.star_phase))) * vis
            add(self.star_x, self.star_y, self.star_ch, self.star_tone, b, self.star_gw)

        if not parts:
            return None
        return [np.concatenate(k) for k in zip(*parts)]


# ================================================================== วาดภาพ
class Renderer:
    GLOW_DIV = 8

    def __init__(self, screen):
        self.screen = screen
        font = pygame.font.SysFont(FONT_NAMES, FONT_SIZE, bold=True)
        self.glyphs, self.gw, self.gh = build_glyphs(font)
        self.ring_tex = make_ring_texture()
        self.disk_tex, ring_full = make_disk_textures()
        R, half = DISK_TEX_R, int(1.3 * DISK_TEX_R)
        cx, cy = ring_full.get_width() // 2, ring_full.get_height() // 2
        self.hole_ring_tex = ring_full.subsurface((cx - half, cy - half, 2 * half, 2 * half)).copy()
        self.flash_tex = make_flash_texture(W // 4, H // 4)
        self.ggw, self.ggh = W // self.GLOW_DIV, H // self.GLOW_DIV
        self.glow = np.zeros((self.ggw, self.ggh, 3), np.float32)
        self.glow_tmp = np.zeros_like(self.glow)
        self.nebula = make_nebula(self.ggw, self.ggh)
        self.neb_vis = 0.0
        # เตรียมภาพปลายทางของการย่อ/ขยายไว้ใช้ซ้ำ (สร้างภาพเต็มจอใหม่ทุกเฟรมช้ากว่าเกือบ 3 เท่า)
        conv = lambda size: pygame.Surface(size).convert()
        self.g_small = conv((self.ggw, self.ggh))
        self.g_tiny = conv((self.ggw // 8, self.ggh // 8))
        self.g_halo = conv((self.ggw, self.ggh))
        self.g_full = conv((W, H))
        self.flash_full = conv((W, H))
        self.has_fblits = hasattr(screen, "fblits")
        self.ui_font = pygame.font.SysFont(FONT_NAMES, 15, bold=True)
        self.text_cache = {}

    def text(self, s, color):
        key = (s, color)
        surf = self.text_cache.get(key)
        if surf is None:
            if len(self.text_cache) > 200:
                self.text_cache.clear()
            surf = self.text_cache[key] = self.ui_font.render(s, True, color)
        return surf

    def draw(self, sim, tails):
        screen = self.screen
        screen.fill((0, 0, 0))
        ph, t = sim.phase, sim.t

        # จอสั่น: ใกล้จบช่วงดูดกลืน และตอนระเบิด
        amp = 0.0
        if ph == 2:
            amp = SHAKE * float(smooth((sim.tp - (PHASE_SECONDS[2] - 5)) / 5))
        amp += 14 * math.exp(-max(t - sim.flash_t, 0) * 3.5) if t - sim.flash_t < 2 else 0
        sx, sy = (sim.rng.uniform(-amp, amp, 2) if amp > 0.2 else (0.0, 0.0))

        self.neb_vis = sim.star_vis()
        v = sim.visuals(tails, t)
        if v is not None:
            x, y, ch, tone, b, gw, front = v
            x = x + sx
            y = y + sy
            ok = (x > -10) & (x < W + 10) & (y > -12) & (y < H + 12) & (b > LEVEL_B[0] * 0.6)
            # ตัวอักษรที่อยู่ในขอบฟ้าเหตุการณ์ไม่วาด (ยกเว้นดิสก์ส่วนที่อยู่หน้าหลุม)
            if sim.R > 0.5:
                ok &= (np.hypot(x - CX - sx, y - CY - sy) > sim.R) | front
            for m in sim.minis:
                ok &= np.hypot(x - m.x - sx, y - m.y - sy) > m.radius()
            x, y, ch, tone, b, gw = x[ok], y[ok], ch[ok], tone[ok], np.minimum(b[ok], 1.0), gw[ok]
            self.draw_glow(x, y, tone, b * gw, sx, sy, ph)
            self.draw_holes(sim, sx, sy, black=True)
            lvl = np.clip(np.rint(b ** (1 / 1.8) * NL) - 1, 0, NL - 1).astype(np.int64)
            keys = (ch.astype(np.int64) * NT + tone) * NL + lvl
            xi = (x - self.gw / 2).astype(np.int32)
            yi = (y - self.gh / 2).astype(np.int32)
            self.blit_glyphs(keys, xi, yi)
        else:
            self.draw_glow(np.zeros(0), np.zeros(0), np.zeros(0, int), np.zeros(0), sx, sy, ph)
            self.draw_holes(sim, sx, sy, black=True)
        self.draw_holes(sim, sx, sy, black=False)

        # จุดเล็ก ๆ ที่เหลือตอนหลุมหดตัว
        if ph == 3 and sim.R > 0.3:
            pygame.draw.circle(screen, (90, 70, 60), (CX + sx, CY + sy), 2)
        # แสงวาบตอนระเบิด
        since = t - sim.flash_t
        if 0 <= since < 1.5:
            k = math.exp(-since * 3.2)
            fl = pygame.transform.smoothscale(self.flash_tex, (W, H), self.flash_full)
            if k < 0.999:
                c = int(255 * k)
                fl.fill((c, c, c), special_flags=pygame.BLEND_RGB_MULT)
            screen.blit(fl, (sx, sy), special_flags=pygame.BLEND_RGB_ADD)
            c = int(200 * math.exp(-since * 7))
            if c > 0:
                screen.fill((c, c, c), special_flags=pygame.BLEND_RGB_ADD)

    def draw_glow(self, x, y, tone, w, sx, sy, ph):
        """แสงเรือง: โยนความสว่างลงบัฟเฟอร์ 1/4 ความละเอียด เบลอด้วยการย่อแล้วขยาย แล้วบวกลงจอ
        ช่วงดูดกลืนกับกาแล็กซี บัฟเฟอร์ค่อย ๆ จางแทนการล้าง เลยเป็นหางแสงตามหลังตัวที่วิ่ง"""
        g = self.glow
        keep = {2: 0.80, 3: 0.55, 4: 0.62}.get(ph, 0.0)
        gain = 1 - 0.75 * keep          # แสงที่ค้างจากเฟรมก่อนสะสมกัน ลดของใหม่ลงหน่อย ไม่ให้สว่างเกินช่วงอื่น
        if keep:
            g *= keep
        else:
            g[:] = 0
        if len(x):
            gx = np.clip(((x - sx) / self.GLOW_DIV).astype(np.int32), 0, self.ggw - 1)
            gy = np.clip(((y - sy) / self.GLOW_DIV).astype(np.int32), 0, self.ggh - 1)
            idx = gx * self.ggh + gy
            col = PALETTE[tone] * (w * gain)[:, None]
            size = self.ggw * self.ggh
            for c in range(3):
                g[..., c] += np.bincount(idx, col[:, c], size).reshape(self.ggw, self.ggh)
        if self.neb_vis > 0.01:   # เมฆเนบิวลา (ใส่เพิ่มทีละนิดทุกเฟรม รวมกับที่ค้างจากเฟรมก่อนแล้วได้ความสว่างเท่าที่ตั้งไว้พอดี)
            g += self.nebula * (self.neb_vis * (1 - keep))
        tmp = self.glow_tmp
        np.multiply(g, GLOW_GAIN * 255, out=tmp)
        np.minimum(tmp, 255, out=tmp)
        pygame.surfarray.blit_array(self.g_small, tmp.astype(np.uint8))
        sm = pygame.transform.smoothscale
        sm(self.g_small, self.g_tiny.get_size(), self.g_tiny)
        sm(self.g_tiny, self.g_halo.get_size(), self.g_halo)          # แสงฟุ้งวงกว้าง
        self.g_small.blit(self.g_halo, (0, 0), special_flags=pygame.BLEND_RGB_ADD)
        sm(self.g_small, (W, H), self.g_full)                         # ขยายทีเดียวเต็มจอ ได้แสงนุ่ม ๆ
        self.screen.blit(self.g_full, (sx, sy), special_flags=pygame.BLEND_RGB_ADD)

    def blit_glyphs(self, keys, xi, yi):
        n = len(keys)
        if n == 0:
            return
        kl = keys.tolist()
        surfs = itemgetter(*kl)(self.glyphs) if n > 1 else (self.glyphs[kl[0]],)
        pos = zip(xi.tolist(), yi.tolist())
        if self.has_fblits:
            self.screen.fblits(zip(surfs, pos), pygame.BLEND_RGB_ADD)
        else:
            self.screen.blits([(s, p, None, pygame.BLEND_RGB_ADD) for s, p in zip(surfs, pos)], doreturn=False)

    def blit_scaled(self, tex, scale, x, y, alpha):
        w, h = tex.get_size()
        size = (max(2, int(w * scale)), max(2, int(h * scale)))
        surf = pygame.transform.smoothscale(tex, size)
        if alpha < 0.999:
            c = int(255 * alpha)
            surf.fill((c, c, c), special_flags=pygame.BLEND_RGB_MULT)
        self.screen.blit(surf, (x - size[0] / 2, y - size[1] / 2), special_flags=pygame.BLEND_RGB_ADD)

    def draw_holes(self, sim, sx, sy, black):
        # หลุมใหญ่: เงาดำ แล้ว (หลังวาดตัวอักษร) ดิสก์กับวงแหวนแสง
        if sim.R > 0.5 and sim.phase in (1, 2, 3):
            x, y, r = CX + sx, CY + sy, sim.R
            if black:
                pygame.draw.circle(self.screen, (0, 0, 0), (x, y), r)
            else:
                k = r / DISK_TEX_R
                da = sim.disk_alpha()
                if da > 0.01:
                    self.blit_scaled(self.disk_tex, k, x, y, da)
                ra = sim.ring_alpha()
                if ra > 0.01:
                    self.blit_scaled(self.hole_ring_tex, k, x, y, ra)
        holes = []
        for m in sim.minis:
            r = m.radius()
            if sim.phase in (0, 1):
                r *= float(smooth((MINI_LIFE - m.age) / 0.4))   # กำลังระเหย หดเล็กลง
            if r > 0.5:
                holes.append((m.x, m.y, r, min(1.0, r / 8)))
        for x, y, r, a in holes:
            if black:
                pygame.draw.circle(self.screen, (0, 0, 0), (x + sx, y + sy), r)
            else:   # วงแหวนแสง (photon ring)
                size = max(4, int(2 * r * PHOTON_RING * 128 / 100))
                ring = pygame.transform.smoothscale(self.ring_tex, (size, size))
                if a < 0.999:
                    c = int(255 * a)
                    ring.fill((c, c, c), special_flags=pygame.BLEND_RGB_MULT)
                self.screen.blit(ring, (x + sx - size / 2, y + sy - size / 2), special_flags=pygame.BLEND_RGB_ADD)

    def draw_bar(self, alpha, left, right, message):
        """แถบปุ่มควบคุมด้านล่างจอ"""
        if alpha <= 0.01:
            return
        strip = pygame.Surface((W, 26), pygame.SRCALPHA)
        strip.fill((0, 0, 0, int(170 * alpha)))
        self.screen.blit(strip, (0, H - 26))
        k = int(255 * alpha)
        for s, xpos, col in ((left, 10, (200, 225, 210)), (right, None, (150, 200, 255))):
            surf = self.text(s, col)
            surf.set_alpha(k)
            self.screen.blit(surf, (xpos if xpos is not None else W - surf.get_width() - 10, H - 22))
        if message:
            surf = self.text(message, (255, 225, 170))
            surf.set_alpha(k)
            self.screen.blit(surf, ((W - surf.get_width()) // 2, H - 52))


# ================================================================== โปรแกรมหลัก
HELP = ("space: next phase   R: restart   click: mini black hole / supernova   "
        "P: pause   +/-: speed   L: loop   H: bar   F: fullscreen   esc: quit")
SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]


def main():
    ap = argparse.ArgumentParser(description="หลุมดำกลืนโค้ด")
    ap.add_argument("--seconds", type=float, default=0, help="รันกี่วินาที (เวลาในเรื่อง) แล้วปิดเอง (0 = ไม่ปิดเอง)")
    ap.add_argument("--screenshot", help="เซฟเฟรมสุดท้ายเป็นไฟล์ png ก่อนปิด")
    ap.add_argument("--shots", help="เซฟภาพที่เวลาเหล่านี้ (วินาทีในเรื่อง) เช่น 4,12,25")
    ap.add_argument("--shot-dir", default=".", help="โฟลเดอร์ที่เก็บภาพจาก --shots")
    ap.add_argument("--start-at", type=float, default=0, help="กระโดดไปเริ่มที่วินาทีนี้ของเรื่อง")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--fast", action="store_true", help="ไม่รอเวลาจริง เดินเรื่องเฟรมละ 1/60 วิ (ไว้ทดสอบ)")
    ap.add_argument("--no-auto", action="store_true", help="ปิดการลดจำนวนตัวอักษรอัตโนมัติ")
    args = ap.parse_args()
    if sys.stdout is not None:
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    pygame.init()
    headless = os.environ.get("SDL_VIDEODRIVER") == "dummy"
    flags = 0
    if not headless:
        flags = pygame.SCALED
        desk = pygame.display.get_desktop_sizes()
        # จอไม่ใหญ่กว่าภาพพอให้มีที่สำหรับแถบชื่อหน้าต่างกับ taskbar: เปิดเต็มจอแทน (ย่อให้พอดีเองถ้าจอเล็กกว่า)
        if desk and (desk[0][0] < W or desk[0][1] < H + 80):
            flags |= pygame.FULLSCREEN
    screen = pygame.display.set_mode((W, H), flags)
    pygame.display.set_caption("หลุมดำกลืนโค้ด")
    screen.fill((0, 0, 0))
    loading = pygame.font.SysFont(FONT_NAMES, 18, bold=True).render("loading glyphs...", True, (90, 200, 120))
    screen.blit(loading, ((W - loading.get_width()) // 2, H // 2))
    pygame.display.flip()

    sim = Sim(args.seed)
    ren = Renderer(screen)
    auto = AUTO_REDUCE and not args.no_auto and not args.fast
    tails = True
    shots = sorted(float(s) for s in args.shots.split(",")) if args.shots else []

    if args.start_at > 0:   # เดินฟิสิกส์ไปก่อนโดยไม่วาด
        for _ in range(int(args.start_at / PHYSICS_DT)):
            sim.step(PHYSICS_DT)
        sim.events.clear()

    clock = pygame.time.Clock()
    speed_i, paused = SPEEDS.index(1.0), False
    acc = 0.0
    real_start = time.perf_counter()
    bar_until, bar_pinned = 10.0, False
    message, message_until = "", 0.0
    frame_times = []
    stats = [[0, 0.0] for _ in range(5)]          # เฟรม, เวลา ต่อช่วง
    worst = [0.0] * 5
    fps_shown, next_check = 0.0, 3.0
    running = True
    while running:
        frame_dt = clock.tick(0 if args.fast else TARGET_FPS) / 1000
        real_t = time.perf_counter() - real_start
        if args.fast:
            frame_dt = 1 / 60
        frame_dt = min(frame_dt, 0.1)
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            elif e.type == pygame.KEYDOWN:
                bar_until = max(bar_until, real_t + 4)
                if e.key == pygame.K_ESCAPE:
                    running = False
                elif e.key == pygame.K_SPACE:
                    sim.enter_phase((sim.phase + 1) % 5)
                elif e.key == pygame.K_r:
                    sim.reset()
                    message, message_until = "restart", real_t + 2
                elif e.key == pygame.K_p:
                    paused = not paused
                elif e.key in (pygame.K_PLUS, pygame.K_EQUALS, pygame.K_KP_PLUS):
                    speed_i = min(speed_i + 1, len(SPEEDS) - 1)
                    message, message_until = f"speed {SPEEDS[speed_i]}x", real_t + 2
                elif e.key in (pygame.K_MINUS, pygame.K_KP_MINUS):
                    speed_i = max(speed_i - 1, 0)
                    message, message_until = f"speed {SPEEDS[speed_i]}x", real_t + 2
                elif e.key == pygame.K_l:
                    sim.set_loop(not sim.loop)
                    message, message_until = f"loop {'on' if sim.loop else 'off'}", real_t + 2
                elif e.key == pygame.K_h:
                    bar_pinned = not bar_pinned
                    bar_until = real_t   # ปิดการปักไว้แล้วให้แถบหายเลย
                elif e.key == pygame.K_f:
                    pygame.display.toggle_fullscreen()
            elif e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                sim.click(*e.pos)
            elif e.type == pygame.MOUSEMOTION and e.pos[1] > H - 70:
                bar_until = max(bar_until, real_t + 2)

        # ฟิสิกส์แบบ fixed timestep
        if not paused:
            acc += frame_dt * SPEEDS[speed_i]
            steps = 0
            while acc >= PHYSICS_DT and steps < MAX_STEPS_PER_FRAME:
                sim.step(PHYSICS_DT)
                acc -= PHYSICS_DT
                steps += 1
            if steps == MAX_STEPS_PER_FRAME:
                acc = 0.0
        if sim.events:
            message, message_until = sim.events[-1], real_t + 2.5
            sim.events.clear()

        ren.draw(sim, tails)
        status = (f"phase {sim.phase + 1}/5 {PHASE_NAMES[sim.phase]}   {SPEEDS[speed_i]}x   "
                  f"loop {'on' if sim.loop else 'off'}   {fps_shown:.0f} fps   {sim.n_active} chars"
                  + ("   PAUSED" if paused else ""))
        bar_a = 1.0 if bar_pinned else float(np.clip(bar_until - real_t, 0, 1))
        ren.draw_bar(bar_a, HELP, status, message if real_t < message_until else "")
        pygame.display.flip()

        # วัด FPS และลดจำนวนตัวอักษรถ้าเครื่องไม่ทัน
        if not args.fast:
            frame_times.append(frame_dt)
            stats[sim.phase][0] += 1
            stats[sim.phase][1] += frame_dt
            worst[sim.phase] = max(worst[sim.phase], frame_dt)
        if real_t >= next_check and frame_times:
            fps_shown = len(frame_times) / sum(frame_times)
            if auto and fps_shown < TARGET_FPS * 0.9:
                if tails:
                    tails = False
                    message, message_until = "auto: tails off", real_t + 2.5
                elif sim.n_active > MIN_PARTICLES:
                    sim.n_active = max(MIN_PARTICLES, int(sim.n_active * 0.85))
                    message, message_until = f"auto: {sim.n_active} chars", real_t + 2.5
            frame_times.clear()
            next_check = real_t + 1.0

        if shots and sim.t >= shots[0]:
            path = Path(args.shot_dir) / f"shot_{shots[0]:05.1f}.png"
            pygame.image.save(screen, str(path))
            print(f"เซฟภาพ {path}")
            shots.pop(0)
        if args.seconds and sim.t >= args.seconds:
            if args.screenshot:
                pygame.image.save(screen, args.screenshot)
            running = False

    elapsed = time.perf_counter() - real_start
    print(f"รันไป {elapsed:.1f} วินาที ตัวอักษร {sim.n_active} ตัว หางเงา {'เปิด' if tails else 'ปิด'}")
    for k, (frames, secs) in enumerate(stats):
        if frames:
            print(f"  ช่วง {k + 1} {PHASE_NAMES[k]}: เฉลี่ย {frames / secs:.1f} fps, เฟรมช้าสุด {worst[k] * 1000:.0f} ms")
    pygame.quit()


if __name__ == "__main__":
    main()
