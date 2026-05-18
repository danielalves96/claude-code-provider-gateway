import { Flex, theme } from "antd";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useDashboardPage } from "../hooks/useDashboardPage.js";
import { EnabledProvidersCard } from "./overview/EnabledProvidersCard.js";
import { StatusOverview } from "./overview/StatusOverview.js";
import { QuickLaunchCard } from "./quick-launch/QuickLaunchCard.js";
import { ShellSetupCard } from "./shell-setup/ShellSetupCard.js";

export default function DashboardPage() {
  const { token } = theme.useToken();
  const page = useDashboardPage();

  const shellSetupCard = page.shouldShowShellSetup
    ? page.shellSetup && (
        <ShellSetupCard
          setup={page.shellSetup}
          panelPort={page.status?.panelPort ?? 6767}
          defaultOpen={!page.hasTerminalConfigured}
          canDismiss={page.hasTerminalConfigured}
          onRefresh={page.refreshShellSetup}
          onDismiss={page.dismissShellSetup}
        />
      )
    : null;

  return (
    <Flex vertical gap={token.paddingLG}>
      <PageHeader title="Dashboard" />
      <StatusOverview status={page.status} />
      <EnabledProvidersCard stats={page.stats} />
      {!page.hasTerminalConfigured && shellSetupCard}
      <QuickLaunchCard items={page.launchItems} error={page.launchError} />
      {page.hasTerminalConfigured && shellSetupCard}
    </Flex>
  );
}
