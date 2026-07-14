"use client";

import { useMemo, useState } from "react";
import { formatPhoneBR } from "@/lib/phone";
import type { CustomerOption } from "./actions";

type CustomerSelectProps = {
  customers: CustomerOption[];
  defaultCustomerId?: string;
};

export function CustomerSelect({
  customers,
  defaultCustomerId
}: CustomerSelectProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCustomers = useMemo(() => {
    if (!normalizedSearch) {
      return customers;
    }

    return customers.filter((customer) => {
      const text = `${customer.name} ${customer.phone} ${customer.phone_normalized}`;
      return text.toLowerCase().includes(normalizedSearch);
    });
  }, [customers, normalizedSearch]);

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Buscar cliente
        <input
          className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome ou telefone"
          type="search"
          value={search}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Cliente
        <select
          className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={defaultCustomerId ?? ""}
          name="customer_id"
          required
        >
          <option value="">Selecione um cliente</option>
          {filteredCustomers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} - {formatPhoneBR(customer.phone)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
