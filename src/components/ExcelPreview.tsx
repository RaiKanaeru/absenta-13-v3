import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Download, FileText } from 'lucide-react';
import { useLetterhead } from '../hooks/useLetterhead';

interface ExcelPreviewProps {
  title: string;
  data: Record<string, string | number | Date | null | undefined>[];
  columns: {
    key: string;
    label: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    format?: 'text' | 'number' | 'percentage' | 'date';
  }[];
  showPreview?: boolean;
  onExport?: () => void;
  onExportSMKN13?: () => void;
  className?: string;
  teacherName?: string;
  subjectName?: string;
  reportPeriod?: string;
  showLetterhead?: boolean;
  reportKey?: string;
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  title,
  data,
  columns,
  showPreview = true,
  onExport,
  onExportSMKN13,
  className = "",
  teacherName,
  subjectName,
  reportPeriod,
  showLetterhead = true,
  reportKey
}) => {
  // Load letterhead configuration
  const { letterhead } = useLetterhead(reportKey);
  const formatCellValue = (value: string | number | Date | null | undefined, format?: string): string => {
    if (value === null || value === undefined) return '';
    
    const formatters: Record<string, () => string> = {
      number: () => typeof value === 'number' ? value.toLocaleString('id-ID') : String(value),
      percentage: () => typeof value === 'number' ? `${value.toFixed(2)}%` : String(value),
      date: () => value instanceof Date ? value.toLocaleDateString('id-ID') : String(value)
    };
    
    return formatters[format || '']?.() || (value instanceof Date ? value.toLocaleDateString('id-ID') : String(value));
  };

  const getCellStyle = (format?: string, value?: string | number | null, columnKey?: string, align?: string) => {
    const baseStyle = "px-1 sm:px-2 py-1 text-xs border-r border-b border-gray-400 overflow-hidden";
    
    // Explicit alignment from column config takes precedence, otherwise use default based on format
    const formatAlignMap: Record<string, string> = {
        number: 'text-right font-mono',
        percentage: 'text-right font-mono',
        date: 'text-center'
    };
    
    const alignStyle = align 
        ? `text-${align}` 
        : (formatAlignMap[format || ''] || 'text-left');

    // Special styling for attendance columns (with type guard)
    const numValue = typeof value === 'number' ? value : 0;
    if (columnKey === 'hadir' && numValue > 0) {
      return `${baseStyle} text-center font-semibold bg-emerald-50 text-emerald-700`;
    }
    if (columnKey === 'izin' && numValue > 0) {
      return `${baseStyle} text-center font-semibold bg-blue-50 text-blue-700`;
    }
    if (columnKey === 'sakit' && numValue > 0) {
      return `${baseStyle} text-center font-semibold bg-red-50 text-red-700`;
    }
    if (columnKey === 'alpa' && numValue > 0) {
      return `${baseStyle} text-center font-semibold bg-yellow-50 text-yellow-700`;
    }
    
    return `${baseStyle} ${alignStyle} bg-white`;
  };

  const getHeaderStyle = (align?: string) => {
    const baseStyle = "px-1 sm:px-2 py-1 text-xs font-semibold bg-gray-200 border-r border-b border-gray-500 text-gray-800 overflow-hidden";
    const alignMap: Record<string, string> = {
      center: 'text-center',
      right: 'text-right'
    };
    return `${baseStyle} ${alignMap[align || ''] || 'text-left'}`;
  };

  if (!showPreview || !data || data.length === 0) {
    return null;
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-800 break-words">
              {title} ({data.length} record)
            </CardTitle>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download Excel</span>
                <span className="sm:hidden">Download</span>
              </Button>
            )}
            {onExportSMKN13 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportSMKN13}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export SMKN 13</span>
                <span className="sm:hidden">SMKN 13</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Letterhead */}
        {showLetterhead && (
          letterhead.enabled && letterhead.lines && letterhead.lines.length > 0 ? (
          <div className="px-2 sm:px-4 py-3 bg-white border-b border-gray-300">
            <div className="flex items-center justify-between mb-3 gap-3">
              {letterhead.logoLeftUrl ? (
                <img 
                  src={letterhead.logoLeftUrl} 
                  alt="Logo Kiri" 
                  className="h-12 sm:h-16 lg:h-20 w-auto object-contain flex-shrink-0"
                  onError={(e) => {
                    console.warn('⚠️ Logo kiri gagal dimuat:', letterhead.logoLeftUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded flex-shrink-0">
                  <span className="text-xs text-gray-500">LOGO KIRI</span>
                </div>
              )}
              <div className="flex-1"></div>
              {letterhead.logoRightUrl ? (
                <img 
                  src={letterhead.logoRightUrl} 
                  alt="Logo Kanan" 
                  className="h-12 sm:h-16 lg:h-20 w-auto object-contain flex-shrink-0"
                  onError={(e) => {
                    console.warn('⚠️ Logo kanan gagal dimuat:', letterhead.logoRightUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded flex-shrink-0">
                  <span className="text-xs text-gray-500">LOGO KANAN</span>
                </div>
              )}
            </div>
            <div className={`text-${letterhead.alignment || 'center'} space-y-1`}>
              {letterhead.lines.map((line, index) => {
                // Handle both old format (string) and new format (object)
                const text = typeof line === 'string' ? line : line.text;
                const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');
                
                return (
                  <div 
                    key={index}
                    className={`${fontWeight === 'bold' ? 'font-bold' : 'font-normal'} ${index === 0 ? 'text-sm sm:text-base lg:text-lg' : 'text-xs sm:text-sm'} break-words`}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
          ) : (
            // Fallback letterhead jika belum ada konfigurasi
            <div className="px-2 sm:px-4 py-3 bg-white border-b border-gray-300">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded flex-shrink-0">
                <span className="text-xs text-gray-500">LOGO KIRI</span>
              </div>
              <div className="flex-1"></div>
              <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded flex-shrink-0">
                <span className="text-xs text-gray-500">LOGO KANAN</span>
              </div>
            </div>
              <div className="text-center space-y-1">
                <div className="font-bold text-sm sm:text-base lg:text-lg break-words">PEMERINTAH DAERAH PROVINSI DKI JAKARTA</div>
                <div className="font-bold text-xs sm:text-sm break-words">DINAS PENDIDIKAN</div>
                <div className="font-bold text-xs sm:text-sm break-words">SMK NEGERI 13 JAKARTA</div>
                <div className="text-xs sm:text-sm break-words">Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910</div>
              </div>
            </div>
          )
        )}
        
        {/* Teacher and Subject Information */}
        {(teacherName || subjectName || reportPeriod) && (
          <div className="px-2 sm:px-4 py-3 bg-gray-50 border-b border-gray-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
              {teacherName && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                  <span className="font-medium text-gray-700">Nama Guru:</span>
                  <span className="text-gray-600 break-words">{teacherName}</span>
                </div>
              )}
              {subjectName && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                  <span className="font-medium text-gray-700">Mata Pelajaran:</span>
                  <span className="text-gray-600 break-words">{subjectName}</span>
                </div>
              )}
              {reportPeriod && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 sm:col-span-2 lg:col-span-1">
                  <span className="font-medium text-gray-700">Periode:</span>
                  <span className="text-gray-600 break-words">{reportPeriod}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto border border-gray-400">
          <div className="min-w-full">
            
            {/* Excel-like Table */}
            <table className="w-full text-xs min-w-max table-fixed">
              <thead>
                <tr className="bg-gray-200 border-b border-gray-500">
                  {columns.map((column, index) => (
                    <th
                      key={column.key}
                      className={getHeaderStyle(column.align)}
                      style={{ 
                        width: column.width ? `${Math.max(column.width, 80)}px` : '120px'
                      }}
                    >
                      <div className="truncate" title={column.label}>
                        {column.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`${
                      rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50 transition-colors`}
                  >
                    {columns.map((column, colIndex) => {
                      const cellValue = row[column.key];
                      const safeValue = cellValue instanceof Date 
                        ? cellValue.toLocaleDateString('id-ID') 
                        : cellValue;
                      const displayValue = formatCellValue(cellValue, column.format);
                      return (
                        <td
                          key={column.key}
                          className={getCellStyle(column.format, typeof safeValue === 'string' || typeof safeValue === 'number' ? safeValue : null, column.key, column.align)}
                          style={{ 
                            width: column.width ? `${Math.max(column.width, 80)}px` : '120px'
                          }}
                        >
                          <div className="truncate" title={String(displayValue ?? '')}>
                            {displayValue}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Excel-like Footer Info */}
        <div className="px-2 sm:px-4 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <span>Total: {data.length} record</span>
            <span className="hidden sm:inline">Preview Excel Format</span>
            <span className="sm:hidden">Excel Format</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExcelPreview;
