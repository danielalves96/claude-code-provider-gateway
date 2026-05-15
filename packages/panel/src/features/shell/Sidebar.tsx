import { GithubOutlined } from "@ant-design/icons";
import { Flex, Layout, Menu, Tooltip, Typography, theme } from "antd";
import { useState } from "react";

const { Text } = Typography;

import { useLocation, useNavigate } from "react-router-dom";
import { openExternal } from "../../shared/openExternal.js";
import { NAV_ITEMS, selectedKeyFromPath } from "./navItems.js";

const { Sider } = Layout;

const GITHUB_URL = "https://github.com/danielalves96/claude-code-provider-gateway";

export function Sidebar() {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = selectedKeyFromPath(location.pathname);

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
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={NAV_ITEMS}
        onClick={({ key }) => navigate(key)}
      />
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
        gap: token.paddingSM,
        padding: `0 ${collapsed ? 0 : token.paddingLG}px`,
        height: 48,
        color: token.colorTextSecondary,
        textDecoration: "none",
        transition: "color 0.2s, background 0.2s",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = token.colorText;
        e.currentTarget.style.background = token.colorBgTextHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = token.colorTextSecondary;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <GithubOutlined style={{ fontSize: 16, flexShrink: 0 }} />
      {!collapsed && <span style={{ fontSize: token.fontSize }}>Star us on GitHub</span>}
    </a>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: 0,
        right: 0,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
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
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Text style={{ fontSize: 11, color: token.colorTextQuaternary }}>
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
        padding: `${token.paddingMD}px ${collapsed ? 0 : token.paddingLG}px`,
        overflow: "hidden",
        height: 64,
      }}
    >
      <img
        src="/claude-blind.png"
        alt=""
        style={{
          height: 32,
          width: "auto",
          flexShrink: 0,
        }}
      />
      {!collapsed && (
        <img
          src="/logo_name.png"
          alt="Claude Code Provider Gateway"
          style={{
            height: 28,
            width: "auto",
            objectFit: "contain",
          }}
        />
      )}
    </Flex>
  );
}
