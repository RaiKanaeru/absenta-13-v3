import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


import { toast } from '@/hooks/use-toast';
import { getApiUrl } from '@/config/api';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  X, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  User
} from 'lucide-react';

interface UserProfile {
  id: number;
  username: string;
  nama: string;
  email?: string;
  role: string;
  created_at?: string;
  updated_at?: string;
  // Additional fields based on role
  nip?: string; // For teachers
  nis?: string; // For students
  kelas?: string; // For students
  alamat?: string;
  no_telepon?: string; // For teachers
  telepon_orangtua?: string; // For students
  nomor_telepon_siswa?: string; // For students
  jenis_kelamin?: 'L' | 'P'; // For teachers and students
  mata_pelajaran?: string; // For teachers
  jabatan?: string; // For students
  // Additional fields for complete profile
  guru_id?: number; // For teachers
  mapel?: string; // Alternative field name for mata_pelajaran
}

interface EditProfileProps {
  userData: UserProfile;
  onUpdate: (updatedData: UserProfile) => void;
  onClose: () => void;
  role: 'admin' | 'guru' | 'siswa';
}

// =============================================================================
// VALIDATION HELPERS (extracted to reduce cognitive complexity)
// =============================================================================

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

// =============================================================================
// REQUEST BODY BUILDERS (extracted to reduce cognitive complexity)
// =============================================================================

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

/**
 * Builds updated user data for onUpdate callback
 */
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


export const EditProfile = ({ userData, onUpdate, onClose, role }: EditProfileProps) => {
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    nama: userData.nama || '',
    username: userData.username || '',
    email: userData.email || '',
    alamat: userData.alamat || '',
    telepon_orangtua: userData.telepon_orangtua || '',
    nomor_telepon_siswa: userData.nomor_telepon_siswa || '',
    jenis_kelamin: userData.jenis_kelamin || '',
    // Pastikan field opsional bertipe string agar input selalu controlled
    no_telepon: userData.no_telepon || '',
    mata_pelajaran: userData.mata_pelajaran || userData.mapel || '',
    jabatan: userData.jabatan || ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const validateForm = () => {
    let newErrors: Record<string, string> = {};
    
    // Basic field validation (nama, username, email)
    newErrors = { ...newErrors, ...validateBasicFields(formData) };
    
    // Role-specific validation
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
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      // Build request body using lookup pattern (reduces cognitive complexity)
      const buildRequestBody = REQUEST_BODY_BUILDERS[role];
      const requestBody = buildRequestBody ? buildRequestBody(formData) : {};

      const response = await fetch(getApiUrl(`/api/${role}/update-profile`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Profile update error:', errorData);
        throw new Error(errorData.error || 'Gagal memperbarui profil');
      }

      const result = await response.json();
      toast({
        title: "Berhasil!",
        description: "Profil berhasil diperbarui"
      });
      
      // Update parent component dengan data yang benar
      onUpdate({
        ...userData,
        ...result.data,
        nama: result.data.nama,
        username: result.data.username,
        email: result.data.email,
        alamat: result.data.alamat,
        telepon_orangtua: result.data.telepon_orangtua,
        nomor_telepon_siswa: result.data.nomor_telepon_siswa,
        jenis_kelamin: result.data.jenis_kelamin,
        ...(role === 'guru' && {
          no_telepon: result.data.no_telepon,
          mata_pelajaran: result.data.mata_pelajaran
        })
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      const response = await fetch(getApiUrl(`/api/${role}/change-password`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        toast({
          title: "Berhasil!",
          description: "Password berhasil diubah"
        });
        
        // Clear password form
        setPasswordData({
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengubah password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengubah password',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = () => {
    const roleMap: Record<string, string> = {
      admin: 'Administrator',
      guru: 'Guru',
      siswa: 'Siswa'
    };
    return roleMap[role] || 'User';
  };

  const getRoleSpecificFields = () => {
    switch (role) {
      case 'admin':
        // Admin tidak memerlukan field tambahan, hanya data dasar dari tabel users
        return null;
      case 'guru':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nip">NIP</Label>
              <Input
                id="nip"
                value={userData.nip || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">NIP tidak dapat diubah</p>
            </div>
            <div>
              <Label htmlFor="mata_pelajaran">Mata Pelajaran</Label>
              <Input
                id="mata_pelajaran"
                value={formData.mata_pelajaran}
                onChange={(e) => handleInputChange('mata_pelajaran', e.target.value)}
                placeholder="Mata pelajaran yang diajar"
              />
            </div>
          </div>
        );
      case 'siswa':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nis">NIS</Label>
              <Input
                id="nis"
                value={userData.nis || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">NIS tidak dapat diubah</p>
            </div>
            <div>
              <Label htmlFor="kelas">Kelas</Label>
              <Input
                id="kelas"
                value={userData.kelas || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Kelas tidak dapat diubah</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Edit Profil - {getRoleDisplayName()}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Profile Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Informasi Profil
              </h3>
              
              {/* Role-specific fields */}
              {getRoleSpecificFields()}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => handleInputChange('nama', e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className={errors.nama ? 'border-red-500' : ''}
                  />
                  {errors.nama && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.nama}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Masukkan username"
                    className={errors.username ? 'border-red-500' : ''}
                  />
                  {errors.username && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.username}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Masukkan email (opsional)"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Field tambahan hanya untuk guru dan siswa */}
              {role !== 'admin' && (
                <>
                  {role === 'siswa' ? (
                    // Field khusus untuk siswa
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="telepon_orangtua">Telepon Orangtua</Label>
                          <Input
                            id="telepon_orangtua"
                            value={formData.telepon_orangtua}
                            onChange={(e) => handleInputChange('telepon_orangtua', e.target.value)}
                            placeholder="Masukkan nomor telepon orangtua (opsional)"
                            className={errors.telepon_orangtua ? 'border-red-500' : ''}
                          />
                          {errors.telepon_orangtua && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.telepon_orangtua}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="nomor_telepon_siswa">Nomor Telepon Siswa</Label>
                          <Input
                            id="nomor_telepon_siswa"
                            value={formData.nomor_telepon_siswa}
                            onChange={(e) => handleInputChange('nomor_telepon_siswa', e.target.value)}
                            placeholder="Masukkan nomor telepon siswa (opsional)"
                            className={errors.nomor_telepon_siswa ? 'border-red-500' : ''}
                          />
                          {errors.nomor_telepon_siswa && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.nomor_telepon_siswa}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                          <select
                            id="jenis_kelamin"
                            value={formData.jenis_kelamin}
                            onChange={(e) => handleInputChange('jenis_kelamin', e.target.value)}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md ${errors.jenis_kelamin ? 'border-red-500' : ''}`}
                          >
                            <option value="">Pilih jenis kelamin (opsional)</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                          </select>
                          {errors.jenis_kelamin && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.jenis_kelamin}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="alamat">Alamat</Label>
                        <Textarea
                          id="alamat"
                          value={formData.alamat}
                          onChange={(e) => handleInputChange('alamat', e.target.value)}
                          placeholder="Masukkan alamat (opsional)"
                          rows={3}
                        />
                      </div>
                    </>
                  ) : (
                    // Field untuk guru
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="no_telepon">Nomor Telepon</Label>
                          <Input
                            id="no_telepon"
                            value={formData.no_telepon}
                            onChange={(e) => handleInputChange('no_telepon', e.target.value)}
                            placeholder="Masukkan nomor telepon (opsional)"
                            className={errors.no_telepon ? 'border-red-500' : ''}
                          />
                          {errors.no_telepon && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.no_telepon}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                          <select
                            id="jenis_kelamin"
                            value={formData.jenis_kelamin}
                            onChange={(e) => handleInputChange('jenis_kelamin', e.target.value)}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md ${errors.jenis_kelamin ? 'border-red-500' : ''}`}
                          >
                            <option value="">Pilih jenis kelamin (opsional)</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                          </select>
                          {errors.jenis_kelamin && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.jenis_kelamin}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="alamat">Alamat</Label>
                        <Textarea
                          id="alamat"
                          value={formData.alamat}
                          onChange={(e) => handleInputChange('alamat', e.target.value)}
                          placeholder="Masukkan alamat (opsional)"
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Change Password Section */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Ubah Password
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">Password Baru *</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        placeholder="Masukkan password baru"
                        className={errors.newPassword ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.newPassword}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Konfirmasi Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                        placeholder="Konfirmasi password baru"
                        className={errors.confirmPassword ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <Button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Simpan Profil
              </Button>
              
              <Button
                onClick={handleChangePassword}
                disabled={loading || !passwordData.newPassword || !passwordData.confirmPassword}
                variant="outline"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Ubah Password
              </Button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Informasi Penting:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Field dengan tanda (*) wajib diisi</li>
                    <li>• Username harus unik dan tidak boleh sama dengan user lain</li>
                    <li>• Password minimal 6 karakter</li>
                    <li>• Data yang tidak dapat diubah: {role === 'guru' ? 'NIP' : role === 'siswa' ? 'NIS dan Kelas' : 'ID'}</li>
                    {role === 'admin' && (
                      <li>• Admin hanya dapat mengubah nama, username, dan email</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
