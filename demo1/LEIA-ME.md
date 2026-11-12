# Parecis Telha — Demo 1 (protótipo de sistemas)

Protótipo no navegador (HTML + JavaScript + three.js r128) **sem modelos 3D**: tudo é cubo ou cilindro com etiqueta.
Serve para testar o código, as funções e os parâmetros antes do Godot, e para gerar a lista de modelos 3D necessários.

- Jogar: `index.html` (H mostra os controles)
- Lista de modelos 3D: `modelos.html` (e aba "Modelos 3D" no computador do jogo, com botão para baixar .csv)

## Um arquivo por sistema (`js/`)
| Arquivo | O que faz |
|---|---|
| dados.js | TODOS os parâmetros (preços, pesos, velocidades, clientes, economia). Balanceamento só aqui. |
| eventos.js | Barramento de eventos (vira signals no Godot) + utilidades |
| modelos.js | Registro de modelos 3D: cada objeto nasce por `PT.modelo('id')` e entra na ficha de cotação |
| tempo.js | Relógio 7h–17h = 12 min reais, pula a noite, passos fixos de 1 min de jogo, velocidade x1/x5/x20/x60 |
| mundo.js | Cena, barracão 132x40, personagem 3ª pessoa, câmera, colisão, entidades e interações (E / 1–4) |
| economia.js | Caixa, capital de giro, agiota, FINAME por reputação, recebíveis, custos fixos, energia, extrato, previsão |
| loja.js | Loja do navegador do escritório (à vista / FINAME) |
| entrega.js | Caminhão em trilho fixo, buzina se bloquearem o corredor, volumes na carroceria |
| construcao.js | Fantasma verde/amarelo/vermelho, grade 0,5 m, nivelamento, cabo do quadro, sobrecarga |
| ponte.js | Botoeira pendente, gancho, balanço, sobrecarga → cabo estoura → carga cai → morte |
| maquinas.js | Classe genérica de máquina por dados (perfiladeira, guilhotina, dobradeira), CLP, desgaste, enrosco |
| estoque.js | Bobinas, pilhas de produto, carregar na mão, paleteira, inventário |
| pedidos.js | Clientes por perfil, negociação, coleta, entrega parcial, multa, pagamento |
| carregamento.js | Mesa de carregamento 2D ("Tetris prático"): pacotes, peso, equilíbrio, cintas, dano na viagem |
| reputacao.js | 3 barras → estrelas, faixas por entregas |
| zoeira.js | Placa de dias sem acidentes, morte/respawn, boleto simbólico, cicatrizes no piso |
| save.js | Save JSON com `save_version`, só em estado estável, exportar/importar |
| ui.js | HUD, celular, computador (Loja/Banco/E-mail/Pedidos/Reputação/Modelos 3D/Sistema), CLP, prancheta, minijogos |
| main.js | Inicialização e laço principal |

Revisado pela "sala" de IAs (Claude escreve; ChatGPT, Gemini e Grok revisam).
