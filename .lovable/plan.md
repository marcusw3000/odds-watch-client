
# Corrigir Preview de Imagem ao Compartilhar Site

## Problema
Quando o link do site é compartilhado em plataformas como WhatsApp, Telegram, Facebook, Twitter ou LinkedIn, a imagem de preview não aparece.

## Causa Raiz
As meta tags `og:image` e `twitter:image` no `index.html` usam caminhos relativos (`/og-image.png`) em vez de URLs absolutas. Os crawlers das redes sociais não conseguem resolver esses caminhos relativos.

## Solução
Atualizar as meta tags para usar URLs absolutas com o domínio completo.

---

## Alterações

### Arquivo: `index.html`

**Antes:**
```html
<meta property="og:image" content="/og-image.png" />
<meta name="twitter:image" content="/og-image.png" />
```

**Depois:**
```html
<meta property="og:image" content="https://odds-watch-client.lovable.app/og-image.png" />
<meta name="twitter:image" content="https://odds-watch-client.lovable.app/og-image.png" />
```

---

## Detalhes Técnicos

| Meta Tag | Antes | Depois |
|----------|-------|--------|
| `og:image` | `/og-image.png` | `https://odds-watch-client.lovable.app/og-image.png` |
| `twitter:image` | `/og-image.png` | `https://odds-watch-client.lovable.app/og-image.png` |
| `og:url` | `https://mercadoprevisoes.com.br` | Mantém (ou atualizar se necessário) |

### Observações
1. A imagem `og-image.png` já existe em `public/` com dimensões corretas (1200x630)
2. O código dinâmico em `src/lib/seo.ts` já usa `window.location.origin` para construir URLs absolutas corretamente
3. Esta correção afeta apenas as meta tags estáticas do HTML inicial

---

## Resultado Esperado
Após a publicação, ao compartilhar o link em qualquer plataforma, a imagem de preview aparecerá corretamente.

## Validação
Após implementar, testar em:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- Compartilhar link no WhatsApp
