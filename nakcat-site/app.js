// ใช้ร่วมกันทุกหน้า: รายการโปรด (localStorage) / ติดตั้งเป็นแอป (PWA) / แอนิเมชันเล็กๆ
(() => {
    const onIndex = Boolean(document.querySelector('#games'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ===================== รายการโปรด =====================
    const FAV_KEY = 'nakcat-favs';
    let favs = [];
    try { favs = JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) {}

    const saveFavs = () => {
        try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
    };
    const hasFav = (key) => favs.some((f) => f.key === key);
    // บอกไฟล์อื่น (เช่น breed-likes.js) ว่ามีการกด/เอาหัวใจออก
    const announceFav = (key, on) => document.dispatchEvent(new CustomEvent('nakcat:fav-change', { detail: { key, on } }));

    function syncFavButtons(root = document) {
        root.querySelectorAll('.fav-btn[data-fav]').forEach((btn) => {
            const on = hasFav(btn.dataset.fav);
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', `${on ? 'เอาออกจาก' : 'บันทึกลง'}รายการโปรด: ${btn.dataset.favTitle}`);
            const heart = btn.querySelector('.fav-heart');
            if (heart) heart.textContent = on ? '♥' : '♡';
            const text = btn.querySelector('.fav-text');
            if (text) text.textContent = on ? (btn.dataset.favOn || 'บันทึกแล้ว') : (btn.dataset.favOff || 'บันทึกไว้อ่าน');
        });
        updateFab();
    }

    // ปุ่มหัวใจลอยมุมขวาล่าง + หน้าต่างรายการโปรด
    document.body.insertAdjacentHTML('beforeend', `
        <button type="button" class="fav-fab" id="fav-fab" hidden aria-label="เปิดรายการโปรด">
            <span aria-hidden="true">♥</span><span class="fav-count" id="fav-count">0</span>
        </button>
        <dialog class="fav-dialog" id="fav-dialog" aria-labelledby="fav-title">
            <button type="button" class="dialog-close" id="fav-close" aria-label="ปิด">✕</button>
            <h3 id="fav-title">รายการโปรดของฉัน</h3>
            <div id="fav-list"></div>
            <p class="fav-note">บันทึกไว้ในเบราว์เซอร์ของเครื่องนี้เท่านั้น</p>
        </dialog>
        <div class="toast" id="toast" role="status" aria-live="polite"></div>`);
    const fab = document.querySelector('#fav-fab');
    const favDialog = document.querySelector('#fav-dialog');

    function updateFab() {
        fab.hidden = favs.length === 0;
        document.querySelector('#fav-count').textContent = favs.length;
    }

    let toastTimer;
    function toast(msg) {
        const el = document.querySelector('#toast');
        el.textContent = msg;
        el.classList.add('is-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
    }

    const groups = [
        ['article', 'บทความ'],
        ['breed', 'สายพันธุ์แมว'],
        ['name', 'ชื่อแมวที่ชอบ'],
    ];

    function renderFavList() {
        const list = document.querySelector('#fav-list');
        if (!favs.length) {
            list.innerHTML = '<p class="fav-empty">ยังไม่มีรายการโปรด<br>กด ♡ ที่บทความ สายพันธุ์แมว หรือชื่อแมวที่ชอบได้เลย</p>';
            return;
        }
        list.innerHTML = groups.map(([type, label]) => {
            const items = favs.filter((f) => f.key.startsWith(`${type}:`));
            if (!items.length) return '';
            return `
                <section class="fav-group">
                    <h4>${label}</h4>
                    <ul class="fav-items${type === 'name' ? ' is-chips' : ''}">
                        ${items.map((f) => {
                            const thumb = f.img ? `<img src="${f.img}" alt="">` : '';
                            const main = type === 'article'
                                ? `<a class="fav-item-main" href="${f.url}">${thumb}<span>${f.title}</span></a>`
                                : type === 'breed'
                                    ? `<button type="button" class="fav-item-main" data-open-breed="${f.key.slice(6)}">${thumb}<span>${f.title}</span></button>`
                                    : `<span class="fav-item-main"><span>${f.title}</span></span>`;
                            return `<li>${main}<button type="button" class="fav-remove" data-remove="${f.key}" aria-label="เอา ${f.title} ออก">✕</button></li>`;
                        }).join('')}
                    </ul>
                </section>`;
        }).join('');
    }

    fab.addEventListener('click', () => {
        renderFavList();
        favDialog.showModal();
    });
    document.querySelector('#fav-close').addEventListener('click', () => favDialog.close());
    favDialog.addEventListener('click', (e) => {
        if (e.target === favDialog) { favDialog.close(); return; }
        const remove = e.target.closest('[data-remove]');
        if (remove) {
            favs = favs.filter((f) => f.key !== remove.dataset.remove);
            saveFavs();
            announceFav(remove.dataset.remove, false);
            renderFavList();
            syncFavButtons();
            if (!favs.length) favDialog.close();
            return;
        }
        const breed = e.target.closest('[data-open-breed]');
        if (breed) {
            favDialog.close();
            // หน้าแรกเปิดข้อมูลพันธุ์ได้เลย หน้าอื่นพาไปหน้าแรกแล้วค่อยเปิด
            if (onIndex) document.dispatchEvent(new CustomEvent('nakcat:open-breed', { detail: breed.dataset.openBreed }));
            else location.href = `index.html?breed=${encodeURIComponent(breed.dataset.openBreed)}#games`;
        }
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.fav-btn[data-fav]');
        if (!btn) return;
        e.stopPropagation();
        const { fav: key, favTitle: title, favUrl: url, favImg: img } = btn.dataset;
        if (hasFav(key)) {
            favs = favs.filter((f) => f.key !== key);
            toast('เอาออกจากรายการโปรดแล้ว');
        } else {
            favs.push({ key, title, url: url || '', img: img || '' });
            toast('บันทึกแล้ว ดูได้ที่ปุ่มหัวใจมุมขวาล่าง');
            btn.classList.remove('is-pop');
            void btn.offsetWidth;
            btn.classList.add('is-pop');
        }
        saveFavs();
        syncFavButtons();
        announceFav(key, hasFav(key));
    }, true);

    // ปุ่มหัวใจที่สร้างทีหลัง (การ์ดพันธุ์แมว ชื่อที่สุ่มได้) ให้แสดงสถานะถูกต้องเสมอ
    new MutationObserver((records) => {
        if (records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1 && (n.matches('.fav-btn') || n.querySelector('.fav-btn'))))) {
            syncFavButtons();
        }
    }).observe(document.body, { childList: true, subtree: true });
    syncFavButtons();

    // ===================== ติดตั้งเป็นแอป (PWA) =====================
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // เบราว์เซอร์ที่รองรับจะส่งสัญญาณมา จึงค่อยโชว์ปุ่มติดตั้งใน footer
    let installEvent = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installEvent = e;
        const footer = document.querySelector('.footer-inner');
        if (!footer || document.querySelector('#install-app')) return;
        footer.insertAdjacentHTML('beforeend', '<button type="button" class="install-btn" id="install-app">ติดตั้ง nakcat เป็นแอป</button>');
        document.querySelector('#install-app').addEventListener('click', async () => {
            if (!installEvent) return;
            installEvent.prompt();
            await installEvent.userChoice;
            installEvent = null;
            document.querySelector('#install-app').remove();
        });
    });

    if (reduceMotion) return;

    // ===================== แอนิเมชัน =====================
    // แมวนั่งบนปุ่มหลัก กระดิกหางตอนชี้เมาส์
    const catSvg = `
        <span class="btn-cat" aria-hidden="true">
            <svg viewBox="0 0 44 30">
                <path class="btn-cat-tail" d="M30 27 Q41 25 40 15 Q39.5 10 36 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
                <path d="M7 30 Q6 18 9 13 L10 4 L16 10 Q19 9 22 10 L28 4 L29 13 Q32 18 31 30Z" fill="currentColor"/>
                <circle cx="15" cy="17" r="1.8" fill="#c98a68"/>
                <circle cx="23" cy="17" r="1.8" fill="#c98a68"/>
            </svg>
        </span>`;
    document.querySelectorAll('.hero-actions .btn:not(.btn-ghost), #contact-submit, #site-rating-submit').forEach((btn) => {
        btn.classList.add('has-cat');
        btn.insertAdjacentHTML('beforeend', catSvg);
    });
})();
