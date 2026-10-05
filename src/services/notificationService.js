import api from './api';

const notificationService = {
  async getAll(page = 0, size = 20) {
    const { data } = await api.get('/notification/non-lues', { params: { page, size } });
    return data;
  },

  async countNonLues() {
    const { data } = await api.get('/notification/count-non-lues');
    return data.count;
  },

  async marquerLue(id) {
    const { data } = await api.patch(`/notification/${id}/lue`);
    return data;
  },

  async marquerToutesLues() {
    await api.patch('/notification/marquer-toutes-lues');
  },
};

export default notificationService;