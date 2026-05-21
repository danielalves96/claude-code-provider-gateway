import { SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Collapse,
  Flex,
  Form,
  InputNumber,
  Row,
  Space,
  Typography,
  theme,
} from "antd";
import { useEffect, useState } from "react";

const { Text } = Typography;

interface RuntimeLimits {
  rateLimit: number;
  rateWindow: number;
  maxConcurrency: number;
}

interface RuntimeLimitsSectionProps extends RuntimeLimits {
  onSave: (limits: RuntimeLimits) => void;
}

export function RuntimeLimitsSection({
  rateLimit,
  rateWindow,
  maxConcurrency,
  onSave,
}: RuntimeLimitsSectionProps) {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<RuntimeLimits>({ rateLimit, rateWindow, maxConcurrency });

  useEffect(() => {
    setDraft({ rateLimit, rateWindow, maxConcurrency });
  }, [rateLimit, rateWindow, maxConcurrency]);

  const changed =
    draft.rateLimit !== rateLimit ||
    draft.rateWindow !== rateWindow ||
    draft.maxConcurrency !== maxConcurrency;

  const setLimit = (key: keyof RuntimeLimits, value: number | null) => {
    setDraft((current) => ({ ...current, [key]: Math.max(0, Math.floor(value ?? 0)) }));
  };

  return (
    <Collapse
      size="small"
      ghost
      expandIconPosition="end"
      items={[
        {
          key: "advanced",
          label: (
            <Flex vertical gap={0}>
              <Text strong>
                <Space>
                  <ThunderboltOutlined style={{ color: token.colorPrimary }} />
                  Advanced settings
                </Space>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Optional local request limits for this provider. Leave as 0 for no limits.
              </Text>
            </Flex>
          ),
          children: (
            <Flex vertical gap={12}>
              <Form layout="vertical">
                <Row gutter={[token.paddingSM, token.paddingXS]}>
                  <LimitInput
                    label="Max concurrent"
                    description="Caps simultaneous in-flight requests."
                    value={draft.maxConcurrency}
                    onChange={(value) => setLimit("maxConcurrency", value)}
                  />
                  <LimitInput
                    label="Requests"
                    description="Caps request starts inside the window."
                    value={draft.rateLimit}
                    onChange={(value) => setLimit("rateLimit", value)}
                  />
                  <LimitInput
                    label="Window"
                    description="Window size in seconds."
                    addonAfter="s"
                    value={draft.rateWindow}
                    onChange={(value) => setLimit("rateWindow", value)}
                  />
                </Row>
              </Form>

              <Flex justify="space-between" align="center" gap={token.paddingSM} wrap="wrap">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  The daemon enforces these before sending requests upstream. 0 disables a limit.
                </Text>
                <Button
                  size="small"
                  type="primary"
                  icon={<SaveOutlined />}
                  disabled={!changed}
                  onClick={() => onSave(draft)}
                >
                  Save limits
                </Button>
              </Flex>
            </Flex>
          ),
        },
      ]}
    />
  );
}

function LimitInput({
  label,
  description,
  value,
  addonAfter,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  addonAfter?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <Col xs={24} md={8}>
      <Form.Item label={label} style={{ marginBottom: 0 }}>
        <InputNumber
          min={0}
          step={1}
          precision={0}
          addonAfter={addonAfter}
          value={value}
          style={{ width: "100%" }}
          onChange={onChange}
        />
        <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
          {description}
        </Text>
      </Form.Item>
    </Col>
  );
}
