import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleSpecificFieldsTop, RoleSpecificFieldsBottom, PasswordChangeForm } from './EditProfile.components';
import { useEditProfileForm } from '@/hooks/useEditProfileForm';
import { 
  Lock, 
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

export const EditProfile = ({ userData, onUpdate, onClose, role }: EditProfileProps) => {
  const {
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
  } = useEditProfileForm(userData, role, onUpdate, onClose);

  const getRoleDisplayName = () => {
    const roleMap: Record<string, string> = {
      admin: 'Administrator',
      guru: 'Guru',
      siswa: 'Siswa'
    };
    return roleMap[role] || 'User';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
              <RoleSpecificFieldsTop 
                role={role} 
                userData={userData} 
                formData={formData} 
                handleInputChange={handleInputChange} 
              />
              
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
              <RoleSpecificFieldsBottom 
                role={role} 
                formData={formData} 
                handleInputChange={handleInputChange} 
                errors={errors}
              />
            </div>

            {/* Change Password Section */}
            <PasswordChangeForm 
              showNewPassword={showNewPassword}
              setShowNewPassword={setShowNewPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              passwordData={passwordData}
              errors={errors}
              handlePasswordChange={handlePasswordChange}
            />

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
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Informasi Penting:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Field dengan tanda (*) wajib diisi</li>
                    <li>• Username harus unik dan tidak boleh sama dengan user lain</li>
                    <li>• Password minimal 6 karakter</li>
                    <li>• Data yang tidak dapat diubah: {
                      ({
                        'guru': 'NIP',
                        'siswa': 'NIS dan Kelas'
                      }[role] || 'ID')
                    }</li>
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
