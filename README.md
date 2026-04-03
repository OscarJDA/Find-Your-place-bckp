# Simulador y Analista de Viabilidad Comercial


Este proyecto es una aplicación multiplataforma (Web/Móvil) diseñada para empoderar a emprendedores en la toma de decisiones estratégicas. Evalúa zonas geográficas en tiempo real basándose en variables críticas como flujo peatonal, competencia y nivel socioeconómico.

---

## Características Principales

* **Inteligencia Artificial Local:** Utiliza un modelo **Random Forest Regressor** desarrollado íntegramente en TypeScript. Esto permite ejecutar predicciones de éxito de manera 100% offline, reduciendo la latencia y eliminando la dependencia de servidores externos para el análisis.
* **Fusión Geoespacial:** Integra datos de múltiples proveedores como **Mapbox** y **OpenStreetMap (OSM)**, cruzándolos con datos comerciales oficiales (INEGI) para ofrecer una pre-evaluación estructurada y precisa.
* **Diversidad Comercial:** El algoritmo está optimizado para mitigar la saturación de mercado, sugiriendo el **Top 5 de localizaciones** priorizando la viabilidad y la diversidad espacial.
* **Reportes Offline:** Generación nativa de reportes en formato **PDF**, permitiendo exportar los análisis detallados directamente desde el dispositivo.

---

## 🛠️ Tecnologías Principales

| Categoría | Herramientas |
| :--- | :--- |
| **Frontend & Mobile** | ![Angular](https://img.shields.io/badge/Angular-20-DD0031?style=flat-square&logo=angular) ![Ionic](https://img.shields.io/badge/Ionic-8-3880FF?style=flat-square&logo=ionic) ![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square&logo=capacitor) |
| **Mapas & Geodatos** | ![Mapbox](https://img.shields.io/badge/Mapbox-GL_JS-000000?style=flat-square&logo=mapbox) ![OSM](https://img.shields.io/badge/OpenStreetMap-Nominatim-7EBC6F?style=flat-square&logo=openstreetmap) |
| **Machine Learning** | ![TypeScript](https://img.shields.io/badge/Random_Forest-TypeScript-3178C6?style=flat-square&logo=typescript) |
| **Reportes** | `jsPDF` • `html2canvas` |

