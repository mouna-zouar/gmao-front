import api from './api';

/* Page « Supervision » : tableau de bord du parc connecté pour une période (en heures). */
const supervisionService = {
  async tableau(heures = 24) {
    const { data } = await api.get('/supervision', { params: { heures } });
    return data;
  },
};

export default supervisionService;
