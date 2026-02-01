import React from 'react';
import { Badge } from "@/components/ui/badge";

/**
 * Helper component for displaying multi-guru list (S2004 - extracted to reduce nesting)
 */
export const MultiGuruDisplay = ({ guruList }: { guruList: string }) => (
  <div className="text-xs text-green-600 mt-1">
    <div className="font-medium">Multi-Guru:</div>
    {guruList.split('||').map((guru) => {
      const [guruId, guruName] = guru.split(':');
      return (
        <div key={`guru-${guruId}`} className="text-xs text-green-700 truncate">- {guruName}</div>
      );
    })}
  </div>
);

/**
 * Helper component for displaying teacher badges (S3358 - extracted to reduce nested ternary)
 */
export const TeacherBadgeDisplay = ({ guruList, namaGuru }: { guruList?: string; namaGuru?: string }) => {
  // Case 1: Multi-guru with || separator
  if (guruList?.includes('||')) {
    return (
      <>
        {guruList.split('||').map((guru) => {
          const guruId = guru.split(':')[0];
          return (
            <Badge key={`guru-${guruId}`} variant="outline" className="text-xs bg-blue-50 text-blue-700">
              {guru.split(':')[1]}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 2: Multiple teachers comma-separated
  if (namaGuru?.includes(',')) {
    return (
      <>
        {namaGuru.split(',').map((guru) => {
          const trimmedName = guru.trim();
          return (
            <Badge key={`name-${trimmedName}`} variant="outline" className="text-xs bg-blue-50 text-blue-700">
              {trimmedName}
            </Badge>
          );
        })}
      </>
    );
  }
  // Case 3: Single teacher
  return (
    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
      {namaGuru || '-'}
    </Badge>
  );
};
