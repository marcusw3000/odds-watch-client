import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BCB API endpoints
const BCB_ENDPOINTS: Record<string, string> = {
  SELIC: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json",
  SELIC_META: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
  IPCA: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json",
  CDI: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
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

// Fetch PTAX (different API structure)
async function fetchPTAX(): Promise<BCBDataResponse> {
  // Get yesterday's date (PTAX is published next day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0].replace(/-/g, "-");
  const formattedDate = `'${dateStr.substring(5, 7)}-${dateStr.substring(8, 10)}-${dateStr.substring(0, 4)}'`;
  
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=${formattedDate}&$format=json`;
  
  console.log("Fetching PTAX from:", url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PTAX API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.value || data.value.length === 0) {
    throw new Error("No PTAX data available");
  }
  
  const cotacao = data.value[0];
  
  return {
    indicator: "PTAX",
    value: cotacao.cotacaoVenda,
    date: dateStr,
    rawResponse: data,
  };
}

// Fetch data from BCB API
async function fetchBCBData(indicator: string): Promise<BCBDataResponse> {
  if (indicator === "PTAX") {
    return fetchPTAX();
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
