import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthCheck {
  label: string;
  passed: boolean;
}

function calculatePasswordStrength(password: string): {
  score: number;
  checks: StrengthCheck[];
  label: string;
  color: string;
} {
  const checks: StrengthCheck[] = [
    { label: 'Mínimo 6 caracteres', passed: password.length >= 6 },
    { label: 'Letra minúscula', passed: /[a-z]/.test(password) },
    { label: 'Letra maiúscula', passed: /[A-Z]/.test(password) },
    { label: 'Número', passed: /\d/.test(password) },
    { label: 'Caractere especial', passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const passedChecks = checks.filter(c => c.passed).length;
  const score = passedChecks / checks.length;

  let label: string;
  let color: string;

  if (password.length === 0) {
    label = '';
    color = 'bg-muted';
  } else if (score <= 0.2) {
    label = 'Muito fraca';
    color = 'bg-destructive';
  } else if (score <= 0.4) {
    label = 'Fraca';
    color = 'bg-orange-500';
  } else if (score <= 0.6) {
    label = 'Razoável';
    color = 'bg-yellow-500';
  } else if (score <= 0.8) {
    label = 'Boa';
    color = 'bg-lime-500';
  } else {
    label = 'Forte';
    color = 'bg-green-500';
  }

  return { score, checks, label, color };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { score, checks, label, color } = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          <span className={cn(
            "text-xs font-medium",
            score <= 0.4 && "text-destructive",
            score > 0.4 && score <= 0.6 && "text-yellow-600",
            score > 0.6 && "text-green-600"
          )}>
            {label}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", color)}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((check, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors duration-200",
              check.passed ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {check.passed ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <X className="h-3 w-3 shrink-0" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
