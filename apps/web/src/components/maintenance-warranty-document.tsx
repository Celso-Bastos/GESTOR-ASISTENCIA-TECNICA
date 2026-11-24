import Link from "next/link";
import { canManageWarrantyDocument } from "@/lib/organization/warranty-document";
import { getOrganizationWarrantyDocument } from "@/lib/organization/warranty-document-queries";
import { buildWarrantyDocumentMessage } from "@/lib/maintenance/warranty-document-sharing";
import { WarrantyDocumentControls } from "./warranty-document-controls";

type WarrantyOrder = {
  warranty_enabled: boolean; warranty_signed: boolean; order_number: string;
  warranty_amount: number | null; warranty_unit: string | null;
};

export async function MaintenanceWarrantyDocument({ order, role, customer, deviceModel }: {
  order: WarrantyOrder; role: string;
  customer: { name: string; phone_normalized: string | null; phone: string | null } | null;
  deviceModel: string | null;
}) {
  if (!order.warranty_enabled) return null;
  const { document, error } = await getOrganizationWarrantyDocument();
  return <div className="grid min-w-0 gap-3 rounded-md border border-line bg-surface p-4 sm:p-5">
    <h2 className="text-lg font-semibold text-foreground">Termo de garantia</h2>
    <p className="text-sm text-body">Termo físico assinado: {order.warranty_signed ? "Sim" : "Não"}</p>
    <p className="text-sm text-muted">O documento digital é uma cópia informativa das condições gerais. O termo físico continua sendo assinado presencialmente pelo cliente.</p>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : document ? <WarrantyDocumentControls
      key={document.updatedAt} name={document.name} phone={customer?.phone_normalized || customer?.phone}
      message={buildWarrantyDocumentMessage({ customerName: customer?.name, orderNumber: order.order_number,
        deviceModel, warrantyAmount: order.warranty_amount, warrantyUnit: order.warranty_unit })}
    /> : <p className="text-sm text-muted">Nenhum termo de garantia configurado para esta loja.</p>}
    {canManageWarrantyDocument(role) && (!document || error) && <Link href="/configuracoes#termo-garantia" className="min-h-11 py-2 text-sm text-accent underline">Configurar termo</Link>}
  </div>;
}
