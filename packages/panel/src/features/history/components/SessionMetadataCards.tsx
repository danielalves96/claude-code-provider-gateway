import { Card, Col, Row, Typography, theme } from "antd";
import { formatUptime } from "../../../shared/utils/time.js";
import { formatDate } from "../format.js";
import { providerLabel } from "../labels.js";
import type { Session } from "../types.js";

const { Text } = Typography;

interface SessionMetadataCardsProps {
  session: Session;
}

export function SessionMetadataCards({ session }: SessionMetadataCardsProps) {
  const { token } = theme.useToken();

  const items = [
    { label: "Started", value: formatDate(session.startedAt) },
    {
      label: "Ended",
      value: session.endedAt ? formatDate(session.endedAt) : "Running",
    },
    { label: "Duration", value: formatUptime(session.durationMs) },
    { label: "Mode", value: session.modelMode },
    {
      label: "Providers",
      value:
        session.modelMode === "all"
          ? session.enabledProviders.map(providerLabel).join(", ") || "none"
          : providerLabel(session.activeProvider),
    },
  ];

  return (
    <Row gutter={[token.paddingXS, token.paddingXS]}>
      {items.map(({ label, value }) => (
        <Col key={label}>
          <Card size="small">
            <Text
              type="secondary"
              style={{
                fontSize: token.fontSizeSM - 1,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                display: "block",
              }}
            >
              {label}
            </Text>
            <Text ellipsis={{ tooltip: value }}>
              {value.length > 30 ? `${value.slice(0, 30)}…` : value}
            </Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
