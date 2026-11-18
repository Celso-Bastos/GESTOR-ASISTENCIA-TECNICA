type DeviceFormFieldsProps = {
  values: Record<string, string | undefined>;
};

const inputClass =
  "h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft";

export function DeviceFormFields({ values }: DeviceFormFieldsProps) {
  return (
    <fieldset className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
      <legend className="px-1 text-sm font-semibold text-foreground">
        Aparelho
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-body">
          Marca
          <input className={inputClass} defaultValue={values.brand} name="brand" />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Modelo
          <input
            className={inputClass}
            defaultValue={values.model}
            name="model"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Cor
          <input className={inputClass} defaultValue={values.color} name="color" />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Armazenamento
          <input
            className={inputClass}
            defaultValue={values.storage}
            name="storage"
            placeholder="128 GB"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body sm:col-span-2">
          IMEI
          <input className={inputClass} defaultValue={values.imei} name="imei" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-body">
        Observações do aparelho
        <textarea
          className="min-h-28 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          defaultValue={values.device_notes}
          name="device_notes"
        />
      </label>
    </fieldset>
  );
}
