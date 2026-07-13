import type { AVAILABLE_MESSAGE_VARIABLES } from "./defaults";

type MessageVariable = (typeof AVAILABLE_MESSAGE_VARIABLES)[number];

export type MessageVariables = Partial<Record<MessageVariable, string | null>>;

export function interpolateMessageTemplate(
  template: string,
  variables: MessageVariables
) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = variables[key as MessageVariable];

    return value ? String(value) : "";
  });
}

