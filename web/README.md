# Site (Next.js)

Site estático: todas as páginas são geradas no build a partir dos JSONs em `public/data` (formato em [DADOS.md](DADOS.md)). Não há backend.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção (gera ~820 páginas estáticas)
```

## Estrutura
```
src/app/                  rotas: / · /partidas · /times · /jogadores (+ telas de detalhe [id], [slug], [puuid])
src/components/site/      cabeçalho e navegação
src/components/listas/    tabelas com filtros das páginas de lista (Client Components)
src/components/analise/   blocos das telas de análise
src/lib/                  tipos, carga de dados (servidor), formatação, constantes do site
```
Filtros das listas ficam na URL (ex.: `/partidas?time=ufmt_turuna&mapa=Haven`), então dá para compartilhar o link já filtrado.

## Deploy na Vercel
1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `enzodias1/hackathon-valorant-usp` (precisa de acesso à conta do GitHub dono do repositório).
2. **Root Directory: `web`** (o resto a Vercel detecta sozinha: framework Next.js, `npm run build`).
3. Deploy. A cada push na `main` o site é publicado de novo; cada Pull Request ganha um link de prévia.
