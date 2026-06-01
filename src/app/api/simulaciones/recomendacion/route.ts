import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { budget, simulations } = body;

    if (budget === undefined || !Array.isArray(simulations)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const insforge = createServiceClient();

    // Prepare simulated catalog summary for AI prompt
    const catalogSummary = simulations
      .map((s: any) => {
        return `- **${s.nombre}**: Precio Venta: ${s.precio}€, Costo Total: ${s.costoTotal}€, CPA Promedio: ${s.cpaVal}€, Tasa de Entrega: ${Math.round(s.tasa * 100)}%, Margen de Entrega: ${s.profitDelivered.toFixed(2)}€, Costo si es Rechazado: ${s.lossRejected.toFixed(2)}€, Beneficio Neto Esperado: ${s.expectedProfit.toFixed(2)}€, ROI de Anuncios: ${s.adsRoi.toFixed(1)}%`;
      })
      .join("\n");

    const prompt = `
Actúa como un Growth Hacker y Media Buyer experto especializado en comercio electrónico mediante pago contra entrega (Cash on Delivery - COD) en mercados europeos y de Latinoamérica.

El usuario tiene un presupuesto publicitario diario de **${budget}€** en anuncios (Meta Ads / TikTok Ads) para vender los productos de su catálogo.
Aquí tienes el análisis matemático detallado de los unit economics de su catálogo de productos actual:

${catalogSummary}

Por favor, genera un informe estratégico ejecutivo de alto nivel, en español y con formato Markdown premium. El informe debe estructurarse de la siguiente manera:

1. **Análisis de Ganadores y Perdedores (Superstars & Underperformers)**:
   - Identifica y destaca los productos estrella que tienen la mejor rentabilidad matemática y ROI de publicidad (los que deberías escalar con prioridad).
   - Advierte severamente sobre los productos que están a pérdidas (como los que tienen ROI de anuncios negativo o beneficio neto por envío negativo, ej. "BaseCC 4x1") y explica por qué están perdiendo dinero.

2. **Plan de Distribución de Presupuesto (${budget}€)**:
   - Propón una asignación óptima del presupuesto diario de ${budget}€ entre los productos recomendados.
   - Detalla cuánto gastar en cada producto ganador y cuántos pedidos y ganancias diarias netas proyectadas se obtendrán.

3. **Tácticas de Optimización para COD**:
   - Da 2 o 3 consejos prácticos específicos para este catálogo con el fin de reducir el costo de rechazo o mejorar la tasa de entrega (que es crítica en COD).

4. **Ángulos de Meta Ads**:
   - Para el mejor producto del catálogo, sugiere 2 ángulos creativos o copys publicitarios específicos y persuasivos enfocados en el valor de la oferta.

Sé directo, profesional, estratégico y evita rodeos. Utiliza emojis para que la lectura sea dinámica e impactante.
`;

    const response = await insforge.ai.chat.completions.create({
      model: "openai/gpt-4",
      messages: [
        {
          role: "system",
          content: "Eres un consultor experto en comercio electrónico y COD que analiza unit economics y presupuestos publicitarios."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      thinking: false
    });

    const recommendation = response.choices?.[0]?.message?.content || "No se pudo generar una recomendación.";

    return NextResponse.json({ recommendation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido en el servidor de IA" }, { status: 500 });
  }
}
