// Carga dos dados no SERVIDOR (build estático): lê public/data direto do disco.
// Use em Server Components / generateStaticParams. Em Client Components, receba os dados por props.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { DataIndex, Economy, Match, ModelInfo, Player, Team, TeamZones } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, ...parts), "utf-8")) as T;
}

export const getIndex = cache(() => readJson<DataIndex>("index.json"));
export const getMatch = cache((id: string) => readJson<Match>("matches", `${id}.json`));
export const getTeam = cache((slug: string) => readJson<Team>("teams", `${slug}.json`));
export const getEconomy = cache(() => readJson<Economy>("economy.json"));
export const getZones = cache((slug: string) => readJson<TeamZones>("zones", `${slug}.json`));
export const getModel = cache(() => readJson<ModelInfo>("model.json"));
export const getPlayer = cache((puuid: string) => readJson<Player>("players", `${decodeURIComponent(puuid)}.json`));
