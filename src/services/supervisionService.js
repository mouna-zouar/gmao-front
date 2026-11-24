import api from './api';

const supervisionService = {
  async tableau(heures = 24) {
    const { data } = await api.get('/supervision', { params: { heures } });
    return data;
  },
};

export default supervisionService;
