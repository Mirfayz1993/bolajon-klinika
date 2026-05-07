// Print template helpers — extracted from page.tsx (Stage 0 refactor).
// HTML/CSS strings are preserved verbatim — behavior must remain identical.

import { floorLabel } from '@/lib/utils';

// --- Types -------------------------------------------------------------------

interface PrintPatient {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  birthDate: string;
}

interface PrintAssignedService {
  id: string;
  categoryName: string;
  itemName: string;
  price: number;
  isPaid: boolean;
  doctor?: { name: string; role: string } | null;
  admission?: { bed: { bedNumber: string; room: { roomNumber: string; floor: number } } | null } | null;
}

interface PrintNurseNote {
  createdAt: string;
  medicines?: { name: string; quantity: number; unit: string }[] | null;
}

interface PrintPrescription {
  medicineName: string;
  dosage: string;
  duration: string;
  instructions?: string;
  createdAt: string;
}

interface PrintPrescriptionInput {
  medicineName: string;
  dosage: string;
  duration: string;
  instructions: string;
}

// --- printQr -----------------------------------------------------------------

export function printQr(opts: {
  patient: PrintPatient;
  qrDataUrl: string | null;
}): void {
  const { patient, qrDataUrl } = opts;
  if (!qrDataUrl) return;
  const p = patient;
  const html = `<html><head><title>QR - ${p.lastName} ${p.firstName}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:20px}
      .name{font-size:18px;font-weight:bold;margin-bottom:4px}
      .info{font-size:13px;color:#666;margin-bottom:16px}
      img{width:220px;height:220px}
      .box{border:2px solid #1e293b;display:inline-block;padding:16px;border-radius:12px}
      </style></head>
      <body>
        <div class="box">
          <div class="name">${p.lastName} ${p.firstName} ${p.fatherName}</div>
          <div class="info">${p.phone} | Tug'ilgan yil: ${new Date(p.birthDate).getFullYear()}</div>
          <img src="${qrDataUrl}" alt="QR"/>
          <div class="info" style="margin-top:8px">Bolajon Klinikasi</div>
        </div>
      </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:500px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
}

// --- printReceipt ------------------------------------------------------------

export async function printReceipt(opts: {
  patient: PrintPatient;
  qrDataUrl: string | null;
  setQrDataUrl: (url: string) => void;
  assignedServices: PrintAssignedService[];
  nurseNotes: PrintNurseNote[];
  justPaidIds?: string[];
  canSeePrices: boolean;
  patientId: string;
}): Promise<void> {
  const {
    patient,
    qrDataUrl,
    setQrDataUrl,
    assignedServices,
    nurseNotes,
    justPaidIds,
    canSeePrices,
    patientId,
  } = opts;

  if (!canSeePrices) return;
  const p = patient;

  // Oynani SYNC ochib olamiz (popup bloker oldini olish)
  const win = window.open('', '_blank', 'width=440,height=720');
  if (!win) { alert("Popup bloklangan. Brauzer sozlamalaridan ruxsat bering."); return; }
  win.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:20px">⏳ Yuklanmoqda...</body></html>');

  // Ensure QR is loaded
  let qr = qrDataUrl;
  if (!qr) {
    const r = await fetch(`/api/patients/${patientId}/qr`);
    if (r.ok) { const j = await r.json(); qr = j.dataUrl; setQrDataUrl(j.dataUrl); }
  }

  // Klinika logotipi — server dan base64 olamiz (print uchun ishonchli)
  let logoDataUrl = '';
  try {
    const logoRes = await fetch('/api/clinic-logo');
    if (logoRes.ok) { const j = await logoRes.json(); logoDataUrl = j.dataUrl ?? ''; }
  } catch { /* fallback: logosiz */ }

  // justPaidIds berilsa — faqat shular; aks holda barcha to'langan
  const paid = justPaidIds
    ? assignedServices.filter(s => justPaidIds.includes(s.id))
    : assignedServices.filter(s => s.isPaid);
  const unpaid = assignedServices.filter(s => !s.isPaid && !(justPaidIds?.includes(s.id)));

  // Medicines from nurse notes
  const allMedicines: { name: string; quantity: number; unit: string; date: string }[] = [];
  for (const note of nurseNotes ?? []) {
    if (Array.isArray(note.medicines)) {
      for (const m of note.medicines as { name: string; quantity: number; unit: string }[]) {
        allMedicines.push({ ...m, date: note.createdAt });
      }
    }
  }

  const fmtM = (n: number) => n.toLocaleString('uz-UZ') + " so'm";
  const fmtD = (d: string) => new Date(d).toLocaleDateString('uz-UZ');

  const paidRows = paid.map(sv => {
    // Faqat shifokor xizmatlarida "Doktor: To'liq Ism" ko'rsatiladi
    const doctorName = sv.doctor?.name ?? '';
    const isAmb = sv.categoryName.toLowerCase().includes('ambulator');
    const bed = sv.admission?.bed;
    const bedInfo = isAmb && bed
      ? `<div style="font-size:13px;font-weight:bold;margin-top:3px;">Xona: ${bed.room.roomNumber} (${floorLabel(bed.room.floor)}) &nbsp;|&nbsp; Krovat: №${bed.bedNumber}</div>`
      : '';
    return `<tr>
        <td colspan="2" style="padding:7px 8px;border-bottom:1px dashed #aaa;">
          <div style="font-weight:900;font-size:14px;">${sv.categoryName}</div>
          <div style="font-weight:900;font-size:14px;margin-top:1px;">${sv.itemName}</div>
          ${doctorName ? `<div style="font-size:13px;font-weight:bold;margin-top:3px;">Doktor: ${doctorName}</div>` : ''}
          ${bedInfo}
        </td>
      </tr>`;
  }).join('');

  const unpaidRows = unpaid.map(sv =>
    `<tr>
        <td style="padding:5px 8px;">
          ${sv.categoryName} — ${sv.itemName}
        </td>
        <td style="padding:5px 8px;text-align:right;">${fmtM(Number(sv.price))}</td>
      </tr>`
  ).join('');

  const medicineRows = allMedicines.map(m =>
    `<tr>
        <td style="padding:5px 8px;">
          ${m.name} x ${m.quantity} ${m.unit}
        </td>
        <td style="padding:5px 8px;text-align:right;font-size:11px;">${fmtD(m.date)}</td>
      </tr>`
  ).join('');

  const reminderSection = (unpaid.length > 0 || allMedicines.length > 0) ? `
      <tr><td colspan="2" style="height:12px;"></td></tr>
      <tr><td colspan="2" style="padding:6px 8px;font-size:11px;font-weight:bold;border-top:2px dashed #000;border-bottom:1px solid #000;">
        ESLATMA — Tolanmagan xizmatlar
      </td></tr>
      ${unpaidRows}
      ${allMedicines.length > 0 ? `
        <tr><td colspan="2" style="padding:4px 8px;font-size:11px;font-weight:bold;border-top:1px solid #000;">
          Belgilangan dorilar
        </td></tr>
        ${medicineRows}
      ` : ''}
    ` : '';

  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>Chek — ${p.lastName} ${p.firstName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;color:#000!important;background:transparent!important}
        img{background:#fff!important}
        body{font-family:'Times New Roman',Times,serif;font-size:16px;font-weight:bold;background:#fff!important;padding:0}
        .wrap{max-width:380px;margin:0 auto;padding:12px}
        .header{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid #000;margin-bottom:10px}
        .header-logo{width:52px;height:52px;object-fit:contain;flex-shrink:0}
        .header-text{flex:1}
        .logo{font-size:20px;font-weight:900;letter-spacing:1px}
        .sub{font-size:14px;font-weight:bold}
        .patient{border:1px solid #000;padding:8px 10px;margin-top:10px;margin-bottom:10px}
        .patient .name{font-weight:900;font-size:17px}
        .patient .info{font-size:15px;font-weight:bold;margin-top:3px}
        table{width:100%;border-collapse:collapse;margin-bottom:8px}
        .total-row{border-top:2px solid #000;border-bottom:2px solid #000;font-weight:bold}
        .total-row td{padding:8px!important;font-size:18px;font-weight:900}
        .qr-section{text-align:center;margin-top:12px;padding-top:10px;border-top:2px solid #000}
        .qr-section img{width:160px;height:160px;background:#fff!important;display:block;margin:0 auto;image-rendering:crisp-edges}
        .qr-section .qr-label{font-size:13px;font-weight:bold;margin-top:4px}
        .date{text-align:right;font-size:14px;font-weight:bold;margin-bottom:8px}
        @media print{
          @page{margin:4mm 3mm;size:80mm auto}
          .no-print{display:none}
          body{font-size:16px}
          img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
          *{color:#000!important;background:transparent!important;-webkit-print-color-adjust:exact}
        }
      </style>
    </head><body>
    <div class="wrap">
      <div class="no-print" style="text-align:center;margin-bottom:12px">
        <button onclick="window.print()" style="padding:8px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Chop etish</button>
      </div>
      <div class="header">
        ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="Logo" />` : ''}
        <div class="header-text">
          <div class="logo">BOLAJON KLINIKASI</div>
          <div class="sub">Xizmat ko'rsatish cheki</div>
        </div>
      </div>
      <div class="date">${new Date().toLocaleString('uz-UZ')}</div>
      <table>
        <thead></thead>
        <tbody>
          ${paidRows}
          <tr class="total-row">
            <td colspan="2" style="text-align:center;letter-spacing:2px;">✓ TO'LANDI</td>
          </tr>
          ${reminderSection}
        </tbody>
      </table>
      <div class="patient">
        <div class="name">${p.lastName} ${p.firstName} ${p.fatherName}</div>
        <div class="info">${new Date(p.birthDate).getFullYear()}</div>
      </div>
      <div class="qr-section">
        ${qr ? `<img src="${qr}" alt="QR"/>` : '<p>QR yuklanmadi</p>'}
        <div class="qr-label">Bemor kartasini skanerlang</div>
      </div>
    </div>
    </body></html>`);
  win.document.close();
}

// --- printPrescription -------------------------------------------------------

export async function printPrescription(rx: PrintPrescription): Promise<void> {
  let logoDataUrl = '';
  try {
    const logoRes = await fetch('/api/clinic-logo');
    if (logoRes.ok) { const j = await logoRes.json(); logoDataUrl = j.dataUrl ?? ''; }
  } catch { /* logosiz */ }

  const logoHtml = logoDataUrl
    ? `<div style="text-align:center;margin-bottom:8px"><img src="${logoDataUrl}" style="max-height:70px;max-width:180px;object-fit:contain"/></div>`
    : '';

  const html = `<html><head><meta charset="utf-8"/><title>Retsept</title>
    <style>
      body{font-family:sans-serif;padding:24px;max-width:400px;margin:0 auto}
      h2{margin:8px 0 16px;text-align:center;font-size:18px}
      .divider{border:none;border-top:1px dashed #999;margin:12px 0}
      p{margin:8px 0}
      .clinic-name{text-align:center;font-size:13px;color:#555;margin-bottom:4px}
      img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      @media print{body{padding:16px}}
    </style>
    </head><body>
    ${logoHtml}
    <div class="clinic-name">BOLAJON KLINIKASI</div>
    <hr class="divider"/>
    <h2>Retsept</h2>
    <p><strong>Dori:</strong> ${rx.medicineName}</p>
    <p><strong>Dozasi:</strong> ${rx.dosage}</p>
    <p><strong>Muddati:</strong> ${rx.duration}</p>
    ${rx.instructions ? `<p><strong>Ko'rsatma:</strong> ${rx.instructions}</p>` : ''}
    <hr class="divider"/>
    <p style="color:#888;font-size:12px">Sana: ${new Date(rx.createdAt).toLocaleDateString('uz-UZ')}</p>
    <p style="margin-top:32px;font-size:12px">Shifokor imzosi: ___________</p>
    </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:500px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
  }, 300);
}

// --- printPrescriptions ------------------------------------------------------

export function printPrescriptions(
  patient: { firstName: string; lastName: string; fatherName: string; birthDate: string },
  rxList: PrintPrescriptionInput[]
): void {
  const today = new Date().toLocaleDateString('uz-UZ');
  const patientName = `${patient.lastName} ${patient.firstName} ${patient.fatherName}`;
  const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();

  const rows = rxList.map((rx, i) => `
    <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed #000;">
      <b>${i + 1}. ${rx.medicineName}</b><br/>
      Dozasi: ${rx.dosage}<br/>
      Muddat: ${rx.duration}<br/>
      ${rx.instructions ? `Ko'rsatma: ${rx.instructions}<br/>` : ''}
    </div>
  `).join('');

  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      * { color: #000 !important; background: transparent !important; }
      body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; margin: 0; width: 72mm; }
      h2 { font-size: 14px; text-align: center; margin: 0 0 8px; }
      .center { text-align: center; }
      .line { border-top: 1px dashed #000; margin: 6px 0; }
      @media print { body { width: 72mm; } }
    </style>
  </head><body>
    <h2>BOLAJON KLINIKASI</h2>
    <div class="center" style="font-size:11px;">RETSEPT</div>
    <div class="line"></div>
    <div>Bemor: <b>${patientName}</b></div>
    <div>Yosh: ${age}</div>
    <div>Sana: ${today}</div>
    <div class="line"></div>
    ${rows}
    <div class="line"></div>
    <div class="center" style="font-size:10px;">Shifokor imzosi: ___________</div>
  </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:600px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
  }, 300);
}
