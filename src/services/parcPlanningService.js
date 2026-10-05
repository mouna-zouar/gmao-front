import api from './api';

/**
 * GET /api/parc/planning?debut=...&fin=... — missions + réservations de tous
 * les véhicules chevauchant la fenêtre [debut, fin).
 *
 * Nommé "parcPlanningService" (et non "planningService", déjà pris par le
 * planning des bons de maintenance/techniciens) pour éviter toute confusion
 * avec ce module sans rapport.
 */
function toLocalIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const parcPlanningService = {
  async getPlanning(debut, fin) {
    const { data } = await api.get('/parc/planning', {
      params: { debut: toLocalIso(debut), fin: toLocalIso(fin) },
    });
    return data;
  },
};

export default parcPlanningService;
