import { useState, useCallback } from 'react';
import api from '../api/axios';

export interface ImportRow {
  article: string;
  name?: string;
  price?: number;
  brandName?: string;
  [key: string]: any;
}

export interface ImportMetrics {
  totalExecutionTimeSeconds: string;
  totalRowsProcessed: number;
  insertedCount: number;
  updatedCount: number;
  newBrandsCount: number;
  errors: { identifier: string; reason: string }[];
}

export function useChunkedImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<{ identifier: string; reason: string }[]>([]);
  const [metrics, setMetrics] = useState<ImportMetrics | null>(null);

  const startImport = useCallback(async (rows: ImportRow[]) => {
    setIsImporting(true);
    setTotalCount(rows.length);
    setProcessedCount(0);
    setProgress(0);
    setErrors([]);
    setMetrics(null);

    const chunkSize = 50;
    const chunks: ImportRow[][] = [];
    
    for (let i = 0; i < rows.length; i += chunkSize) {
      chunks.push(rows.slice(i, i + chunkSize));
    }

    let processed = 0;
    const currentErrors: { identifier: string; reason: string }[] = [];
    let isSuccess = true;
    
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalNewBrands = 0;

    const startTime = performance.now();

    try {
      for (const chunk of chunks) {
        const response = await api.post('/import/chunk', { items: chunk });
        const { errors: chunkErrors = [], insertedCount = 0, updatedCount = 0, newBrandsCount = 0 } = response.data;
        
        totalInserted += insertedCount;
        totalUpdated += updatedCount;
        totalNewBrands += newBrandsCount;

        if (chunkErrors.length > 0) {
          currentErrors.push(...chunkErrors);
          setErrors([...currentErrors]);
          isSuccess = false;
        }

        processed += chunk.length;
        setProcessedCount(processed);
        setProgress(Math.round((processed / rows.length) * 100));
      }
    } catch (err) {
      console.error('Fatal error during chunked import:', err);
      isSuccess = false;
    } finally {
      const endTime = performance.now();
      const totalTimeSeconds = (endTime - startTime) / 1000;
      setMetrics({
        totalExecutionTimeSeconds: `${totalTimeSeconds.toFixed(2)} s`,
        totalRowsProcessed: processed,
        insertedCount: totalInserted,
        updatedCount: totalUpdated,
        newBrandsCount: totalNewBrands,
        errors: currentErrors
      });
      setIsImporting(false);
    }
    
    return isSuccess;
  }, []);

  return { isImporting, totalCount, processedCount, progress, errors, metrics, startImport };
}
