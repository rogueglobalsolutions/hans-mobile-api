import prisma from "../config/prisma";
import { AccountStatus, AppointmentStatus } from "../generated/prisma/enums";
import * as commerceService from "./commerce.service";
import { getBAStats } from "./ba.service";

const LOW_STOCK_THRESHOLD = 5;
const RECENT_ORDERS_LIMIT = 10;

/**
 * Everything the admin dashboard needs in one round trip. The dashboard used to fire
 * 7 separate requests (each re-running auth), and pulled the full pending-verification
 * and appointment lists just to show their counts.
 */
export async function getDashboardSummary() {
  const [
    pendingVerifications,
    pendingAppointments,
    baStats,
    orderCounts,
    financial,
    lowStockProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count({
      where: { accountStatus: AccountStatus.PENDING_VERIFICATION, hasSubmittedVerification: true },
    }),
    prisma.appointment.count({ where: { status: AppointmentStatus.PENDING } }),
    getBAStats(),
    commerceService.getOrderCounts() as Promise<{ ordersToday: number; ordersThisWeek: number }>,
    commerceService.getFinancialSummary({ filterType: "weekly" }),
    commerceService.getLowStockProducts(LOW_STOCK_THRESHOLD),
    commerceService.getRecentOrders(RECENT_ORDERS_LIMIT),
  ]);

  return {
    pendingVerifications,
    pendingAppointments,
    baCount: baStats.baCount,
    contestCount: baStats.contestCount,
    ordersToday: orderCounts.ordersToday,
    ordersThisWeek: orderCounts.ordersThisWeek,
    netSalesThisWeek: financial.netSales,
    lowStockProducts,
    recentOrders,
  };
}
