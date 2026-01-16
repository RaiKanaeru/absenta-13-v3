import { getWIBTime } from "@/lib/time-utils";

/**
 * Generates time slots for consecutive hours
 */
export const generateTimeSlots = (startTime: string, endTime: string, startJamKe: number, consecutiveHours: number) => {
  const slots = [];
  
  // Parse start time using WIB timezone
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const currentTime = getWIBTime();
  currentTime.setHours(startHour, startMinute, 0, 0);
  
  // If end time is provided for single hour, calculate duration
  let duration = 40; // default 40 minutes
  if (endTime && consecutiveHours === 1) {
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const endTimeObj = getWIBTime();
    endTimeObj.setHours(endHour, endMinute, 0, 0);
    duration = (endTimeObj.getTime() - currentTime.getTime()) / (1000 * 60);
  }

  for (let i = 0; i < consecutiveHours; i++) {
    const jamMulai = currentTime.toTimeString().slice(0, 5);
    currentTime.setMinutes(currentTime.getMinutes() + duration);
    const jamSelesai = currentTime.toTimeString().slice(0, 5);
    
    slots.push({
      jam_ke: startJamKe + i,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai
    });
    
    // Add 5 minutes break between classes
    if (i < consecutiveHours - 1) {
      currentTime.setMinutes(currentTime.getMinutes() + 5);
    }
  }
  
  return slots;
};

/**
 * Validates the schedule form data
 */
export const validateJadwalForm = (formData: Record<string, string | number | number[] | boolean | null>, consecutiveHours: number) => {
  const errors: string[] = [];
  
  // Validasi jam_ke
  if (!formData.jam_ke || Number.isNaN(Number.parseInt(String(formData.jam_ke)))) {
    errors.push('Jam ke- harus diisi dengan angka');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jamKe = Number.parseInt(String(formData.jam_ke));
    if (jamKe < 1 || jamKe > 12) {
      errors.push('Jam ke- harus antara 1-12');
    }
  }
  
  // Validasi jam_mulai < jam_selesai
  if (formData.jam_mulai && formData.jam_selesai) {
    const start = new Date(`2000-01-01T${formData.jam_mulai}`);
    const end = new Date(`2000-01-01T${formData.jam_selesai}`);
    if (start >= end) {
      errors.push('Jam selesai harus lebih besar dari jam mulai');
    }
  }
  
  // Validasi consecutive hours
  if (consecutiveHours < 1 || consecutiveHours > 6) {
    errors.push('Jumlah jam berurutan harus antara 1-6');
  }
  
  // Validasi field wajib
  if (!formData.kelas_id) errors.push('Kelas harus dipilih');
  if (!formData.hari) errors.push('Hari harus dipilih');
  if (!formData.jam_mulai) errors.push('Jam mulai harus diisi');
  if (!formData.jam_selesai) errors.push('Jam selesai harus diisi');
  
  return errors;
};

/**
 * Helper to get valid guru IDs
 */
export const getValidGuruIds = (ids: number[]): number[] => ids.filter(id => id && !Number.isNaN(id) && id > 0);

/**
 * Helper to build jadwal payload
 */
export const buildJadwalPayload = (form: any, validGuruIds: number[], slot?: { jam_mulai: string; jam_selesai: string; jam_ke: number }) => ({
  kelas_id: Number.parseInt(form.kelas_id),
  mapel_id: form.jenis_aktivitas === 'pelajaran' ? Number.parseInt(form.mapel_id) : null,
  guru_id: form.jenis_aktivitas === 'pelajaran' && validGuruIds.length > 0 ? validGuruIds[0] : null,
  guru_ids: form.jenis_aktivitas === 'pelajaran' ? validGuruIds : [],
  ruang_id: form.ruang_id && form.ruang_id !== 'none' ? Number.parseInt(form.ruang_id) : null,
  hari: form.hari,
  jam_mulai: slot?.jam_mulai || form.jam_mulai,
  jam_selesai: slot?.jam_selesai || form.jam_selesai,
  jam_ke: slot?.jam_ke || Number.parseInt(form.jam_ke),
  jenis_aktivitas: form.jenis_aktivitas,
  is_absenable: form.jenis_aktivitas === 'pelajaran',
  keterangan_khusus: form.keterangan_khusus || null
});
