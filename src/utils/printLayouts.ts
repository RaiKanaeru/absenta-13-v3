// Print Layout Utilities untuk Laporan Absenta
import { toast } from '@/hooks/use-toast';

export interface PrintData {
  nama: string;
  nis?: string;
  nip?: string;
  nama_kelas?: string;
  H?: number;
  I?: number;
  S?: number;
  A?: number;
  D?: number;
  presentase?: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface LetterheadConfig {
  enabled: boolean;
  lines: Array<{
    text: string;
    fontWeight: 'normal' | 'bold';
  }>;
  alignment: 'left' | 'center' | 'right';
}

// Default letterhead fallback
const DEFAULT_LETTERHEAD: LetterheadConfig = {
  enabled: true,
  lines: [
    { text: "PEMERINTAH DAERAH PROVINSI DKI JAKARTA", fontWeight: "bold" },
    { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
    { text: "SMK NEGERI 13 JAKARTA", fontWeight: "bold" },
    { text: "Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910", fontWeight: "normal" }
  ],
  alignment: "center"
};

// Function to render letterhead HTML
export function renderLetterheadHTML(letterhead: LetterheadConfig | null): string {
  const config = letterhead || DEFAULT_LETTERHEAD;
  
  if (!config.enabled || !config.lines || config.lines.length === 0) {
    return '';
  }

  const alignment = config.alignment || 'center';
  
  const lines = config.lines
    .filter(line => {
      // Handle both old format (string) and new format (object)
      const text = typeof line === 'string' ? line : line.text;
      return text.trim().length > 0;
    })
    .map((line, index) => {
      // Handle both old format (string) and new format (object)
      const text = typeof line === 'string' ? line : line.text;
      const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');
      const style = fontWeight === 'bold' ? 'font-weight:bold;font-size:18px;' : 'font-size:14px;';
      return `<div style="${style}">${escapeHtml(text)}</div>`;
    })
    .join('');

  return `
    <div style="text-align:${alignment};margin-bottom:20px;">
      ${lines}
    </div>
    <hr style="margin:20px 0;border:1px solid #ddd;" />
  `;
}

// Function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const printReport = (
  data: PrintData[], 
  layout: string, 
  dateRange: DateRange,
  reportType: 'student' | 'teacher' = 'student',
  letterhead: LetterheadConfig | null = null
) => {
  if (data.length === 0) {
    toast({ title: 'Tidak ada data', description: 'Tidak ada data untuk dicetak', variant: 'destructive' });
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  let content = '';
  
  switch (layout) {
    case 'simple':
      content = generateSimpleLayout(data, dateRange, reportType, letterhead);
      break;
    case 'detailed':
      content = generateDetailedLayout(data, dateRange, reportType, letterhead);
      break;
    case 'compact':
      content = generateCompactLayout(data, dateRange, reportType, letterhead);
      break;
    case 'official':
      content = generateOfficialLayout(data, dateRange, reportType, letterhead);
      break;
    default:
      content = generateSimpleLayout(data, dateRange, reportType, letterhead);
  }

  const title = reportType === 'student' ? 'Laporan Kehadiran Siswa' : 'Laporan Kehadiran Guru';

  printWindow.document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { 
          font-family: 'Times New Roman', serif; 
          margin: 20px; 
          line-height: 1.4;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          page-break-inside: avoid;
        }
        .title { 
          font-size: 18px; 
          font-weight: bold; 
          margin-bottom: 10px; 
          text-transform: uppercase;
        }
        .subtitle { 
          font-size: 14px; 
          margin-bottom: 5px; 
        }
        .date-range { 
          font-size: 12px; 
          color: #333; 
          margin-bottom: 20px; 
        }
        .table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
          font-size: 11px;
        }
        .table th, .table td { 
          border: 1px solid #000; 
          padding: 6px; 
          text-align: center; 
        }
        .table th { 
          background-color: #f0f0f0; 
          font-weight: bold; 
          font-size: 10px;
        }
        .table td.left { 
          text-align: left; 
        }
        .footer { 
          margin-top: 40px; 
          page-break-inside: avoid;
        }
        .signature { 
          margin-top: 50px; 
        }
        @media print {
          body { 
            margin: 15px; 
            font-size: 12px;
          }
          .no-print { 
            display: none; 
          }
          .page-break { 
            page-break-before: always; 
          }
          @page {
            margin: 2cm;
            size: A4;
          }
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
  printWindow.document.close();
  
  // Trigger print after delay to ensure styles render
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 500);
};

const generateSimpleLayout = (data: PrintData[], dateRange: DateRange, reportType: 'student' | 'teacher', letterhead: LetterheadConfig | null = null) => {
  const isStudent = reportType === 'student';
  const title = isStudent ? 'LAPORAN KEHADIRAN SISWA' : 'LAPORAN KEHADIRAN GURU';
  const idLabel = isStudent ? 'NIS' : 'NIP';
  
  return `
    ${renderLetterheadHTML(letterhead)}
    <div class="header">
      <div class="title">${title}</div>
      <div class="date-range">Periode: ${dateRange.startDate} s/d ${dateRange.endDate}</div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 25%;">Nama</th>
          <th style="width: 15%;">${idLabel}</th>
          ${isStudent ? '<th style="width: 10%;">Kelas</th>' : ''}
          <th style="width: 8%;">H</th>
          <th style="width: 8%;">I</th>
          <th style="width: 8%;">S</th>
          <th style="width: 8%;">A</th>
          <th style="width: 13%;">Presentase</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td class="left">${item.nama}</td>
            <td>${isStudent ? item.nis : item.nip}</td>
            ${isStudent ? `<td>${item.nama_kelas || '-'}</td>` : ''}
            <td>${item.H || 0}</td>
            <td>${item.I || 0}</td>
            <td>${item.S || 0}</td>
            <td>${item.A || 0}</td>
            <td>${Number(item.presentase || 0).toFixed(2)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

const generateDetailedLayout = (data: PrintData[], dateRange: DateRange, reportType: 'student' | 'teacher', letterhead: LetterheadConfig | null = null) => {
  const isStudent = reportType === 'student';
  const title = isStudent ? 'LAPORAN DETAIL KEHADIRAN SISWA' : 'LAPORAN DETAIL KEHADIRAN GURU';
  const idLabel = isStudent ? 'NIS' : 'NIP';
  
  return `
    ${renderLetterheadHTML(letterhead)}
    <div class="header">
      <div class="title">${title}</div>
      <div class="date-range">Periode: ${dateRange.startDate} s/d ${dateRange.endDate}</div>
      <div class="date-range">Dicetak pada: ${new Date().toLocaleDateString('id-ID')} pukul ${new Date().toLocaleTimeString('id-ID')}</div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 5%;">No</th>
          <th rowspan="2" style="width: 20%;">Nama ${isStudent ? 'Siswa' : 'Guru'}</th>
          <th rowspan="2" style="width: 12%;">${idLabel}</th>
          ${isStudent ? '<th rowspan="2" style="width: 8%;">Kelas</th>' : ''}
          <th colspan="5" style="width: 40%;">Kehadiran</th>
          <th rowspan="2" style="width: 10%;">Total</th>
          <th rowspan="2" style="width: 10%;">Presentase</th>
        </tr>
        <tr>
          <th style="background-color: #e8f5e8;">H</th>
          <th style="background-color: #fff3cd;">I</th>
          <th style="background-color: #f8d7da;">S</th>
          <th style="background-color: #f5c6cb;">A</th>
          <th style="background-color: #d1ecf1;">D</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((item, index) => {
          const total = (item.H || 0) + (item.I || 0) + (item.S || 0) + (item.A || 0) + (item.D || 0);
          return `
            <tr>
              <td>${index + 1}</td>
              <td class="left" style="font-weight: bold;">${item.nama}</td>
              <td>${isStudent ? item.nis : item.nip}</td>
              ${isStudent ? `<td>${item.nama_kelas || '-'}</td>` : ''}
              <td style="background-color: #e8f5e8; font-weight: bold;">${item.H || 0}</td>
              <td style="background-color: #fff3cd;">${item.I || 0}</td>
              <td style="background-color: #f8d7da;">${item.S || 0}</td>
              <td style="background-color: #f5c6cb;">${item.A || 0}</td>
              <td style="background-color: #d1ecf1;">${item.D || 0}</td>
              <td style="font-weight: bold;">${total}</td>
              <td style="font-weight: bold;">${Number(item.presentase || 0).toFixed(2)}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div class="footer">
      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div style="text-align: center;">
          <div>Mengetahui,</div>
          <div>Kepala Sekolah</div>
          <div style="margin-top: 70px; border-top: 1px solid #000; width: 200px;">
            <div style="margin-top: 5px;">Drs. Nama Kepala Sekolah</div>
            <div>NIP. 19xxxxxxxxxxxxxxxx</div>
          </div>
        </div>
        <div style="text-align: center;">
          <div>Example, ${new Date().toLocaleDateString('id-ID')}</div>
          <div>${isStudent ? 'Wali Kelas' : 'Koordinator Guru'}</div>
          <div style="margin-top: 70px; border-top: 1px solid #000; width: 200px;">
            <div style="margin-top: 5px;">Nama ${isStudent ? 'Wali Kelas' : 'Koordinator'}</div>
            <div>NIP. 19xxxxxxxxxxxxxxxx</div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const generateCompactLayout = (data: PrintData[], dateRange: DateRange, reportType: 'student' | 'teacher', letterhead: LetterheadConfig | null = null) => {
  const isStudent = reportType === 'student';
  const title = isStudent ? 'REKAP KEHADIRAN SISWA' : 'REKAP KEHADIRAN GURU';
  const idLabel = isStudent ? 'NIS' : 'NIP';
  
  return `
    ${renderLetterheadHTML(letterhead)}
    <div class="header">
      <div class="title">${title}</div>
      <div class="date-range">${dateRange.startDate} s/d ${dateRange.endDate}</div>
    </div>
    <table class="table" style="font-size: 10px;">
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 30%;">Nama</th>
          <th style="width: 15%;">${idLabel}</th>
          ${isStudent ? '<th style="width: 10%;">Kelas</th>' : ''}
          <th style="width: 8%;">H</th>
          <th style="width: 8%;">I</th>
          <th style="width: 8%;">S</th>
          <th style="width: 8%;">A</th>
          <th style="width: 8%;">%</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td class="left">${item.nama}</td>
            <td>${isStudent ? item.nis : item.nip}</td>
            ${isStudent ? `<td>${item.nama_kelas || '-'}</td>` : ''}
            <td>${item.H || 0}</td>
            <td>${item.I || 0}</td>
            <td>${item.S || 0}</td>
            <td>${item.A || 0}</td>
            <td>${Number(item.presentase || 0).toFixed(1)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

const generateOfficialLayout = (data: PrintData[], dateRange: DateRange, reportType: 'student' | 'teacher', letterhead: LetterheadConfig | null = null) => {
  const isStudent = reportType === 'student';
  const title = isStudent ? 'LAPORAN KEHADIRAN SISWA' : 'LAPORAN KEHADIRAN GURU';
  const idLabel = isStudent ? 'Nomor Induk Siswa' : 'Nomor Induk Pegawai';
  
  // Use dynamic letterhead if available, otherwise fallback to hardcoded
  const letterheadHTML = letterhead && letterhead.enabled ? 
    renderLetterheadHTML(letterhead) : 
    `
    <div class="header">
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 100px; border: none; text-align: center;">
            <img src="/logo.png" alt="Logo" style="width: 80px; height: 80px;">
          </td>
          <td style="border: none; text-align: center;">
            <div style="font-size: 16px; font-weight: bold;">PEMERINTAH PROVINSI JAWA TENGAH</div>
            <div style="font-size: 18px; font-weight: bold;">DINAS PENDIDIKAN DAN KEBUDAYAAN</div>
            <div style="font-size: 20px; font-weight: bold;">SMA NEGERI 1 EXAMPLE</div>
            <div style="font-size: 12px;">NSS: 301031234567 • NPSN: 12345678</div>
            <div style="font-size: 12px;">Jl. Pendidikan No. 123, Telp. (0271) 123456</div>
            <div style="font-size: 12px;">Website: www.sman1example.sch.id • Email: info@sman1example.sch.id</div>
          </td>
          <td style="width: 100px; border: none;"></td>
        </tr>
      </table>
      <hr style="border-top: 3px solid #000; margin: 20px 0;">
    </div>
    `;
  
  return `
    ${letterheadHTML}
    <div class="header">
      <div class="title" style="text-decoration: underline;">${title}</div>
      <div class="date-range">Periode: ${dateRange.startDate} sampai dengan ${dateRange.endDate}</div>
    </div>
    <table class="table">
      <thead>
        <tr style="background-color: #4472c4; color: white;">
          <th style="width: 5%;">No</th>
          <th style="width: 20%;">Nama ${isStudent ? 'Siswa' : 'Guru'}</th>
          <th style="width: 12%;">${idLabel}</th>
          ${isStudent ? '<th style="width: 8%;">Kelas</th>' : ''}
          <th style="width: 8%;">Hadir</th>
          <th style="width: 8%;">Izin</th>
          <th style="width: 8%;">Sakit</th>
          <th style="width: 8%;">Alpa</th>
          <th style="width: 8%;">Dispen</th>
          <th style="width: 15%;">Presentase Kehadiran</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td class="left" style="font-weight: bold;">${item.nama}</td>
            <td>${isStudent ? item.nis : item.nip}</td>
            ${isStudent ? `<td>${item.nama_kelas || '-'}</td>` : ''}
            <td style="background-color: #e8f5e8; font-weight: bold;">${item.H || 0}</td>
            <td style="background-color: #fff3cd;">${item.I || 0}</td>
            <td style="background-color: #f8d7da;">${item.S || 0}</td>
            <td style="background-color: #f5c6cb;">${item.A || 0}</td>
            <td style="background-color: #d1ecf1;">${item.D || 0}</td>
            <td style="font-weight: bold; color: ${Number(item.presentase || 0) >= 80 ? '#28a745' : '#dc3545'};">
              ${Number(item.presentase || 0).toFixed(2)}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <!-- Summary Statistics -->
    <div style="margin-top: 30px;">
      <h4>RINGKASAN STATISTIK</h4>
      <table class="table" style="width: 50%;">
        <tr>
          <td class="left">Total ${isStudent ? 'Siswa' : 'Guru'}</td>
          <td style="font-weight: bold;">${data.length} orang</td>
        </tr>
        <tr>
          <td class="left">Rata-rata Kehadiran</td>
          <td style="font-weight: bold;">${(data.reduce((sum, item) => sum + (item.presentase || 0), 0) / data.length).toFixed(2)}%</td>
        </tr>
        <tr>
          <td class="left">Kehadiran Tertinggi</td>
          <td style="font-weight: bold;">${Math.max(...data.map(item => item.presentase || 0)).toFixed(2)}%</td>
        </tr>
        <tr>
          <td class="left">Kehadiran Terendah</td>
          <td style="font-weight: bold;">${Math.min(...data.map(item => item.presentase || 0)).toFixed(2)}%</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div style="text-align: center; width: 200px;">
          <div>Mengetahui,</div>
          <div style="font-weight: bold;">Kepala Sekolah</div>
          <div style="margin-top: 80px; border-top: 1px solid #000; padding-top: 5px;">
            <div style="font-weight: bold;">Drs. Nama Kepala Sekolah, M.Pd</div>
            <div>NIP. 19xxxxxxxxxxxxxxxx</div>
          </div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div>Example, ${new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long', 
            year: 'numeric'
          })}</div>
          <div style="font-weight: bold;">${isStudent ? 'Wali Kelas' : 'Koordinator Guru'}</div>
          <div style="margin-top: 80px; border-top: 1px solid #000; padding-top: 5px;">
            <div style="font-weight: bold;">Nama ${isStudent ? 'Wali Kelas' : 'Koordinator'}, S.Pd</div>
            <div>NIP. 19xxxxxxxxxxxxxxxx</div>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
        <div>Laporan ini dicetak secara otomatis oleh Sistem Absenta pada ${new Date().toLocaleString('id-ID')}</div>
      </div>
    </div>
  `;
};
