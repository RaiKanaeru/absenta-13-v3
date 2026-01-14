import React, { useState, useEffect } from 'react';
import { Input } from './input';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  placeholder = "08:30",
  required = false,
  disabled = false,
  className = ""
}) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Hanya izinkan angka dan titik dua
    inputValue = inputValue.replace(/[^\d:]/g, '');
    
    // Batasi panjang maksimal 5 karakter (HH:MM)
    if (inputValue.length > 5) {
      inputValue = inputValue.substring(0, 5);
    }
    
    // Auto-format: tambahkan : setelah 2 digit pertama
    if (inputValue.length === 2 && !inputValue.includes(':')) {
      inputValue = inputValue + ':';
    }
    
    setDisplayValue(inputValue);
    onChange(inputValue);
  };

  const handleBlur = () => {
    // Validasi dan format ulang saat kehilangan fokus
    if (displayValue && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(displayValue)) {
      if (displayValue.includes(':')) {
        const [hours, minutes] = displayValue.split(':');
        const validHours = Math.min(23, Math.max(0, Number.parseInt(hours) || 0));
        const validMinutes = Math.min(59, Math.max(0, Number.parseInt(minutes) || 0));
        const formattedValue = `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
        setDisplayValue(formattedValue);
        onChange(formattedValue);
      } else if (displayValue.length > 0) {
        // Jika hanya angka tanpa :, format sebagai jam:00
        const numValue = Number.parseInt(displayValue);
        if (numValue >= 0 && numValue <= 23) {
          const formattedValue = `${numValue.toString().padStart(2, '0')}:00`;
          setDisplayValue(formattedValue);
          onChange(formattedValue);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Izinkan: Backspace, Delete, Arrow keys, Tab, Enter
    if ([8, 9, 13, 27, 46, 37, 38, 39, 40].includes(e.keyCode)) {
      return;
    }
    
    // Izinkan angka dan titik dua
    if (!/[\d:]/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      className={`font-mono ${className}`}
      maxLength={5}
    />
  );
};
