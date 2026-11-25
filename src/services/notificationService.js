import api from './api';
import authService from './Authservice';

const entete = () => {
  const user = authService.getCurrentUser();
  const personnelId = user?.personnelId ?? user?.personnel?.id ?? user?.userId ?? null;
  return { headers: personnelId != null ? { 'X-Personnel-Id': String(personnelId) } : {} };
};

const notificationService = {
  async getAll(page = 0, size = 20) {
    const { data } = await api.get('/notification/non-lues', { params: { page, size }, ...entete() });
    return data;
  },

  async countNonLues() {
    const { data } = await api.get('/notification/count-non-lues', entete());
    return data.count;
  },

  async marquerLue(id) {
    const { data } = await api.patch(`/notification/${id}/lue`);
    return data;
  },

  async marquerToutesLues() {
    await api.patch('/notification/marquer-toutes-lues', null, entete());
  },
};

export default notificationService;