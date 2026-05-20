import {
  ApiOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ForkOutlined,
  HistoryOutlined,
  PartitionOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Badge } from "antd";

export type NavItem = NonNullable<MenuProps["items"]>[number];

const BASE_ITEMS: NavItem[] = [
  { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/live", icon: <ThunderboltOutlined />, label: "Live Sessions" },
  { key: "/providers", icon: <ApiOutlined />, label: "Providers" },
  { key: "/model-chain", icon: <PartitionOutlined />, label: "Model Chain" },
  { key: "/routing", icon: <ForkOutlined />, label: "Routing" },
  { key: "/history", icon: <HistoryOutlined />, label: "History" },
  { key: "/logs", icon: <FileTextOutlined />, label: "Server Logs" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

export function buildNavItems(isLive: boolean): NavItem[] {
  if (!isLive) return BASE_ITEMS;
  return BASE_ITEMS.map((item) =>
    item && "key" in item && item.key === "/live"
      ? {
          ...item,
          icon: (
            <Badge dot status="processing" offset={[3, -3]}>
              <ThunderboltOutlined />
            </Badge>
          ),
        }
      : item,
  );
}

export function selectedKeyFromPath(pathname: string): string {
  if (pathname === "/") return "/";
  for (const item of BASE_ITEMS) {
    const key = String(item && "key" in item ? (item.key ?? "") : "");
    if (key && key !== "/" && (pathname === key || pathname.startsWith(`${key}/`))) return key;
  }
  return "/";
}
