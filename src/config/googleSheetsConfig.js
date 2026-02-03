
// NOTE: Google Sheets API key configuration has been removed for security and simplicity.
// We are now using direct CSV export which works reliably for public sheets.

export const googleSheetsConfig = {
  // Spreadsheet ID is still needed to locate the file
  spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_ID,
  
  // Sheet names constant mapping
  sheets: {
    USUARIOS: 'USUARIOS',
    ENTRADAS_ESTOQUE: 'ENTRADAS_ESTOQUE',
    RESERVAS: 'RESERVAS',
    PEDIDOS: 'PEDIDOS',
  }
};
