"use strict";
// มินิเกม "ถ้าแมวพูดได้วันเดียว จะพูดอะไรเป็นประโยคแรก"
// ไฟล์ต้นฉบับคือ src/catsays.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/catsays.js ใหม่
(() => {
    // ชื่อที่ใช้เมื่อผู้ใช้ไม่ได้กรอกชื่อแมว
    const DEFAULT_NAME = 'เจ้าเหมียว';
    // คลังประโยค อิงจากนิสัยจริงของแมว
    const catLines = [
        { text: 'จุ๊บฉันสิ ฉันไปเลียขี้มา' },
        { text: 'ชามข้าวยังไม่เต็ม', context: 'ทั้งที่เหลือครึ่งชาม' },
        { text: 'ตีห้าแล้ว ตื่น' },
        { text: 'เมื่อกี้เปิดประตูให้แล้วทำไมยังไม่ออก' },
        { text: 'ห้องนี้ของฉัน' },
        { text: 'แก้วนี้วางผิดที่ ฉันแค่ช่วยจัดให้', context: 'ปัดแก้วตกโต๊ะ' },
        { text: 'งานเธอสำคัญกว่าฉันเหรอ', context: 'นั่งทับคีย์บอร์ด' },
        { text: 'ของในกล่องเป็นของเธอ แต่กล่องเป็นของฉัน', context: 'ไม่สนของขวัญ สนแต่กล่อง' },
        { text: 'ลูบได้สามที ทีที่สี่กัดนะ' },
        { text: 'ฉันไม่ได้อ้วน ฉันขนฟู' },
        { text: 'เตียงนี้ใหญ่ไป ฉันเลยแบ่งขอบให้เธอนอน', context: 'นอนกลางเตียง' },
        { text: 'ในห้องน้ำมีอะไร ทำไมต้องปิดประตูไม่ให้ฉันเห็น', context: 'นั่งรอหน้าห้องน้ำ' },
        { text: 'ของขวัญจ้า ไม่ต้องขอบคุณ', context: 'คาบจิ้งจกมาวางหน้าห้อง' },
        { text: 'น้ำในแก้วเธออร่อยกว่าน้ำในชามฉัน' },
        { text: 'หาฉันไม่เจอหรอก', context: 'มุดหัวใต้ผ้าห่ม แต่ก้นโผล่' },
        { text: 'ตีสองแล้ว ได้เวลาซ้อมวิ่ง', context: 'วิ่งทั่วบ้านกลางดึก' },
        { text: 'ได้ยินนะว่าเรียก แต่ไม่อยากหัน', context: 'เรียกชื่อแล้วกระดิกแค่หู' },
        { text: 'ซื้อที่นอนแพงมาทำไม ฉันชอบถุงพลาสติก' },
        { text: 'ข้าวยี่ห้อนี้ฉันเบื่อแล้ว', context: 'เพิ่งกินหมดไปสองถุง' },
        { text: 'ใครเอางูมาวางข้างหลังฉัน!', context: 'เห็นแตงกวา' },
        { text: 'หมอคนนั้นไม่ใช่เพื่อนฉันแล้ว', context: 'กลับจากฉีดวัคซีน' },
        { text: 'ขอนวดพุงเธอก่อนนอนแป๊บนึง', context: 'เหยียบ ๆ นวด ๆ' },
        { text: 'กระดาษที่เธอกำลังอ่าน คือที่นั่งของฉัน' },
        { text: 'ฉันเห็นสิ่งที่เธอมองไม่เห็น', context: 'จ้องมุมห้องเปล่า ๆ' },
        { text: 'นกตัวนั้นมันท้าฉัน', context: 'ส่งเสียงแง็ก ๆ ใส่หน้าต่าง' },
        { text: 'วันนี้ฉันจะจำไปจนตาย', context: 'หลังโดนจับอาบน้ำ' },
        { text: 'กระเป๋าเดินทางนี่หมายความว่าไง จะทิ้งฉันเหรอ', context: 'นอนขวางในกระเป๋า' },
        { text: 'โชว์พุงให้ดูเฉย ๆ ไม่ได้ให้จับ' },
        { text: 'เปิดตู้เย็นทำไมไม่เรียกฉัน', context: 'วิ่งมาจากอีกห้อง' },
        { text: 'อย่าเพิ่งลุก ฉันเพิ่งได้ท่านอนที่ดีที่สุดในชีวิต', context: 'นอนบนตัก' },
    ];
    // จำว่ารอบที่แล้วสุ่มได้ประโยคลำดับที่เท่าไร (-1 = ยังไม่เคยสุ่ม)
    let lastIndex = -1;
    // สุ่ม 1 ประโยค โดยไม่ให้ซ้ำกับรอบที่แล้ว
    function pickLine() {
        let index;
        do {
            index = Math.floor(Math.random() * catLines.length);
        } while (index === lastIndex);
        lastIndex = index;
        return catLines[index];
    }
    // ตัดช่องว่างหน้า-หลังชื่อ ถ้าเว้นว่างไว้ใช้ชื่อเริ่มต้นแทน
    function cleanName(raw) {
        const name = raw.trim();
        return name === '' ? DEFAULT_NAME : name;
    }
    // ===================== วาดรูปสำหรับแชร์ =====================
    const INK = '#221f1b';
    const MUTED = '#6b645a';
    const ORANGE = '#b8532a';
    // วาดรูปกว้าง 1080 แล้วส่งกลับเป็นไฟล์รูป
    // height = 1080 ได้สี่เหลี่ยมจัตุรัส (โพสต์ IG/Facebook), 1920 ได้ขนาดสตอรี่ (เนื้อหาเดิมวางไว้กลางรูป)
    async function makeImage(line, name, height = 1080) {
        try {
            await Promise.all(['600 66px Pridi', '400 40px "IBM Plex Sans Thai Looped"'].map((f) => document.fonts.load(f)));
        }
        catch (e) { }
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = height;
        const g = canvas.getContext('2d');
        if (!g)
            throw new Error('เบราว์เซอร์นี้วาดรูปไม่ได้');
        // พื้นหลังสีพีชเรียบ (สีเดียวกับ --peach ใน style.css)
        g.fillStyle = '#f1e3cf';
        g.fillRect(0, 0, 1080, height);
        // เลื่อนจุดเริ่มวาดลงมา ให้เนื้อหาขนาด 1080×1080 อยู่กลางรูป (รูปจัตุรัสเลื่อน 0)
        g.translate(0, (height - 1080) / 2);
        // หัวรูป
        g.textAlign = 'center';
        g.fillStyle = INK;
        g.font = '600 60px Pridi, sans-serif';
        g.fillText('nakcat', 540, 120);
        g.fillStyle = MUTED;
        g.font = '400 38px "IBM Plex Sans Thai Looped", sans-serif';
        g.fillText('ถ้าแมวพูดได้วันเดียว ประโยคแรกคือ...', 540, 185);
        // กรอบคำพูด และหางที่ชี้ลงไปหาแมว
        g.fillStyle = '#fbf8f2';
        g.beginPath();
        g.roundRect(90, 230, 900, 500, 56);
        g.fill();
        g.beginPath();
        g.moveTo(200, 720);
        g.lineTo(300, 720);
        g.lineTo(190, 800);
        g.closePath();
        g.fill();
        // ประโยคในกรอบ: วัดความสูงก่อน แล้ววางให้อยู่กลางกรอบ
        g.font = '600 66px Pridi, sans-serif';
        const lines = wrapLines(g, `“${line.text}”`, 760).slice(0, 4);
        const blockHeight = lines.length * 90 + (line.context ? 70 : 0);
        let y = 230 + (500 - blockHeight) / 2 + 68;
        g.fillStyle = INK;
        lines.forEach((text) => {
            g.fillText(text, 540, y);
            y += 90;
        });
        if (line.context) {
            g.fillStyle = MUTED;
            g.font = '400 40px "IBM Plex Sans Thai Looped", sans-serif';
            g.fillText(`(${line.context})`, 540, y - 10);
        }
        // แมวกับชื่อ (ชื่อยาวจะย่อตัวอักษรลงให้พอดี)
        g.fillStyle = '#fbf8f2';
        g.beginPath();
        g.arc(190, 885, 78, 0, Math.PI * 2);
        g.fill();
        g.textBaseline = 'middle';
        g.font = '100px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        g.fillText('🐱', 190, 892);
        g.textBaseline = 'alphabetic';
        const byText = `— ${name} กล่าว`;
        g.textAlign = 'left';
        g.font = '600 60px Pridi, sans-serif';
        const width = g.measureText(byText).width;
        if (width > 690)
            g.font = `600 ${Math.floor((60 * 690) / width)}px Pridi, sans-serif`;
        g.fillStyle = ORANGE;
        g.fillText(byText, 300, 905);
        // ท้ายรูป
        g.textAlign = 'center';
        g.fillStyle = INK;
        g.font = '500 40px "IBM Plex Sans Thai Looped", sans-serif';
        g.fillText('เล่นได้ที่ nakcat.netlify.app  #nakcat', 540, 1030);
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png');
        });
    }
    // ===================== หน้าเว็บ =====================
    const form = document.querySelector('#catsays-form');
    const nameInput = document.querySelector('#catsays-name');
    const speakBtn = document.querySelector('#catsays-speak');
    const bubble = document.querySelector('#catsays-bubble');
    const byline = document.querySelector('#catsays-by');
    const saveBtn = document.querySelector('#catsays-save');
    const hint = document.querySelector('#catsays-hint');
    const shareBox = document.querySelector('#catsays-share');
    const ratingBox = document.querySelector('#catsays-rating');
    // หน้าที่ไม่มีเกมนี้ (หาไม่เจอสักชิ้น) ก็ไม่ต้องทำอะไรต่อ
    if (!form || !nameInput || !speakBtn || !bubble || !byline || !saveBtn || !hint || !shareBox || !ratingBox)
        return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(pointer: coarse)').matches; // จอสัมผัส = มือถือ/แท็บเล็ต
    let current = null; // ประโยคที่กำลังแสดงอยู่ (null = ยังไม่ได้กด)
    let currentName = DEFAULT_NAME;
    // สุ่มประโยคใหม่แล้วแสดงในกรอบคำพูด
    const speak = () => {
        track('plays:cat-says'); // ได้ประโยคใหม่ 1 ครั้ง = เล่น 1 ครั้ง
        current = pickLine();
        currentName = cleanName(nameInput.value);
        // ใช้ textContent ไม่ใช่ innerHTML: ชื่อที่ผู้ใช้พิมพ์จะแสดงเป็นตัวหนังสือเสมอ ไม่ถูกตีความเป็นโค้ด
        bubble.textContent = `“${current.text}”`;
        if (current.context) {
            const small = document.createElement('small');
            small.textContent = `(${current.context})`;
            bubble.append(small);
        }
        bubble.classList.remove('is-empty');
        byline.textContent = `— ${currentName} กล่าว`;
        if (!reduceMotion) {
            bubble.animate([{ transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
        }
        speakBtn.textContent = 'พูดอีกประโยค';
        saveBtn.hidden = false;
        hint.textContent = '';
        // แถบแชร์แบบเดียวกับเกมอื่น (สร้างใหม่ทุกประโยค)
        const card = {
            text: `ถ้า${currentName}พูดได้วันเดียว ประโยคแรกคือ “${current.text}” มาฟังแมวที่บ้านคุณพูดบ้าง`,
            emoji: '🐱',
            label: 'ถ้าแมวพูดได้วันเดียว',
            title: currentName,
            sub: `“${current.text}”`,
        };
        shareBox.innerHTML = shareBar(card);
        // เตรียมรูปสตอรี่แบบกรอบคำพูดไว้ล่วงหน้าให้ปุ่ม IG Story (ถ้ากดก่อนรูปเสร็จ จะได้รูปแบบมาตรฐานของเว็บแทน)
        makeImage(current, currentName, 1920)
            .then((blob) => { card.blob = blob; })
            .catch(() => { });
        if (ratingBox.innerHTML === '')
            ratingBox.innerHTML = gameRating('cat-says');
    };
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // กันไม่ให้หน้าเว็บโหลดใหม่ตอนกดปุ่ม/กด Enter
        speak();
    });
    // ดาวน์โหลดรูปลงเครื่อง (ใช้บนคอมพิวเตอร์ หรือเมื่อแชร์ตรงไม่ได้)
    const download = (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'nakcat-catsays.png';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        hint.textContent = 'บันทึกรูปแล้ว เอาไปลงโซเชียลได้เลย อย่าลืมแท็ก #nakcat นะ';
    };
    saveBtn.addEventListener('click', async () => {
        if (!current)
            return;
        const line = current;
        const name = currentName;
        saveBtn.disabled = true;
        hint.textContent = 'กำลังสร้างรูป...';
        try {
            const blob = await makeImage(line, name);
            const file = new File([blob], 'nakcat-catsays.png', { type: 'image/png' });
            // มือถือ/แท็บเล็ต: เปิดเมนูแชร์ เลือกแอปโซเชียลหรือบันทึกรูปได้เลย
            // (คอมพิวเตอร์บางเครื่องก็มีเมนูแชร์ แต่ดาวน์โหลดเป็นไฟล์ใช้ง่ายกว่า)
            if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        text: `ถ้า${name}พูดได้วันเดียว ประโยคแรกคือ “${line.text}” ลองเล่นที่ https://nakcat.netlify.app/#games #nakcat`,
                    });
                    hint.textContent = '';
                }
                catch (err) {
                    // กดยกเลิกเมนูแชร์เอง ไม่ต้องทำอะไร / แชร์ไม่ได้ด้วยเหตุอื่น ดาวน์โหลดแทน
                    if (err instanceof DOMException && err.name === 'AbortError')
                        hint.textContent = '';
                    else
                        download(blob);
                }
            }
            else {
                download(blob);
            }
        }
        catch (err) {
            hint.textContent = 'สร้างรูปไม่สำเร็จ ลองอีกครั้งนะ';
        }
        saveBtn.disabled = false;
    });
})();
