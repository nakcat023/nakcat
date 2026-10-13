"use strict";
// เครื่องคิดอายุแมวเป็นอายุคน: 1 ปี ≈ 15, 2 ปี ≈ 24 จากนั้น +4 ต่อปี
// ไฟล์ต้นฉบับคือ src/age.ts — แก้ที่นั่นแล้วสั่ง npm run build จะได้ nakcat-site/age.js ใหม่
(() => {
    const ageYearsEl = document.querySelector('#age-years');
    const ageMonthsEl = document.querySelector('#age-months');
    const humanAgeEl = document.querySelector('#human-age');
    const ageStageEl = document.querySelector('#age-stage');
    const ageTipEl = document.querySelector('#age-tip');
    const ageForm = document.querySelector('#age-form');
    // หน้าที่ไม่มีเครื่องคิดอายุ ก็ไม่ต้องทำอะไรต่อ
    if (!ageYearsEl || !ageMonthsEl || !humanAgeEl || !ageStageEl || !ageTipEl || !ageForm)
        return;
    const stepBtns = ageForm.querySelectorAll('.step-btn');
    const MAX_YEARS = 30;
    let ageYears = 3;
    let ageMonths = 0;
    const agePoints = [[0, 0], [1, 1], [3, 4], [6, 10], [12, 15], [24, 24]];
    const stages = [
        { until: 12, name: 'ลูกแมว', tip: 'ช่วงสำคัญของวัคซีนและการถ่ายพยาธิ ให้อาหารสูตรลูกแมวและพาไปตรวจตามนัดหมอ' },
        { until: 84, name: 'วัยหนุ่มสาว', tip: 'พลังเหลือเฟือ ชวนเล่นวันละ 2–3 รอบ และตรวจสุขภาพประจำปีปีละครั้ง' },
        { until: 132, name: 'วัยผู้ใหญ่', tip: 'ระวังน้ำหนักเกินและดูแลสุขภาพช่องปาก เพราะโรคฟันพบบ่อยในวัยนี้' },
        { until: Infinity, name: 'วัยสูงวัย', tip: 'ตรวจสุขภาพทุก 6 เดือน และสังเกตการกินน้ำ ปัสสาวะ และน้ำหนักตัวอย่างใกล้ชิด' },
    ];
    // อายุแมว (เดือน) → อายุคน (ปี): ช่วงก่อน 2 ปีลากเส้นตรงระหว่างจุดเทียบ
    function toHumanAge(months) {
        if (months <= 0)
            return 0;
        if (months >= 24)
            return 24 + ((months - 24) / 12) * 4;
        for (let i = 1; i < agePoints.length; i++) {
            const [m1, h1] = agePoints[i - 1];
            const [m2, h2] = agePoints[i];
            if (months <= m2)
                return h1 + ((months - m1) / (m2 - m1)) * (h2 - h1);
        }
        return 24; // ไม่มีทางมาถึงตรงนี้ (จุดสุดท้ายคือ 24 เดือน) แต่ใส่ไว้ให้ครบทุกทาง
    }
    // แสดงผลใหม่ทั้งหมดตามอายุปัจจุบัน
    // (ใช้แบบลูกศร ไม่ใช้ function เพราะ function เรียกใช้ได้ก่อนบรรทัดเช็ก null ข้างบน TypeScript จึงไม่ยอมเชื่อว่าไม่ใช่ null)
    const updateAge = () => {
        ageYearsEl.textContent = String(ageYears);
        ageMonthsEl.textContent = String(ageMonths);
        const months = ageYears * 12 + ageMonths;
        stepBtns.forEach((btn) => {
            if (btn.dataset.step === '-1')
                btn.disabled = months === 0;
            else
                btn.disabled = btn.dataset.unit === 'years' ? ageYears >= MAX_YEARS : months >= MAX_YEARS * 12 + 11;
        });
        // ช่วงสุดท้ายคือ Infinity จึงหาเจอเสมอ แต่ find() อาจคืน undefined ได้ตามหลัก เลยกันไว้
        const stage = stages.find((s) => months < s.until) ?? stages[stages.length - 1];
        humanAgeEl.textContent = String(Math.round(toHumanAge(months)));
        ageStageEl.textContent = stage.name;
        ageTipEl.textContent = stage.tip;
    };
    // ปุ่ม − / +  (เดือนเกิน 11 จะปัดเป็นปีถัดไป และกลับกัน)
    stepBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const step = Number(btn.dataset.step);
            let total = ageYears * 12 + ageMonths;
            total += btn.dataset.unit === 'years' ? step * 12 : step;
            total = Math.min(Math.max(total, 0), MAX_YEARS * 12 + 11);
            if (btn.dataset.unit === 'years' && total > MAX_YEARS * 12)
                total = MAX_YEARS * 12 + ageMonths;
            ageYears = Math.floor(total / 12);
            ageMonths = total % 12;
            updateAge();
        });
    });
    ageForm.addEventListener('submit', (e) => e.preventDefault());
    updateAge();
})();
