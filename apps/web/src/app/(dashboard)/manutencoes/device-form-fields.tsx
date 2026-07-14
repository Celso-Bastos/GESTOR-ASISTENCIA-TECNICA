type DeviceFormFieldsProps = {
  values: Record<string, string | undefined>;
};

const inputClass =
  "h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export function DeviceFormFields({ values }: DeviceFormFieldsProps) {
  return (
    <fieldset className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <legend className="px-1 text-sm font-semibold text-slate-950">
        Aparelho
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Marca
          <input className={inputClass} defaultValue={values.brand} name="brand" />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Modelo
          <input
            className={inputClass}
            defaultValue={values.model}
            name="model"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Cor
          <input className={inputClass} defaultValue={values.color} name="color" />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Armazenamento
          <input
            className={inputClass}
            defaultValue={values.storage}
            name="storage"
            placeholder="128 GB"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          IMEI
          <input className={inputClass} defaultValue={values.imei} name="imei" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Observações do aparelho
        <textarea
          className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          defaultValue={values.device_notes}
          name="device_notes"
        />
      </label>
    </fieldset>
  );
}
