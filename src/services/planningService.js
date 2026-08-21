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
    const { data } = await api.get('/planning/config');
    return data;
  },
};

export default planningService;