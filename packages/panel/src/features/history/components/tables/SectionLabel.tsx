import { Typography, theme } from "antd";

const { Text } = Typography;

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Text
      type="secondary"
      style={{
        fontSize: token.fontSizeSM - 1,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Text>
  );
}
