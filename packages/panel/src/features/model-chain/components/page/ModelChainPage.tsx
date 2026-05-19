import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Flex, Row, theme } from "antd";
import { useState } from "react";
import { PageHeader } from "../../../../shared/components/PageHeader.js";
import { useChainDraft } from "../../hooks/useChainDraft.js";
import { useModelChainPage } from "../../hooks/useModelChainPage.js";
import { ChainCard } from "../card/ChainCard.js";
import { ChainModal } from "../modal/ChainModal.js";

export default function ModelChainPage() {
  const { token } = theme.useToken();
  const { chains, options, loaded, saving, persist, deleteChain, toggleChainEnabled } =
    useModelChainPage();
  const { editing, setEditing, openNew, openEdit, cancelEdit, saveDraft } = useChainDraft(
    chains,
    persist,
  );
  const [showAlert, setShowAlert] = useState(
    () => localStorage.getItem("ccpg_dismiss_chain_alert") !== "true",
  );

  return (
    <Flex vertical gap={token.paddingLG} style={{ paddingBottom: token.paddingLG * 2 }}>
      <Flex justify="space-between" align="flex-start" gap={token.padding}>
        <PageHeader
          title="Model Chain"
          description="Create custom Claude-discoverable models that try providers in your priority order."
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          New chain
        </Button>
      </Flex>

      {showAlert && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => {
            localStorage.setItem("ccpg_dismiss_chain_alert", "true");
            setShowAlert(false);
          }}
          message="Model chains appear in Claude as Custom Models"
          description="Use the model picker entry, or launch directly with ccpg --yourSlug. The first model is tried first; failures move to the next entry."
        />
      )}

      {!loaded ? (
        <Card loading />
      ) : chains.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No chains yet"
          style={{
            padding: token.paddingXL,
            border: `1px dashed ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            Create your first chain
          </Button>
        </Empty>
      ) : (
        <Row gutter={[token.paddingLG, token.paddingLG]}>
          {chains.map((chain) => (
            <Col xs={24} xl={12} key={chain.id}>
              <ChainCard
                chain={chain}
                options={options}
                saving={saving}
                onEdit={() => openEdit(chain)}
                onDelete={() => deleteChain(chain.id)}
                onToggleEnabled={(enabled) => toggleChainEnabled(chain.id, enabled)}
              />
            </Col>
          ))}
        </Row>
      )}

      <ChainModal
        open={editing !== null}
        draft={editing}
        options={options}
        existingSlugs={chains
          .filter((chain) => chain.id !== editing?.id)
          .map((chain) => chain.slug)}
        onChange={setEditing}
        onCancel={cancelEdit}
        onSave={saveDraft}
      />
    </Flex>
  );
}
