// เก็บไฟล์หลักไว้ในเครื่อง ให้เปิดเว็บ เล่นมินิเกม และดูเช็กลิสต์ได้แม้ไม่มีเน็ต
// แก้ไฟล์ในเว็บเมื่อไร ให้เปลี่ยนเลขเวอร์ชันนี้ด้วย เครื่องผู้ใช้จะได้โหลดของใหม่
const CACHE = 'nakcat-v29';

const breeds = ['abyssinian', 'americanshort', 'australianmist', 'bengal', 'birman', 'british', 'burmilla', 'chinchilla',
    'exotic', 'khaomanee', 'korat', 'mainecoon', 'munchkin', 'norwegian', 'ocicat', 'persian', 'ragamuffin', 'ragdoll',
    'russianblue', 'scottishfold', 'siamese', 'sphynx'];

// รูปย่อในกล่อง อ่านต่อ ท้ายบทความ
const thumbs = ['cat-eyes', 'cat-sleeping', 'cat-window', 'kitten-about', 'kitten-vet'];

const CORE = [
    './',
    'index.html',
    'article-first24.html',
    'article-sleep.html',
    'article-language.html',
    'article-home.html',
    'article-health.html',
    'article-food.html',
    'article-buy.html',
    'style.css?v=21',
    'app.js',
    'feedback.js',
    'minigames.js',
    'catsays.js',
    'age.js',
    'api.js',
    'visits.js',
    'contact.js',
    'breed-likes.js',
    'leaderboard.js',
    'site-rating.js',
    'stories.js',
    'manifest.json',
    'images/hero-cat.jpg',
    'images/kitten-about.jpg',
    'images/kitten-vet.jpg',
    'images/cat-food.jpg',
    'images/cat-sleeping.jpg',
    'images/cat-eyes.jpg',
    'images/cat-window.jpg',
    'images/cat-mother.jpg',
    'images/icon-192.png',
    'images/icon-512.png',
    ...breeds.map((b) => `images/breeds/${b}.jpg`),
    ...thumbs.map((t) => `images/thumbs/${t}.jpg`),
];

self.addEventListener('install', (e) => {
    // ไฟล์ไหนโหลดไม่ได้ก็ข้ามไป ไม่ให้ทั้งชุดล้ม
    e.waitUntil(caches.open(CACHE).then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => {})))));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return; // ส่งข้อมูล (POST) ไม่ต้องเก็บ
    const url = new URL(req.url);
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (url.origin !== location.origin && !isFont) return;

    // หน้าเว็บ: เอาของใหม่จากเน็ตก่อน ถ้าออฟไลน์ค่อยใช้ที่เก็บไว้
    // Netlify เปลี่ยนลิงก์เป็น /article-x (ไม่มี .html) แต่ที่เก็บไว้ตอนติดตั้งคือ article-x.html เลยต้องลองทั้งสองแบบ
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req, { ignoreSearch: true })
                        .then((hit) => hit || caches.match(url.pathname + '.html'))
                        .then((hit) => hit || caches.match('index.html'))
                )
        );
        return;
    }

    // สคริปต์กับสไตล์ของเว็บ: เอาจากเน็ตก่อน ไม่งั้นหน้าใหม่จะได้สคริปต์ของรอบก่อน
    // ออฟไลน์ค่อยใช้ที่เก็บไว้ (ห้ามตกไปที่ index.html เพราะจะได้ HTML ไปแทนสคริปต์)
    if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    // รูป ฟอนต์: ใช้ที่เก็บไว้ทันที แล้วแอบอัปเดตเบื้องหลัง
    e.respondWith(
        caches.match(req).then((hit) => {
            const fresh = fetch(req)
                .then((res) => {
                    if (res.ok || res.type === 'opaque') {
                        const copy = res.clone();
                        caches.open(CACHE).then((cache) => cache.put(req, copy));
                    }
                    return res;
                })
                .catch(() => hit);
            return hit || fresh;
        })
    );
});
