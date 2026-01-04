import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  getFontSizeClass: () => string;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZES: FontSize[] = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'];

const DEFAULT_FONT_SIZE: FontSize = 'base';

export const FontSizeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getStoredFontSize = (): FontSize => {
    if (typeof window === 'undefined') {
      return DEFAULT_FONT_SIZE;
    }

    const saved =
      window.localStorage.getItem('fontSize') || window.sessionStorage.getItem('fontSize');

    return (FONT_SIZES.includes(saved as FontSize) ? saved : DEFAULT_FONT_SIZE) as FontSize;
  };

  const updateDocumentFontSize = (size: FontSize) => {
    const root = document.documentElement;
    const fontSizeClasses = Array.from(root.classList).filter((className) =>
      className.startsWith('font-size-'),
    );

    fontSizeClasses.forEach((className) => root.classList.remove(className));
    root.classList.add(`font-size-${size}`);
  };

  const persistFontSize = (size: FontSize) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('fontSize', size);
    window.sessionStorage.setItem('fontSize', size);
  };

  const [fontSize, setFontSizeState] = useState<FontSize>(() => getStoredFontSize());

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    persistFontSize(size);

    // Apply to document root for global font size
    updateDocumentFontSize(size);
  };

  const increaseFontSize = () => {
    const currentIndex = FONT_SIZES.indexOf(fontSize);
    if (currentIndex < FONT_SIZES.length - 1) {
      setFontSize(FONT_SIZES[currentIndex + 1]);
    }
  };

  const decreaseFontSize = () => {
    const currentIndex = FONT_SIZES.indexOf(fontSize);
    if (currentIndex > 0) {
      setFontSize(FONT_SIZES[currentIndex - 1]);
    }
  };

  const resetFontSize = () => {
    setFontSize(DEFAULT_FONT_SIZE);
  };

  const getFontSizeClass = () => {
    return `font-size-${fontSize}`;
  };

  useEffect(() => {
    // Apply font size on mount
    updateDocumentFontSize(fontSize);
  }, [fontSize]);

  const value: FontSizeContextType = {
    fontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    getFontSizeClass,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = (): FontSizeContextType => {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};
