# Manual de Uso — radar-precos-mcp

**Servidor MCP para pesquisa de preços em contratações públicas**  
Implementa a metodologia da IN SEGES/ME nº 65/2021.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos e instalação](#2-pré-requisitos-e-instalação)
3. [Configuração no Claude Desktop](#3-configuração-no-claude-desktop)
4. [Fluxo recomendado de uso](#4-fluxo-recomendado-de-uso)
5. [Ferramentas disponíveis](#5-ferramentas-disponíveis)
6. [Exemplos passo a passo](#6-exemplos-passo-a-passo)
7. [Entendendo a Média Saneada](#7-entendendo-a-média-saneada)
8. [Relatórios gerados](#8-relatórios-gerados)
9. [Pendências que exigem preenchimento humano](#9-pendências-que-exigem-preenchimento-humano)
10. [Perguntas frequentes](#10-perguntas-frequentes)

---

## 1. Visão geral

Este servidor MCP conecta o Claude às APIs governamentais de contratações públicas e automatiza a etapa de coleta e análise de preços de mercado exigida pela IN SEGES/ME nº 65/2021.

### O que o servidor faz automaticamente

- Busca preços históricos no **PNCP** e no **Compras.gov.br**
- Aplica o algoritmo de **Média Saneada** (remoção de outliers por Z-score) conforme a IN SEGES/ME nº 65/2021
- Calcula o **Coeficiente de Variação (CV)** e verifica conformidade com o limite de 25%
- Gera a **planilha Excel** com toda a série de preços e análise crítica
- Gera o **documento Word** já no formato das seções 7.1 a 7.9

### O que ainda requer preenchimento humano

- Data e hora exatas de acesso aos portais
- Cotações de fornecedores (quando necessário)
- Consulta ao Banco de Preços (bancodeprecos.com.br)
- Contratos anteriores do próprio órgão (Fonte III)
- Assinatura dos responsáveis (seção 7.9)

---

## 2. Pré-requisitos e instalação

### Requisitos

- **Node.js** versão 18 ou superior → https://nodejs.org
- **npm** versão 9 ou superior (vem junto com o Node.js)
- Acesso à internet (para consultar PNCP e Compras.gov.br)

### Passo a passo

```bash
# 1. Baixe o projeto
git clone https://github.com/<usuario>/radar-precos-mcp.git

# 2. Entre na pasta
cd radar-precos-mcp

# 3. Instale as dependências
npm install

# 4. Compile o projeto
npm run build
```

Após o build, o servidor estará disponível em `dist/index.js`.

---

## 3. Configuração no Claude Desktop

Abra o arquivo de configuração do Claude Desktop:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Adicione o bloco abaixo (ajuste o caminho conforme onde você clonou o projeto):

```json
{
  "mcpServers": {
    "pesquisa-precos": {
      "command": "node",
      "args": ["C:/caminho/para/radar-precos-mcp/dist/index.js"]
    }
  }
}
```

**Reinicie o Claude Desktop.** Ao reabrir, as ferramentas `buscar_contratacoes_pncp`, `executar_pesquisa_precos` etc. estarão disponíveis no Claude.

### Verificando se funcionou

No chat do Claude, pergunte:

> "Quais ferramentas de pesquisa de preços você tem disponíveis?"

O Claude deverá listar as 5 ferramentas do servidor.

---

## 4. Fluxo recomendado de uso

```
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 1 – Pesquisa automatizada                                │
│  Prompt: "Faça uma pesquisa de preços para [objeto]"            │
│  → Claude chama executar_pesquisa_precos                        │
│  → Busca PNCP + Compras.gov.br em paralelo                      │
│  → Aplica Média Saneada                                         │
│  → Retorna preço de referência + alertas + pendências           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  ETAPA 2 – Revisão dos resultados                               │
│  Verifique: quantas fontes foram encontradas?                   │
│  O CV ficou ≤ 25%? Houve outliers removidos?                    │
│  Se poucas fontes: adicione cotações de fornecedores            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  ETAPA 3 – Geração dos relatórios                               │
│  Prompt: "Gere os relatórios em C:/Pesquisas/licencas"          │
│  → Claude chama gerar_relatorios                                │
│  → Cria pesquisa-precos.xlsx (planilha)                         │
│  → Cria pesquisa-precos.docx (documento Word)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  ETAPA 4 – Complementação humana                                │
│  Abra o Word e preencha os campos marcados em AMARELO:          │
│  • Datas de acesso aos portais                                  │
│  • Cotações de fornecedores (se aplicável)                      │
│  • Responsáveis e assinaturas (seção 7.9)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Ferramentas disponíveis

### 5.1 `executar_pesquisa_precos` ⭐ Ponto de entrada principal

Executa toda a pesquisa automaticamente: busca no PNCP e Compras.gov.br, aplica Média Saneada e retorna o objeto completo.

**Parâmetros:**

| Parâmetro | Obrigatório | Descrição | Exemplo |
|---|---|---|---|
| `objeto` | ✅ | Descrição do objeto | `"licença de software antivírus"` |
| `unidadeMedida` | ✅ | Unidade | `"licença"`, `"UN"`, `"mês"` |
| `quantidade` | ✅ | Quantidade estimada | `100` |
| `uf` | ❌ | Filtro por estado | `"DF"`, `"SP"` |
| `janelasMeses` | ❌ | Período de busca | `12` (padrão) |
| `termosAdicionais` | ❌ | Palavras extras de busca | `["endpoint", "segurança"]` |
| `dataBase` | ❌ | Data para deflação | `"2025-06-16"` (padrão: hoje) |

---

### 5.2 `buscar_contratacoes_pncp`

Busca somente no PNCP (útil para refinar ou ampliar uma busca específica).

**Parâmetros principais:**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `termoBusca` | ✅ | Palavras-chave |
| `codigoModalidade` | ❌ | 6=Pregão, 8=Dispensa, 9=Inexigibilidade |
| `janelasMeses` | ❌ | Janela de busca (padrão: 12) |
| `limite` | ❌ | Máximo de resultados (padrão: 20) |

---

### 5.3 `buscar_contratos_compras`

Busca no Contratos.gov.br / Compras.gov.br.

**Parâmetros principais:**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `termoBusca` | ✅ | Palavras-chave |
| `cnpjOrgao` | ❌ | Filtrar por CNPJ do órgão |
| `janelasMeses` | ❌ | Janela de busca (padrão: 12) |

---

### 5.4 `calcular_preco_referencia`

Aplica a Média Saneada sobre uma lista de preços que você fornece manualmente. Útil quando você já coletou preços de outras fontes (fornecedores, mídias, contratos anteriores do órgão) e quer calcular o preço de referência.

**Parâmetro:** `fontes` — lista de objetos `FontePreco` com campos: `id`, `fonte`, `descricaoObjeto`, `valorUnitario`, `unidadeMedida`, `dataContrato`, `orgao`, `dataConsulta`.

---

### 5.5 `gerar_relatorios`

Gera os arquivos Excel e Word.

**Parâmetros:**

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `pesquisa` | ✅ | Objeto retornado por `executar_pesquisa_precos` |
| `caminhoExcel` | ✅ | Caminho de saída do .xlsx |
| `caminhoWord` | ✅ | Caminho de saída do .docx |
| `responsaveis` | ❌ | Nomes para a seção 7.9 |

---

## 6. Exemplos passo a passo

### Exemplo 1 — Pesquisa simples de software

**Prompt para o Claude:**

```
Faça uma pesquisa de preços para:
- Objeto: licença de software de antivírus corporativo
- Unidade: licença/ano
- Quantidade: 500
```

**O que o Claude fará:**
1. Chamará `executar_pesquisa_precos` com esses parâmetros
2. Buscará no PNCP os contratos dos últimos 12 meses com "antivírus corporativo"
3. Buscará no Compras.gov.br
4. Aplicará a Média Saneada
5. Retornará algo como:

```
Pesquisa concluída:
- 12 fontes encontradas (8 PNCP + 4 Compras.gov.br)
- Preço de referência: R$ 45,80/licença/ano
- CV: 18,3% ✅ (dentro do limite de 25%)
- 2 outliers removidos na Iteração 2
- Valor total estimado: R$ 22.900,00
```

---

### Exemplo 2 — Ampliar busca quando há poucas fontes

Se o resultado trouxer menos de 3 fontes, amplie os termos:

```
Busque no PNCP com os termos "proteção endpoint segurança" nos últimos 18 meses.
Depois combine com os resultados anteriores e recalcule o preço de referência.
```

---

### Exemplo 3 — Incluir cotações de fornecedores

Após receber cotações por e-mail, você pode adicioná-las manualmente:

```
Tenho 3 cotações de fornecedores para licença antivírus:
- Fornecedor A: R$ 42,00/licença (cotação de 10/06/2025)
- Fornecedor B: R$ 51,00/licença (cotação de 11/06/2025)
- Fornecedor C: R$ 39,50/licença (cotação de 12/06/2025)

Inclua essas cotações e recalcule a Média Saneada junto com as fontes já encontradas.
```

---

### Exemplo 4 — Gerar os relatórios finais

```
Gere os relatórios da pesquisa de antivírus em:
- Excel: C:/Pesquisas/2025/antivirus/mapa-pesquisa.xlsx
- Word:  C:/Pesquisas/2025/antivirus/relatorio-pesquisa.docx
- Responsáveis: "Maria Silva - Analista de TI", "João Santos - Coordenador de Compras"
```

---

### Exemplo 5 — Fluxo completo em um único prompt

```
Faça uma pesquisa de preços completa e gere os relatórios:

Objeto: Serviço de assinatura de plataforma de videoconferência corporativa
Unidade: usuário/mês
Quantidade: 2.000 usuários
UF: DF
Termos adicionais: ["videoconferência", "reunião virtual", "Teams", "Zoom", "Meet"]

Salve os relatórios em C:/Pesquisas/videoconferencia/ com o nome videoconferencia-2025.
Responsáveis: "Ana Costa" e "Pedro Lima".
```

---

## 7. Entendendo a Média Saneada

A IN SEGES/ME nº 65/2021 exige a aplicação da Média Saneada para eliminar preços atípicos (outliers) que distorcem a média de mercado.

### Como funciona o algoritmo

**Passo 1 — Coleta inicial**

Suponha que você encontrou 7 preços (em R$/licença):
```
100,  95,  98,  102,  97,  350,  99
```
O valor 350 é claramente um outlier.

**Passo 2 — Iteração 1**

```
Média    = 134,43
Desvio   = 93,07
CV       = 93,07 / 134,43 = 69,2%  ← acima de 25%, continua
Z-scores = [-0,37, -0,42, -0,39, -0,35, -0,40, +2,32, -0,38]
                                               ↑ maior |Z|
Remove: 350
```

**Passo 3 — Iteração 2**

```
Amostra  = [100, 95, 98, 102, 97, 99]
Média    = 98,5
Desvio   = 2,43
CV       = 2,43 / 98,5 = 2,5%  ← abaixo de 25%, para!

Preço de referência = R$ 98,50
```

### Critérios de parada

| Situação | O que acontece |
|---|---|
| CV ≤ 25% | ✅ Série aceita — preço de referência = média atual |
| Restariam menos de 3 fontes | ⚠️ Para com o que tem — alerta gerado |
| Série já tem 3 fontes e CV > 25% | ⚠️ Mantém as 3 — alerta de CV fora do limite |

### O que significa o CV

- **CV ≤ 25%** → Série homogênea, dentro do limite aceitável ✅
- **CV entre 25% e 40%** → Série com alguma variação, recomenda-se justificativa ⚠️
- **CV > 40%** → Série heterogênea, necessita justificativa formal ❌

---

## 8. Relatórios gerados

### 8.1 Planilha Excel (`.xlsx`)

Contém 4 abas:

**Aba 1 — Mapa de Pesquisa**  
Tabela resumo com todas as fontes consultadas: portal, objeto, valor, data, órgão, UF.

**Aba 2 — Série de Preços**  
Série completa com código de cores:
- 🟢 Verde: preços válidos (incluídos na média)
- 🔴 Vermelho: outliers removidos

**Aba 3 — Análise Crítica**  
Tabela iteração por iteração mostrando:
- Amostra de cada iteração
- Média, desvio padrão e CV
- Z-score de cada elemento
- Qual elemento foi removido e por quê

**Aba 4 — Alertas e Pendências**  
Lista de alertas automáticos e pendências para preenchimento humano.

---

### 8.2 Documento Word (`.docx`)

Gerado conforme a estrutura da IN SEGES/ME nº 65/2021, com as seções:

| Seção | Conteúdo |
|---|---|
| 7.1 | Identificação do processo |
| 7.2 | Objeto e especificação técnica |
| 7.2.1.1 | PNCP — Contratações (Fonte I) |
| 7.2.1.2 | PNCP — Contratos (Fonte I) |
| 7.2.1.3 | Compras.gov.br (Fonte II) |
| 7.2.1.4 | Catálogo de Soluções de TIC (Fonte II) |
| 7.2.1.5 | Contratos anteriores do próprio órgão (Fonte III) |
| 7.2.1.6 | Mídias especializadas (Fonte IV) |
| 7.2.1.7 | Cotações de fornecedores (Fonte V) |
| 7.3 | Conclusão sobre fontes similares |
| 7.4 | Análise crítica — Média Saneada (tabela iterativa) |
| 7.5 | Preço de referência e valor total estimado |
| 7.6 | Observações adicionais |
| 7.7 | Referências |
| 7.8 | Anexos |
| 7.9 | Responsáveis pela pesquisa |

**Campos destacados em amarelo** precisam de preenchimento humano.

---

## 9. Pendências que exigem preenchimento humano

Após gerar os relatórios, abra o documento Word e preencha os campos em amarelo:

### Na seção 7.2.1.x (para cada portal consultado):
- [ ] Data e **hora** exata da consulta (ex.: "16/06/2025 às 14h32")
- [ ] Link exato da pesquisa realizada (copie da barra de endereços)
- [ ] Número de resultados encontrados na tela

### Na seção 7.2.1.4 (Catálogo de Soluções de TIC):
- [ ] O objeto consta no catálogo? Sim/Não
- [ ] Se sim: qual o código e descrição no catálogo?

### Na seção 7.2.1.5 (Contratos anteriores do órgão):
- [ ] Há contratos anteriores do próprio órgão para o mesmo objeto?
- [ ] Se sim: número do contrato, fornecedor, valor unitário, vigência

### Na seção 7.2.1.6 (Mídias especializadas):
- [ ] Preços encontrados em sites especializados (ex.: Bionexo, BPS)
- [ ] Fonte, URL, data de acesso e valor

### Na seção 7.2.1.7 (Cotações de fornecedores):
- [ ] Planilhas ou e-mails de cotação recebidos
- [ ] Identificação do fornecedor e data de envio

### Na seção 7.9 (Responsáveis):
- [ ] Nome, matrícula e cargo de quem realizou a pesquisa
- [ ] Nome, matrícula e cargo do responsável pela área demandante
- [ ] Data e assinatura

---

## 10. Perguntas frequentes

**P: O servidor encontrou apenas 2 fontes. O que fazer?**

R: Com menos de 3 fontes, a IN SEGES/ME nº 65/2021 não permite concluir a pesquisa automaticamente. O Claude alertará sobre isso. Opções: (1) ampliar os termos de busca, (2) ampliar a janela para 18 ou 24 meses, (3) incluir cotações de fornecedores manualmente, (4) incluir preços do Banco de Preços (bancodeprecos.com.br).

---

**P: O CV ficou acima de 25%. O que fazer?**

R: Isso indica grande variação nos preços encontrados. O sistema manterá o cálculo com as 3 mínimas fontes e gerará um alerta. No documento Word, você precisará incluir uma **justificativa** explicando a heterogeneidade dos preços (diferenças de especificação, porte do contrato, região, etc.).

---

**P: Posso usar o servidor sem internet?**

R: Não. As ferramentas de busca (`buscar_contratacoes_pncp`, `buscar_contratos_compras`) requerem acesso às APIs do governo. Apenas `calcular_preco_referencia` e `gerar_relatorios` funcionam offline — desde que você já tenha os dados das fontes.

---

**P: Os preços encontrados são de anos diferentes. Isso é problema?**

R: O servidor aplica automaticamente deflação pelo **IPCA/IBGE** para corrigir preços históricos à data-base informada. Verifique o campo `dataBase` na pesquisa; se não informado, usa a data atual.

---

**P: Como faço para buscar somente Pregão Eletrônico?**

R: Use o parâmetro `codigoModalidade: 6` (Pregão Eletrônico é o padrão). Outros códigos: 8=Dispensa, 9=Inexigibilidade.

---

**P: O documento Word gerado já é o documento final?**

R: É o rascunho estruturado. Todos os campos preenchidos automaticamente estão corretos, mas os campos em amarelo ainda precisam de intervenção humana (datas de acesso, cotações, assinaturas). Após completar os campos, o documento está pronto para ser anexado ao processo de contratação.

---

**P: Posso usar para pesquisa de materiais (CATMAT), não apenas serviços?**

R: Sim. Informe o objeto com descrição clara do material e, opcionalmente, o `codigoMaterial` (código CATMAT). A busca é textual e funciona para bens e serviços.

---

## Suporte e contribuição

- Reporte bugs via [GitHub Issues](https://github.com/<usuario>/radar-precos-mcp/issues)
- Contribuições são bem-vindas via Pull Request
- Dúvidas sobre a metodologia: consulte a IN SEGES/ME nº 65/2021 e a documentação do PNCP

---

## Créditos

Este projeto foi desenvolvido com base em dois servidores MCP open-source voltados para contratações públicas brasileiras:

- **[GovBR-Claude-Plugin](https://github.com/heitorrapcinski/GovBR-Claude-Plugin)** — forneceu a integração com as APIs do PNCP e do Compras.gov.br. A estrutura de clientes HTTP, paginação e mapeamento de respostas governamentais foram inspirados nesse projeto.
- **[licinexus-mcp](https://github.com/Licinexus/licinexus-mcp)** — forneceu referência de arquitetura para servidores MCP de licitações, incluindo padrões de ferramentas e organização de tipos TypeScript.

A camada de análise estatística (Média Saneada, Z-score, CV) e a geração de relatórios conforme a IN SEGES/ME nº 65/2021 são contribuições originais deste projeto.

---

*Manual elaborado com base na IN SEGES/ME nº 65/2021.*
