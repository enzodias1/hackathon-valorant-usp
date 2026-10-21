// Arte oficial dos agentes em public/art/agents (política "Legal Jibber Jabber" da Riot).
// Nome do arquivo = nome do agente em minúsculas, sem acento nem símbolos ("KAY/O" -> "kayo"), igual ao download.
export const agentSlug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

export const agentArt = (name: string | null | undefined) =>
  name ? { portrait: `/art/agents/${agentSlug(name)}.webp`, background: `/art/agents/${agentSlug(name)}_bg.webp` } : undefined;
