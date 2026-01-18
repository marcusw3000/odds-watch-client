import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  offset: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canNextPage: boolean;
  canPrevPage: boolean;
  pageNumbers: (number | 'ellipsis')[];
  startItem: number;
  endItem: number;
  resetPage: () => void;
}

export function usePagination({
  initialPage = 1,
  initialPageSize = 25,
  totalItems = 0,
}: UsePaginationOptions = {}): UsePaginationReturn {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = useMemo(() => 
    Math.max(1, Math.ceil(totalItems / pageSize)), 
    [totalItems, pageSize]
  );

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  const canNextPage = page < totalPages;
  const canPrevPage = page > 1;

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    setPageState(1); // Reset to first page when changing page size
  }, []);

  const nextPage = useCallback(() => {
    if (canNextPage) setPage(page + 1);
  }, [canNextPage, page, setPage]);

  const prevPage = useCallback(() => {
    if (canPrevPage) setPage(page - 1);
  }, [canPrevPage, page, setPage]);

  const resetPage = useCallback(() => {
    setPageState(1);
  }, []);

  // Calculate visible page numbers with ellipsis
  const pageNumbers = useMemo((): (number | 'ellipsis')[] => {
    const delta = 1; // Number of pages to show on each side of current page
    const range: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      // Always show first page
      range.push(1);
      
      if (page > delta + 2) {
        range.push('ellipsis');
      }
      
      // Show pages around current page
      const start = Math.max(2, page - delta);
      const end = Math.min(totalPages - 1, page + delta);
      
      for (let i = start; i <= end; i++) {
        if (!range.includes(i)) range.push(i);
      }
      
      if (page < totalPages - delta - 1) {
        range.push('ellipsis');
      }
      
      // Always show last page
      if (!range.includes(totalPages)) {
        range.push(totalPages);
      }
    }
    
    return range;
  }, [page, totalPages]);

  const startItem = totalItems === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + pageSize, totalItems);

  return {
    page,
    pageSize,
    offset,
    totalPages,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    canNextPage,
    canPrevPage,
    pageNumbers,
    startItem,
    endItem,
    resetPage,
  };
}
