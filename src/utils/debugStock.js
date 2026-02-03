
import { getAvailableStockForDate } from './stockValidator';

export const debugStock = async (productCode, date) => {
    console.log(`%c 🕵️ DEBUGGING STOCK FOR ${productCode} on ${date}`, 'background: #222; color: #bada55; font-size: 14px; padding: 4px;');
    try {
        const start = performance.now();
        const available = await getAvailableStockForDate(productCode, date);
        const end = performance.now();
        
        console.log(`%c RESULT: ${available} UND Available`, 'font-weight: bold; font-size: 16px;');
        console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
        return available;
    } catch (e) {
        console.error("Debug failed", e);
    }
};

// Attach to window for console access
if (typeof window !== 'undefined') {
    window.debugStock = debugStock;
    console.log("✅ Stock Debugger Loaded. Usage: window.debugStock('400010', '2026-01-28')");
}
