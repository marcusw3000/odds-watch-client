/**
 * Validação e formatação de dados brasileiros (CPF e Telefone)
 */

/**
 * Valida CPF com dígitos verificadores
 * Algoritmo oficial da Receita Federal
 */
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) return false;
  
  // Rejeitar CPFs com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(digits[9])) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== parseInt(digits[10])) return false;
  
  return true;
}

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Valida telefone brasileiro (com DDD)
 * Aceita: 10 dígitos (fixo) ou 11 dígitos (celular)
 */
export function validateBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Deve ter 10 (fixo) ou 11 (celular) dígitos
  if (digits.length < 10 || digits.length > 11) return false;
  
  // DDD válido (11-99)
  const ddd = parseInt(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  
  // Celular deve começar com 9
  if (digits.length === 11 && digits[2] !== '9') return false;
  
  return true;
}

/**
 * Formata telefone: (11) 99999-9999 ou (11) 9999-9999
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  
  // Telefone fixo (10 dígitos) ou celular (11 dígitos)
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Extrai apenas dígitos de uma string
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}
