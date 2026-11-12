# Testes automáticos da Demo 1

- `teste_ciclo_completo.js` — caminho feliz: caminhão → ponte → instalar → cabo → bobina → produzir → paleteira → pedido → coleta → cabo estoura → morte → save/load.
- `teste_quebrar_o_jogo.js` — tenta quebrar: coleta parcial com motorista indo embora, modo "devolver", save com caminhão no pátio, valores negativos, cobrança no dia 30, vencimento do FINAME, tirar bobina no meio da produção, mover máquina, morrer com a paleteira, cancelamento com multa, save inválido.

Como rodar: servir a pasta do repositório (`python3 -m http.server 8765`), colocar o `three.min.js` (r128) nesta pasta e rodar `node teste_quebrar_o_jogo.js` (precisa do Playwright).
