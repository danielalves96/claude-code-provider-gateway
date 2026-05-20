import { Avatar, theme } from "antd";
import { useState } from "react";

interface ProviderLogoProps {
  providerId: string;
  label: string;
  size: number;
  logoUrl?: string;
}

export function ProviderLogo({ providerId, label, size, logoUrl }: ProviderLogoProps) {
  const { token } = theme.useToken();
  const [failedLogoSrc, setFailedLogoSrc] = useState<string | null>(null);
  const src = logoUrl ?? `/providers/${providerId}.webp`;

  if (failedLogoSrc === src) {
    return (
      <Avatar
        shape="square"
        size={size}
        style={{ backgroundColor: token.colorFillSecondary, flexShrink: 0 }}
      >
        <span style={{ color: token.colorText, fontSize: Math.max(12, Math.round(size * 0.38)) }}>
          {label.charAt(0).toUpperCase()}
        </span>
      </Avatar>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
      }}
      onError={() => setFailedLogoSrc(src)}
    />
  );
}
