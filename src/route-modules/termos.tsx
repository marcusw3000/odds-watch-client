import type { MetaFunction } from "react-router";
import { TermosPage } from "@/pages/TermosPage";

export const meta: MetaFunction = () => [
  { title: "Termos de Uso | Mercado de Previsões" },
  {
    name: "description",
    content: "Leia os termos de uso da plataforma OddsWatch e as regras aplicáveis ao uso do serviço.",
  },
];

export default function TermosRoute() {
  return <TermosPage />;
}
