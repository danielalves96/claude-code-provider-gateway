import { Flex, Typography, theme } from "antd";
import type { Session } from "../types.js";
import { ModelsUsedTable } from "./ModelsUsedTable.js";
import { RequestLogTable } from "./RequestLogTable.js";
import { SessionMetadataCards } from "./SessionMetadataCards.js";

const { Text } = Typography;
const RECENT_REQUEST_LIMIT = 40;

interface SessionDetailsProps {
  session: Session;
}

export function SessionDetails({ session }: SessionDetailsProps) {
  const { token } = theme.useToken();

  const usedModels = Object.entries(session.modelStats ?? {}).sort(
    ([, a], [, b]) => b.requests - a.requests,
  );
  const requestLog = [...(session.requestLog ?? [])].reverse().slice(0, RECENT_REQUEST_LIMIT);

  return (
    <Flex
      vertical
      gap={token.padding}
      style={{
        padding: `${token.padding}px ${token.paddingXL}px ${token.padding}px ${token.paddingLG}px`,
      }}
    >
      <SessionMetadataCards session={session} />
      {usedModels.length > 0 && <ModelsUsedTable rows={usedModels} />}
      {requestLog.length > 0 && <RequestLogTable entries={requestLog} />}

      <Text type="secondary" style={{ fontFamily: "monospace", fontSize: token.fontSizeSM - 1 }}>
        session id: {session.id}
      </Text>
    </Flex>
  );
}
