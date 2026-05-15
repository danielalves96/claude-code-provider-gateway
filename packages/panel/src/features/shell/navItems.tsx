import {
  ApiOutlined,
  DashboardOutlined,
  ForkOutlined,
  HistoryOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

export type NavItem = NonNullable<MenuProps["items"]>[number];

export const NAV_ITEMS: NavItem[] = [
  { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/providers", icon: <ApiOutlined />, label: "Providers" },
  { key: "/routing", icon: <ForkOutlined />, label: "Routing" },
  { key: "/history", icon: <HistoryOutlined />, label: "History" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

export function selectedKeyFromPath(pathname: string): string {
  if (pathname === "/") return "/";
  for (const item of NAV_ITEMS) {
    const key = String(item?.key ?? "");
    if (key && key !== "/" && pathname.startsWith(key)) return key;
  }
  return "/";
}
