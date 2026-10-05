import api from './api';

const bonMaintenancePieceService = {

    async findByBonMaintenanceId(bonMaintenanceId) {
        const { data } = await api.get(
            `/bon-maintenance-pieces/bon-maintenance/${bonMaintenanceId}`
        );
        return data;
    },

    async getById(id) {
        const { data } = await api.get(
            `/bon-maintenance-pieces/${id}`
        );
        return data;
    },

    async create(payload) {
        const { data } = await api.post(
            '/bon-maintenance-pieces',
            payload
        );
        return data;
    },

    async update(id, payload) {
        const { data } = await api.put(
            `/bon-maintenance-pieces/${id}`,
            payload
        );
        return data;
    },

    async accepter(id) {
        const { data } = await api.put(
            `/bon-maintenance-pieces/${id}/accepter`
        );
        return data;
    },

    async refuser(id) {
        const { data } = await api.put(
            `/bon-maintenance-pieces/${id}/refuser`
        );
        return data;
    },

    async remove(id) {
        await api.delete(
            `/bon-maintenance-pieces/${id}`
        );
    },
};

export default bonMaintenancePieceService;