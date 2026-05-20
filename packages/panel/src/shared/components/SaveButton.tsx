import { CheckOutlined, SaveOutlined } from "@ant-design/icons";
import { Button } from "antd";

interface SaveButtonProps {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
  label?: string;
  savedLabel?: string;
}

export function SaveButton({
  onClick,
  saving,
  saved,
  label = "Save",
  savedLabel = "Saved",
}: SaveButtonProps) {
  return (
    <Button
      type="primary"
      icon={saved ? <CheckOutlined /> : <SaveOutlined />}
      loading={saving}
      onClick={onClick}
    >
      {saved ? savedLabel : label}
    </Button>
  );
}
