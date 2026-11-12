# Modelos 3D grátis — Parecis Telha

Baixados em 12/11/2026. **Todos CC0** (domínio público: uso comercial livre, sem crédito obrigatório).

- `grab3d/` — 22 modelos do [Grab3D](https://grab3d.com) (versão "light" quando existia). Licença em `grab3d/LICENCA_CC0.txt`.
- `kenney/` — caminhões do [Kenney Car Kit](https://kenney.nl/assets/car-kit) (precisam da pasta `Textures/`). Licença em `kenney/LICENCA_CC0_Kenney.txt`.
- `preview.html` — prévia 3D de todos (girar com o mouse). `previa.png` — imagem da prévia.

Os packs da **ithappy** (personagens, galinha, móveis) NÃO ficam aqui: a licença deles proíbe redistribuir os arquivos soltos. Ficam só no PC do Lucas.

Qual modelo substitui qual cubo do jogo: ver `demo1/js/producao_modelos.js` (campo `gratis`) ou `demo1/modelos.html`.

Observações:
- Caminhões Kenney estão em escala de brinquedo (~2,7 m) e mais simples que o resto; o baú do Grab3D combina melhor.
- Itens pequenos com muitos triângulos (capacete 19k, lata de tinta 12k) devem ser simplificados (Decimate) antes do Godot.
- A ponte do Grab3D é pórtico; aproveitar viga, carro e gancho.
