import api from './api';

function toIsoLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const planningService = {

  async findEvenements(mode, dateDebut, dateFin) {
    const { data } = await api.get('/planning', {
      params: {
        mode,
        dateDebut: toIsoLocalDateTime(dateDebut),
        dateFin: toIsoLocalDateTime(dateFin),
      },
    });
    return data;
  },


async findConfig() {
  try {
    const { data } = await api.get('/planning/config');
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn('Config planning non trouvée, utilisation des valeurs par défaut.');
      return {
        dayClick: true,
      };
    }
    throw error; // pour les autres erreurs, on les relance
  }
},

  async findById(id, mode) {
    const { data } = await api.get(`/planning/${id}`, {
      params: { mode },
    });
    return data;
  },


  async findByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/planning/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },


  async findByIntervenant(intervenantId) {
    const { data } = await api.get(`/planning/intervenant/${intervenantId}`);
    return data;
  },


  async findByTache(tacheId) {
    const { data } = await api.get(`/planning/tache/${tacheId}`);
    return data;
  },

  async findToday(mode) {
    const { data } = await api.get('/planning/today', {
      params: { mode },
    });
    return data;
  },

  async findPlanningTechnicien(personnelId, dateDebut, dateFin) {
    const { data } = await api.get(`/planning/technicien/${personnelId}`, {
      params: {
        dateDebut: toIsoLocalDateTime(dateDebut),
        dateFin: toIsoLocalDateTime(dateFin),
      },
    });
    return data;
  },

  async findPlanningTousTechniciens(dateDebut, dateFin) {
    const params = {};
    if (dateDebut) params.dateDebut = toIsoLocalDateTime(dateDebut);
    if (dateFin) params.dateFin = toIsoLocalDateTime(dateFin);
    const { data } = await api.get('/planning/techniciens', { params });
    return data;
  },
};

export default planningService;