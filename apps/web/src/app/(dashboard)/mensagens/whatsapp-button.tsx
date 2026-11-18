"use client";

import { MessageCircle } from "lucide-react";
import { useWhatsAppAction, WhatsAppAlternatives } from "./whatsapp-controls";
import type { OperationalMessageType } from "@assistencia/shared/constants/message-types";
import {
  logWhatsAppMessageAction
} from "./actions";

type WhatsAppButtonProps = {
  orderId: string;
  messageType: OperationalMessageType;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};


export function WhatsAppButton({
  orderId,
  messageType,
  label,
  disabled = false,
  variant = "secondary"
}: WhatsAppButtonProps) {
  const { state, formAction, isPending, prepare, feedback } = useWhatsAppAction(
    logWhatsAppMessageAction.bind(null, orderId, messageType)
  );

  const className =
    variant === "primary"
      ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-success-line disabled:cursor-not-allowed disabled:bg-disabled-bg sm:w-auto"
      : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-success-line bg-success-soft px-3 text-sm font-semibold text-success transition hover:bg-success-muted focus:outline-none focus:ring-2 focus:ring-success-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:h-10 sm:w-auto";

  return (
    <form action={formAction} onSubmit={prepare} className="grid w-full gap-2 sm:w-auto">
      <button className={className} disabled={disabled || isPending} type="submit">
        <MessageCircle className="size-4" aria-hidden="true" />
        {isPending ? "Abrindo..." : label}
      </button>

      <WhatsAppAlternatives state={state} feedback={feedback} />
      {state.error ? (
        <p role="alert" className="max-w-xs rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-5 text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
