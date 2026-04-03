import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class IntelligentSearchService {
    private geminiKey: string | undefined = (environment.apiKeys as any)?.gemini;
    private cache = new Map<string, string>();

    constructor() { }

    /**
     * Envía la búsqueda a Gemini para que seleccione la categoría adecuada.
     */
    async categorize(query: string, categories: string[]): Promise<string | null> {
        if (!query) return null;
        const q = query.toLowerCase().trim();

        // Devolver desde caché si ya se buscó
        if (this.cache.has(q)) {
            return this.cache.get(q) || null;
        }

        if (!this.geminiKey || this.geminiKey.includes('AIzaSyBudRqyQSNfr7yGYFhaoDx2fpFPDc1zzlI') || this.geminiKey === '') {
            console.warn('⚡ Búsqueda inteligente desactivada: Falta API Key de Gemini. Usando búsqueda básica.');
            return this.basicFallback(q, categories);
        }

        const prompt = `Actúa como un motor de clasificación de lugares y negocios. 
El usuario ha buscado: "${q}".
Las categorías disponibles en la app son las siguientes:
${categories.join('\n')}

Primero, evalúa si la palabra o frase buscada ("${q}") tiene sentido genuino como un tipo de negocio, giro comercial, lugar o actividad económica. Si el texto es aleatorio, contiene letras sin sentido (ej. "asdf", "hjkl"), o es una palabra que evidentemente no representa un negocio o lugar, responde ÚNICAMENTE con la palabra "INVALIDO".
Si tiene sentido como negocio o lugar (incluso si la palabra está mal escrita pero se entiende, o si es un negocio válido), dime a cuál de las categorías disponibles pertenece principalmente. 
Responde ÚNICAMENTE con el nombre exacto de la categoría. No agregues comillas, ni explicaciones. Si es un negocio válido pero no se ajusta perfectamente a ninguna, elige la categoría más cercana.`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.0,
                        maxOutputTokens: 200
                    }
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Error de API Gemini:', data.error);
                return this.basicFallback(q, categories);
            }
            if (data.candidates && data.candidates.length > 0) {
                const resultText = data.candidates[0].content?.parts?.[0]?.text?.trim();

                if (!resultText) return this.basicFallback(q, categories);

                if (resultText === 'INVALIDO') {
                    return 'INVALIDO';
                }

                // Verificar si la respuesta de la IA coincide con alguna de nuestras categorías (ignorando mayúsculas)
                const match = categories.find(c => resultText.toLowerCase().includes(c.toLowerCase()));

                if (match) {
                    this.cache.set(q, match);
                    return match;
                }
            }
        } catch (e) {
            console.error('Error al usar Gemini API para búsqueda inteligente', e);
        }

        // Fallback si la API falla o no devuelve una categoría válida
        return this.basicFallback(q, categories);
    }

    private basicFallback(query: string, categories: string[]): string | null {
        query = query.toLowerCase().trim();

        const strictMatch = categories.find(c =>
            c.toLowerCase().includes(query) || query.includes(c.toLowerCase())
        );
        if (strictMatch) return strictMatch;

        const keywordMapping: { [key: string]: string[] } = {
            'Alimentos y bebidas': ['comida', 'bebida', 'restaurante', 'cafe', 'bar', 'snack', 'postre', 'taco', 'hamburguesa', 'pizza', 'panaderia', 'pasteleria', 'cafeteria', 'bebida'],
            'Arte': ['arte', 'pintura', 'galeria', 'dibujo', 'artesania, papeleria'],
            'Barberia': ['barberia', 'barbero', 'corte de hombre', 'barba'],
            'Belleza': ['belleza', 'maquillaje', 'unas', 'spa', 'estetica', 'salon', 'uñas'],
            'Construccion': ['construccion', 'albañil', 'materiales', 'cemento', 'arquitectura'],
            'Contratistas': ['contratista', 'plomero', 'electricista', 'carpintero'],
            'Cortes de Cabello': ['corte de cabello', 'estilista', 'peluqueria', 'corte'],
            'Costureria': ['costureria', 'sastre', 'ropa a medida', 'arreglos', 'tela'],
            'Cuidado': ['cuidado', 'asilo', 'niñera', 'guarderia'],
            'Educacion': ['educacion', 'escuela', 'clases', 'curso', 'tutor', 'academia', 'ingles', 'matematicas'],
            'Eventos y Entretenimeinto': ['eventos', 'fiesta', 'entretenimiento', 'salon de fiestas', 'musica', 'dj', 'payaso'],
            'Fitness': ['fitness', 'gimnasio', 'gym', 'entrenador', 'deporte', 'crossfit'],
            'Hogar y Jardineria': ['hogar', 'jardineria', 'muebles', 'decoracion', 'plantas', 'vivero'],
            'Infantes': ['infante', 'bebe', 'juguetes', 'ropa de niño', 'pañales'],
            'Ingenieria': ['ingenieria', 'ingeniero', 'planos', 'calculo'],
            'Legal y Financiero': ['legal', 'financiero', 'abogado', 'contador', 'prestamos', 'seguros', 'notario'],
            'Limpieza': ['limpieza', 'lavanderia', 'tintoreria', 'aseo', 'productos de limpieza'],
            'Mascotas': ['mascota', 'veterinaria', 'perro', 'gato', 'alimento para perro', 'estetica canina'],
            'Negocios': ['negocio', 'consultoria', 'oficina', 'emprendimiento'],
            'Reciclaje': ['reciclaje', 'chatarra', 'carton', 'plastico', 'aluminio'],
            'Regalos': ['regalo', 'sorpresa', 'floreria', 'envolturas'],
            'Restaurantes': ['restaurante', 'cena', 'desayuno', 'mariscos', 'carne'],
            'Ropa': ['ropa', 'boutique', 'zapateria', 'bolsas', 'accesorios', 'vestidos'],
            'Salud y Medicina': ['salud', 'medicina', 'farmacia', 'doctor', 'medico', 'clinica', 'dentista', 'optica', 'psicologo'],
            'Servicios IT': ['it', 'computadoras', 'programacion', 'desarrollo', 'software', 'reparacion de pc', 'celulares'],
            'Servicios Vehiculares': ['vehiculo', 'carro', 'auto', 'mecanico', 'taller', 'refaccionaria', 'llantas', 'autolavado', 'moto'],
            'Servivios Electronicos': ['electronico', 'reparacion de tv', 'electrodomesticos'],
            'Tatuajes y Piercings': ['tatuaje', 'piercing', 'tattoo'],
            'Tienda Abarrotes': ['abarrote', 'tiendita', 'miscelanea', 'minisuper', 'supermercado', 'carniceria'],
            'Viajes y Transportistas': ['viaje', 'transporte', 'taxi', 'flete', 'mudanza', 'turismo', 'agencia']
        };

        for (const [category, keywords] of Object.entries(keywordMapping)) {
            if (keywords.some(k => query.includes(k) || k.includes(query))) {
                const match = categories.find(c => c.toLowerCase() === category.toLowerCase());
                if (match) return match;
            }
        }
        return null;
    }
}
