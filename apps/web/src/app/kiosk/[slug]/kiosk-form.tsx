"use client";

import { useState, type FormEvent } from "react";

type KioskFormProps = {
  slug: string;
  token: string;
};

const successMessage =
  "Cadastro realizado com sucesso. A loja podera entrar em contato pelo WhatsApp.";
const errorMessage =
  "Nao foi possivel concluir o cadastro. Verifique os dados e tente novamente.";

export function KioskForm({ slug, token }: KioskFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/kiosk/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          token,
          name,
          phone,
          consent,
          website
        })
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setName("");
      setPhone("");
      setConsent(false);
      setWebsite("");
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="grid gap-5 sm:gap-6" onSubmit={handleSubmit}>
      <input
        autoComplete="off"
        className="hidden"
        name="website"
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        value={website}
      />

      <label className="grid gap-3 text-lg font-semibold text-content sm:text-xl">
        Nome
        <input
          autoComplete="name"
          className="h-14 rounded-md border border-line-strong bg-surface px-4 text-xl font-medium text-foreground outline-none transition placeholder:text-disabled focus:border-accent-border-strong focus:ring-4 focus:ring-focus-soft sm:h-16 sm:px-5 sm:text-2xl"
          maxLength={120}
          minLength={2}
          onChange={(event) => setName(event.target.value)}
          placeholder="Seu nome"
          required
          value={name}
        />
      </label>

      <label className="grid gap-3 text-lg font-semibold text-content sm:text-xl">
        WhatsApp
        <input
          autoComplete="tel"
          className="h-14 rounded-md border border-line-strong bg-surface px-4 text-xl font-medium text-foreground outline-none transition placeholder:text-disabled focus:border-accent-border-strong focus:ring-4 focus:ring-focus-soft sm:h-16 sm:px-5 sm:text-2xl"
          inputMode="tel"
          maxLength={30}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(11) 99999-9999"
          required
          type="tel"
          value={phone}
        />
      </label>

      <label className="flex gap-4 rounded-md border border-line bg-surface p-4 text-base font-medium leading-7 text-body shadow-sm sm:p-5 sm:text-lg">
        <input
          checked={consent}
          className="mt-1 size-6 shrink-0 rounded border-line-strong text-accent"
          onChange={(event) => setConsent(event.target.checked)}
          required
          type="checkbox"
        />
        <span>
          Aceito receber contato da loja pelo WhatsApp sobre manutencao,
          entrega, produtos e promocoes.
        </span>
      </label>

      {status === "success" ? (
        <p className="rounded-md border border-accent-line bg-accent-soft px-5 py-4 text-lg font-semibold text-accent-strong">
          {successMessage}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-md border border-danger-line bg-danger-soft px-5 py-4 text-lg font-semibold text-danger">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="h-14 rounded-md bg-teal-700 px-8 text-lg font-bold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-focus-soft disabled:cursor-not-allowed disabled:bg-disabled-bg sm:h-16 sm:text-xl"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Enviando..." : "Cadastrar"}
      </button>
    </form>
  );
}
