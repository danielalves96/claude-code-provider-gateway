import { Flex, Typography, theme } from "antd";
import type { Session } from "../../domain/types.js";
import { ModelsUsedTable } from "../tables/ModelsUsedTable.js";
import { RequestLogTable } from "../tables/RequestLogTable.js";
import { SessionMetadataCards } from "./SessionMetadataCards.js";

const { Text } = Typography;

interface SessionDetailsProps {
  session: Session;
}

export function SessionDetails({ session }: SessionDetailsProps) {
  const { token } = theme.useToken();

  const usedModels = Object.entries(session.modelStats ?? {}).sort(
    ([, a], [, b]) => b.requests - a.requests,
  );
  const requestLog = [...(session.requestLog ?? [])].reverse();

  return (
    <Flex
      vertical
      gap={token.paddingLG}
      style={{
        padding: `${token.paddingLG}px ${token.paddingLG}px ${token.padding}px ${token.paddingXL}px`,
        background: "rgba(0,0,0,0.15)",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: "inset 0 4px 8px rgba(0,0,0,0.05)",
      }}
    >
      <SessionMetadataCards session={session} />

      {usedModels.length > 0 && (
        <div
          style={{
            background: token.colorBgContainer,
            padding: token.padding,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <ModelsUsedTable rows={usedModels} />
        </div>
      )}

      {requestLog.length > 0 && (
        <div
          style={{
            background: token.colorBgContainer,
            padding: token.padding,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <RequestLogTable entries={requestLog} />
        </div>
      )}

      <Text
        type="secondary"
        style={{ fontFamily: "monospace", fontSize: token.fontSizeSM - 1, alignSelf: "flex-end" }}
      >
        session id: {session.id}
      </Text>
    </Flex>
  );
}
