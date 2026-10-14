// เก็บไฟล์หลักไว้ในเครื่อง ให้เปิดเว็บ เล่นมินิเกม และดูเช็กลิสต์ได้แม้ไม่มีเน็ต
// แก้ไฟล์ในเว็บเมื่อไร ให้เปลี่ยนเลขเวอร์ชันนี้ด้วย เครื่องผู้ใช้จะได้โหลดของใหม่
const CACHE = 'nakcat-v23';

const breeds = ['abyssinian', 'americanshort', 'australianmist', 'bengal', 'birman', 'british', 'burmilla', 'chinchilla',
    'exotic', 'khaomanee', 'korat', 'mainecoon', 'munchkin', 'norwegian', 'ocicat', 'persian', 'ragamuffin', 'ragdoll',
    'russianblue', 'scottishfold', 'siamese', 'sphynx'];

const CORE = [
    './',
    'index.html',
    'article-first24.html',
    'article-sleep.html',
    'article-language.html',
    'article-home.html',
    'style.css?v=16',
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
    'images/cat-sleeping.jpg',
    'images/cat-eyes.jpg',
    'images/cat-window.jpg',
    'images/icon-192.png',
    'images/icon-512.png',
    ...breeds.map((b) => `images/breeds/${b}.jpg`),
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
    if (req.method !== 'GET') return; // ฟอร์มที่ส่งเข้า Netlify ไม่ต้องยุ่ง
    const url = new URL(req.url);
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (url.origin !== location.origin && !isFont) return;

    // หน้าเว็บ: เอาของใหม่จากเน็ตก่อน ถ้าออฟไลน์ค่อยใช้ที่เก็บไว้
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
        );
        return;
    }

    // รูป สไตล์ สคริปต์ ฟอนต์: ใช้ที่เก็บไว้ทันที แล้วแอบอัปเดตเบื้องหลัง
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
