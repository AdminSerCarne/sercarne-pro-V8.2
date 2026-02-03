
import { readSheetData } from './googleSheetsService';
import { googleSheetsConfig } from '@/config/googleSheetsConfig';

/**
 * Maps raw sheet rows to structured User objects.
 * Sheet Headers: Usuario, Login, Senha_hash, Tipo_de_Usuario, Ativo, app_login
 */
const formatUsuariosData = (rawData) => {
  if (!rawData || rawData.length < 2) return [];

  // Skip header row
  const rows = rawData.slice(1);
  
  return rows.map((row, index) => {
    // Map columns by index based on the screenshot provided
    // 0: Usuario (Name)
    // 1: Login (Phone)
    // 2: Senha_hash (Password)
    // 3: Tipo_de_Usuario (Role)
    // 4: Ativo (Boolean/Checkbox)
    // 5: app_login (App Route)
    
    return {
      id: `user-${index}`,
      name: row[0] || '',
      login: row[1] ? String(row[1]).replace(/\D/g, '') : '', // Sanitize phone number
      passwordHash: row[2] || '',
      role: row[3] || 'Cliente/B2C',
      isActive: row[4] === 'TRUE' || row[4] === true || row[4] === 'VERDADEIRO',
      appRoute: row[5] || '/',
    };
  }).filter(user => user.login && user.isActive); // Only return active users with valid logins
};

export const getAllUsuarios = async () => {
  try {
    const data = await readSheetData(googleSheetsConfig.sheets.USUARIOS);
    return formatUsuariosData(data);
  } catch (error) {
    console.error('[UsuariosService] Failed to fetch users:', error);
    throw error;
  }
};

export const getUsuarioByLogin = async (loginInput) => {
  try {
    const allUsers = await getAllUsuarios();
    const sanitizedInput = String(loginInput).replace(/\D/g, '');
    
    return allUsers.find(u => u.login === sanitizedInput) || null;
  } catch (error) {
    console.error(`[UsuariosService] Failed to find user ${loginInput}:`, error);
    return null;
  }
};
