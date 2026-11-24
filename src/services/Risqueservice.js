import api from './api';

const risqueService = {
  async getRisques(limite) {
    const { data } = await api.get('/maintenance-risque', {
      params: limite ? { limite } : {},
    });
    return data;
  },
};

export default risqueService;