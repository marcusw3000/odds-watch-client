import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Search, Home, TrendingUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        {/* Ícone */}
        <div className="mx-auto mb-6 rounded-full bg-muted p-6 w-fit">
          <Search className="h-12 w-12 text-muted-foreground" />
        </div>

        {/* Título */}
        <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Página não encontrada
        </h2>
        <p className="mb-8 text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>

        {/* Ações principais */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Ir para Início
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/mercados">
              <TrendingUp className="mr-2 h-4 w-4" />
              Ver Mercados
            </Link>
          </Button>
        </div>

        {/* Links úteis */}
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Ou tente uma dessas páginas:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/portfolio" className="hover:text-foreground transition-colors">
              Portfólio
            </Link>
            <Link to="/leaderboard" className="hover:text-foreground transition-colors">
              Ranking
            </Link>
            <Link to="/faq" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
              Ajuda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
