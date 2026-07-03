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
    <form className="grid gap-6" onSubmit={handleSubmit}>
      <input
        autoComplete="off"
        className="hidden"
        name="website"
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        value={website}
      />

      <label className="grid gap-3 text-xl font-semibold text-slate-800">
        Nome
        <input
          autoComplete="name"
          className="h-16 rounded-md border border-slate-300 bg-white px-5 text-2xl font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          maxLength={120}
          minLength={2}
          onChange={(event) => setName(event.target.value)}
          placeholder="Seu nome"
          required
          value={name}
        />
      </label>

      <label className="grid gap-3 text-xl font-semibold text-slate-800">
        WhatsApp
        <input
          autoComplete="tel"
          className="h-16 rounded-md border border-slate-300 bg-white px-5 text-2xl font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          inputMode="tel"
          maxLength={30}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(11) 99999-9999"
          required
          type="tel"
          value={phone}
        />
      </label>

      <label className="flex gap-4 rounded-md border border-slate-200 bg-white p-5 text-lg font-medium leading-7 text-slate-700 shadow-sm">
        <input
          checked={consent}
          className="mt-1 size-6 shrink-0 rounded border-slate-300 text-teal-700"
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
        <p className="rounded-md border border-teal-200 bg-teal-50 px-5 py-4 text-lg font-semibold text-teal-800">
          {successMessage}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-lg font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="h-16 rounded-md bg-teal-700 px-8 text-xl font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Enviando..." : "Cadastrar"}
      </button>
    </form>
  );
}
