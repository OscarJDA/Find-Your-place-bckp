import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { OpenStreetMapService } from './api/openstreetmap.service';
import { PlacesProviderService } from './api/places-provider.service';
import { InegiService } from './api/inegi.service';
import { MapboxService } from './api/mapbox.service';
import { IntelligentSearchService } from './intelligent-search.service';
import { RandomForestService, RFPredictionResult } from './random-forest.service';

export interface LocationCoordinates {
    lat: number;
    lng: number;
}

export interface Recommendation {
    id: string;
    coords: LocationCoordinates;
    score: number; // 0 a 100
    address: string;

    // Legacy/UI Props (Restored for backward compatibility)
    competitorsCount: number;
    saturationLevel: 'Saturado' | 'Oportunidad' | 'Equilibrado' | 'Muy pocos';
    footTraffic: 'Alto' | 'Medio' | 'Bajo';
    socioeconomicLevel?: 'Alto' | 'Medio' | 'Bajo';
    securityLevel?: 'Alta' | 'Media' | 'Baja';
    activeHours: 'Mañana' | 'Tarde' | 'Noche' | 'Todo el día' | 'Desconocido';
    zoneType: 'Residencial' | 'Comercial' | 'Mixta' | 'Industrial' | 'Desconocido';
    accessibility: {
        mainRoads: boolean;
        publicTransport: boolean;
        parking: boolean;
        walkability: string;
    };
    nearby: {
        schools: boolean;
        hospitals: boolean;
        transit: boolean;
        malls: boolean;
    };
    pros: string[];
    cons: string[];
    recommendationText: string;
    title: string;
    streetViewImage?: string;

    // New Analysis Data
    analysis?: {
        competitionStatus: string;
        trafficGenerators: string[];
        accessibilityLevel: string;
    };
    formulaDetails?: {
        weights: {
            traffic: number;
            competition: number;
            socioeconomic: number;
            accessibility: number;
            security: number;
        };
        rawScores: {
            traffic: number;
            competition: number;
            socioeconomic: number;
            accessibility: number;
            security: number;
        };
        totalScore: number;
        totalScoreRaw: number;
    };
    // Random Forest Prediction Data
    rfPrediction?: RFPredictionResult;
}

@Injectable({
    providedIn: 'root'
})
export class BusinessAnalysisService {
    private mapboxAccessToken = environment.apiKeys.mapbox;

    // Mapeo dinámico de pesos según la categoría del negocio
    public getCategoryWeights(category: string) {
        // Pesos por defecto inspirados en el ejemplo (Suma = 1.0)
        const defaultWeights = {
            TRAFFIC: 0.30,
            COMPETITION: 0.20,
            SOCIOECONOMIC: 0.20,
            ACCESSIBILITY: 0.15,
            SECURITY: 0.15
        };

        const weightsMap: { [key: string]: typeof defaultWeights } = {
            'Alimentos y bebidas': { TRAFFIC: 0.40, COMPETITION: 0.25, SOCIOECONOMIC: 0.15, ACCESSIBILITY: 0.10, SECURITY: 0.10 },
            'Restaurantes': { TRAFFIC: 0.40, COMPETITION: 0.25, SOCIOECONOMIC: 0.15, ACCESSIBILITY: 0.10, SECURITY: 0.10 },
            'Tienda Abarrotes': { TRAFFIC: 0.45, COMPETITION: 0.30, SOCIOECONOMIC: 0.05, ACCESSIBILITY: 0.10, SECURITY: 0.10 },
            'Salud y Medicina': { TRAFFIC: 0.20, COMPETITION: 0.15, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.35, SECURITY: 0.10 },
            'Belleza': { TRAFFIC: 0.30, COMPETITION: 0.25, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.15, SECURITY: 0.10 },
            'Barberia': { TRAFFIC: 0.30, COMPETITION: 0.25, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.15, SECURITY: 0.10 },
            'Educacion': { TRAFFIC: 0.15, COMPETITION: 0.15, SOCIOECONOMIC: 0.25, ACCESSIBILITY: 0.20, SECURITY: 0.25 },
            'Legal y Financiero': { TRAFFIC: 0.15, COMPETITION: 0.20, SOCIOECONOMIC: 0.30, ACCESSIBILITY: 0.15, SECURITY: 0.20 },
            'Construccion': { TRAFFIC: 0.10, COMPETITION: 0.20, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.40, SECURITY: 0.10 },
            'Eventos y Entretenimeinto': { TRAFFIC: 0.30, COMPETITION: 0.15, SOCIOECONOMIC: 0.25, ACCESSIBILITY: 0.15, SECURITY: 0.15 },
            'Arte': { TRAFFIC: 0.20, COMPETITION: 0.10, SOCIOECONOMIC: 0.35, ACCESSIBILITY: 0.20, SECURITY: 0.15 },
            'Ropa': { TRAFFIC: 0.35, COMPETITION: 0.25, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.10, SECURITY: 0.10 },
            'Limpieza': { TRAFFIC: 0.20, COMPETITION: 0.20, SOCIOECONOMIC: 0.20, ACCESSIBILITY: 0.20, SECURITY: 0.20 },
            'Mascotas': { TRAFFIC: 0.30, COMPETITION: 0.20, SOCIOECONOMIC: 0.25, ACCESSIBILITY: 0.15, SECURITY: 0.10 },
            'Servicios Vehiculares': { TRAFFIC: 0.25, COMPETITION: 0.25, SOCIOECONOMIC: 0.10, ACCESSIBILITY: 0.30, SECURITY: 0.10 },
        };

        return weightsMap[category] || defaultWeights;
    }

    private readonly STORAGE_KEY = 'mapa_negocios_saved_locations';
    private savedLocations: { recommendation: Recommendation, category: string, date: string, type: string }[] = [];

    private locationPickedSource = new BehaviorSubject<LocationCoordinates | null>(null);
    locationPicked$ = this.locationPickedSource.asObservable();

    // Cache para evitar llamadas repetidas
    private geocodeCache = new Map<string, string>();
    private lastNominatimCall = 0;
    private NOMINATIM_DELAY = 1000; // 1 segundo entre llamadas

    constructor(
        private osmService: OpenStreetMapService,
        private inegiService: InegiService,
        private mapboxService: MapboxService,
        private placesService: PlacesProviderService,
        private aiSearchService: IntelligentSearchService,
        private randomForest: RandomForestService
    ) {
        this.loadSavedLocations();
    }

    private loadSavedLocations() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                this.savedLocations = JSON.parse(data);
            } catch (e) {
                console.error('Error parsing saved locations from localStorage', e);
            }
        }
    }

    emitLocationPicked(coords: LocationCoordinates) {
        this.locationPickedSource.next(coords);
    }

    clearLocationPicked() {
        this.locationPickedSource.next(null);
    }

    saveLocation(recommendation: Recommendation, category: string) {
        // Prevent duplicates
        if (!this.savedLocations.find(l => l.recommendation.id === recommendation.id)) {
            this.savedLocations.unshift({
                recommendation,
                category,
                type: category,
                // Using standard Date object
                date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
            });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedLocations));
        }
    }

    deleteLocation(id: string) {
        this.savedLocations = this.savedLocations.filter(l => l.recommendation.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedLocations));
    }

    getSavedLocations() {
        return this.savedLocations;
    }

    saveLocationsLocal(locations: any[]) {
        this.savedLocations = locations;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedLocations));
    }

    getCategories(): string[] {
        return [
            'Alimentos y bebidas',
            'Arte',
            'Barberia',
            'Belleza',
            'Construccion',
            'Contratistas',
            'Cortes de Cabello',
            'Costureria',
            'Cuidado',
            'Educacion',
            'Eventos y Entretenimeinto',
            'Fitness',
            'Hogar y Jardineria',
            'Infantes',
            'Ingenieria',
            'Legal y Financiero',
            'Limpieza',
            'Mascotas',
            'Negocios',
            'Reciclaje',
            'Regalos',
            'Restaurantes',
            'Ropa',
            'Salud y Medicina',
            'Servicios IT',
            'Servicios Vehiculares',
            'Servivios Electronicos',
            'Tatuajes y Piercings',
            'Tienda Abarrotes',
            'Viajes y Transportistas'
        ];
    }

    // Método mejorado con rate limiting para Nominatim (Adaptado para usar reverseNominatimSimple)
    async reverseGeocode(lat: number, lng: number): Promise<string> {
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey)!;
        }

        // Respetar rate limit de Nominatim
        const now = Date.now();
        const timeSinceLastCall = now - this.lastNominatimCall;
        if (timeSinceLastCall < this.NOMINATIM_DELAY) {
            await this.delay(this.NOMINATIM_DELAY - timeSinceLastCall);
        }

        try {
            this.lastNominatimCall = Date.now();
            // Usamos el nuevo método simple
            const address = await this.osmService.reverseNominatimSimple(lat, lng);
            this.geocodeCache.set(cacheKey, address);
            return address;
        } catch (error) {
            console.error('Reverse geocode error:', error);
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    async searchPlaces(query: string): Promise<any[]> {
        if (!query) return [];
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.mapboxAccessToken}&autocomplete=true&limit=5`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.features || [];
        } catch (error) {
            console.error('Error searching places:', error);
            return [];
        }
    }

    public analysisProgress$ = new BehaviorSubject<number>(0);

    // Track active analysis to prevent race conditions
    private currentAnalysisId = 0;

    private latestCompetitors: any[] = [];

    public getLatestCompetitors(): any[] {
        return this.latestCompetitors;
    }

    // --- CRITICAL OPTIMIZATION: Main Analysis Flow ---
    async analyzeArea(center: LocationCoordinates, radiusKm: number, category: string): Promise<Recommendation[]> {
        const analysisId = ++this.currentAnalysisId; // Capture ID for this run
        const updateProgress = (val: number) => {
            if (this.currentAnalysisId === analysisId) {
                this.analysisProgress$.next(val);
            }
        };

        console.log(`🚀 Iniciando análisis optimizado para ${category} en ${radiusKm}km... (ID: ${analysisId})`);
        updateProgress(0.01); // Start slightly above 0

        // RESOLVER LA CATEGORÍA PARA LA EVALUACIÓN MULTICRITERIO
        let resolvedCategory = category;
        const knownCategories = this.getCategories();
        if (!knownCategories.includes(category)) {
            const aiMatch = await this.aiSearchService.categorize(category, knownCategories);
            if (aiMatch) {
                resolvedCategory = aiMatch;
                console.log(`🤖 IA resolvió la categoría libre "${category}" a -> "${resolvedCategory}" para ajustar los pesos.`);
            }
        }

        const radiusMeters = radiusKm * 1000;

        // 1. Parallel Data Fetching with Fake Progress Simulation
        // Iniciamos un intervalo que sube de 0 a 30% suavemente mientras espera
        let fakeProgress = 0.01;
        const progressInterval = setInterval(() => {
            if (this.currentAnalysisId !== analysisId) {
                clearInterval(progressInterval);
                return;
            }
            fakeProgress += 0.02;
            if (fakeProgress > 0.30) fakeProgress = 0.30;
            updateProgress(fakeProgress);
        }, 200);

        try {
            const [osmInfra, competitorsData] = await Promise.all([
                this.withTimeout(this.osmService.getInfrastructure(center.lat, center.lng, radiusMeters), 45000, []),
                this.withTimeout(this.fetchCompetitors(center, radiusMeters, category), 45000, [])
            ]);
            this.latestCompetitors = competitorsData;
            clearInterval(progressInterval); // Stop fake progress

            if (this.currentAnalysisId !== analysisId) return []; // Abort if new analysis started

            if (osmInfra.length === 0 && competitorsData.length === 0) {
                console.warn("⚠️ No se obtuvieron datos de API, retornando grid básico");
            }

            updateProgress(0.35); // Sync to 35% real state

            const infra = this.categorizeInfrastructure(osmInfra);

            // 2. Generate HYBRID Candidates
            const candidates = this.generateHybridCandidates(center, radiusKm, infra);
            console.log(`📍 Evaluando ${candidates.length} puntos...`);

            updateProgress(0.40);

            // 3. Batch Processing (40% to 85%)
            const scoredCandidates: Recommendation[] = [];

            // Reduced chunk size for smoother updates if count is low
            const chunkSize = Math.max(10, Math.ceil(candidates.length / 20));

            for (let i = 0; i < candidates.length; i += chunkSize) {
                if (this.currentAnalysisId !== analysisId) return []; // Check cancellation

                const chunk = candidates.slice(i, i + chunkSize);
                const chunkResults = chunk.map((coord, idx) =>
                    this.calculateLocationScore(coord, i + idx, competitorsData, infra, resolvedCategory)
                );
                scoredCandidates.push(...chunkResults);

                // Progress math: 0.40 + (0.45 * ratio) -> Ends at 0.85
                const ratio = Math.min(1, (i + chunkSize) / candidates.length);
                const currentProgress = 0.40 + (0.45 * ratio);
                updateProgress(currentProgress);

                // Yield briefly
                if (candidates.length > 20) await this.delay(5);
            }

            // 4. SPATIAL DIVERSITY
            updateProgress(0.86);
            const diverseTop5 = this.selectDiverseBest(scoredCandidates, 5, 0.3);

            // 5. Final Geocoding (86% to 98%)
            const totalFinal = diverseTop5.length;
            for (let i = 0; i < totalFinal; i++) {
                if (this.currentAnalysisId !== analysisId) return []; // Check cancellation

                const rec = diverseTop5[i];
                try {
                    await this.delay(50); // Small visual delay
                    rec.address = await this.osmService.reverseNominatimSimple(rec.coords.lat, rec.coords.lng);
                    rec.title = rec.address.split(',')[0];
                } catch (e) {
                    rec.title = `Ubicación ${rec.id}`;
                }

                // Update progress per item
                const stepProgress = 0.86 + (0.12 * ((i + 1) / totalFinal)); // Max 0.98
                updateProgress(stepProgress);
            }

            updateProgress(1); // 100% Completado
            return diverseTop5;

        } catch (error) {
            clearInterval(progressInterval);
            console.error("Analysis failed", error);
            // Only update failure if we are still the active analysis
            if (this.currentAnalysisId === analysisId) {
                this.analysisProgress$.next(0);
            }
            return [];
        }
    }

    // --- HELPER WRAPPERS ---
    private async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
        const timeout = new Promise<T>(resolve => setTimeout(() => {
            console.warn('API call timed out, using fallback');
            resolve(fallback);
        }, ms));
        return Promise.race([promise, timeout]);
    }

    // --- SPATIAL DIVERSITY ALGORITHM ---
    private selectDiverseBest(candidates: Recommendation[], count: number, minDistanceKm: number): Recommendation[] {
        // 1. Sort by Score Descending
        // Add tiny random noise to break ties in a non-linear way (avoids scanline order artifacts)
        const sorted = candidates.sort((a, b) => (b.score + Math.random() * 0.05) - (a.score + Math.random() * 0.05));

        const selected: Recommendation[] = [];

        for (const candidate of sorted) {
            if (selected.length >= count) break;

            // Check collision with already selected
            let tooClose = false;
            for (const existing of selected) {
                const dist = this.calculateDistance(candidate.coords.lat, candidate.coords.lng, existing.coords.lat, existing.coords.lng);
                if (dist < minDistanceKm) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                selected.push(candidate);
            }
        }

        return selected;
    }

    // --- LOGICA DE NEGOCIO REFINADA ---

    private calculateLocationScore(
        point: LocationCoordinates,
        index: number,
        competitors: any[],
        infra: any,
        category: string
    ): Recommendation {
        const ANALYSIS_RADIUS_KM = 0.5; // Radio de 500m

        // OPTIMIZACIÓN: Usar filtro rápido (Bounding Box) antes de Haversine costoso
        const localCompetitors = this.filterByDistanceOptimized(competitors, point, ANALYSIS_RADIUS_KM);
        const localSchools = this.filterByDistanceOptimized(infra.schools, point, ANALYSIS_RADIUS_KM);
        const localHospitals = this.filterByDistanceOptimized(infra.hospitals, point, ANALYSIS_RADIUS_KM);
        const localTransport = this.filterByDistanceOptimized(infra.transport, point, ANALYSIS_RADIUS_KM);
        const localMalls = this.filterByDistanceOptimized(infra.malls, point, ANALYSIS_RADIUS_KM);
        const localOffices = this.filterByDistanceOptimized(infra.offices, point, ANALYSIS_RADIUS_KM);
        const localMainRoads = this.filterByDistanceOptimized(infra.mainRoads, point, ANALYSIS_RADIUS_KM);
        const localParking = this.filterByDistanceOptimized(infra.parking, point, ANALYSIS_RADIUS_KM);

        // Consider Residential and General Commercial density explicitly
        const localResidential = this.filterByDistanceOptimized(infra.residential, point, ANALYSIS_RADIUS_KM);
        const localCommercial = this.filterByDistanceOptimized(infra.commercial, point, ANALYSIS_RADIUS_KM);

        const compCount = localCompetitors.length;

        // ═══════════════════════════════════════════════════════════
        //  CÁLCULO DE LAS 7 VARIABLES (FEATURES) DEL MODELO RF
        //  x = (x1, x2, ... x7)
        // ═══════════════════════════════════════════════════════════

        // x1: Flujo Peatonal (Continua, 0-100)
        let flujoPeatonal = 15;
        flujoPeatonal += Math.min(localSchools.length * 15, 30);
        flujoPeatonal += Math.min(localHospitals.length * 20, 40);
        flujoPeatonal += Math.min(localMalls.length * 25, 50);
        if (localResidential.length > 0) flujoPeatonal += 20;
        if (localResidential.length > 2) flujoPeatonal += 15;
        if (localCommercial.length > 0) flujoPeatonal += 10;
        flujoPeatonal = Math.min(flujoPeatonal, 100);

        // x2: Flujo Vehicular (Continua, 0-100)
        let flujoVehicular = 10;
        if (localMainRoads.length > 0) flujoVehicular += 30;
        if (localMainRoads.length > 1) flujoVehicular += 15;
        if (localParking.length > 0) flujoVehicular += 20;
        if (localTransport.length > 0) flujoVehicular += 15;
        if (localMalls.length > 0) flujoVehicular += 15;
        flujoVehicular = Math.min(flujoVehicular, 100);

        // x3: Número de Competidores (Discreta)
        const numCompetidores = compCount;

        // x4: Nivel Socioeconómico (Continua, 0-100)
        let nivelSocioeconomico = 50;
        if (localResidential.length > 0) nivelSocioeconomico += 10;
        if (localMalls.length > 0) nivelSocioeconomico += 20;
        if (localSchools.length > 0) nivelSocioeconomico += 10;
        if (localOffices.length > 0) nivelSocioeconomico += 10;
        nivelSocioeconomico = Math.min(nivelSocioeconomico, 100);

        // x5: Índice de Seguridad (Continua, 0-100)
        let indiceSeguridad = 50;
        if (localMainRoads.length > 0) indiceSeguridad += 20;
        if (localCommercial.length > 0) indiceSeguridad += 10;
        if (localHospitals.length > 0) indiceSeguridad += 10;
        if (localParking.length > 0) indiceSeguridad += 5;
        if (localTransport.length > 0) indiceSeguridad += 5;
        indiceSeguridad = Math.min(indiceSeguridad, 100);

        // x6: Densidad Poblacional (Continua, 0-100)
        let densidadPoblacional = 20;
        if (localResidential.length > 0) densidadPoblacional += 25;
        if (localResidential.length > 2) densidadPoblacional += 20;
        if (localSchools.length > 0) densidadPoblacional += 15;
        if (localCommercial.length > 0) densidadPoblacional += 10;
        if (localTransport.length > 1) densidadPoblacional += 10;
        densidadPoblacional = Math.min(densidadPoblacional, 100);

        // x7: Renta Promedio (Continua, 0-100)
        let rentaPromedio = 45;
        if (localMalls.length > 0) rentaPromedio += 25;
        if (localOffices.length > 0) rentaPromedio += 15;
        if (localCommercial.length > 0) rentaPromedio += 10;
        if (localResidential.length > 0) rentaPromedio += 5;
        rentaPromedio = Math.min(rentaPromedio, 100);

        // ═══════════════════════════════════════════════════════════
        //  PREDICCIÓN CON RANDOM FOREST REGRESSOR
        //  f̂(x) = (1/T) Σ h_t(x)
        // ═══════════════════════════════════════════════════════════
        const rfResult = this.randomForest.predict({
            flujoPeatonal,
            flujoVehicular,
            numCompetidores,
            nivelSocioeconomico,
            indiceSeguridad,
            densidadPoblacional,
            rentaPromedio
        });

        // Usar el score del Random Forest como score principal
        const stars = rfResult.score;

        // ═══════════════════════════════════════════════════════════
        //  CÁLCULO LEGACY (para formulaDetails / comparación)
        // ═══════════════════════════════════════════════════════════
        let compScore = 0;
        if (compCount === 0) compScore = 100;
        else if (compCount <= 2) compScore = 85;
        else if (compCount <= 4) compScore = 60;
        else compScore = 10;

        let accessScore = 10;
        if (localTransport.length > 0) accessScore += 40;
        else if (localMainRoads.length > 0) accessScore += 20;
        if (localTransport.length > 2) accessScore += 20;
        if (localParking.length > 0) accessScore += 20;
        if (localCommercial.length > 1) accessScore += 10;
        accessScore = Math.min(accessScore, 100);

        const weights = this.getCategoryWeights(category);
        const totalScoreLegacy = (
            (flujoPeatonal * weights.TRAFFIC) +
            (compScore * weights.COMPETITION) +
            (accessScore * weights.ACCESSIBILITY) +
            (nivelSocioeconomico * weights.SOCIOECONOMIC) +
            (indiceSeguridad * weights.SECURITY)
        );

        // Metadata Generation
        let saturation: 'Saturado' | 'Oportunidad' | 'Equilibrado' | 'Muy pocos' = 'Equilibrado';
        if (compCount === 0) saturation = 'Oportunidad';
        else if (compCount <= 2) saturation = 'Muy pocos';
        else if (compCount > 5) saturation = 'Saturado';

        let footTraffic: 'Alto' | 'Medio' | 'Bajo' = 'Bajo';
        if (flujoPeatonal > 70) footTraffic = 'Alto';
        else if (flujoPeatonal > 40) footTraffic = 'Medio';

        let socioeconomicLevel: 'Alto' | 'Medio' | 'Bajo' = 'Medio';
        if (nivelSocioeconomico > 70) socioeconomicLevel = 'Alto';
        else if (nivelSocioeconomico <= 40) socioeconomicLevel = 'Bajo';

        let securityLevel: 'Alta' | 'Media' | 'Baja' = 'Media';
        if (indiceSeguridad > 70) securityLevel = 'Alta';
        else if (indiceSeguridad <= 40) securityLevel = 'Baja';

        const zoneType = this.inferZoneType(point, infra.residential, infra.commercial);

        const pros: string[] = [];
        const cons: string[] = [];
        if (compCount === 0) pros.push('Sin competencia directa');
        else if (compCount <= 2) pros.push('Baja competencia en la zona');

        if (localResidential.length > 0) pros.push('Zona residencial (Clientes locales)');
        if (flujoPeatonal > 60) pros.push('Alto flujo potencial de personas');
        if (localTransport.length > 2) pros.push('Excelente conectividad');
        if (rfResult.confidence > 0.8) pros.push('Alta confianza del modelo predictivo');

        if (compCount > 5) cons.push('Zona saturada de competencia');
        if (flujoPeatonal < 30) cons.push('Flujo de personas moderado/bajo');
        if (accessScore < 40) cons.push('Accesibilidad limitada (Poco transporte)');
        if (rfResult.confidence < 0.5) cons.push('Confianza del modelo moderada');

        const activeHours = (localHospitals.length > 0 || localMalls.length > 0) ? 'Todo el día' : 'Tarde';

        return {
            id: `loc-${index}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            coords: point,
            score: parseFloat(stars.toFixed(1)),
            address: 'Calculando...',
            title: `Opción ${index + 1}`,
            competitorsCount: compCount,
            saturationLevel: saturation,
            footTraffic,
            socioeconomicLevel,
            securityLevel,
            activeHours,
            zoneType,
            accessibility: {
                mainRoads: localMainRoads.length > 0,
                publicTransport: localTransport.length > 0,
                parking: localParking.length > 0,
                walkability: (localTransport.length > 1 || localResidential.length > 2) ? 'Alta' : 'Media'
            },
            nearby: {
                schools: localSchools.length > 0,
                hospitals: localHospitals.length > 0,
                transit: localTransport.length > 0,
                malls: localMalls.length > 0
            },
            pros,
            cons,
            recommendationText: `Zona ${zoneType} con tráfico ${footTraffic}.`,
            formulaDetails: {
                weights: {
                    traffic: weights.TRAFFIC,
                    competition: weights.COMPETITION,
                    socioeconomic: weights.SOCIOECONOMIC,
                    accessibility: weights.ACCESSIBILITY,
                    security: weights.SECURITY
                },
                rawScores: {
                    traffic: flujoPeatonal,
                    competition: compScore,
                    socioeconomic: nivelSocioeconomico,
                    accessibility: accessScore,
                    security: indiceSeguridad
                },
                totalScore: parseFloat(stars.toFixed(1)),
                totalScoreRaw: totalScoreLegacy
            },
            rfPrediction: rfResult
        };
    }

    // --- UTILIDADES ---

    private async fetchCompetitors(center: LocationCoordinates, radiusMeters: number, category: string): Promise<any[]> {
        // Intenta usar INEGI (DENUE) primero porque es mejor en México
        try {
            const inegiData = await firstValueFrom(
                this.inegiService.getDenueBusinesses(center.lat, center.lng, radiusMeters, category)
            );
            if (inegiData && inegiData.length > 0) {
                // Normalizar datos de INEGI a formato {lat, lon}
                return inegiData.map((d: any) => ({ lat: parseFloat(d.Latitud), lon: parseFloat(d.Longitud), type: 'inegi' }));
            }
        } catch (e) {
            console.warn('INEGI falló, usando OSM fallback');
        }

        // Fallback a OSM
        const knownCategories = this.getCategories();
        if (!knownCategories.includes(category)) {
            return await this.osmService.searchByKeyword(center.lat, center.lng, radiusMeters, category);
        }

        const osmTag = this.mapCategoryToOsmTag(category);
        return await this.osmService.getNearbyPlaces(center.lat, center.lng, radiusMeters, osmTag.value, osmTag.key);
    }

    private categorizeInfrastructure(elements: any[]) {
        if (!elements) return { schools: [], hospitals: [], malls: [], transport: [], offices: [], mainRoads: [], residential: [], commercial: [], parking: [], nightlife: [] };
        return {
            schools: elements.filter(e => e.tags?.amenity === 'school' || e.tags?.amenity === 'university'),
            hospitals: elements.filter(e => e.tags?.amenity === 'hospital' || e.tags?.amenity === 'clinic'),
            malls: elements.filter(e => e.tags?.shop === 'mall' || e.tags?.shop === 'supermarket'),
            transport: elements.filter(e => e.tags?.highway === 'bus_stop' || e.tags?.public_transport),
            offices: elements.filter(e => e.tags?.office || e.tags?.building === 'office'),
            mainRoads: elements.filter(e => e.tags?.highway === 'primary' || e.tags?.highway === 'secondary' || e.tags?.highway === 'tertiary'),
            residential: elements.filter(e => e.tags?.landuse === 'residential' || e.tags?.highway === 'residential'),
            commercial: elements.filter(e => e.tags?.landuse === 'commercial' || e.tags?.landuse === 'retail'),
            parking: elements.filter(e => e.tags?.amenity === 'parking'),
            nightlife: elements.filter(e => e.tags?.amenity === 'bar' || e.tags?.amenity === 'pub' || e.tags?.amenity === 'nightclub')
        };
    }

    // --- FILTER OPTIMIZATION ---
    private filterByDistanceOptimized(items: any[], center: LocationCoordinates, radiusKm: number): any[] {
        if (!items || items.length === 0) return [];

        // 1. Quick Bounding Box Filter (Avoids expensive Math.sin/cos/atan2)
        // 1 degree lat ~= 111km. 0.01 deg ~= 1.1km. 
        // 0.5km is approx 0.005 degrees. Let's use 0.008 for safety.
        const SAFE_DEG = 0.01;
        const bounded = items.filter(item =>
            Math.abs(item.lat - center.lat) < SAFE_DEG &&
            Math.abs(item.lon - center.lng) < SAFE_DEG
        );

        // 2. Precise Filter on remaining items
        return bounded.filter(item => this.calculateDistance(center.lat, center.lng, item.lat, item.lon) <= radiusKm);
    }

    // --- HYBRID GENERATION STRATEGY ---
    private generateHybridCandidates(center: LocationCoordinates, radiusKm: number, infra: any): LocationCoordinates[] {
        const points: LocationCoordinates[] = [];

        // 1. Grid Points using Spiral Generation (Better than scanline for user perception)
        // or just ensure we don't break early.
        const area = Math.PI * radiusKm * radiusKm;
        const targetDensity = area / 200; // Less dense grid to ensure we cover the whole circle within limits
        const stepKm = Math.max(0.15, Math.sqrt(targetDensity));

        const R = 6371;
        const latRadius = (radiusKm / R) * (180 / Math.PI);
        const latStep = (stepKm / R) * (180 / Math.PI);

        // Generate Grid
        for (let lat = center.lat - latRadius; lat <= center.lat + latRadius; lat += latStep) {

            const lngRadius = (radiusKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
            const lngStep = (stepKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

            for (let lng = center.lng - lngRadius; lng <= center.lng + lngRadius; lng += lngStep) {
                if (this.calculateDistance(center.lat, center.lng, lat, lng) <= radiusKm) {
                    points.push({ lat, lng });
                }
            }
        }

        // Limit grid points if too many (taking random sample to avoid cutting off bottom half)
        if (points.length > 300) {
            // Shuffle to ensure random distribution if we slice
            for (let i = points.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [points[i], points[j]] = [points[j], points[i]];
            }
            points.splice(300); // Keep max 300 grid points
        }


        // 2. Hot-Spot Injection
        const hotspots = [
            ...infra.malls,
            ...infra.hospitals,
            ...infra.schools,
            ...infra.transport,
            ...infra.commercial,
            ...infra.residential // Include residential streets/zones as hotspots
        ];

        // Add Hotspots (up to 100)
        const selectedHotspots = hotspots.sort(() => 0.5 - Math.random()).slice(0, 100);
        for (const h of selectedHotspots) {
            // Basic validity check
            if (h.lat && h.lon && this.calculateDistance(center.lat, center.lng, h.lat, h.lon) <= radiusKm) {
                points.push({ lat: h.lat, lng: h.lon });
            }
        }

        return points;
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private inferZoneType(point: LocationCoordinates, residential: any[], commercial: any[]): 'Comercial' | 'Residencial' | 'Mixta' | 'Industrial' {
        // Simplified inference for speed inside loop
        const nearbyRes = this.filterByDistanceOptimized(residential, point, 0.3).length;
        const nearbyCom = this.filterByDistanceOptimized(commercial, point, 0.3).length;
        if (nearbyCom > nearbyRes) return 'Comercial';
        if (nearbyRes > nearbyCom) return 'Residencial';
        return 'Mixta';
    }

    private inferActiveHours(schools: any[], offices: any[], nightlife: any[], malls: any[], hospitals: any[]): 'Mañana' | 'Tarde' | 'Noche' | 'Todo el día' | 'Desconocido' {
        if (hospitals.length > 0) return 'Todo el día';
        if (nightlife.length > 1) return 'Noche';
        if (malls.length > 0) return 'Todo el día';
        if (offices.length > 1) return 'Mañana'; // Laboral suele empezar mañana/tarde
        if (schools.length > 0) return 'Mañana';
        return 'Tarde'; // Default
    }

    private mapCategoryToOsmTag(category: string): { value: string, key?: string } {
        const mapping: { [key: string]: { value: string, key?: string } } = {
            'Alimentos y bebidas': { value: 'restaurant', key: 'amenity' },
            'Arte': { value: 'art', key: 'shop' },
            'Barberia': { value: 'hairdresser', key: 'shop' },
            'Belleza': { value: 'beauty', key: 'shop' },
            'Construccion': { value: 'trade', key: 'shop' },
            'Contratistas': { value: 'trade', key: 'shop' },
            'Cortes de Cabello': { value: 'hairdresser', key: 'shop' },
            'Costureria': { value: 'tailor', key: 'shop' },
            'Cuidado': { value: 'clinic', key: 'amenity' },
            'Educacion': { value: 'school', key: 'amenity' },
            'Eventos y Entretenimeinto': { value: 'theatre', key: 'amenity' },
            'Fitness': { value: 'fitness_centre', key: 'leisure' },
            'Hogar y Jardineria': { value: 'garden_centre', key: 'shop' },
            'Infantes': { value: 'kindergarten', key: 'amenity' },
            'Ingenieria': { value: 'architect', key: 'office' },
            'Legal y Financiero': { value: 'lawyer', key: 'office' },
            'Limpieza': { value: 'laundry', key: 'shop' },
            'Mascotas': { value: 'pet', key: 'shop' },
            'Negocios': { value: 'company', key: 'office' },
            'Reciclaje': { value: 'recycling', key: 'amenity' },
            'Regalos': { value: 'gift', key: 'shop' },
            'Restaurantes': { value: 'restaurant', key: 'amenity' },
            'Ropa': { value: 'clothes', key: 'shop' },
            'Salud y Medicina': { value: 'clinic', key: 'amenity' },
            'Servicios IT': { value: 'it', key: 'office' },
            'Servicios Vehiculares': { value: 'car_repair', key: 'shop' },
            'Servivios Electronicos': { value: 'electronics', key: 'shop' },
            'Tatuajes y Piercings': { value: 'tattoo', key: 'shop' },
            'Tienda Abarrotes': { value: 'convenience', key: 'shop' },
            'Viajes y Transportistas': { value: 'travel_agency', key: 'shop' }
        };
        return mapping[category] || { value: 'shop' };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}