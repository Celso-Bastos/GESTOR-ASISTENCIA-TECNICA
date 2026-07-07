import type { MaintenanceCustomer, MaintenanceDevice } from "./actions";

function singleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function getMaintenanceCustomer(order: {
  customers: MaintenanceCustomer | MaintenanceCustomer[] | null;
}) {
  return singleRelation(order.customers);
}

export function getMaintenanceDevice(order: {
  devices: MaintenanceDevice | MaintenanceDevice[] | null;
}) {
  return singleRelation(order.devices);
}
