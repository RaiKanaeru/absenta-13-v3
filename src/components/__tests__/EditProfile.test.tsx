import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditProfile } from '../shared/EditProfile';

// Mock apiCall
vi.mock('@/utils/apiClient', () => ({
  apiCall: vi.fn().mockResolvedValue({ data: { nama: 'Updated Name' } })
}));

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({
    toast: vi.fn(),
    toasts: []
  })
}));

describe('EditProfile Component', () => {
  const mockUserData = {
    id: 1,
    username: 'testuser',
    nama: 'Test User',
    email: 'test@example.com',
    role: 'guru',
    nip: '123456',
    mata_pelajaran: 'Matematika',
    no_telepon: '08123456789',
    jenis_kelamin: 'L' as const,
    alamat: 'Jl. Test No. 1'
  };

  const mockOnUpdate = vi.fn();
  const mockOnClose = vi.fn();

  it('renders correctly for guru role', () => {
    render(
      <EditProfile 
        userData={mockUserData} 
        onUpdate={mockOnUpdate} 
        onClose={mockOnClose} 
        role="guru" 
      />
    );

    expect(screen.getByText('Edit Profil - Guru')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Lengkap *')).toHaveValue('Test User');
    expect(screen.getByLabelText('NIP')).toHaveValue('123456');
    expect(screen.getByLabelText('Mata Pelajaran')).toHaveValue('Matematika');
  });

  it('validates form and submits update', async () => {
    render(
      <EditProfile 
        userData={mockUserData} 
        onUpdate={mockOnUpdate} 
        onClose={mockOnClose} 
        role="guru" 
      />
    );

    const nameInput = screen.getByLabelText('Nama Lengkap *');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    const saveButton = screen.getByText('Simpan Profil');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
