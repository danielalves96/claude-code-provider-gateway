import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "../features/shell/components/AppShell.js";

const DashboardPage = lazy(() => import("../features/dashboard/components/DashboardPage.js"));
const LiveSessionPage = lazy(
  () => import("../features/live-session/components/LiveSessionPage.js"),
);
const HistoryPage = lazy(() => import("../features/history/components/page/HistoryPage.js"));
const ServerLogsPage = lazy(() => import("../features/logs/components/page/ServerLogsPage.js"));
const ProvidersPage = lazy(() => import("../features/providers/components/page/ProvidersPage.js"));
const RoutingPage = lazy(() => import("../features/routing/components/page/RoutingPage.js"));
const SettingsPage = lazy(() => import("../features/settings/components/page/SettingsPage.js"));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/live" element={<LiveSessionPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/routing" element={<RoutingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/logs" element={<ServerLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
