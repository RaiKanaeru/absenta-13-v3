import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleSpecificFieldsProps {
  role: 'admin' | 'guru' | 'siswa';
  userData: {
    nip?: string;
    nis?: string;
    kelas?: string;
  };
  formData: {
    mata_pelajaran: string;
    telepon_orangtua: string;
    nomor_telepon_siswa: string;
    jenis_kelamin: string;
    alamat: string;
    no_telepon: string;
  };
  errors: Record<string, string>;
  handleInputChange: (field: string, value: string) => void;
}

export const RoleSpecificFieldsTop: React.FC<RoleSpecificFieldsProps> = ({
  role,
  userData,
  formData,
  handleInputChange
}) => {
  if (role === 'guru') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nip">NIP</Label>
          <Input
            id="nip"
            value={userData.nip || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-1">NIP tidak dapat diubah</p>
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
  }

  if (role === 'siswa') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nis">NIS</Label>
          <Input
            id="nis"
            value={userData.nis || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-1">NIS tidak dapat diubah</p>
        </div>
        <div>
          <Label htmlFor="kelas">Kelas</Label>
          <Input
            id="kelas"
            value={userData.kelas || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-1">Kelas tidak dapat diubah</p>
        </div>
      </div>
    );
  }

  return null;
};

export const RoleSpecificFieldsBottom: React.FC<RoleSpecificFieldsProps> = ({
  role,
  formData,
  errors,
  handleInputChange
}) => {
  if (role === 'admin') {
    return null;
  }

  if (role === 'guru') {
    return (
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
              className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground ${errors.jenis_kelamin ? 'border-red-500' : ''}`}
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
    );
  }

  if (role === 'siswa') {
    return (
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
              className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground ${errors.jenis_kelamin ? 'border-red-500' : ''}`}
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
    );
  }

  return null;
};

interface PasswordChangeFormProps {
  showNewPassword: boolean;
  setShowNewPassword: (show: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  passwordData: {
    newPassword: string;
    confirmPassword: string;
  };
  errors: Record<string, string>;
  handlePasswordChange: (field: string, value: string) => void;
}

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordData,
  errors,
  handlePasswordChange
}) => {
  return (
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
  );
};

