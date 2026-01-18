/**
 * ReportLetterhead Component
 * Shared component for rendering letterhead in reports
 * Supports both custom letterhead from settings and default SMKN 13 header
 */

import React from 'react';
import { DEFAULT_SCHOOL_HEADER } from '../../lib/academic-constants';
import type { LetterheadConfig } from '../../hooks/useLetterhead';

interface ReportLetterheadProps {
  /** Letterhead configuration from useLetterhead hook */
  letterhead: LetterheadConfig | null;
  /** Report title (e.g., "REKAP KETIDAKHADIRAN SISWA") */
  reportTitle: string;
  /** Selected academic year (e.g., "2024") */
  selectedTahun: string;
  /** Optional subtitle for class name */
  className?: string;
  /** Optional subtitle for period information */
  periodInfo?: string;
}

/**
 * Renders logo images with error handling
 */
const LogoImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <img 
    src={src} 
    alt={alt} 
    className="h-16 object-contain"
    onError={(e) => {
      console.warn(`${alt} gagal dimuat:`, src);
      e.currentTarget.style.display = 'none';
    }}
  />
);

/**
 * Renders the default SMKN 13 letterhead
 */
const DefaultLetterhead: React.FC = () => (
  <>
    <div className="text-sm font-bold">
      {DEFAULT_SCHOOL_HEADER.government}<br />
      {DEFAULT_SCHOOL_HEADER.department}<br />
      {DEFAULT_SCHOOL_HEADER.branch}<br />
      {DEFAULT_SCHOOL_HEADER.school}
    </div>
    <div className="text-xs mt-2">
      {DEFAULT_SCHOOL_HEADER.address}<br />
      {DEFAULT_SCHOOL_HEADER.contact}<br />
      Email: {DEFAULT_SCHOOL_HEADER.email} Home page: {DEFAULT_SCHOOL_HEADER.website}
    </div>
  </>
);

/**
 * Renders custom letterhead from settings
 */
const CustomLetterhead: React.FC<{ letterhead: LetterheadConfig }> = ({ letterhead }) => (
  <>
    {/* Logo kiri dan kanan jika tersedia */}
    {(letterhead.logoLeftUrl || letterhead.logoRightUrl) && (
      <div className="flex justify-between items-center mb-4">
        {letterhead.logoLeftUrl && (
          <LogoImage src={letterhead.logoLeftUrl} alt="Logo Kiri" />
        )}
        <div className="flex-1"></div>
        {letterhead.logoRightUrl && (
          <LogoImage src={letterhead.logoRightUrl} alt="Logo Kanan" />
        )}
      </div>
    )}
    
    {/* Baris teks kop laporan */}
    {letterhead.lines?.map((line, index) => (
      <div 
        key={index} 
        className={`text-sm ${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}`}
        style={{ textAlign: letterhead.alignment }}
      >
        {line.text}
      </div>
    ))}
  </>
);

/**
 * Checks if letterhead has custom configuration that should be rendered
 */
const hasCustomLetterhead = (letterhead: LetterheadConfig | null): letterhead is LetterheadConfig => {
  return letterhead !== null && 
         letterhead.enabled && 
         letterhead.lines !== undefined && 
         letterhead.lines.length > 0;
};

/**
 * ReportLetterhead Component
 * Renders a complete report header with letterhead and title information
 */
export const ReportLetterhead: React.FC<ReportLetterheadProps> = ({
  letterhead,
  reportTitle,
  selectedTahun,
  className,
  periodInfo
}) => {
  return (
    <div className="text-center mb-6 p-4 bg-white border-2 border-gray-300">
      {hasCustomLetterhead(letterhead) ? (
        <CustomLetterhead letterhead={letterhead} />
      ) : (
        <DefaultLetterhead />
      )}
      
      {/* Report Title */}
      <div className="text-lg font-bold mt-4">
        {reportTitle}
      </div>
      
      {/* Academic Year */}
      <div className="text-sm">
        TAHUN PELAJARAN {selectedTahun}/{Number.parseInt(selectedTahun) + 1}
      </div>
      
      {/* Class Name (optional) */}
      {className && (
        <div className="text-sm font-bold">
          KELAS {className}
        </div>
      )}
      
      {/* Period Info (optional) */}
      {periodInfo && (
        <div className="text-sm">
          {periodInfo}
        </div>
      )}
    </div>
  );
};

export default ReportLetterhead;
