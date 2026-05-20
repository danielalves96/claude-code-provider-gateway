import { Button, Modal, Typography } from "antd";
import type { ConfirmAction, ProviderInfo } from "../../domain/types.js";

const { Text } = Typography;

interface ConfirmModalProps {
  action: ConfirmAction | null;
  providers: ProviderInfo[];
  onCancel: () => void;
  onConfirm: () => void;
}

const COPY = {
  "replace-key": {
    title: "Replace API key?",
    text: (label: string) =>
      `An API key is already configured for ${label}. Saving a new one will overwrite it permanently.`,
    okText: "Replace",
    danger: false,
  },
  "remove-key": {
    title: "Remove API key?",
    text: (label: string) =>
      `The API key for ${label} will be permanently removed. The provider will stop working until a new key is added.`,
    okText: "Remove",
    danger: true,
  },
  "change-url": {
    title: "Change Base URL?",
    text: (label: string) =>
      `Update the Base URL for ${label}? Make sure the new endpoint is reachable.`,
    okText: "Update",
    danger: false,
  },
  "delete-provider": {
    title: "Delete custom provider?",
    text: (label: string) =>
      `${label} will be permanently removed, including its API key, routing rules, and logo.`,
    okText: "Delete",
    danger: true,
  },
} as const;

export function ConfirmModal({ action, providers, onCancel, onConfirm }: ConfirmModalProps) {
  if (!action) return null;
  const label = providers.find((p) => p.id === action.providerId)?.label ?? action.providerId;
  const copy = COPY[action.kind];

  return (
    <Modal
      centered
      open
      title={copy.title}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" danger={copy.danger} onClick={onConfirm} autoFocus>
          {copy.okText}
        </Button>,
      ]}
      width={420}
    >
      <Text type="secondary">{copy.text(label)}</Text>
    </Modal>
  );
}
