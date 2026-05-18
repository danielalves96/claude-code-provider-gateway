import { CaretRightOutlined } from "@ant-design/icons";
import { theme } from "antd";
import type { MouseEvent } from "react";

interface TableExpandButtonProps<RecordType> {
  expanded: boolean;
  record: RecordType;
  size?: number;
  iconSize?: number;
  onExpand: (record: RecordType, event: MouseEvent<HTMLElement>) => void;
}

export function TableExpandButton<RecordType>({
  expanded,
  record,
  size = 28,
  iconSize = 16,
  onExpand,
}: TableExpandButtonProps<RecordType>) {
  const { token } = theme.useToken();

  return (
    <button
      type="button"
      aria-label={expanded ? "Collapse row" : "Expand row"}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: expanded ? token.colorFillSecondary : "transparent",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        padding: 0,
      }}
      onClick={(event) => onExpand(record, event)}
    >
      <CaretRightOutlined
        rotate={expanded ? 90 : 0}
        style={{
          color: expanded ? token.colorPrimary : token.colorTextSecondary,
          transition: "transform 0.2s",
          fontSize: iconSize,
        }}
      />
    </button>
  );
}
