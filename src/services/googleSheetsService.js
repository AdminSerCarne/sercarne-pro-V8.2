
import { parse } from 'csv-parse/browser/esm';

// --- Configuration ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const MAX_RETRIES = 2; // Reduced retries to prevent long hangs
const TIMEOUT_MS = 5000; // 5 seconds timeout
const BASE_DELAY = 1000;

// --- State ---
const cache = {};
const pendingRequests = {};

/**
 * Sleep helper
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with Timeout and Error Handling
 */
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Fetch with Exponential Backoff
 */
const fetchWithBackoff = async (url, attempt = 0) => {
  try {
    const response = await fetchWithTimeout(url);

    if (response.ok) {
      return response;
    }

    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      if (attempt < MAX_RETRIES) {
        const delay = (BASE_DELAY * Math.pow(2, attempt)) + (Math.random() * 500);
        console.warn(`[Sheets] Rate limit/Error (${response.status}). Retrying in ${Math.round(delay)}ms...`);
        await wait(delay);
        return fetchWithBackoff(url, attempt + 1);
      }
    }

    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  } catch (error) {
    if (attempt < MAX_RETRIES && error.name !== 'AbortError') {
      const delay = (BASE_DELAY * Math.pow(2, attempt));
      console.warn(`[Sheets] Network error. Retrying...`, error);
      await wait(delay);
      return fetchWithBackoff(url, attempt + 1);
    }
    console.error(`[Sheets] Fetch failed: ${error.message}`);
    throw error; 
  }
};

export const fetchSheetCSV = async (sheetName) => {
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;
  
  if (!spreadsheetId) {
    console.error('[Sheets] VITE_GOOGLE_SHEETS_ID is not defined');
    return [];
  }

  // 1. Check Cache
  const cached = cache[sheetName];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // 2. Request Deduplication
  if (pendingRequests[sheetName]) {
    return pendingRequests[sheetName];
  }

  // 3. Request
  const requestPromise = (async () => {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetchWithBackoff(url);
      const text = await response.text();

      return new Promise((resolve) => {
        parse(text, {
          columns: false,
          trim: true,
          skip_empty_lines: true,
          relax_column_count: true
        }, (err, output) => {
          if (err) {
            console.error(`[Sheets] CSV Parse error for ${sheetName}:`, err);
            resolve([]); 
          } else {
            cache[sheetName] = { timestamp: Date.now(), data: output };
            resolve(output);
          }
        });
      });
    } catch (error) {
      console.error(`[Sheets] Final failure for "${sheetName}":`, error.message);
      return []; // Return empty array to prevent app crash
    } finally {
      delete pendingRequests[sheetName];
    }
  })();

  pendingRequests[sheetName] = requestPromise;
  return requestPromise;
};

export const readSheetData = async (sheetName) => {
    try {
        return await fetchSheetCSV(sheetName);
    } catch (e) {
        console.error(`[Sheets] readSheetData wrapper error:`, e);
        return [];
    }
};

export const fetchStockData = async () => {
  try {
    const rows = await readSheetData('2026 Base Catalogo Precifica V2');
    
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => {
      if (!row || row.length <= 3) return null;

      const codigo = row[3]?.toString().trim();
      if (!codigo) return null;
      
      // Basic Stock info
      const rawStock = row[7]?.toString() || '';
      const stockNumeric = parseInt(rawStock.replace(/[^\d-]/g, '')) || 0;

      const rawWeight = row[8]?.toString() || '';
      const weightNumeric = parseFloat(rawWeight.replace(',', '.')) || 0;

      const rawUnit = row[28]?.toString().trim() || 'UND';
      
      // Extended info for filters (Task 3 & 5)
      // Based on typical layout or previous context. 
      // Column F (Index 5) is Brand/Image
      const rawBrand = row[5]?.toString().trim() || ''; 
      
      // Column V (Index 21) is likely Species/Category (based on screenshot "Meia Res Vaca Gaucha")
      const rawSpecies = row[21]?.toString().trim() || ''; 
      
      // Packaging is often derived from Unit or separate, defaulting to Unit for now
      const rawPackaging = rawUnit; 

      return {
        codigo_produto: codigo,
        estoque_und: Math.max(0, stockNumeric),
        peso_medio_kg: weightNumeric,
        unidade_estoque: rawUnit.toUpperCase(),
        marca: rawBrand,
        especie: rawSpecies,
        tipo_embalagem: rawPackaging
      };
    }).filter(Boolean);
  } catch (error) {
    console.error("[Sheets] Error in fetchStockData:", error);
    return [];
  }
};

export const getEntradasEstoque = async () => {
    try {
        const rows = await readSheetData('ENTRADAS_ESTOQUE');
        
        if (!rows || rows.length < 2) return [];

        return rows.slice(1).map(row => {
            if (!row || row.length < 3) return null;

            const dateStr = row[0]?.toString().trim();
            const codigo = row[1]?.toString().trim();
            const qtd = parseInt(row[2]?.toString().replace(/[^\d-]/g, '')) || 0;
            const obs = row[3]?.toString().trim() || '';

            if (!dateStr || !codigo) return null;

            let isoDate = '';
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } else {
                isoDate = dateStr;
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

            return {
                data_entrada: isoDate,
                codigo: codigo,
                qtd_und: qtd,
                obs: obs
            };
        }).filter(Boolean);
    } catch (error) {
        console.error("[Sheets] Error in getEntradasEstoque:", error);
        return [];
    }
};
