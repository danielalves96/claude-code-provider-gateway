import { Skeleton, Layout, theme } from "antd";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";

const { Content } = Layout;

function PageFallback() {
  const { token } = theme.useToken();
  return (
    <Skeleton
      active
      paragraph={{ rows: 6 }}
      style={{ padding: `${token.paddingLG}px 0` }}
    />
  );
}

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
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
