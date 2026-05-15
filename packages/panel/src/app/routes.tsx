import { Route, Routes } from "react-router-dom";
import DashboardPage from "../features/dashboard/components/DashboardPage.js";
import HistoryPage from "../features/history/components/HistoryPage.js";
import ProvidersPage from "../features/providers/components/ProvidersPage.js";
import RoutingPage from "../features/routing/components/RoutingPage.js";
import SettingsPage from "../features/settings/components/SettingsPage.js";
import { AppShell } from "../features/shell/AppShell.js";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/routing" element={<RoutingPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
