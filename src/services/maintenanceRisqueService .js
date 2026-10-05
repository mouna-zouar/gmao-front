import api from './api';

const maintenanceRisqueService = {
  async calculerRisques(limite = 50) {
    const { data } = await api.get('/maintenance-risque', { params: { limite } });
    return data; // List<RisqueEquipementDTO>
  },
};

export default maintenanceRisqueService;