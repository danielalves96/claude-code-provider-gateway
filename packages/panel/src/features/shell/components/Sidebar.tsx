import { GithubOutlined } from "@ant-design/icons";
import { ConfigProvider, Flex, Layout, Menu, Tooltip, Typography, theme } from "antd";
import { useState } from "react";

const { Text } = Typography;

import { useLocation, useNavigate } from "react-router-dom";
import { openExternal } from "../../../shared/openExternal.js";
import { useLiveIndicator } from "../../live-session/hooks/useLiveIndicator.js";
import { buildNavItems, selectedKeyFromPath } from "./navItems.js";

const { Sider } = Layout;

const GITHUB_URL = "https://github.com/danielalves96/claude-code-provider-gateway";

export function Sidebar() {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isLive = useLiveIndicator();
  const selectedKey = selectedKeyFromPath(location.pathname);
  const navItems = buildNavItems(isLive);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={250}
      style={{
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        height: "100vh",
        position: "sticky",
        top: 0,
        left: 0,
        overflow: "auto",
      }}
    >
      <Brand collapsed={collapsed} />
      <ConfigProvider
        theme={{
          components: {
            Menu: {
              itemBg: "transparent",
              itemSelectedBg: token.colorFillTertiary,
              itemSelectedColor: token.colorPrimary,
              itemHoverBg: token.colorFillQuaternary,
              itemHoverColor: token.colorText,
              activeBarBorderWidth: 0,
              itemHeight: 44,
              iconSize: 15,
              iconMarginInlineEnd: 10,
              itemPaddingInline: 20,
            },
          },
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: "none", paddingBlock: token.paddingSM }}
        />
      </ConfigProvider>
      <GitHubButton collapsed={collapsed} />
      <AppVersion collapsed={collapsed} />
    </Sider>
  );
}

function GitHubButton({ collapsed }: { collapsed: boolean }) {
  const { token } = theme.useToken();

  const link = (
    <a
      href={GITHUB_URL}
      onClick={(e) => {
        e.preventDefault();
        openExternal(GITHUB_URL);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        padding: `0 ${collapsed ? 0 : 20}px`,
        height: 44,
        color: token.colorTextSecondary,
        textDecoration: "none",
        transition: "color 0.2s, background 0.2s",
        width: "100%",
        boxSizing: "border-box",
        fontSize: token.fontSize,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = token.colorText;
        e.currentTarget.style.background = token.colorFillQuaternary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = token.colorTextSecondary;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 14,
        }}
      >
        <GithubOutlined />
      </div>
      {!collapsed && <span>Star us on GitHub</span>}
    </a>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 84,
        left: 0,
        right: 0,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        paddingBlock: token.paddingXS,
      }}
    >
      {collapsed ? (
        <Tooltip title="Star us on GitHub" placement="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </div>
  );
}

function AppVersion({ collapsed }: { collapsed: boolean }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 0,
        right: 0,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: token.colorTextQuaternary,
          fontFamily: "monospace",
        }}
      >
        {collapsed ? __APP_VERSION__ : `v${__APP_VERSION__}`}
      </Text>
    </div>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      justify={collapsed ? "center" : "flex-start"}
      gap={token.paddingSM}
      style={{
        padding: `0 ${collapsed ? 0 : token.paddingLG}px`,
        overflow: "hidden",
        height: 56,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorPrimaryBg} 100%)`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,

          flexShrink: 0,
        }}
      >
        <img src="/claude-blind.webp" alt="" style={{ height: 22, width: "auto" }} />
      </div>
      {!collapsed && (
        <img
          src="/logo_name.webp"
          alt="Claude Code Provider Gateway"
          style={{ height: 28, width: "auto", objectFit: "contain" }}
        />
      )}
    </Flex>
  );
}
