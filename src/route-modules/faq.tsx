import type { MetaFunction } from "react-router";
import { FAQPage } from "@/pages/FAQPage";

export const meta: MetaFunction = () => [
  { title: "Perguntas Frequentes | OrbMarket" },
  {
    name: "description",
    content: "Tire suas dúvidas sobre a plataforma OrbMarket, conta, segurança, depósitos, saques e mercados.",
  },
];

export default function FAQRoute() {
  return <FAQPage />;
}
