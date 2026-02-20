const pad2 = (value) => String(value).padStart(2, '0');

export const formatDateToISO = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const toISODateLocal = (value) => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) return formatDateToISO(value);

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  if (raw.includes('T')) {
    const isoPart = raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPart)) return isoPart;
  }

  const parsed = new Date(raw);
  return formatDateToISO(parsed);
};

export const getTodayISODateLocal = () => formatDateToISO(new Date());
