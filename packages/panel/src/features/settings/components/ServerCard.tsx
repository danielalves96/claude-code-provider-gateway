import { SettingOutlined } from "@ant-design/icons";
import { Card, Form, type FormInstance, InputNumber, Space } from "antd";
import type { CSSProperties } from "react";
import type { ServerConfig } from "../types.js";

interface ServerCardProps {
  form: FormInstance<ServerConfig>;
}

const MONO_INPUT: CSSProperties = {
  width: 140,
  fontFamily: "monospace",
};

export function ServerCard({ form }: ServerCardProps) {
  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          Server
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="proxyPort"
          label="Proxy Port"
          help="Claude Code points here via ANTHROPIC_BASE_URL"
          style={{ marginBottom: 0 }}
        >
          <InputNumber style={MONO_INPUT} min={1} max={65535} />
        </Form.Item>
      </Form>
    </Card>
  );
}
