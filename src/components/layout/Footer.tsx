import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" />
            <p className="text-sm text-center md:text-left">
              Plataforma demonstrativa. Não envolve apostas reais ou valores financeiros.
            </p>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Termos de Uso
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacidade
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
