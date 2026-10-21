// Arte oficial dos agentes em public/art/agents (política "Legal Jibber Jabber" da Riot).
// Nome do arquivo = nome do agente em minúsculas, sem acento nem símbolos ("KAY/O" -> "kayo"), igual ao download.
export const agentSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

export const agentArt = (name: string | null | undefined) =>
  name ? { portrait: `/art/agents/${agentSlug(name)}.webp`, background: `/art/agents/${agentSlug(name)}_bg.webp` } : undefined;

// Splash dos mapas em public/art/maps (WebP leve gerado a partir do splash oficial), pelo codinome interno ("Jam" -> jam.webp).
export const mapSplash = (code: string | null | undefined) => (code ? `/art/maps/${code.toLowerCase()}.webp` : undefined);
