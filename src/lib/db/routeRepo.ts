// ============================================================
// Route Repository
// ============================================================
import { getDb } from './database';
import type { Route, RouteStop } from '@/types/domain';
import { todayISO } from '@/lib/utils/helpers';

export const routeRepo = {
  async getTodayRoute(): Promise<Route | undefined> {
    return getDb().routes.where('date').equals(todayISO()).first();
  },

  async getTodayStops(): Promise<RouteStop[]> {
    const route = await this.getTodayRoute();
    if (!route) return [];
    return getDb().routeStops.where('routeId').equals(route.id).sortBy('order');
  },

  async updateStopStatus(stopId: string, status: RouteStop['status']): Promise<void> {
    await getDb().routeStops.update(stopId, { status });
  }
};
