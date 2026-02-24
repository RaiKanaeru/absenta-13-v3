/**
 * ReportSummary Component
 * Shared component for rendering report summary/notes section
 * Shows attendance legend and effective working days information
 */

import React from 'react';
import { 

  getEffectiveDays, 
  getTotalAcademicYearDays,
  calculateDateRangeEffectiveDays,
  getMonthName 
} from '../../lib/academic-constants';

type ViewMode = 'tahunan' | 'bulanan' | 'tanggal';

interface ReportSummaryProps {
  /** Current view mode */
  viewMode: ViewMode;
  /** Selected month number (1-12) for monthly view */
  selectedBulan?: string;
  /** Start date for date range view */
  selectedTanggalAwal?: string;
  /** End date for date range view */
  selectedTanggalAkhir?: string;
  /** Custom legend text (optional) */
  legendText?: string;
}

/**
 * Default legend text for attendance status
 */
const DEFAULT_LEGEND = 'S: Sakit | A: Alpa | I: Izin';

/**
 * Calculates and displays effective working days based on view mode
 */
const EffectiveDaysDisplay: React.FC<{
  viewMode: ViewMode;
  selectedBulan?: string;
  selectedTanggalAwal?: string;
  selectedTanggalAkhir?: string;
}> = ({ viewMode, selectedBulan, selectedTanggalAwal, selectedTanggalAkhir }) => {
  if (viewMode === 'tahunan') {
    return (
      <div>
        Total dalam setahun: {getTotalAcademicYearDays()} hari
      </div>
    );
  }
  
  if (viewMode === 'bulanan' && selectedBulan) {
    const monthNumber = Number.parseInt(selectedBulan);
    const monthName = getMonthName(monthNumber);
    const effectiveDays = getEffectiveDays(monthNumber);
    
    return (
      <div>
        Bulan {monthName}: {effectiveDays} hari
      </div>
    );
  }
  
  if (viewMode === 'tanggal' && selectedTanggalAwal && selectedTanggalAkhir) {
    const effectiveDays = calculateDateRangeEffectiveDays(selectedTanggalAwal, selectedTanggalAkhir);
    
    return (
      <div>
        Periode {selectedTanggalAwal} - {selectedTanggalAkhir}: {effectiveDays} hari
      </div>
    );
  }
  
  return null;
};

/**
 * ReportSummary Component
 * Renders report footer with legend and effective days information
 */
export const ReportSummary: React.FC<ReportSummaryProps> = ({
  viewMode,
  selectedBulan,
  selectedTanggalAwal,
  selectedTanggalAkhir,
  legendText = DEFAULT_LEGEND
}) => {
  return (
    <div className="mt-4 text-sm">
      <div className="font-bold">KETERANGAN:</div>
      <div>{legendText}</div>
      <div className="mt-2">
        <div className="font-bold">JUMLAH HARI EFEKTIF KERJA:</div>
        <EffectiveDaysDisplay 
          viewMode={viewMode}
          selectedBulan={selectedBulan}
          selectedTanggalAwal={selectedTanggalAwal}
          selectedTanggalAkhir={selectedTanggalAkhir}
        />
      </div>
    </div>
  );
};

export default ReportSummary;
