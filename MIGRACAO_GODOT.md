# PARECIS TELHA — Plano de migração da Demo 1 (HTML) para o Godot

Status: versão 2, revisada pelo ChatGPT e pelo Grok (12/11/2026). Aprovada pelo ChatGPT com as correções abaixo.

## 1. Decisões que já valem
- **Engine:** **Godot 4.7.2** Standard (sem .NET), versão fixa: não atualizar sozinho e não usar a 4.8 (ainda em beta). Renderizador **Compatibility** (o notebook do Lucas é Ryzen 5 3500U + Vega 8, 8 GB).
- **Física:** Jolt, gravado explicitamente no projeto (`physics/3d/physics_engine = "Jolt Physics"`), padrão dos projetos novos desde a 4.6.
- **Dois relógios separados (ChatGPT):** o *relógio industrial* (produção, energia, folha, juros, entregas; x1/x5/x20) anda em minutos de jogo com acumulador e limite de minutos por quadro. O *relógio físico* (personagem, câmera, ponte, empilhadeira, colisões, ragdoll) roda em `_physics_process` a 60 Hz fixos, com interpolação na tela.
- **Linguagem:** GDScript tipado. Motivo concreto: projeto C# do Godot 4 não exporta para Web, e GDScript exporta.
- **A Demo 1 é a especificação.** Toda regra, número e caso de bug que a Demo testou vira requisito. Os mais de 100 testes automáticos da Demo viram a lista de testes do Godot.
- **Câmera:** 3ª pessoa atrás do ombro (SpringArm3D, não atravessa parede) + 1ª pessoa (tecla V). Sem câmera livre.
- **Arte:** os GLBs feitos nesta fase entram direto. Estilo low poly de cores chapadas, com os personagens da ithappy.

## 2. Estrutura do projeto
```
perfiladeira/godot/
  project.godot
  autoload/      EventBus.gd  Dados.gd  Tempo.gd  Economia.gd  Reputacao.gd  Pedidos.gd  Estoque.gd  Save.gd  Zoeira.gd
  dados/         dados.json        (cópia 1:1 do demo1/js/dados.js — balanceamento continua num lugar só)
  cenas/         Barracao.tscn  Jogador.tscn  CameraRig.tscn  Maquina.tscn  Ponte.tscn  Caminhao.tscn  Npc.tscn  Empilhadeira.tscn  Loja.tscn
  ui/            Hud.tscn  ParecisOS.tscn (o PC)  Clp.tscn  Ligacao.tscn  Minijogo.tscn  Celular.tscn
  modelos/       *.glb dos modelos do Claude + Grab3D/Kenney (CC0)
  privado/       personagens ithappy (fica FORA do GitHub, no .gitignore)
  testes/        GUT (Godot Unit Test), em modo headless
```

## 3. Mapa: arquivo da Demo → Godot
| Demo 1 (JS) | Godot 4 | Observação |
|---|---|---|
| eventos.js | autoload `EventBus` (signals) | os nomes de evento ficam iguais (`pedidoNovo`, `morreu`, `minuto`…) |
| dados.js | `dados/dados.json` + autoload `Dados` | um script converte o JS em JSON |
| tempo.js | autoload `Tempo` (passo fixo de 1 min de jogo; velocidade x1/x5/x20) | o tempo acelerado nunca passa por frame |
| economia.js, reputacao.js, pedidos.js | autoloads de lógica pura (sem nós 3D) | são os primeiros a migrar, com testes |
| estoque.js | autoload `Estoque` + cenas `Bobina`, `Pilha` | a pilha usa MultiMesh para as telhas |
| save.js | autoload `Save` (JSON, `save_version`) | mesmo formato da Demo; dá para importar o save da Demo |
| mundo.js | `Barracao.tscn` (estrutura GLB + piso + colisões) + `Jogador.tscn` (CharacterBody3D) + `CameraRig.tscn` | as colisões AABB viram StaticBody3D |
| maquinas.js | `Maquina.tscn` genérica + recurso `MaquinaDef` (perfiladeira/guilhotina/dobradeira = dados) | luz da torre do CLP, rolos girando (`rolo_inf_*`), lâmina (`lamina`), avental (`avental`) |
| ponte.js | `Ponte.tscn` (viga dupla, carro, gancho) | o cabo é um cilindro escalado; botoeira = modo de controle |
| construcao.js | nó `ModoConstrucao` (fantasma + grade de 0,5 m, raio a partir do centro da tela) | |
| entrega.js | `Caminhao.tscn` + Path3D/PathFollow3D | o corredor vira um caminho fixo |
| funcionarios.js, balcao.js | `Npc.tscn` + NavigationAgent3D (navmesh assada) | troca o "andar até" caseiro |
| empilhadeira.js, carregamento.js | `Empilhadeira.tscn` (cinemática) + mesa de carregamento (UI) | |
| zoeira.js | autoload `Zoeira` + ragdoll (PhysicalBone3D no esqueleto ithappy) | morte, boleto, "0 dias sem acidente" |
| ui.js, pc.js, pc_apps.js | cenas Control (HUD, ParecisOS, CLP, ligação, minijogo) | o PC continua sendo o "sistema operacional" do jogo |
| modelos.js, modelos3d.js, producao_modelos.js | não migram | no Godot o GLB entra direto; a lista vira documentação |

## 4. Modelos 3D
- **Do Claude (42 GLB):** `modelos3d/claude/glb/` são importados como estão. Nós já nomeados para animar: `rolos/rolo_inf_N`, `lamina`, `avental`, `luz_verde/ambar/vermelha`, `teto` (some com o jogador dentro), `face` da placa de acidentes.
- **Grátis (CC0):** Grab3D (versões leves de até 5k triângulos em `modelos3d_gratis/leves`) e Kenney.
- **Personagens ithappy:** importar o `personagens_ithappy.glb` (corpo + 23 peças + 15 animações) ou o `.blend` direto (o Godot importa .blend com o Blender instalado). AnimationTree com BlendSpace1D (parado → andando → correndo) e estados de morte/queda. **Não vai para o GitHub público** (licença Fab): pasta `privado/` ou repositório privado.
- **LOD:** o Godot gera LOD automático na importação. Mesmo assim, a estrutura do barracão já vem fundida por cor (40k triângulos, poucas chamadas de desenho).

## 5. Ordem de trabalho (marcos). Reordenada pelo ChatGPT: ponte antes da produção, benchmark primeiro
0. **M0 — Benchmark no notebook:** importar os GLBs reais (barracão, 3 máquinas, ponte, 7 personagens) numa cena simples, a 720p, no Compatibility, com sombra. Medir CPU, GPU e memória no executável exportado, não no editor. *Pronto quando a cena roda estável no notebook do Lucas.*
1. **M1 — Lógica sem gráfico:** EventBus, Dados, Tempo (os dois relógios), Economia, Reputação, Pedidos e Save, com os testes da Demo portados para o GUT. *Pronto quando os testes passam headless.*
2. **M2 — Andar no barracão:** barracão, jogador ithappy animado, câmera 3ª/1ª pessoa, colisões, escritório/loja com teto e parede que somem.
3. **M3 — Ponte rolante básica:** botoeira, carga pendurada, levar a bobina até o desbobinador. Primeiro o movimento e os estados do cabo; o ragdoll e as quedas vêm depois.
4. **M4 — Produzir:** máquina genérica, bobina no mandril, cabo do quadro, CLP, alinhamento, produção, corte, mesa de saída e pilhas. O ciclo completo sem atalhos de teste.
5. **M5 — Vender:** ParecisOS (loja, banco, e-mail, pedidos), ligações, caminhão de entrega e coleta (com a lógica de fila, bloqueio, espera máxima e reagendamento da Demo; o PathFollow3D sozinho não faz isso), loja de balcão.
6. **M5.5 — Loop completo com NPCs parados (Grok):** comprar → receber → produzir → vender → entregar → morrer, do começo ao fim, antes da IA de navegação. Zoeira completa (ragdoll, boleto, placa).
7. **M6 — Equipe:** funcionários e clientes com navmesh, empilhadeira, mesa de carregamento. Critério: tudo operando junto sem conflitos.
8. **M7 — Integração e publicação:** build estável para Windows, saves e desempenho conferidos. O desempenho é medido em **todos** os marcos, não só aqui.

## 6. Metas de desempenho (Ryzen 5 3500U / Vega 8). Revisadas pelo ChatGPT e pelo Grok
| Configuração | Meta |
|---|---|
| 720p, qualidade baixa | **30 fps estáveis (obrigatório)** |
| 720p, qualidade média | 30 a 45 fps |
| 1080p, qualidade baixa | testar, sem garantia |
| 1080p, qualidade média | meta futura, não é compromisso |
- Medir com o profiler do Godot (CPU, GPU, memória) no executável exportado. Os números de chamadas de desenho e triângulos (uns 300 e 300 mil) são só referência, não regra.
- 1 luz direcional com sombra (testar 2 cascatas), sem sombra dinâmica em peça pequena. Sem SDFGI nem névoa volumétrica (o Compatibility não tem).
- **Estrutura do barracão em módulos de 12 m** (pilares, viga de rolamento, tesouras, terças por trecho) em vez de uma malha única: o Godot descarta o que está fora da câmera e dá para esconder o telhado por trecho.
- **Telhado de verdade no jogo final:** existe como geometria e só os módulos que tampam a câmera somem ou ficam transparentes (a Demo está sem telhado por enquanto).
- **MultiMesh por setor ou pilha**, nunca um só para tudo: o MultiMesh não descarta instância por instância.
- No máximo 7 personagens com esqueleto na tela (dono + 6 funcionários); clientes da loja só quando o jogador está perto. Ragdoll só no dono.
- 8 GB de RAM: não testar com Blender, editor e jogo abertos juntos.

## 7. Riscos
- **Compatibility renderer:** menos efeitos de luz. O estilo de cores chapadas não depende deles.
- **Licença ithappy:** controlar o que vai para o repositório público. Conferido em 12/11: a pasta `privado/` nunca foi enviada ao GitHub (o .gitignore não apaga o que já foi enviado; aqui não há nada a apagar). Manter uma lista de licenças dos 42 GLBs e dos modelos Grab3D/Kenney.
- **Tempo acelerado (x20):** já resolvido na Demo com passo fixo; replicar igual (sub-passos anti-túnel do caminhão e da ponte).
- **Save:** manter `save_version` e migrador desde o primeiro dia. Importar o save da Demo só em estado "parado": a Demo já bloqueia salvar com carga na ponte, caminhão no pátio ou cliente no balcão. Uma peça pela metade na máquina é guardada (`progressoM`), como já é na Demo.
- **Navegação (Grok + ChatGPT):** o jogador instala máquinas onde quiser, então a navmesh precisa acompanhar.
  - Cada máquina, pilha e carga recebe um NavigationObstacle3D (desvio na hora), e a navmesh é reassada em segundo plano depois de cada instalação ou mudança.
  - Camadas de navegação separadas para pedestres e empilhadeiras, conferência de corredor estreito e tempo máximo para funcionário preso (ele desiste e volta).
  - O NavigationAgent3D só calcula o caminho; o código é que move o corpo.
- **Câmera (ChatGPT):** configurar o SpringArm3D com máscara de colisão das paredes e portas, forma de esfera pequena, margem de segurança e excluindo o próprio jogador. A Camera3D fica como filha direta do SpringArm3D.
- **Importar o save da Demo (ChatGPT):** precisa de um importador próprio que lê o arquivo exportado pela Demo e converte para o formato do Godot (`user://`). Vector3, Quaternion e Color viram listas no JSON. Toda gravação faz backup, grava num arquivo temporário e só então substitui o save, com validação antes de carregar.
- **Ragdoll + quedas:** quando o cabo estoura, cai a carga e o dono vira ragdoll ao mesmo tempo. Limitar a uns 20 corpos rígidos ativos e "dormir" os objetos parados.

## 8. Pendências levantadas pelas IAs para a Demo/Godot
- 1ª pessoa: mãos ou ferramenta simples na tela quando estiver operando botoeira, CLP ou ferramenta (ChatGPT).
- HUD normal separado do HUD de depuração na versão pública (ChatGPT).
- Animações: avaliar por vídeo curto (pés deslizando, transição andar/correr), não por foto (ChatGPT).

## 9. O que o Lucas precisa fazer
- Instalar o Godot **4.7.2** (versão padrão, não a .NET) no notebook.
- Dizer se o repositório do Godot fica no mesmo GitHub (pasta `godot/`) ou num repositório privado, por causa dos personagens.
