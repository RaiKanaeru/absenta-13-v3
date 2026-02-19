import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { apiCall } from '@/utils/apiClient';

interface UserProfile {
  id: number;
  username: string;
  nama: string;
  email?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  nip?: string;
  nis?: string;
  kelas?: string;
  alamat?: string;
  no_telepon?: string;
  telepon_orangtua?: string;
  nomor_telepon_siswa?: string;
  jenis_kelamin?: 'L' | 'P';
  mata_pelajaran?: string;
  jabatan?: string;
  guru_id?: number;
  mapel?: string;
}

interface FormDataType {
  nama: string;
  username: string;
  email: string;
  alamat: string;
  telepon_orangtua: string;
  nomor_telepon_siswa: string;
  jenis_kelamin: string;
  no_telepon: string;
  mata_pelajaran: string;
  jabatan: string;
}

const PHONE_REGEX = /^[0-9+\-\s()]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^\w+$/;

function validateBasicFields(formData: { nama: string; username: string; email: string }) {
  const errors: Record<string, string> = {};
  
  if (!formData.nama.trim()) {
    errors.nama = 'Nama harus diisi';
  } else if (formData.nama.trim().length < 2) {
    errors.nama = 'Nama minimal 2 karakter';
  }
  
  if (!formData.username.trim()) {
    errors.username = 'Username harus diisi';
  } else if (formData.username.trim().length < 3) {
    errors.username = 'Username minimal 3 karakter';
  } else if (!USERNAME_REGEX.test(formData.username.trim())) {
    errors.username = 'Username hanya boleh huruf, angka, dan underscore';
  }
  
  if (formData.email && !EMAIL_REGEX.test(formData.email)) {
    errors.email = 'Format email tidak valid';
  }
  
  return errors;
}

function validatePhoneNumber(phone: string, fieldName: string, errorMsg: string) {
  if (phone && !PHONE_REGEX.test(phone)) {
    return { [fieldName]: errorMsg };
  }
  return {};
}

function validateGenderField(jenis_kelamin: string) {
  if (jenis_kelamin && !['L', 'P'].includes(jenis_kelamin)) {
    return { jenis_kelamin: 'Jenis kelamin harus L atau P' };
  }
  return {};
}

function buildAdminRequestBody(formData: FormDataType) {
  return {
    nama: formData.nama.trim(),
    username: formData.username.trim(),
    email: formData.email?.trim() || null
  };
}

function buildGuruRequestBody(formData: FormDataType) {
  return {
    nama: formData.nama.trim(),
    username: formData.username.trim(),
    email: formData.email?.trim() || null,
    alamat: formData.alamat?.trim() || null,
    no_telepon: formData.no_telepon?.trim() || null,
    jenis_kelamin: formData.jenis_kelamin || null,
    mata_pelajaran: formData.mata_pelajaran?.trim() || null,
    jabatan: formData.jabatan?.trim() || null
  };
}

function buildSiswaRequestBody(formData: FormDataType) {
  return {
    nama: formData.nama.trim(),
    username: formData.username.trim(),
    email: formData.email?.trim() || null,
    alamat: formData.alamat?.trim() || null,
    telepon_orangtua: formData.telepon_orangtua?.trim() || null,
    nomor_telepon_siswa: formData.nomor_telepon_siswa?.trim() || null,
    jenis_kelamin: formData.jenis_kelamin || null
  };
}

function buildUpdateData(
  userData: UserProfile, 
  resultData: Record<string, unknown>, 
  role: string
): UserProfile {
  const baseData = {
    ...userData,
    ...resultData,
    nama: resultData.nama as string,
    username: resultData.username as string,
    email: resultData.email as string,
    alamat: resultData.alamat as string,
    telepon_orangtua: resultData.telepon_orangtua as string,
    nomor_telepon_siswa: resultData.nomor_telepon_siswa as string,
    jenis_kelamin: resultData.jenis_kelamin as 'L' | 'P'
  };

  if (role === 'guru') {
    return {
      ...baseData,
      no_telepon: resultData.no_telepon as string,
      mata_pelajaran: resultData.mata_pelajaran as string
    } as UserProfile;
  }

  return baseData as UserProfile;
}

const REQUEST_BODY_BUILDERS: Record<string, (formData: FormDataType) => object> = {
  admin: buildAdminRequestBody,
  guru: buildGuruRequestBody,
  siswa: buildSiswaRequestBody
};

export const useEditProfileForm = (
  userData: UserProfile, 
  role: 'admin' | 'guru' | 'siswa',
  onUpdate: (updatedData: UserProfile) => void,
  onClose: () => void
) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    nama: userData.nama || '',
    username: userData.username || '',
    email: userData.email || '',
    alamat: userData.alamat || '',
    telepon_orangtua: userData.telepon_orangtua || '',
    nomor_telepon_siswa: userData.nomor_telepon_siswa || '',
    jenis_kelamin: userData.jenis_kelamin || '',
    no_telepon: userData.no_telepon || '',
    mata_pelajaran: userData.mata_pelajaran || userData.mapel || '',
    jabatan: userData.jabatan || ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    let newErrors: Record<string, string> = {};
    
    newErrors = { ...newErrors, ...validateBasicFields(formData) };
    
    if (role === 'siswa') {
      newErrors = { 
        ...newErrors, 
        ...validatePhoneNumber(formData.telepon_orangtua, 'telepon_orangtua', 'Format nomor telepon orangtua tidak valid'),
        ...validatePhoneNumber(formData.nomor_telepon_siswa, 'nomor_telepon_siswa', 'Format nomor telepon siswa tidak valid'),
        ...validateGenderField(formData.jenis_kelamin)
      };
    } else if (role === 'guru') {
      newErrors = { 
        ...newErrors, 
        ...validatePhoneNumber(formData.no_telepon, 'no_telepon', 'Format nomor telepon tidak valid'),
        ...validateGenderField(formData.jenis_kelamin)
      };
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'Password baru harus diisi';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Password minimal 6 karakter';
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password tidak cocok';
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleUpdateProfile = async () => {
    if (!validateForm()) {
      toast({
        title: "Error Validasi",
        description: "Mohon perbaiki error yang ada",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const buildRequestBody = REQUEST_BODY_BUILDERS[role];
      const requestBody = buildRequestBody ? buildRequestBody(formData) : {};

      const result = await apiCall<{ data: Record<string, unknown> }>(`/api/${role}/update-profile`, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      toast({
        title: "Berhasil!",
        description: "Profil berhasil diperbarui"
      });
      
      const d = result.data;
      onUpdate(buildUpdateData(userData, d, role));
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui profil',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      toast({
        title: "Error Validasi",
        description: "Mohon perbaiki error password yang ada",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await apiCall(`/api/${role}/change-password`, {
        method: 'PUT',
        body: JSON.stringify({
          newPassword: passwordData.newPassword
        })
      });

      toast({
        title: "Berhasil!",
        description: "Password berhasil diubah"
      });
      
      setPasswordData({
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengubah password',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    errors,
    formData,
    passwordData,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleInputChange,
    handlePasswordChange,
    handleUpdateProfile,
    handleChangePassword
  };
};
