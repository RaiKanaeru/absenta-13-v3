import React from 'react';
import { Button } from '@/components/ui/button';
import { useFontSize } from '@/contexts/FontSizeContext';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Type,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface FontSizeControlProps {
  variant?: 'compact' | 'full' | 'floating';
  className?: string;
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({ 
  variant = 'full', 
  className = '' 
}) => {
  const { 
    fontSize, 
    setFontSize, 
    increaseFontSize, 
    decreaseFontSize, 
    resetFontSize 
  } = useFontSize();

  const fontSizeLabels = {
    xs: 'Sangat Kecil',
    sm: 'Kecil',
    base: 'Normal',
    lg: 'Besar',
    xl: 'Sangat Besar',
    '2xl': 'Ekstra Besar',
    '3xl': 'Super Besar'
  };

  const fontSizeSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl'
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={decreaseFontSize}
          disabled={fontSize === 'xs'}
          className="h-8 w-8 p-0"
          title="Perkecil Font"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <Badge variant="secondary" className="min-w-[60px] justify-center">
          {fontSizeLabels[fontSize]}
        </Badge>
        
        <Button
          variant="outline"
          size="sm"
          onClick={increaseFontSize}
          disabled={fontSize === '3xl'}
          className="h-8 w-8 p-0"
          title="Perbesar Font"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="lg"
              className="h-12 w-12 rounded-full shadow-lg"
              title="Pengaturan Font"
            >
              <Type className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Pengaturan Ukuran Font
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {Object.entries(fontSizeLabels).map(([size, label]) => (
              <DropdownMenuItem
                key={size}
                onClick={() => setFontSize(size as any)}
                className={`flex items-center justify-between ${
                  fontSize === size ? 'bg-accent' : ''
                }`}
              >
                <span className={fontSizeSizes[size as keyof typeof fontSizeSizes]}>
                  {label}
                </span>
                {fontSize === size && (
                  <Badge variant="default" className="ml-2">
                    Aktif
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetFontSize}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset ke Normal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={`flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Type className="h-4 w-4" />
          Ukuran Font
        </h3>
        <Badge variant="secondary">
          {fontSizeLabels[fontSize]}
        </Badge>
      </div>
      
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={decreaseFontSize}
          disabled={fontSize === 'xs'}
          className="flex-1"
        >
          <ZoomOut className="h-4 w-4 mr-2" />
          Perkecil
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={resetFontSize}
          className="flex-1"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={increaseFontSize}
          disabled={fontSize === '3xl'}
          className="flex-1"
        >
          <ZoomIn className="h-4 w-4 mr-2" />
          Perbesar
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {Object.entries(fontSizeLabels).map(([size, label]) => (
          <Button
            key={size}
            variant={fontSize === size ? "default" : "outline"}
            size="sm"
            onClick={() => setFontSize(size as any)}
            className={`h-8 text-xs ${
              fontSizeSizes[size as keyof typeof fontSizeSizes]
            }`}
            title={label}
          >
            Aa
          </Button>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 text-center">
        Pengaturan akan disimpan otomatis
      </div>
    </div>
  );
};
