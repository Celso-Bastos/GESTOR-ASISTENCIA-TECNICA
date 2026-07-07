import { notFound } from "next/navigation";
import {
  getMaintenanceOrderById,
  updateMaintenanceOrderAction
} from "../../actions";
import { MaintenanceForm } from "../../maintenance-form";
import { getMaintenanceDevice } from "../../maintenance-relations";

type EditarManutencaoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function priceToInput(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

export default async function EditarManutencaoPage({
  params
}: EditarManutencaoPageProps) {
  const { id } = await params;
  const order = await getMaintenanceOrderById(id);

  if (!order) {
    notFound();
  }

  const device = getMaintenanceDevice(order);

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Manutenções
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Editar {order.order_number}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Atualize dados básicos da ordem e do aparelho sem alterar organização,
          criador ou número da OS.
        </p>
      </div>

      <MaintenanceForm
        action={updateMaintenanceOrderAction.bind(null, order.id)}
        initialValues={{
          brand: device?.brand ?? "",
          model: device?.model ?? "",
          color: device?.color ?? "",
          storage: device?.storage ?? "",
          imei: device?.imei ?? "",
          device_notes: device?.notes ?? "",
          reported_issue: order.reported_issue,
          diagnosis: order.diagnosis ?? "",
          expected_delivery_date: order.expected_delivery_date ?? "",
          estimated_price: priceToInput(order.estimated_price),
          final_price: priceToInput(order.final_price),
          internal_notes: order.internal_notes ?? ""
        }}
        mode="edit"
        submitLabel="Salvar alterações"
      />
    </section>
  );
}
