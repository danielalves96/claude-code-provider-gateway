import { type ThemeConfig, theme } from "antd";

export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#FF6C2D",
    colorInfo: "#FF6C2D",
    colorSuccess: "#7fb069",
    colorWarning: "#e0a458",
    colorError: "#ef4444",
    colorBgLayout: "#262624",
    colorBgContainer: "#2c2c2b",
    colorBgElevated: "#30302e",
    colorBgSpotlight: "#30302e",
    colorBorder: "#3e3e38",
    colorBorderSecondary: "#33332f",
    colorText: "#f1f1ef",
    colorTextSecondary: "#c3c0b6",
    colorTextTertiary: "#b7b5a9",
    colorTextQuaternary: "#83827d",
    colorFillSecondary: "#1b1b19",
    colorFillTertiary: "#1a1915",
    colorFillQuaternary: "#15151310",
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily:
      "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontFamilyCode:
      "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  components: {
    Layout: {
      siderBg: "#1f1e1d",
      headerBg: "#1f1e1d",
      bodyBg: "#262624",
      triggerBg: "#2c2c2b",
    },
    Card: {
      paddingLG: 20,
      colorBgContainer: "#2c2c2b",
      colorBorderSecondary: "#3e3e38",
      borderRadiusLG: 16,
    },
    Table: {
      cellPaddingBlock: 8,
      cellPaddingInline: 14,
      headerBg: "#1b1b19",
      headerColor: "#b7b5a9",
      rowHoverBg: "#33332f",
      borderColor: "#3e3e38",
    },
    Menu: {
      itemBorderRadius: 12,
      itemBg: "#1f1e1d",
      itemSelectedBg: "#2c2b27",
      itemSelectedColor: "#ffffff",
      itemHoverBg: "#2c2b27",
      itemHoverColor: "#f1f1ef",
      subMenuItemBg: "#1f1e1d",
      darkItemBg: "#1f1e1d",
      darkItemSelectedBg: "#2c2b27",
      darkItemSelectedColor: "#ffffff",
      darkItemHoverBg: "#2c2b27",
      darkItemHoverColor: "#f1f1ef",
      darkSubMenuItemBg: "#1f1e1d",
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      defaultBg: "#30302e",
      defaultBorderColor: "#3e3e38",
      defaultHoverBg: "#3a3a37",
      colorTextLightSolid: "#141413",
    },
    Input: {
      colorBgContainer: "#1b1b19",
      colorBorder: "#3e3e38",
      activeBorderColor: "#FF6C2D",
      hoverBorderColor: "#52514a",
    },
    InputNumber: {
      colorBgContainer: "#1b1b19",
      activeBorderColor: "#FF6C2D",
      hoverBorderColor: "#52514a",
    },
    Select: {
      colorBgContainer: "#1b1b19",
      colorBgElevated: "#30302e",
      optionSelectedBg: "#3a2a22",
      optionSelectedColor: "#f1f1ef",
    },
    DatePicker: {
      colorBgContainer: "#1b1b19",
      activeBorderColor: "#FF6C2D",
      hoverBorderColor: "#52514a",
    },
    Modal: {
      contentBg: "#2c2c2b",
      headerBg: "#2c2c2b",
      footerBg: "#2c2c2b",
      borderRadiusLG: 16,
    },
    Drawer: {
      colorBgElevated: "#2c2c2b",
    },
    Tooltip: {
      colorBgSpotlight: "#30302e",
      colorTextLightSolid: "#f1f1ef",
    },
    Tag: {
      defaultBg: "#1a1915",
      defaultColor: "#c3c0b6",
    },
    Tabs: {
      itemSelectedColor: "#FF6C2D",
      itemHoverColor: "#e08b6e",
      itemActiveColor: "#FF6C2D",
      inkBarColor: "#FF6C2D",
    },
    Switch: {
      colorPrimary: "#FF6C2D",
      colorPrimaryHover: "#e08b6e",
    },
    Segmented: {
      itemSelectedBg: "#30302e",
      itemSelectedColor: "#f1f1ef",
      trackBg: "#1b1b19",
    },
    Divider: {
      colorSplit: "#3e3e38",
    },
    Dropdown: {
      colorBgElevated: "#30302e",
    },
    Popover: {
      colorBgElevated: "#30302e",
    },
    Notification: {
      colorBgElevated: "#30302e",
    },
    Message: {
      colorBgElevated: "#30302e",
    },
  },
};
