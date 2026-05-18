import { Button, Modal, Typography } from "antd";

const { Text } = Typography;

interface ClearHistoryModalProps {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClearHistoryModal({ open, loading, onCancel, onConfirm }: ClearHistoryModalProps) {
  return (
    <Modal
      open={open}
      title="Clear archived history?"
      onCancel={() => !loading && onCancel()}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" danger loading={loading} onClick={onConfirm} autoFocus>
          Clear history
        </Button>,
      ]}
      width={440}
    >
      <Text type="secondary">
        Removes completed and crashed sessions. The currently running session is kept.
      </Text>
    </Modal>
  );
}
