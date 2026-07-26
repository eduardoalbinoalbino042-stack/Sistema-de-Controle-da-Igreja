import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AddressResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento?: string;
  referencia?: string;
}

export async function searchByCep(cep: string): Promise<AddressResult | null> {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  try {
    // Attempt BrasilAPI first (often more up-to-date)
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
    if (response.ok) {
      const data = await response.json();
      return {
        cep: data.cep,
        logradouro: data.street || "",
        bairro: data.neighborhood || "",
        localidade: data.city || "",
        uf: data.state || "",
      };
    }

    // Fallback to ViaCEP if BrasilAPI fails
    const fallback = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await fallback.json();
    if (data.erro) return null;
    return {
      cep: data.cep,
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
      complemento: data.complemento,
    };
  } catch (error) {
    console.error("Error fetching CEP:", error);
    return null;
  }
}

export async function smartSearch(query: string): Promise<AddressResult[]> {
  const trimmed = query.trim();
  
  if (/^\d{5}-?\d{3}$/.test(trimmed)) {
    const res = await searchByCep(trimmed);
    if (res) return [res];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Encontre o endereço COMPLETO e o CEP ATUALIZADO para: "${query}". 
      Responda EXCLUSIVAMENTE com um array JSON no formato: [{"cep": "00000-000", "logradouro": "Nome", "bairro": "Nome", "localidade": "Cidade", "uf": "UF", "referencia": "opcional"}]. 
      Não escreva mais nada além do JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    
    // Robust search for any JSON array pattern
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
    const cleanText = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, "").trim();

    if (!cleanText || cleanText === "[]") return [];

    try {
      const parsed = JSON.parse(cleanText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      // Normalize keys if needed
      return items.map((item: any) => ({
        cep: item.cep || "",
        logradouro: item.logradouro || item.rua || "",
        bairro: item.bairro || "",
        localidade: item.localidade || item.cidade || "",
        uf: item.uf || item.estado || "",
        referencia: item.referencia || ""
      }));
    } catch (e) {
      console.error("Parse error:", e, "Text:", cleanText);
      return [];
    }
  } catch (error) {
    console.error("Smart search exception:", error);
    return [];
  }
}
