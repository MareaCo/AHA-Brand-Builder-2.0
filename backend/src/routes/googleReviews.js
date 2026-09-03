import { Router } from "express";

export const router = Router();

// Insumo opcional de Nivel 1: reseñas públicas de Google Business, usadas como
// insumo real para la Etapa 2 (Insight). Solo activo si hay GOOGLE_PLACES_API_KEY.
router.get("/", async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error: "GOOGLE_PLACES_API_KEY no está configurada. Esta función es opcional en el MVP.",
    });
  }

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "query es obligatorio (nombre del negocio)." });

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      query
    )}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    const placeId = searchData.candidates?.[0]?.place_id;
    if (!placeId) return res.status(404).json({ error: "No se encontró el negocio en Google." });

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews&key=${apiKey}`;
    const detailsResp = await fetch(detailsUrl);
    const detailsData = await detailsResp.json();

    res.json({
      name: detailsData.result?.name,
      rating: detailsData.result?.rating,
      reviews: (detailsData.result?.reviews || []).map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: `No se pudieron obtener reseñas: ${err.message}` });
  }
});
