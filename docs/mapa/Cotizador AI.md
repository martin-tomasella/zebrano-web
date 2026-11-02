# Cotizador AI (Nogal)
Edge function `zebrano-cotizador`. Flujo: medidas → diseño SVG → render → cotización (despiece, placas, herrajes, MO) → [[Aprobación]].
- Canal interno (empleado): ve costos y aprueba. Canal externo (web/app sin login, RRSS): sin costos, con topes, no aprueba.
- Modelos: llm-gateway → Gemini → Claude → OpenAI. Render: OpenAI gpt-image-1 → Pollinations (respaldo).
- Consumo en `ia_consumo`. Ver [[Seguridad]].
