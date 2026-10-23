// Tipos dos JSONs em public/data (gerados por pipeline/export.py). Documentação: web/DADOS.md

export type Color = "Red" | "Blue";
export type Side = "Ataque" | "Defesa";
export type AgentRole = "Duelista" | "Iniciador" | "Controlador" | "Sentinela";

export interface TeamName {
  name: string;
  tag: string;
  institution?: string | null;
}

export interface MatchSummary {
  id: string;
  date: string;
  competition: string;
  stage: string | null;
  map: string;
  red: string;
  blue: string;
  score: Record<Color, number>;
  winner: Color;
}

export interface TeamSummary {
  slug: string;
  name: string;
  tag: string;
  maps: number;
  map_wins: number;
  rounds: number;
  round_win: number;
  competitions: string[];
  strength_rank: number;
  strength: number;
  /** posição ajustada pela equipe pelo resultado (não segue a força); só quando é o caso */
  rank_adjusted?: boolean;
  /** resultado e força em cada campeonato, só com as partidas dele (abas de /times) */
  by_competition: Record<string, CompetitionRecord>;
  /** o mesmo em cada fase do Univavá (Classificatórias 1–4, Fase de Grupos) */
  by_stage: Record<string, CompetitionRecord>;
}

export interface CompetitionRecord {
  maps: number; map_wins: number; rounds: number; round_win: number | null;
  strength_rank: number | null; strength: number | null; of: number | null;
  rank_adjusted?: boolean;
}

export interface PlayerSummary {
  puuid: string;
  name: string;
  team: string;
  rounds: number;
  agent_role: AgentRole | null;
  kd: number;
  wpa_per_round: number;
  eligible: boolean;
  /** outros times por que jogou (só quando jogou por mais de um; o principal é `team`) */
  other_teams?: { slug: string; name: string }[];
  /** o mesmo resumo só com as partidas de cada campeonato (abas de /jogadores) */
  by_competition: Record<string, PlayerScoped>;
  /** e de cada fase do Univavá */
  by_stage: Record<string, PlayerScoped>;
}

export interface PlayerScoped {
  /** o time por que mais jogou ali; `other_teams`, os outros (slugs) */
  team: string;
  other_teams?: string[];
  maps: number;
  rounds: number;
  agent_role: AgentRole | null;
  kd: number;
  wpa_per_round: number;
}

export interface DataIndex {
  teams: Record<string, TeamName>;
  team_list: TeamSummary[];
  players: PlayerSummary[];
  matches: MatchSummary[];
}

// ---------------------------------------------------------------- partida
export interface MatchPlayer {
  puuid: string;
  name: string;
  color: Color;
  agent: string;
  agent_icon: string | null;
  /** ícone redondo do agente usado no minimapa do jogo (replay) */
  minimap_icon?: string | null;
  /** usos de cada habilidade na partida: [C, Q, E, ultimate] (a Riot não diz em que momento) */
  /** usos de C, Q, E e ultimates na partida; ultimate null onde a Riot não conta (Chamber a partir do patch 13.02) */
  casts?: [number, number, number, number | null];
  /** só quando a ultimate não é contada: rounds em que ele matou com a ultimate (o mínimo garantido) */
  ult_min?: number;
  role: AgentRole;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number | null;
  wpa: number;
}

export interface RoundEvent {
  t: number;
  /** revive: ressurreição (ultimate da Sage num aliado, ou da Clove nela mesma); actor = quem reviveu, target = quem voltou */
  type: "kill" | "plant" | "defuse" | "revive";
  actor: string | null;
  wp_red_before: number;
  wp_red_after: number;
  wpa: number;
  after_round_end: boolean;
  victim?: string;
  weapon?: string | null;
  first_blood?: boolean;
  traded?: boolean;
  is_trade?: boolean;
  teamkill?: boolean;
  victim_xy?: [number, number];
  killer_xy?: [number, number] | null;
  assistants?: string[];
  /** ícone da arma (killfeed) ou da habilidade que matou */
  weapon_icon?: string | null;
  kill_kind?: KillKind;
  /** todos os vivos no instante do evento (a vítima de uma kill vem em victim_xy) */
  pos?: PosEntry[];
  /** só na kill do último atacante com a spike plantada: segundos de sobra para desarmar (tempo de spike − corrida do defensor
   *  mais perto até ela − 7 s de desarme); negativo = não dava tempo */
  defuse_margin?: number;
  /** só em revive: quem voltou ao round e o registro anterior (a volta aconteceu entre `from` e `t`) */
  target?: string;
  from?: number;
}

export type KillKind = "weapon" | "ability" | "melee" | "spike" | "fall" | "other";
/** [índice em match.players, x, y, direção da visão em radianos (eixos do jogo: atan2(dy, dx))] */
export type PosEntry = [number, number, number, number];
/** o que o jogador levou no round: [arma, escudo, valor do equipamento] */
export type GearEntry = [string | null, string | null, number];

export interface Round {
  n: number;
  half: string;
  attacker: Color;
  winner: Color;
  result: "Elimination" | "Defuse" | "Detonate" | "Timer";
  score_before: Record<Color, number>;
  buy: Record<Color, string>;
  loadout: Record<Color, number>;
  wp_red_start: number;
  plant: { t: number; site: string | null; by: string | null; xy: [number, number] } | null;
  defuse: { t: number; by: string | null } | null;
  anomalous: boolean;
  events: RoundEvent[];
  /** alinhado com match.players */
  gear?: (GearEntry | null)[];
  /** anotações da equipe (data/meta/replay_notes.json): o que os dados não mostram, como um teleporte de ultimate */
  notes?: ReplayNote[];
}

export interface ReplayNote { player: number; from: number; to: number; kind: "teleport"; label: string; why: string; by: string }

export interface MapTransform {
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
}

export interface Match {
  id: string;
  competition: string;
  stage: string | null;
  series_id: string;
  game_in_series: string | null;
  date: string;
  length_min: number;
  game_version: string;
  map: { code: string; name: string; minimap: string | null; splash: string | null; transform: MapTransform };
  teams: Record<Color, TeamName & { slug: string }>;
  score: Record<Color, number>;
  winner: Color;
  players: MatchPlayer[];
  rounds: Round[];
  /** arma -> ícone de killfeed, para as armas que aparecem em `gear` */
  weapon_icons?: Record<string, string>;
}

// ---------------------------------------------------------------- comparações e insights
export interface Comparison {
  value: number | null;
  league: number | null;
  n: number;
  k?: number;
  z: number | null;
  significant: boolean;
  good: boolean | null;
}

export interface Insight {
  key: string;
  text: string;
  tip?: string;
  z: number | null;
  n?: number;
}

export interface Insights {
  strengths: Insight[];
  weaknesses: Insight[];
  attention: Insight[];
  /** time sem ponto fraco nem atenção: as métricas de menos folga em relação à liga (não confirmadas). O item "intro" abre o grupo. */
  neutral?: Insight[];
  /** time sem ponto forte confirmado: onde ele mais se destaca, ainda dentro do acaso (ou que não fica à frente em nenhuma) */
  neutral_pos?: Insight[];
  notes?: Insight[];
}

// ---------------------------------------------------------------- time
export interface TeamMetric extends Comparison {
  key: string;
  label: string;
  higher_is_better: boolean;
}

export interface RosterPlayer {
  puuid: string;
  name: string;
  rounds: number;
  maps: number;
  agents: string[];
  agent_role: AgentRole | null;
  kd: number;
  acs: number;
  adr: number;
  kast: number;
  wpa_per_round: number;
  fk: number;
  fd: number;
  traded_death_rate: number | null;
  isolated_death_rate: number | null;
  core: boolean;
}

export interface SynergyEdge {
  a: string;
  b: string;
  rounds_together: number;
  b_traded_a: number;
  a_traded_b: number;
  a_deaths_b_alive: number;
  b_deaths_a_alive: number;
  b_assists_on_a: number;
  a_assists_on_b: number;
  assists: number;
  trade_rate: number | null;
  trade_z: number | null;
}

export interface DecisiveRound {
  match_id: string;
  round: number;
  map: string;
  opponent: string;
  opponent_name: string;
  side: Side;
  wp: number;
}

export interface Team {
  slug: string;
  name: string;
  tag: string;
  institution: string | null;
  record: { maps: number; map_wins: number; rounds: number; round_win: number };
  metrics: TeamMetric[];
  wins_above_expected: { wins: number; expected: number; diff: number; per100: number; z: number; significant: boolean };
  insights: Insights;
  maps: { map: string; maps: number; map_wins: number; rounds: number; round_win: number; atk_win: number | null; def_win: number | null; league_atk_win: number | null }[];
  buys: { buy: string; rounds: number; win: number; expected: number; league_win: number | null; z: number; significant: boolean }[];
  roster: RosterPlayer[];
  synergy: {
    nodes: { puuid: string; name: string; agent_role: AgentRole | null; rounds: number }[];
    edges: SynergyEdge[];
    league_pair_trade_rate: number;
  };
  decisive: { throws: DecisiveRound[]; comebacks: DecisiveRound[] };
  matches: { id: string; date: string; competition: string; stage: string | null; map: string; opponent: string; opponent_name: string; score_for: number; score_against: number; won: boolean }[];
  strength: { theta: number; p_vs_avg: number; rank: number; of: number; reliable: boolean };
  economy: TeamEconomy[];
  evolution: TeamEvolution;
}

// ---------------------------------------------------------------- onde o time morre (zones/<slug>.json)
export interface Zone {
  zone: string;
  deaths: number;
  share: number;
  league_share: number;
  untraded_rate: number;
  league_untraded_rate: number;
  isolated_rate: number | null;
  significant: boolean;
  worse_than_league: boolean;
  z: number | null;
}

export interface TeamZones {
  team: string;
  grid_size: number;
  maps: {
    code: string; map: string; minimap: string | null; transform: MapTransform; deaths: number;
    // grid: [coluna (u), linha (v), mortes, mortes sem trade] na grade grid_size × grid_size do minimapa
    sides: Partial<Record<Side, { deaths: number; rounds: number; zones: Zone[]; grid: [number, number, number, number][] }>>;
  }[];
}

// ---------------------------------------------------------------- economia ("forçar ou economizar?")
export type EcoDecision = "Eco" | "Meia compra" | "Forçado";

export interface TeamEconomy {
  context: string;
  label: string;
  n: number;
  decisions: Partial<Record<EcoDecision, { n: number; win_now: number; rounds_next3: number | null }>>;
  insight: string | null;
}

export interface EffectCI {
  effect: number;
  ci90: [number, number];
  significant: boolean;
}

export interface EconomyContext {
  n: number;
  n_horizon: number;
  decisions: Partial<Record<EcoDecision, { n: number; win_now: number; rounds_next3: number | null; n_next3: number; next_full_buy: number; avg_credits: number; avg_spent: number }>>;
  adjusted_vs_save: Partial<Record<EcoDecision, EffectCI>>;
  robustness: Record<string, { n: number; effects: Partial<Record<EcoDecision, EffectCI>> }>;
  by_credits: Record<string, EconomyContext["decisions"]>;
}

export interface Economy {
  definitions: { full_buy_credits: number; save_max_spent_share: number; force_min_spent_share: number; horizon_rounds: number; controls: string[] };
  contexts: Record<string, EconomyContext>;
}

// ---------------------------------------------------------------- evolução no campeonato
export interface TeamEvolution {
  available: boolean;
  periods: { before: string; after: string; maps_before: number; maps_after: number } | null;
  stages: {
    etapa: string; date: string; maps: number; rounds: number; round_win: number; opp_strength: number;
    above_level_per100: number; above_level_se100: number; above_level_z: number;
    traded_death_rate: number | null; isolated_death_rate: number | null;
  }[];
  changes: {
    key: string; label: string; higher_is_better: boolean; before: number; after: number; n_before: number; n_after: number;
    z: number; significant: boolean; improved: boolean; harder_opponents: boolean; text?: string;
  }[];
  players: { puuid: string; name: string; stages: { etapa: string; rounds: number; wpa_per_round: number }[] }[];
}

// ---------------------------------------------------------------- jogador
export interface Moment {
  match_id: string;
  round: number;
  t: number;
  event: "kill" | "plant" | "defuse" | "revive";
  map: string;
  weapon: string | null;
  other: string | null;
  wpa: number;
  wp_before: number;
  wp_after: number;
}

export interface Player {
  puuid: string;
  name: string;
  team: string;
  team_name: string;
  /** cada time por que jogou, o principal (mais rounds) primeiro; as estatísticas da página somam todos */
  teams: { slug: string; name: string; rounds: number; maps: number; competitions: string[] }[];
  sample: { rounds: number; maps: number; eligible: boolean };
  summary: {
    kd: number; kpr: number; dpr: number; apr: number; adr: number; acs: number; kast: number; hs_pct: number;
    kills: number; deaths: number; assists: number; fk: number; fd: number; clutch_att: number; clutch_won: number; plants: number; defuses: number;
  };
  impact: {
    wpa_total: number; wpa_per_round: number; wpa_pr_atk: number | null; wpa_pr_def: number | null;
    breakdown: Partial<Record<"kill" | "assist" | "death" | "plant" | "defuse" | "revive", number>>;
    per_kill: number | null; per_death: number | null; league_per_kill: number; league_per_death: number;
  };
  percentiles: Record<"kd" | "kpr" | "adr" | "acs" | "kast" | "hs_pct" | "wpa_per_round" | "opening_rate" | "clutch_rate", number | null> | null;
  /** posição na liga (1 = melhor) entre os mesmos jogadores do percentil (60+ rounds); empates dividem a posição */
  ranks: Record<"kd" | "kpr" | "adr" | "acs" | "kast" | "hs_pct" | "wpa_per_round" | "opening_rate" | "clutch_rate", number | null> | null;
  role: { agent_role: AgentRole | null };
  comparisons: Record<string, Comparison>;
  insights: Insights;
  agents: { agent: string; icon: string | null; role: AgentRole; maps: number; rounds: number; kd: number; acs: number; wpa_per_round: number; map_win_rate: number }[];
  maps: { map: string; maps: number; rounds: number; kd: number; wpa_per_round: number; map_win_rate: number }[];
  matches: { id: string; date: string; map: string; team: string; opponent: string; opponent_name: string; won: boolean; score_for: number; score_against: number; agent: string; kills: number; deaths: number; assists: number; acs: number; wpa: number }[];
  best_plays: Moment[];
  costliest_deaths: Moment[];
  partners: { puuid: string; name: string; rounds_together: number; they_traded_you: number; your_deaths_with_them_alive: number; you_traded_them: number; their_assists_on_your_kills: number }[];
  stages: { etapa: string; team: string; rounds: number; wpa_per_round: number; kd: number }[];
  duels: PlayerDuels;
  /** null com menos de 25 mortes */
  death_timing: DeathTiming | null;
  /** por agente jogado em 2+ mapas; referência = média da liga no mesmo agente */
  abilities: PlayerAbilities[];
}

export interface PlayerAbilities {
  agent: string;
  icon: string | null;
  maps: number;
  rounds: number;
  slots: { key: "C" | "Q" | "E"; name: string | null; icon: string | null; per_round: number; league: number }[];
  /** null quando a Riot não conta a ultimate do agente nos mapas dele (Chamber a partir do patch 13.02) */
  ult: { name: string | null; icon: string | null; total: number; maps: number; per_map: number; league: number } | null;
}

/** Duelos: quem matou quem (sem team kill), somado em todas as partidas da base. */
export interface PlayerDuels {
  kills: number;
  deaths: number;
  win_rate: number | null;
  /** adversários com 3+ duelos, do mais frequente ao menos (até 8) */
  opponents: { puuid: string; name: string | null; team: string | null; team_name: string | null; kills: number; deaths: number }[];
  /** agentes adversários com 10+ duelos; `significant` = diferente da média do próprio jogador (teste + controle de falsos positivos) */
  by_agent: { agent: string; icon: string | null; kills: number; deaths: number; win: number | null; z: number | null; significant: boolean; good: boolean | null }[];
}

/** Quando o jogador morre no round (segundos desde a queda da barreira), comparado à liga na mesma mistura de funções. */
export interface DeathTiming {
  n: number;
  early_s: number;
  roles: Record<string, number>;
  bins: { from: number; to: number; share: number; league: number }[];
  median: number;
  league_median: number;
  early: number;
  league_early: number;
  by_agent: { agent: string; role: string; n: number; median: number; early: number; league_median: number | null; league_early: number | null }[];
}

// ---------------------------------------------------------------- modelo (página "Metodologia")
export interface ModelScores {
  log_loss: number;
  brier: number;
  auc: number;
  ece?: number;
}

export interface ModelInfo {
  data: { matches: number; rounds: number; states: number; kills: number };
  validation: string;
  features: string[];
  models: Record<"baseline_alive_lookup" | "logistic" | "gbm", ModelScores>;
  chosen: string;
  calibration: { p: number; y: number; n: number }[];
  trade_by_distance: { distance: string; trade_rate: number; n: number }[];
  buy_matchups: { atk_buy: string; def_buy: string; model: number; real: number; n: number }[];
  definitions: { trade_window_s: number; isolated_distance_m: number; throw_wp: number; comeback_wp: number; min_rounds_role: number; significance: string };
}
