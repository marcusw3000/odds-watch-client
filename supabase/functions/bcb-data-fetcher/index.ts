import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BCB API endpoints (SGS - Sistema Gerenciador de Séries)
const BCB_ENDPOINTS: Record<string, string> = {
  SELIC: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json",
  SELIC_META: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
  IPCA: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json",
  IPCA_12M: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json",
  CDI: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
  PIB: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.7326/dados/ultimos/1?formato=json",
};

interface BCBDataResponse {
  indicator: string;
  value: number;
  date: string;
  rawResponse: unknown;
}

// Parse date from BCB format (dd/mm/yyyy)
function parseBCBDate(dateStr: string): string {
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
}

// Get business day for PTAX query (skip weekends)
function getLastBusinessDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1); // Yesterday
  
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) date.setDate(date.getDate() - 2); // Sunday -> Friday
  if (dayOfWeek === 6) date.setDate(date.getDate() - 1); // Saturday -> Friday
  
  return date;
}

// Format date for PTAX API (MM-DD-YYYY)
function formatPTAXDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `'${month}-${day}-${year}'`;
}

// Fetch USD PTAX
async function fetchPTAXUSD(): Promise<BCBDataResponse> {
  const businessDay = getLastBusinessDay();
  const formattedDate = formatPTAXDate(businessDay);
  
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=${formattedDate}&$format=json`;
  
  console.log("Fetching PTAX USD from:", url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PTAX USD API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.value || data.value.length === 0) {
    // Try previous business day
    businessDay.setDate(businessDay.getDate() - 1);
    const prevDate = formatPTAXDate(businessDay);
    const retryUrl = url.replace(formattedDate, prevDate);
    
    console.log("Retrying PTAX USD with:", retryUrl);
    const retryResponse = await fetch(retryUrl);
    const retryData = await retryResponse.json();
    
    if (!retryData.value || retryData.value.length === 0) {
      throw new Error("No PTAX USD data available");
    }
    
    const cotacao = retryData.value[retryData.value.length - 1];
    return {
      indicator: "PTAX_USD",
      value: cotacao.cotacaoVenda,
      date: businessDay.toISOString().split("T")[0],
      rawResponse: retryData,
    };
  }
  
  const cotacao = data.value[data.value.length - 1]; // Last quote of the day
  
  return {
    indicator: "PTAX_USD",
    value: cotacao.cotacaoVenda,
    date: businessDay.toISOString().split("T")[0],
    rawResponse: data,
  };
}

// Fetch EUR PTAX
async function fetchPTAXEUR(): Promise<BCBDataResponse> {
  const businessDay = getLastBusinessDay();
  const formattedDate = formatPTAXDate(businessDay);
  
  // EUR uses different endpoint
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='EUR'&@dataCotacao=${formattedDate}&$format=json`;
  
  console.log("Fetching PTAX EUR from:", url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PTAX EUR API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.value || data.value.length === 0) {
    // Try previous business day
    businessDay.setDate(businessDay.getDate() - 1);
    const prevDate = formatPTAXDate(businessDay);
    const retryUrl = url.replace(formattedDate, prevDate);
    
    console.log("Retrying PTAX EUR with:", retryUrl);
    const retryResponse = await fetch(retryUrl);
    const retryData = await retryResponse.json();
    
    if (!retryData.value || retryData.value.length === 0) {
      throw new Error("No PTAX EUR data available");
    }
    
    const cotacao = retryData.value[retryData.value.length - 1];
    return {
      indicator: "PTAX_EUR",
      value: cotacao.cotacaoVenda,
      date: businessDay.toISOString().split("T")[0],
      rawResponse: retryData,
    };
  }
  
  const cotacao = data.value[data.value.length - 1];
  
  return {
    indicator: "PTAX_EUR",
    value: cotacao.cotacaoVenda,
    date: businessDay.toISOString().split("T")[0],
    rawResponse: data,
  };
}

// Fetch data from BCB API
async function fetchBCBData(indicator: string): Promise<BCBDataResponse> {
  // Handle PTAX currencies specially
  if (indicator === "PTAX" || indicator === "PTAX_USD") {
    return fetchPTAXUSD();
  }
  if (indicator === "PTAX_EUR") {
    return fetchPTAXEUR();
  }
  
  const endpoint = BCB_ENDPOINTS[indicator];
  if (!endpoint) {
    throw new Error(`Unknown indicator: ${indicator}`);
  }
  
  console.log(`Fetching ${indicator} from:`, endpoint);
  
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`BCB API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No data returned for ${indicator}`);
  }
  
  const latest = data[0];
  
  return {
    indicator,
    value: parseFloat(latest.valor),
    date: parseBCBDate(latest.data),
    rawResponse: data,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const { indicator, forceRefresh = false } = await req.json();
    
    if (!indicator) {
      return new Response(
        JSON.stringify({ error: "Indicator is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const today = new Date().toISOString().split("T")[0];
      
      const { data: cached } = await supabase
        .from("bcb_data_cache")
        .select("*")
        .eq("indicator", indicator)
        .eq("reference_date", today)
        .maybeSingle();
      
      if (cached) {
        console.log(`Cache hit for ${indicator} on ${today}`);
        return new Response(
          JSON.stringify({
            indicator: cached.indicator,
            value: cached.value,
            date: cached.reference_date,
            fromCache: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Fetch fresh data
    console.log(`Fetching fresh data for ${indicator}`);
    const data = await fetchBCBData(indicator);
    
    // Cache the result (using service role to bypass RLS)
    const { error: cacheError } = await supabase
      .from("bcb_data_cache")
      .upsert({
        indicator: data.indicator,
        reference_date: data.date,
        value: data.value,
        raw_response: data.rawResponse,
        fetched_at: new Date().toISOString(),
      }, {
        onConflict: "indicator,reference_date",
      });
    
    if (cacheError) {
      console.error("Failed to cache BCB data:", cacheError);
    }
    
    return new Response(
      JSON.stringify({
        indicator: data.indicator,
        value: data.value,
        date: data.date,
        fromCache: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error fetching BCB data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
