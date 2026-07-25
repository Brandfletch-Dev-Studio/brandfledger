// Shared logo component — embeds the BF icon as base64 so it loads
// instantly on any network, without a separate HTTP request.
// Usage: <BFLogo size={32} className="rounded-xl" />

import { LOGO_BASE64 } from "@/lib/logo";

interface BFLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function BFLogo({ size = 32, className = "rounded-xl", alt = "Brandfledger" }: BFLogoProps) {
  return (
    <img
      src={LOGO_BASE64}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
