import React from 'react';
import { Card, CardContent } from './ui/card';

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolAddress?: string;
  reportPeriod?: string;
  teacherName?: string;
  subjectName?: string;
  className?: string;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  subtitle,
  reportPeriod,
  className = ""
}) => {
  return (
    <Card className={`mb-6 ${className}`}>
      <CardContent className="p-6">
        {/* SMKN 13 Letterhead */}
        <div className="text-center mb-6 p-4 bg-white border-2 border-gray-300">
          <div className="text-sm font-bold">
            PEMERINTAH DAERAH PROVINSI JAWA BARAT<br />
            DINAS PENDIDIKAN<br />
            CABANG DINAS PENDIDIKAN WILAYAH VII<br />
            SEKOLAH MENENGAH KEJURUAN NEGERI 13
          </div>
          <div className="text-xs mt-2">
            Jalan Soekarno - Hatta Km.10 Telepon (022) 7318960: Ext. 114<br />
            Telepon/Faksimil: (022) 7332252 – Bandung 40286<br />
            Email: smk13bdg@gmail.com Home page: http://www.smkn13.sch.id
          </div>
          <div className="text-lg font-bold mt-4">
            {title}
          </div>
          {subtitle && (
            <div className="text-sm mt-2">
              {subtitle}
            </div>
          )}
          {reportPeriod && (
            <div className="text-sm mt-2">
              Periode: {reportPeriod}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportHeader;
