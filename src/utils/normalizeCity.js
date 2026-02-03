
export const normalizeCity = (city) => {
  if (!city) return '';
  return String(city)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .trim()
    .toUpperCase();
};
