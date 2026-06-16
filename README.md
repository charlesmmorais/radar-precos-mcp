# radar-precos-mcp

Servidor MCP (Model Context Protocol) especializado em **pesquisa de preços para contratações públicas**, implementando a metodologia da **IN SEGES/ME nº 65/2021**.

## Funcionalidades

- Busca automática de preços no **PNCP** (Portal Nacional de Contratações Públicas)
- Busca automática em **Contratos.gov.br / Compras.gov.br**
- Algoritmo de **Média Saneada** com remoção iterativa de outliers por Z-score (CV ≤ 25%)
- Geração de **planilha Excel** com mapa de pesquisa, série de preços e análise crítica
- Geração de **documento Word** conforme IN SEGES/ME nº 65/2021 (seções 7.1 a 7.9)
- Deflação de preços históricos via **IPCA/IBGE**

## Ferramentas MCP disponíveis

| Ferramenta | Descrição |
|---|---|
| `buscar_contratacoes_pncp` | Busca licitações e itens no PNCP (Fonte I) |
| `buscar_contratos_compras` | Busca contratos em Compras.gov.br (Fontes I/II) |
| `calcular_preco_referencia` | Aplica Média Saneada sobre série de preços |
| `executar_pesquisa_precos` | Pesquisa completa automatizada (ponto de entrada recomendado) |
| `gerar_relatorios` | Gera Excel + Word conforme IN SEGES/ME 65/2021 |

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

## Instalação

```bash
git clone https://github.com/<seu-usuario>/radar-precos-mcp.git
cd radar-precos-mcp
npm install
npm run build
```

## Uso com Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pesquisa-precos": {
      "command": "node",
      "args": ["/caminho/para/radar-precos-mcp/dist/index.js"]
    }
  }
}
```

## Uso com Claude Code

```bash
claude mcp add pesquisa-precos node /caminho/para/radar-precos-mcp/dist/index.js
```

## Exemplo de uso

Prompt para o Claude:

```
Execute uma pesquisa de preços para:
- Objeto: Licença de software de gestão de projetos
- Unidade: licença/mês
- Quantidade: 50
- UF: DF

Depois gere os relatórios Excel e Word em /tmp/pesquisa-licencas.
```

O Claude usará automaticamente `executar_pesquisa_precos` e `gerar_relatorios`.

## Desenvolvimento

```bash
# Verificação de tipos
npm run typecheck

# Testes unitários
npm test

# Testes de integração (requer internet)
npm run test:integration

# Build
npm run build
```

## Arquitetura

```
src/
├── domain/
│   ├── types.ts          # Tipos TypeScript (FontePreco, PesquisaPrecos, etc.)
│   ├── media-saneada.ts  # Algoritmo de Média Saneada (Z-score, CV)
│   ├── normas.ts          # Constantes e validações (IN SEGES/ME nº 65/2021)
│   └── la002.ts          # Re-exporta normas.ts (compatibilidade)
├── apis/
│   ├── pncp.ts           # Cliente PNCP (consulta + integra)
│   ├── compras.ts        # Cliente Contratos.gov.br
│   └── ibge.ts           # Cliente IBGE IPCA (deflação)
├── tools/
│   ├── schemas.ts        # JSON Schemas dos inputs MCP
│   └── index.ts          # Registro e despacho das ferramentas
├── reports/
│   ├── excel.ts          # Relatório Excel (4 abas)
│   └── word.ts           # Relatório Word (seções 7.1–7.9)
├── utils/
│   ├── http.ts           # Cliente HTTP com retry exponencial
│   └── date.ts           # Utilitários de data (janelas, formatação)
└── server.ts             # Servidor MCP stdio
```

## Metodologia implementada

### Média Saneada (IN SEGES/ME nº 65/2021)

1. Calcula média e desvio padrão amostral da série
2. Se CV ≤ 25%: aceita a série como válida
3. Se CV > 25% e n > 3: remove o elemento com maior |Z-score| e repete
4. Se n = 3: para (mínimo de fontes exigido)
5. Preço de referência = média da série saneada

### Hierarquia de fontes (IN SEGES/ME nº 65/2021, Art. 5º)

| Prioridade | Fonte | Janela |
|---|---|---|
| I | PNCP – Contratações e Contratos | 12 meses |
| II | Compras.gov.br / Painel de Preços | 12 meses |
| III | Contratos anteriores do próprio órgão | 12 meses |
| IV | Mídias especializadas | 6 meses |
| V | Cotaç