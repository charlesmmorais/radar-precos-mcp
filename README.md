# radar-precos-mcp

Servidor MCP (Model Context Protocol) especializado em **pesquisa de preços para contratações públicas**, implementando a metodologia da **IN SEGES/ME nº 65/2021**.

> 📖 **[Manual de Uso completo → MANUAL.md](./MANUAL.md)**

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
git clone https://github.com/charlesmmorais/radar-precos-mcp.git
cd radar-precos-mcp
npm install
npm run build
```

## Uso com Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "radar-precos": {
      "command": "node",
      "args": ["/caminho/para/radar-precos-mcp/dist/index.js"]
    }
  }
}
```

> **Windows:** use barras invertidas ou caminho absoluto com `//`, ex:
> `"C:\\Users\\usuario\\radar-precos-mcp\\dist\\index.js"`

## Uso com Claude Code

```bash
claude mcp add radar-precos node /caminho/para/radar-precos-mcp/dist/index.js
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

# Testes unitários (45 testes)
npm test

# Build de produção
npm run build
```

## Arquitetura

```
src/
├── domain/
│   ├── types.ts          # Tipos TypeScript (FontePreco, PesquisaPrecos, etc.)
│   ├── media-saneada.ts  # Algoritmo de Média Saneada (Z-score, CV)
│   ├── normas.ts         # Constantes e validações (IN SEGES/ME nº 65/2021)
│   └── la002.ts          # Re-exporta normas.ts (compatibilidade)
├── apis/
│   ├── pncp.ts           # Cliente PNCP (consulta + integração)
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
4. Se n = 3: para (mínimo de fontes exigido pela norma)
5. Preço de referência = média da série saneada

### Hierarquia de fontes (IN SEGES/ME nº 65/2021, Art. 5º)

| Prioridade | Fonte | Janela |
|---|---|---|
| I | PNCP – Contratações e Contratos | 12 meses |
| II | Compras.gov.br / Painel de Preços | 12 meses |
| III | Contratos anteriores do próprio órgão | 12 meses |
| IV | Mídias especializadas / tabelas aprovadas | 6 meses |
| V | Cotações diretas com fornecedores | 6 meses |

### Relatórios gerados

**Excel (4 abas):**
- `Mapa de Pesquisa` — parâmetros, resultado e análise crítica
- `Série de Preços` — todas as fontes coletadas com metadados
- `Análise Estatística` — histórico de iterações da Média Saneada
- `Fontes e Evidências` — URLs e comprovantes de consulta

**Word:**
- Estrutura completa conforme seções 7.1 a 7.9 da IN SEGES/ME nº 65/2021
- Campos a preencher manualmente destacados como `[PENDÊNCIA: ...]`
- Conclusão de razoabilidade gerada automaticamente

## Limitações conhecidas

- A pesquisa automática cobre PNCP e Compras.gov.br; **Banco de Preços** e **Catálogo de Soluções de TIC** requerem consulta manual
- Deflação via IPCA exige conexão com a API do IBGE
- Cotações com fornecedores e mídias especializadas devem ser inseridas manualmente no objeto `PesquisaPrecos`
- O documento Word gerado requer revisão e assinatura humana — não substitui o processo administrativo

## Créditos

Este projeto foi desenvolvido com base em dois servidores MCP open-source voltados para contratações públicas brasileiras:

- [**GovBR-Claude-Plugin**](https://github.com/heitorrapcinski/GovBR-Claude-Plugin) — forneceu a integração com as APIs do PNCP e do Compras.gov.br. A estrutura de clientes HTTP, paginação e mapeamento de respostas governamentais foram inspirados nesse projeto.
- [**licinexus-mcp**](https://github.com/Licinexus/licinexus-mcp) — forneceu referência de arquitetura para servidores MCP de licitações, incluindo padrões de ferramentas e organização de tipos TypeScript.

A camada de análise estatística (Média Saneada, Z-score, CV) e a geração de relatórios conforme a IN SEGES/ME nº 65/2021 são contribuições originais deste projeto.

## Licença

MIT
