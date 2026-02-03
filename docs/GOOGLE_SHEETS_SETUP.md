
# Google Sheets Integration Setup

This documentation covers the setup and usage of the Google Sheets Service Account integration for the Schlosser App.

## ⚠️ Important Architecture Note
The services located in `src/services/googleSheetsService.js` use the `googleapis` Node.js library. **This library is not compatible with browser-only environments (like Vite/React)** without complex polyfills. Attempting to import these services directly into React components will likely cause build errors. These scripts are intended for server-side logic (e.g., Supabase Edge Functions, Node.js scripts) or need to be replaced with a browser-compatible HTTP implementation.

## 1. Credentials Setup

1.  Obtain the Service Account JSON key file (e.g., `meta-notch-xxx.json`).
2.  Open your `.env` file in the project root.
3.  Fill in the variables:
    *   `VITE_GOOGLE_PROJECT_ID`: found in JSON as `project_id`
    *   `VITE_GOOGLE_CLIENT_EMAIL`: found in JSON as `client_email`
    *   `VITE_GOOGLE_PRIVATE_KEY`: found in JSON as `private_key`. **Important**: Keep the `\n` characters.

## 2. Spreadsheet Access

For the Service Account to work, you must share the Google Sheet with the client email:
1.  Open the Spreadsheet (`Precificação Mix Frigo Schlosser...`).
2.  Click "Share" in the top right.
3.  Paste the `client_email` from your JSON/Env file.
4.  Grant "Editor" permission.
5.  Uncheck "Notify people" and click Share.

## 3. Sheet Structure

The integration expects the following sheet names as defined in `src/config/googleSheetsConfig.js`:

### USUARIOS
*   **Purpose**: Authentication and User Management.
*   **Columns**:
    *   A: Usuario (Name)
    *   B: Login (Phone Number)
    *   C: Senha_hash (Simple Password)
    *   D: Tipo_de_Usuario (Role: Admin, Vendedor, Cliente, etc.)
    *   E: Ativo (Checkbox/Boolean)
    *   F: app_login (Redirect route)

### ENTRADAS_ESTOQUE
*   **Purpose**: Logs incoming stock.
*   **Columns**: Date, Sku, Qty.

### RESERVAS
*   **Purpose**: Logs items reserved by customers.
*   **Usage**: Appended to when an order is created.

### PEDIDOS
*   **Purpose**: Final order records.

## 4. Testing Connection

To test the connection (in a Node.js environment):
1.  Ensure dependencies are installed: `npm install`
2.  Create a test script that imports `testGoogleSheetsConnection` from `src/utils/sheetsConnectionTest.js`.
3.  Run the script.

## 5. FASE 2 Notes

For the next phase of development:
*   Migrate this logic to a secure backend (Supabase Edge Functions or a dedicated Node server).
*   Never expose `VITE_GOOGLE_PRIVATE_KEY` in a production build.
*   Implement proper JWT authentication for the frontend to talk to this backend service.
