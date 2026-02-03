import { addDays, subDays, setHours, setMinutes, isBefore, isAfter, getDay, isSameDay, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const logisticsHelper = {
  // Normalize string for comparison (remove accents, lowercase)
  normalize: (str) => {
    return str
      ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      : "";
  },

  // Get current time in Sao Paulo timezone
  getNowInSaoPaulo: () => {
    // Create a date object from the current time in SP
    const now = new Date();
    const spTime = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    return new Date(spTime);
  },

  // Parse "terças, quintas e sabados" into [2, 4, 6]
  parseDeliveryDays: (daysStr) => {
    const days = [];
    const normalized = logisticsHelper.normalize(daysStr);

    if (normalized.includes('domingo')) days.push(0);
    if (normalized.includes('segunda')) days.push(1);
    if (normalized.includes('terca') || normalized.includes('terça')) days.push(2);
    if (normalized.includes('quarta')) days.push(3);
    if (normalized.includes('quinta')) days.push(4);
    if (normalized.includes('sexta')) days.push(5);
    if (normalized.includes('sabado') || normalized.includes('sábado')) days.push(6);

    return days;
  },

  // Parse "17:30h" or "17:30" into { hours: 17, minutes: 30 }
  parseCutoffTime: (timeStr) => {
    if (!timeStr) return { hours: 17, minutes: 30 };
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
    }
    return { hours: 17, minutes: 30 };
  },

  // Extracts city from client name if necessary
  extractCityFromClientName: (clientName) => {
    if (!clientName) return "";
    
    // Pattern to match text inside parentheses before the hyphen and state abbreviation
    // Example: "SUPERMERCADO POPULAR (BOA VISTA DO BURICA - RS)" -> "BOA VISTA DO BURICA"
    const match = clientName.match(/\((.*?)\s*-\s*[A-Z]{2}\)/);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: Try to find just parentheses content if the first stricter regex fails
    const simpleMatch = clientName.match(/\((.*?)\)/);
    if (simpleMatch && simpleMatch[1]) {
         const parts = simpleMatch[1].split('-');
         return parts[0].trim();
    }
    
    return "";
  },

  // Find route for a city (case/accent insensitive)
  findRouteForCity: (city, routes = []) => {
    if (!city || !routes.length) return null;
    const normalizedCity = logisticsHelper.normalize(city);
    
    // Find precise match first (most reliable)
    const exactMatch = routes.find(r => logisticsHelper.normalize(r.municipio) === normalizedCity);
    if (exactMatch) return exactMatch;

    // Strict startsWith check as fallback
    // This helps match "SAO MARTINHO" with "SAO MARTINHO " (trailing space) or similar
    // But avoids "SAO" matching "SAO PAULO" if exact match fails
    return routes.find(r => {
        const routeCity = logisticsHelper.normalize(r.municipio);
        return routeCity === normalizedCity || routeCity.startsWith(normalizedCity) || normalizedCity.startsWith(routeCity);
    });
  },

  // Validate a specific delivery date against the route rules and current time
  validateDeliveryDate: (dateToCheck, route, now = logisticsHelper.getNowInSaoPaulo()) => {
      const allowedWeekdays = logisticsHelper.parseDeliveryDays(route.dias);
      const weekday = getDay(dateToCheck);
      
      // 1. Check if it's a delivery day
      if (!allowedWeekdays.includes(weekday)) {
          return { isValid: false, reason: "Dia sem rota" };
      }

      // 2. Calculate deadline: Previous day at cutoff time
      const { hours, minutes } = logisticsHelper.parseCutoffTime(route.corte);
      const previousDay = subDays(dateToCheck, 1);
      
      // We set the deadline time on the previous day
      const deadline = new Date(previousDay);
      deadline.setHours(hours, minutes, 0, 0);

      // 3. Comparison
      if (isAfter(now, deadline)) {
         if (isSameDay(dateToCheck, now)) {
             return { isValid: false, reason: "Não há entrega no mesmo dia" };
         } else if (isSameDay(previousDay, now)) {
             return { isValid: false, reason: `Corte excedido (${format(deadline, "HH:mm")})` };
         } else {
             return { isValid: false, reason: "Data limite excedida" };
         }
      }

      return { isValid: true, reason: null, deadline };
  },

  // Generate valid dates
  generateValidDates: (route, daysToGenerate = 30) => {
    if (!route) return [];

    const validDates = [];
    const now = logisticsHelper.getNowInSaoPaulo();
    // Start checking from tomorrow to avoid issues with "today" logic unless specifically needed
    // Usually logistics don't deliver same day unless very early, handled by validation logic
    const today = startOfDay(now); 
    
    for (let i = 0; i < daysToGenerate; i++) {
      const potentialDate = addDays(today, i);
      const validation = logisticsHelper.validateDeliveryDate(potentialDate, route, now);

      validDates.push({
        date: potentialDate,
        isValid: validation.isValid,
        reason: validation.reason,
        deadline: validation.deadline
      });
    }

    return validDates;
  },

  // New specific method to get next 4 valid dates directly
  getNext4ValidDates: (route) => {
      if (!route) return [];
      
      // Generate enough candidates to find 4 valid ones
      // 60 days covers practically any weekly schedule gaps
      const candidates = logisticsHelper.generateValidDates(route, 60);
      
      // Filter for valid ones and take top 4
      return candidates.filter(c => c.isValid).slice(0, 4);
  }
};