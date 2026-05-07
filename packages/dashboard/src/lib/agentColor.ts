// Deterministic color per agent identity.
// Hashes the hex identity to an HSL hue, with high saturation + light enough to glow.

export function agentColorFromIdentity(identityHex: string): string {
  let hash = 0;
  for (let i = 0; i < identityHex.length; i++) {
    hash = (hash * 31 + identityHex.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 65%)`;
}

export function agentColorFromIdentityHexBytes(identityHex: string): {
  fill: string;
  fillSoft: string;
  hue: number;
} {
  let hash = 0;
  for (let i = 0; i < identityHex.length; i++) {
    hash = (hash * 31 + identityHex.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return {
    fill: `hsl(${hue}, 75%, 65%)`,
    fillSoft: `hsla(${hue}, 75%, 65%, 0.18)`,
    hue,
  };
}
