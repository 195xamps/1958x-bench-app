import { apiClient } from '../api';
import type { RepairAction, CreateRepairActionPayload } from '../../types';

export const repairActionsApi = {
  async list(benchJobId: string): Promise<RepairAction[]> {
    const { data } = await apiClient.get('/api/repair-actions/' + benchJobId);
    return data;
  },
  async create(payload: CreateRepairActionPayload): Promise<RepairAction> {
    const { data } = await apiClient.post('/api/repair-actions', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateRepairActionPayload>): Promise<RepairAction> {
    const { data } = await apiClient.patch('/api/repair-actions/' + id, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete('/api/repair-actions/' + id);
  },
};
