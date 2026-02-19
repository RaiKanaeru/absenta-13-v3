import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExcelPreview from '../ExcelPreview';

// Mock useLetterhead
vi.mock('../../hooks/useLetterhead', () => ({
  useLetterhead: vi.fn().mockReturnValue({
    letterhead: {
      enabled: true,
      lines: [
        { text: 'Header Line 1', fontWeight: 'bold' },
        { text: 'Header Line 2', fontWeight: 'normal' }
      ],
      alignment: 'center'
    }
  })
}));

describe('ExcelPreview Component', () => {
  const mockData = [
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 }
  ];

  const mockColumns = [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value', format: 'number' as const }
  ];

  it('renders table with data and letterhead', () => {
    render(
      <ExcelPreview 
        title="Test Preview" 
        data={mockData} 
        columns={mockColumns} 
        showPreview={true}
      />
    );

    expect(screen.getByText('Test Preview (2 record)')).toBeInTheDocument();
    expect(screen.getByText('Header Line 1')).toBeInTheDocument();
    expect(screen.getByText('Header Line 2')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
