import api from './api';
import authService from './Authservice';

function lecteur() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    personnelId: id != null ? Number(id) : null,
    personnelNom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}

const lectureService = {
  async reclamation(id) {
    const { data } = await api.post(`/reclamation/${id}/lu`, lecteur(), { silencieux: true });
    return data;
  },

  async resumeReclamation(id) {
    const { data } = await api.post(`/reclamation/${id}/resume`, lecteur(), { silencieux: true });
    return data;
  },

  async bon(id) {
    const { data } = await api.post(`/bon-maintenance/${id}/lu`, lecteur(), { silencieux: true });
    return data;
  },
};

export default lectureService;
