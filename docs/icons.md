# Ícones do Studygram

A marca existente (s itálico, lilás e azul escuro) foi convertida em contorno vetorial independente de fontes no navegador.

- Favicon: SVG, PNG 16/32/48 e ICO com as três resoluções.
- Tela de Início iOS: `apple-touch-icon` PNG 180×180, opaco e sem cantos arredondados embutidos; o sistema aplica a máscara.
- Manifest: PNG 192 e 512, com margem segura para recorte maskable, nome Studygram e abertura standalone.
- Caminhos do HTML usam `%BASE_URL%` no build do Vite. `start_url`, `scope` e caminhos do manifest são relativos ao próprio manifest para respeitar `/studygram_/` no GitHub Pages.

Regeneração no Windows: `./scripts/generate-icons.ps1`, usando System.Drawing e a fonte Segoe UI apenas para gerar o contorno. Os arquivos finais estão versionados; o build Linux não precisa da fonte nem de executar o script.

No iPhone: abrir o site no Safari, Compartilhar → Adicionar à Tela de Início. Se um atalho antigo continuar com a imagem anterior, remover apenas o atalho e adicioná-lo novamente. Instalação e cache de ícones precisam ser confirmados em um iPhone real; a verificação no desktop valida os arquivos, dimensões e declarações, sem simular essa instalação. Não há suporte offline acrescentado por essa mudança. O modo instalado pode usar armazenamento/sessão separado do Safari; os rascunhos continuam locais ao contexto do navegador.

Referências: [Apple — Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [manifest e ícones](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons).
