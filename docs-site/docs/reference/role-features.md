# Absenta 13 Role Pages and Features

This document summarizes the pages and functions available to each role.

## Common

Login and role routing
- Single entry page at `src/pages/Index_Modern.tsx` handles login and routes to role dashboards.
- Roles supported: admin, guru, siswa (siswa perwakilan).

Shared actions
- Edit profile modal is available in each role dashboard.
- Logout is available from the sidebar.

## Siswa (Perwakilan Kelas)

Perwakilan
- Hanya siswa yang memiliki akun login yang dianggap perwakilan.
- Data siswa pada menu "Data Siswa" tetap netral (tanpa flag perwakilan).

Menu Kehadiran
- Shows schedule for today or a selected date (edit mode with date picker and limited range).
- Records teacher attendance per schedule: Hadir, Tidak Hadir, Izin, Sakit.
- Optional "Ada Tugas" flag when teacher is not present.
- Notes per schedule and multi guru attendance preview.
- "Absen Kelas" action appears when teacher is not present/izin/sakit, to record student attendance.

Riwayat
- Class attendance history grouped by date.
- Summary counts (hadir, izin, sakit, alpa) per schedule.
- Detail view for each schedule, including students who were not present.
- Pagination for long history lists.

Banding Absen
- Submit appeal for one student: select date, schedule, student, proposed status, and reason.
- Recorded status is pulled from database and cannot be edited.
- List of submitted appeals with status and teacher response notes.
- Detail view and pagination.

## Guru

Jadwal Hari Ini
- List of schedules for the current day with status (upcoming, current, completed).
- Non absenable activities are shown with "Tidak perlu absen."
- Multi guru indicator and room info per schedule.
- Select a schedule to take attendance.

Ambil Absensi
- Mark attendance for each student: Hadir, Izin, Sakit, Alpa, Dispen, Lain.
- Add per student notes, and flags for Terlambat and Ada Tugas.
- Edit mode for prior dates with date picker (range limited in UI).
- Shows other teacher notes for multi guru schedules.
- Preview and submit attendance in one batch.

Banding Absen
- Review student appeals with filter for pending items.
- Approve or reject with optional notes.
- Pagination and quick stats (pending vs total).

Riwayat Absensi
- History grouped by date and class with expand details.
- Per student attendance status and notes.
- Pagination by date range (default 7 days per page).

Laporan
- Filter by class and period (month or custom range).
- Generates class attendance report with per date matrix.
- Export to Excel with letterhead.

## Admin

Dashboard Admin
- Live clock, ongoing classes, and attendance percentage.
- Ongoing class cards showing current schedule status.
- Menu grid to access all admin functions.

Tambah Akun Guru
- CRUD teacher accounts with username and password.
- Assign subject, status, and contact data.
- Search and Excel import.

Tambah Akun Siswa
- CRUD student accounts (perwakilan).
- Assign class, status, and contact data.
- Search and Excel import.

Data Guru
- CRUD teacher master data (NIP, subject, contact, status).
- Search and Excel import.

Data Siswa
- CRUD student master data (NIS, class, contact, status).
- Search and Excel import.

Naik Kelas
- Select source and target class.
- Batch select students, preview, and promote.
- Class name parsing to support multiple naming formats.

Mata Pelajaran
- CRUD subjects with status and description.
- Search and Excel import.

Kelas
- CRUD classes with status and description.
- Search and Excel import.

Jadwal
- CRUD schedules with multi guru support.
- Set activity type and absenable flag.
- Filters by class, day, teacher, and activity type.
- Import schedules from Excel and preview results.

Ruang Kelas
- CRUD rooms with code, name, and location.
- Search and Excel import.

Backup and Archive
- Create and list backups.
- Archive old data with progress tracking.
- Backup settings and schedule management.

System Monitoring
- System, application, database, and Redis metrics.
- Alert list with resolve action and auto refresh.

Restorasi Backup
- Upload and restore SQL or ZIP backups.
- Restore from available backup list.
- Validation for file type and size.

Kop Laporan
- Configure report letterhead, alignment, and logos.
- Global or per report scope.
- Preview before saving.

Laporan
- Export class absence recap by year.
- Export teacher attendance recap by year.
- Export schedule matrix (jadwal).

Jam Pelajaran
- Configure time slots per class.
- Load default, edit, add, remove, and copy to other classes.

Database Manager
- List SQL dumps and seeders from `database/`.
- Execute seeder or restore dump with confirmation.
