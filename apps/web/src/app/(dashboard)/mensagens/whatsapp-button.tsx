"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useActionState } from "react";
import type { OperationalMessageType } from "@assistencia/shared/constants/message-types";
import {
  logWhatsAppMessageAction,
  type WhatsAppMessageActionState
} from "./actions";

type WhatsAppButtonProps = {
  orderId: string;
  messageType: OperationalMessageType;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

const initialState: WhatsAppMessageActionState = {};

export function WhatsAppButton({
  orderId,
  messageType,
  label,
  disabled = false,
  variant = "secondary"
}: WhatsAppButtonProps) {
  const [state, action, isPending] = useActionState(
    logWhatsAppMessageAction.bind(null, orderId, messageType),
    initialState
  );
  const openedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.whatsappUrl && openedUrlRef.current !== state.whatsappUrl) {
      openedUrlRef.current = state.whatsappUrl;
      window.open(state.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }, [state.whatsappUrl]);

  const className =
    variant === "primary"
      ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:h-10 sm:w-auto";

  return (
    <form action={action} className="grid w-full gap-2 sm:w-auto">
      <button className={className} disabled={disabled || isPending} type="submit">
        <MessageCircle className="size-4" aria-hidden="true" />
        {isPending ? "Abrindo..." : label}
      </button>

      {state.error ? (
        <p className="max-w-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
