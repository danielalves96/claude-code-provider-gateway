import { Route, Routes } from "react-router-dom";
import DashboardPage from "../features/dashboard/components/DashboardPage.js";
import HistoryPage from "../features/history/components/page/HistoryPage.js";
import ServerLogsPage from "../features/logs/components/page/ServerLogsPage.js";
import ProvidersPage from "../features/providers/components/page/ProvidersPage.js";
import RoutingPage from "../features/routing/components/page/RoutingPage.js";
import SettingsPage from "../features/settings/components/page/SettingsPage.js";
import { AppShell } from "../features/shell/components/AppShell.js";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/routing" element={<RoutingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/logs" element={<ServerLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
