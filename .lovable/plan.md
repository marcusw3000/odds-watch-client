# Plano: Melhorar Tratamento de Erro de Slippage

## Problema Identificado
Quando o preco muda mais de 5% entre a cotacao e a execucao:
1. O backend retorna uma mensagem especifica: "O preco mudou significativamente..."
2. O frontend ignora essa mensagem e mostra: "Erro ao processar compra. Tente novamente."
3. O usuario nao sabe o que aconteceu e nao tem opcao de atualizar o preco

## Solucao Proposta

### Modificar `src/components/market/PurchaseModal.tsx`

**1. Adicionar estado para detectar slippage:**
```typescript
const [slippageDetected, setSlippageDetected] = useState(false);
```

**2. Modificar o catch para tratar erros especificos:**
```typescript
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
  
  // Detectar erro de slippage
  if (errorMessage.includes('preco mudou') || errorMessage.includes('slippage')) {
    setSlippageDetected(true);
    setError('O preco mudou desde sua cotacao. Atualize o preco para continuar.');
    // Atualizar preco automaticamente
    await handleRefreshPrice();
  } else {
    setError(errorMessage || 'Erro ao processar compra. Tente novamente.');
  }
}
```

**3. Adicionar UI especial para slippage:**
- Mostrar alerta amarelo (warning) quando slippage for detectado
- Mostrar novo preco apos atualizacao
- Destacar a diferenca de preco para o usuario
- Adicionar botao "Tentar com novo preco"

**4. Resetar estado de slippage ao atualizar preco:**
```typescript
const handleRefreshPrice = useCallback(async () => {
  setSlippageDetected(false);  // Resetar flag
  // ... resto do codigo
}, [...]);
```

### Fluxo de UX Melhorado

```
Usuario tenta comprar
       |
       v
Preco mudou > 5%?
       |
  +----+----+
  |         |
 Nao       Sim
  |         |
  v         v
Sucesso   Mostrar warning:
          "O preco mudou de R$X para R$Y"
          [Atualizar e Tentar Novamente]
          [Cancelar]
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/market/PurchaseModal.tsx` | Adicionar tratamento de slippage |

## Beneficios
- Usuario entende o que aconteceu (preco mudou)
- Ve o novo preco automaticamente
- Pode decidir se quer continuar com o novo preco
- Experiencia mais transparente e profissional
