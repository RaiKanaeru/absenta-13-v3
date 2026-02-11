// =============================================================================
// Pagination Utility
// Extracted from AdminDashboard.tsx for reuse across components.
// =============================================================================

/**
 * Generates page numbers for pagination controls.
 * Returns an array of page numbers and '...' ellipsis strings.
 *
 * @param currentPage - Current active page (1-based)
 * @param totalPages - Total number of pages
 * @param maxVisiblePages - Maximum visible page buttons (default 5)
 * @returns Array of page numbers and '...' strings
 *
 * @example
 * generatePageNumbers(1, 10) // [1, 2, 3, 4, '...', 10]
 * generatePageNumbers(5, 10) // [1, '...', 4, 5, 6, '...', 10]
 * generatePageNumbers(9, 10) // [1, '...', 7, 8, 9, 10]
 */
export const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages = 5
): (number | string)[] => {
  const pages: (number | string)[] = [];

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push('...', totalPages);
    return pages;
  }

  if (currentPage >= totalPages - 2) {
    pages.push(1, '...');
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1, '...');
  for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
  pages.push('...', totalPages);
  return pages;
};
