import api from './api';

const cliniqueService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/clinique', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/clinique/${id}`);
    return data;
  },
};

export default cliniqueService;