import React from 'react';
import { LetterheadConfig } from '../hooks/useLetterhead';

interface LetterheadSectionProps {
  letterhead: LetterheadConfig;
}

const getLetterheadLineKey = (line: string | { text?: string; fontWeight?: string }, index: number) => {
  if (typeof line === 'string') {
    return `line-${index}-${line.substring(0, 10)}`;
  }
  return `line-${index}-${(line.text || '').substring(0, 10)}`;
};

export const LetterheadSection: React.FC<LetterheadSectionProps> = ({ letterhead }) => {
  if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
    return (
      <div className="px-2 sm:px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3 gap-3">
          {letterhead.logoLeftUrl ? (
            <img 
              src={letterhead.logoLeftUrl} 
              alt="Logo Kiri" 
              className="h-12 sm:h-16 lg:h-20 w-auto object-contain flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-muted border-2 border-dashed border-border rounded flex-shrink-0">
              <span className="text-xs text-muted-foreground">LOGO KIRI</span>
            </div>
          )}
          <div className="flex-1"></div>
          {letterhead.logoRightUrl ? (
            <img 
              src={letterhead.logoRightUrl} 
              alt="Logo Kanan" 
              className="h-12 sm:h-16 lg:h-20 w-auto object-contain flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-muted border-2 border-dashed border-border rounded flex-shrink-0">
              <span className="text-xs text-muted-foreground">LOGO KANAN</span>
            </div>
          )}
        </div>
        <div className={`text-${letterhead.alignment || 'center'} space-y-1`}>
          {letterhead.lines.map((line, index) => {
            // Handle both old format (string) and new format (object)
            const text = typeof line === 'string' ? line : line.text;
            let fontWeight = 'normal';
            if (typeof line === 'object') {
              fontWeight = line.fontWeight || 'normal';
            } else if (index === 0) {
              fontWeight = 'bold';
            }
            
            return (
              <div 
                key={getLetterheadLineKey(line, index)}
                className={`${fontWeight === 'bold' ? 'font-bold' : 'font-normal'} ${index === 0 ? 'text-sm sm:text-base lg:text-lg' : 'text-xs sm:text-sm'} break-words`}
              >
                {text}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback letterhead jika belum ada konfigurasi
  return (
    <div className="px-2 sm:px-4 py-3 bg-card border-b border-border">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-muted border-2 border-dashed border-border rounded flex-shrink-0">
          <span className="text-xs text-muted-foreground">LOGO KIRI</span>
        </div>
        <div className="flex-1"></div>
        <div className="h-12 sm:h-16 lg:h-20 w-12 sm:w-16 lg:w-20 flex items-center justify-center bg-muted border-2 border-dashed border-border rounded flex-shrink-0">
          <span className="text-xs text-muted-foreground">LOGO KANAN</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <div className="font-bold text-sm sm:text-base lg:text-lg break-words">PEMERINTAH DAERAH PROVINSI DKI JAKARTA</div>
        <div className="font-bold text-xs sm:text-sm break-words">DINAS PENDIDIKAN</div>
        <div className="font-bold text-xs sm:text-sm break-words">SMK NEGERI 13 JAKARTA</div>
        <div className="text-xs sm:text-sm break-words">Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910</div>
      </div>
    </div>
  );
};
