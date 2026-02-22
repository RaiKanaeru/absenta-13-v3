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
    if (globalThis.window === undefined) {
      return DEFAULT_FONT_SIZE;
    }

    const saved =
      globalThis.localStorage.getItem('fontSize') || globalThis.sessionStorage.getItem('fontSize');

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
    if (globalThis.window === undefined) {
      return;
    }

    globalThis.localStorage.setItem('fontSize', size);
    globalThis.sessionStorage.setItem('fontSize', size);
  };

  const [internalFontSize, setInternalFontSize] = useState<FontSize>(() => getStoredFontSize());

  const setFontSize = (size: FontSize) => {
    setInternalFontSize(size);
    persistFontSize(size);

    // Apply to document root for global font size
    updateDocumentFontSize(size);
  };

  const increaseFontSize = () => {
    const currentIndex = FONT_SIZES.indexOf(internalFontSize);
    if (currentIndex < FONT_SIZES.length - 1) {
      setFontSize(FONT_SIZES[currentIndex + 1]);
    }
  };

  const decreaseFontSize = () => {
    const currentIndex = FONT_SIZES.indexOf(internalFontSize);
    if (currentIndex > 0) {
      setFontSize(FONT_SIZES[currentIndex - 1]);
    }
  };

  const resetFontSize = () => {
    setFontSize(DEFAULT_FONT_SIZE);
  };

  const getFontSizeClass = () => {
    return `font-size-${internalFontSize}`;
  };

  useEffect(() => {
    // Apply font size on mount
    updateDocumentFontSize(internalFontSize);
  }, [internalFontSize]);

  const value: FontSizeContextType = React.useMemo(() => ({
    fontSize: internalFontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    getFontSizeClass,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [internalFontSize, setFontSize, increaseFontSize, decreaseFontSize, resetFontSize, getFontSizeClass]);

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
