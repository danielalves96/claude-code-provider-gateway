import { Layout, theme } from "antd";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";

const { Content } = Layout;

export function AppShell() {
  const { token } = theme.useToken();

  return (
    <Layout style={{ height: "100vh" }}>
      <Sidebar />
      <Layout style={{ height: "100vh", overflow: "hidden" }}>
        <TopBar />
        <Content
          style={{
            padding: token.paddingLG,
            overflow: "auto",
            height: "calc(100vh - 56px)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
