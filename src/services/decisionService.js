import api from './api';

const decisionService = {
  async reparerOuRemplacer(equipementId) {
    const reponse = await api.get(`/decisions/equipements/${equipementId}/reparer-ou-remplacer`);
    return reponse.status === 204 ? null : reponse.data || null;
  },

  async conseilsPreventif() {
    const { data } = await api.get('/decisions/preventif');
    return data ?? [];
  },

  async prioritesPersonnel(personnelId, limite = 5) {
    const { data } = await api.get(`/decisions/priorites-du-jour/personnel/${personnelId}`, { params: { limite } });
    return data ?? [];
  },

  async previsionsStock(delaiJours = 14, tout = false) {
    const { data } = await api.get('/decisions/stock', { params: { delaiJours, tout } });
    return data ?? null;
  },

  async prioritesDuJour(limite = 5, personnelId = null) {
    const { data } = await api.get('/decisions/priorites-du-jour', { params: { limite, personnelId: personnelId ?? undefined } });
    return data ?? [];
  },
};

export default decisionService;
