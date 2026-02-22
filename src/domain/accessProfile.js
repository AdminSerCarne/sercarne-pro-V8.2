const parseBool = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'sim', 'yes', 'y', 'ativo'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'não', 'no', 'inativo'].includes(normalized)) return false;
  return false;
};

const normalizePath = (rawPath) => {
  const path = String(rawPath || '').trim().toLowerCase();
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
};

const APP_LOGIN_ROUTE_MAP = Object.freeze({
  '/admin': '/admin',
  '/vendedor': '/vendedor',
  '/dashboard': '/vendedor',
  '/producao': '/servico-desossa',
  '/produção': '/servico-desossa',
  '/servico-desossa': '/servico-desossa',
  '/serviço-desossa': '/servico-desossa',
  '/gestorcomercial': '/vendedor',
  '/supervisor': '/vendedor',
  '/transferencias': '/catalog',
  '/transferências': '/catalog',
  '/transferencia': '/catalog',
  '/transferência': '/catalog',
  '/cliente_b2b': '/catalog',
  '/cliente_b2c': '/catalog',
  '/cliente': '/catalog',
});

export const resolveUserLevel = (user) => {
  const level = Number(user?.Nivel ?? user?.nivel ?? user?.nivel_usuario ?? user?.nivelUsuario);
  if (Number.isFinite(level)) return level;
  return 0;
};

export const isUserActive = (user) => parseBool(user?.ativo ?? user?.active ?? true);

export const resolveUserRole = (user) => {
  const rawRole = user?.tipo_de_Usuario ?? user?.tipo_usuario ?? user?.role ?? '';
  const role = String(rawRole).trim().toLowerCase();

  if (role.includes('admin')) return 'admin';
  if (role.includes('gestor')) return 'manager';

  if (
    role.includes('vendedor') ||
    role.includes('representante') ||
    role.includes('supervisor') ||
    role.includes('producao') ||
    role.includes('produção')
  ) {
    return 'vendor';
  }

  return 'public';
};

export const resolveUserAppLogin = (user) => {
  const raw =
    user?.app_login ??
    user?.appLogin ??
    user?.['app login'] ??
    user?.appLoginPath ??
    '';

  return normalizePath(raw);
};

export const resolveHomeRoute = (user) => {
  if (!user) return '/catalog';

  const mappedByAppLogin = APP_LOGIN_ROUTE_MAP[resolveUserAppLogin(user)];
  if (mappedByAppLogin) return mappedByAppLogin;

  const level = resolveUserLevel(user);
  if (level >= 6) return '/vendedor';
  if (level >= 1) return '/catalog';

  const role = resolveUserRole(user);
  if (role === 'admin' || role === 'manager' || role === 'vendor') return '/vendedor';
  return '/catalog';
};
