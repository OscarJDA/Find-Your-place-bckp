import { Injectable } from '@angular/core';

/**
 * ═══════════════════════════════════════════════════════════════
 *  RANDOM FOREST REGRESSOR - Implementación en TypeScript Puro
 * ═══════════════════════════════════════════════════════════════
 *
 *  Modelo Formal de IA:
 *    f(x) = Score de Viabilidad Comercial
 *
 *  Variables (features):
 *    x1: Flujo peatonal         (Continua, 0-100)
 *    x2: Flujo vehicular        (Continua, 0-100)
 *    x3: Número de competidores (Discreta, 0-20+)
 *    x4: Nivel socioeconómico   (Continua, 0-100)
 *    x5: Índice de seguridad    (Continua, 0-100)
 *    x6: Densidad poblacional   (Continua, 0-100)
 *    x7: Renta promedio         (Continua, 0-100)
 *
 *  Modelo Matemático:
 *    f̂(x) = (1/T) Σ h_t(x)   donde h_t(x) es un árbol de decisión t
 *
 *  Cada árbol minimiza:
 *    MSE = (1/n) Σ (y_i − ŷ_i)²
 *
 * ═══════════════════════════════════════════════════════════════
 */

// --- Interfaces ---

export interface RFFeatureVector {
    flujoPeatonal: number;      // x1: 0-100
    flujoVehicular: number;     // x2: 0-100
    numCompetidores: number;    // x3: 0-20+
    nivelSocioeconomico: number;// x4: 0-100
    indiceSeguridad: number;    // x5: 0-100
    densidadPoblacional: number;// x6: 0-100
    rentaPromedio: number;      // x7: 0-100
}

export interface RFPredictionResult {
    score: number;              // 0-5 (score de viabilidad)
    confidence: number;         // 0-1 (nivel de confianza)
    treeVotes: number[];        // Predicción individual de cada árbol
    featureImportance: { [key: string]: number }; // Importancia de cada variable
    modelInfo: {
        numTrees: number;
        maxDepth: number;
        trainingSamples: number;
        mse: number;            // Error cuadrático medio en entrenamiento
        oobScore: number;       // Out-of-Bag score
    };
}

interface TreeNode {
    featureIndex?: number;
    threshold?: number;
    left?: TreeNode;
    right?: TreeNode;
    value?: number; // Leaf value (prediction)
}

interface TrainingSample {
    features: number[];
    target: number; // 0-5
}

// --- Servicio ---

@Injectable({
    providedIn: 'root'
})
export class RandomForestService {

    private forest: TreeNode[] = [];
    private readonly NUM_TREES = 50;           // T = 50 árboles
    private readonly MAX_DEPTH = 8;            // Profundidad máxima de cada árbol
    private readonly MIN_SAMPLES_SPLIT = 5;    // Mínimo de muestras para dividir
    private readonly MAX_FEATURES_RATIO = 0.7; // √n / n ratio para subselección de features
    private readonly BOOTSTRAP_RATIO = 0.8;    // Proporción de muestras para bootstrap

    private trainingData: TrainingSample[] = [];
    private featureNames = [
        'flujoPeatonal', 'flujoVehicular', 'numCompetidores',
        'nivelSocioeconomico', 'indiceSeguridad', 'densidadPoblacional', 'rentaPromedio'
    ];
    private featureImportances: number[] = new Array(7).fill(0);
    private oobScore = 0;
    private trainMSE = 0;
    private isModelTrained = false;

    constructor() {
        this.initializeTrainingData();
        this.trainForest();
    }

    // ═══════════════════════════════════════════════
    //  DATOS DE ENTRENAMIENTO SINTÉTICOS
    //  Generados con conocimiento experto del dominio
    // ═══════════════════════════════════════════════
    private initializeTrainingData() {
        this.trainingData = [
            // ══════════ ESCENARIOS DE ALTA VIABILIDAD (4.0 - 5.0) ══════════
            // Alto flujo, baja competencia, buena zona
            { features: [90, 85, 1, 80, 85, 75, 80], target: 4.8 },
            { features: [85, 80, 0, 85, 90, 70, 85], target: 5.0 },
            { features: [95, 90, 2, 75, 80, 80, 75], target: 4.6 },
            { features: [80, 75, 1, 90, 85, 65, 90], target: 4.7 },
            { features: [88, 82, 0, 82, 88, 72, 82], target: 4.9 },
            { features: [75, 85, 2, 85, 75, 80, 85], target: 4.4 },
            { features: [92, 88, 1, 78, 82, 85, 78], target: 4.7 },
            { features: [82, 78, 0, 88, 92, 68, 88], target: 4.8 },
            { features: [85, 90, 1, 80, 78, 75, 80], target: 4.5 },
            { features: [90, 80, 2, 85, 85, 78, 85], target: 4.5 },
            { features: [78, 82, 0, 92, 88, 70, 92], target: 4.6 },
            { features: [88, 85, 1, 75, 80, 82, 78], target: 4.5 },
            { features: [95, 92, 0, 88, 90, 85, 88], target: 5.0 },
            { features: [80, 88, 1, 82, 85, 72, 85], target: 4.4 },
            { features: [85, 82, 2, 78, 82, 78, 80], target: 4.3 },

            // ══════════ ESCENARIOS BUENOS (3.5 - 4.0) ══════════
            { features: [70, 65, 3, 70, 75, 60, 70], target: 3.8 },
            { features: [75, 70, 4, 65, 70, 65, 65], target: 3.6 },
            { features: [65, 75, 2, 75, 65, 70, 75], target: 3.9 },
            { features: [80, 60, 4, 60, 70, 55, 60], target: 3.5 },
            { features: [60, 70, 3, 80, 70, 60, 80], target: 3.7 },
            { features: [72, 68, 3, 72, 72, 62, 72], target: 3.8 },
            { features: [68, 72, 2, 68, 68, 68, 68], target: 3.9 },
            { features: [75, 65, 4, 70, 65, 58, 65], target: 3.5 },
            { features: [65, 60, 2, 78, 75, 55, 78], target: 3.8 },
            { features: [70, 75, 3, 65, 72, 65, 65], target: 3.7 },
            { features: [78, 72, 3, 72, 68, 70, 70], target: 3.8 },
            { features: [62, 68, 2, 75, 78, 58, 75], target: 3.9 },
            { features: [72, 62, 4, 68, 72, 62, 68], target: 3.5 },
            { features: [68, 78, 3, 72, 65, 68, 72], target: 3.7 },

            // ══════════ ESCENARIOS MEDIOS (2.5 - 3.5) ══════════
            { features: [50, 55, 5, 55, 60, 50, 55], target: 3.0 },
            { features: [55, 50, 6, 50, 55, 55, 50], target: 2.8 },
            { features: [60, 45, 5, 60, 50, 45, 60], target: 3.1 },
            { features: [45, 60, 4, 45, 65, 50, 50], target: 3.2 },
            { features: [50, 50, 7, 55, 55, 55, 55], target: 2.6 },
            { features: [40, 55, 3, 65, 60, 40, 65], target: 3.3 },
            { features: [55, 45, 6, 50, 50, 50, 50], target: 2.7 },
            { features: [48, 52, 5, 52, 58, 48, 55], target: 3.0 },
            { features: [52, 48, 4, 58, 52, 52, 58], target: 3.2 },
            { features: [58, 55, 6, 48, 55, 55, 48], target: 2.8 },
            { features: [45, 50, 5, 55, 60, 45, 55], target: 3.0 },
            { features: [55, 42, 7, 52, 48, 52, 52], target: 2.5 },
            { features: [42, 58, 4, 60, 55, 42, 60], target: 3.2 },
            { features: [50, 48, 6, 48, 52, 48, 50], target: 2.7 },

            // ══════════ ESCENARIOS BAJOS (1.5 - 2.5) ══════════
            { features: [30, 35, 8, 40, 35, 35, 40], target: 2.0 },
            { features: [35, 30, 10, 35, 40, 30, 35], target: 1.8 },
            { features: [25, 40, 7, 45, 30, 40, 45], target: 2.2 },
            { features: [40, 25, 9, 30, 40, 25, 30], target: 1.9 },
            { features: [20, 30, 6, 50, 35, 30, 50], target: 2.4 },
            { features: [35, 28, 8, 38, 38, 32, 38], target: 2.0 },
            { features: [28, 35, 9, 42, 32, 35, 42], target: 2.1 },
            { features: [32, 32, 10, 35, 35, 28, 35], target: 1.8 },
            { features: [38, 25, 7, 48, 40, 25, 48], target: 2.3 },
            { features: [25, 38, 8, 35, 28, 38, 35], target: 2.0 },
            { features: [30, 30, 11, 38, 32, 30, 38], target: 1.7 },
            { features: [22, 35, 6, 42, 38, 32, 45], target: 2.3 },

            // ══════════ ESCENARIOS MUY BAJOS (1.0 - 1.5) ══════════
            { features: [15, 20, 12, 25, 20, 20, 25], target: 1.2 },
            { features: [10, 15, 15, 20, 15, 15, 20], target: 1.0 },
            { features: [20, 10, 14, 15, 25, 10, 15], target: 1.1 },
            { features: [5, 25, 10, 30, 10, 25, 30], target: 1.4 },
            { features: [25, 5, 12, 10, 20, 5, 10], target: 1.0 },
            { features: [12, 18, 13, 22, 18, 18, 22], target: 1.2 },
            { features: [18, 12, 11, 18, 22, 12, 18], target: 1.3 },
            { features: [8, 15, 14, 25, 15, 15, 25], target: 1.1 },

            // ══════════ ESCENARIOS EDGE CASES ══════════
            // Alta competencia pero buena ubicación
            { features: [90, 85, 12, 80, 85, 75, 80], target: 2.8 },
            { features: [85, 80, 15, 75, 80, 70, 75], target: 2.2 },
            // Baja competencia pero mala ubicación
            { features: [20, 25, 0, 30, 25, 25, 30], target: 2.5 },
            { features: [15, 20, 1, 25, 20, 20, 25], target: 2.2 },
            // Buena seguridad compensa
            { features: [50, 50, 5, 50, 95, 50, 50], target: 3.5 },
            { features: [45, 45, 6, 45, 90, 45, 45], target: 3.2 },
            // Alta renta but everything else poor
            { features: [20, 20, 8, 20, 20, 20, 95], target: 2.0 },
            // Alta densidad poblacional compensa
            { features: [40, 40, 4, 40, 40, 95, 40], target: 3.3 },
            { features: [35, 35, 5, 35, 35, 90, 35], target: 3.0 },
            // Todo promedio
            { features: [50, 50, 5, 50, 50, 50, 50], target: 3.0 },
            { features: [55, 55, 4, 55, 55, 55, 55], target: 3.2 },
            { features: [45, 45, 6, 45, 45, 45, 45], target: 2.7 },
            // Zonas premium
            { features: [70, 60, 0, 95, 90, 55, 95], target: 4.8 },
            { features: [60, 50, 1, 90, 85, 50, 90], target: 4.3 },

            // ══════════ MÁS VARIEDAD PARA ROBUSTEZ ══════════
            { features: [72, 58, 3, 62, 68, 55, 65], target: 3.6 },
            { features: [58, 72, 2, 68, 62, 65, 68], target: 3.8 },
            { features: [82, 75, 5, 72, 78, 70, 72], target: 3.8 },
            { features: [65, 55, 4, 58, 65, 52, 58], target: 3.3 },
            { features: [55, 65, 3, 72, 58, 62, 72], target: 3.6 },
            { features: [78, 68, 6, 65, 72, 68, 65], target: 3.4 },
            { features: [42, 38, 7, 42, 45, 38, 42], target: 2.4 },
            { features: [38, 42, 8, 38, 42, 42, 38], target: 2.2 },
            { features: [88, 92, 1, 82, 88, 82, 82], target: 4.7 },
            { features: [92, 85, 0, 90, 82, 78, 90], target: 4.9 },
            { features: [32, 28, 9, 32, 32, 28, 32], target: 1.8 },
            { features: [28, 32, 10, 28, 28, 32, 28], target: 1.6 },
        ];
    }

    // ═══════════════════════════════════════════════
    //  ENTRENAMIENTO DEL BOSQUE ALEATORIO
    //  f̂(x) = (1/T) Σ h_t(x)
    // ═══════════════════════════════════════════════
    private trainForest() {
        console.log(`🌲 Entrenando Random Forest con ${this.NUM_TREES} árboles y ${this.trainingData.length} muestras...`);

        this.forest = [];
        const oobPredictions: Map<number, number[]> = new Map();
        const totalFeatureImportance = new Array(7).fill(0);

        for (let t = 0; t < this.NUM_TREES; t++) {
            // Bootstrap sampling (bagging)
            const { bootstrapSamples, oobIndices } = this.bootstrapSample(this.trainingData);

            // Selección aleatoria de features (√n features por defecto)
            const numFeatures = Math.max(2, Math.ceil(Math.sqrt(7)));

            // Entrenar un árbol de decisión
            const tree = this.buildTree(bootstrapSamples, 0, numFeatures);
            this.forest.push(tree);

            // Calcular predicciones OOB (Out-of-Bag) para estimar error
            for (const oobIdx of oobIndices) {
                const sample = this.trainingData[oobIdx];
                const prediction = this.predictSingleTree(tree, sample.features);
                if (!oobPredictions.has(oobIdx)) {
                    oobPredictions.set(oobIdx, []);
                }
                oobPredictions.get(oobIdx)!.push(prediction);
            }
        }

        // Calcular OOB Score (R² score)
        this.calculateOOBScore(oobPredictions);

        // Calcular Feature Importances usando permutation importance
        this.calculateFeatureImportances();

        // Calcular MSE en datos de entrenamiento
        this.calculateTrainMSE();

        this.isModelTrained = true;
        console.log(`✅ Random Forest entrenado | OOB R²: ${this.oobScore.toFixed(4)} | Train MSE: ${this.trainMSE.toFixed(4)}`);
        console.log('📊 Feature Importances:', this.featureNames.map((n, i) =>
            `${n}: ${(this.featureImportances[i] * 100).toFixed(1)}%`
        ).join(', '));
    }

    // ═══════════════════════════════════════════════
    //  CONSTRUCCIÓN DE UN ÁRBOL DE DECISIÓN
    //  Minimiza MSE = (1/n) Σ (y_i − ŷ_i)²
    // ═══════════════════════════════════════════════
    private buildTree(data: TrainingSample[], depth: number, maxFeatures: number): TreeNode {
        // Condiciones de parada
        if (data.length < this.MIN_SAMPLES_SPLIT || depth >= this.MAX_DEPTH) {
            return { value: this.meanTarget(data) };
        }

        // Verificar si todos los targets son iguales
        const uniqueTargets = new Set(data.map(d => d.target));
        if (uniqueTargets.size === 1) {
            return { value: data[0].target };
        }

        // Selección aleatoria de features (para diversidad entre árboles)
        const featureIndices = this.randomFeatureSubset(7, maxFeatures);

        let bestFeature = -1;
        let bestThreshold = 0;
        let bestMSE = Infinity;
        let bestLeft: TrainingSample[] = [];
        let bestRight: TrainingSample[] = [];

        for (const featureIdx of featureIndices) {
            // Obtener valores únicos para thresholds candidatos
            const values = [...new Set(data.map(d => d.features[featureIdx]))].sort((a, b) => a - b);

            // Usar puntos medios como thresholds candidatos
            for (let v = 0; v < values.length - 1; v++) {
                const threshold = (values[v] + values[v + 1]) / 2;

                const left = data.filter(d => d.features[featureIdx] <= threshold);
                const right = data.filter(d => d.features[featureIdx] > threshold);

                if (left.length === 0 || right.length === 0) continue;

                // Calcular MSE ponderado
                const mse = this.weightedMSE(left, right);

                if (mse < bestMSE) {
                    bestMSE = mse;
                    bestFeature = featureIdx;
                    bestThreshold = threshold;
                    bestLeft = left;
                    bestRight = right;
                }
            }
        }

        // Si no se encontró una división válida, retornar nodo hoja
        if (bestFeature === -1) {
            return { value: this.meanTarget(data) };
        }

        return {
            featureIndex: bestFeature,
            threshold: bestThreshold,
            left: this.buildTree(bestLeft, depth + 1, maxFeatures),
            right: this.buildTree(bestRight, depth + 1, maxFeatures)
        };
    }

    // ═══════════════════════════════════════════════
    //  PREDICCIÓN CON EL BOSQUE COMPLETO
    //  f̂(x) = (1/T) Σ h_t(x)
    // ═══════════════════════════════════════════════
    predict(features: RFFeatureVector): RFPredictionResult {
        if (!this.isModelTrained) {
            console.warn('⚠️ El modelo Random Forest no ha sido entrenado aún.');
            return this.getDefaultPrediction();
        }

        const featureArray = this.vectorToArray(features);
        const treeVotes: number[] = [];

        // Obtener predicción de cada árbol
        for (const tree of this.forest) {
            const prediction = this.predictSingleTree(tree, featureArray);
            treeVotes.push(prediction);
        }

        // f̂(x) = (1/T) Σ h_t(x)
        const rawScore = treeVotes.reduce((sum, v) => sum + v, 0) / treeVotes.length;

        // Clamp a rango [1.0, 5.0]
        const score = Math.min(5.0, Math.max(1.0, parseFloat(rawScore.toFixed(2))));

        // Calcular confianza basada en la varianza entre árboles
        const variance = this.calculateVariance(treeVotes);
        const maxVariance = 2.0; // Varianza máxima esperada
        const confidence = Math.max(0, Math.min(1, 1 - (variance / maxVariance)));

        // Feature importance map
        const featureImportance: { [key: string]: number } = {};
        this.featureNames.forEach((name, idx) => {
            featureImportance[name] = parseFloat(this.featureImportances[idx].toFixed(4));
        });

        return {
            score,
            confidence: parseFloat(confidence.toFixed(3)),
            treeVotes,
            featureImportance,
            modelInfo: {
                numTrees: this.NUM_TREES,
                maxDepth: this.MAX_DEPTH,
                trainingSamples: this.trainingData.length,
                mse: parseFloat(this.trainMSE.toFixed(4)),
                oobScore: parseFloat(this.oobScore.toFixed(4))
            }
        };
    }

    // ═══════════════════════════════════════════════
    //  PREDICCIÓN EN UN SOLO ÁRBOL
    // ═══════════════════════════════════════════════
    private predictSingleTree(node: TreeNode, features: number[]): number {
        // Si es nodo hoja, retornar el valor
        if (node.value !== undefined) {
            return node.value;
        }

        // Navegar por el árbol según el threshold
        if (features[node.featureIndex!] <= node.threshold!) {
            return this.predictSingleTree(node.left!, features);
        } else {
            return this.predictSingleTree(node.right!, features);
        }
    }

    // ═══════════════════════════════════════════════
    //  UTILIDADES ESTADÍSTICAS
    // ═══════════════════════════════════════════════

    private meanTarget(data: TrainingSample[]): number {
        if (data.length === 0) return 3.0;
        return data.reduce((sum, d) => sum + d.target, 0) / data.length;
    }

    private calculateMSE(data: TrainingSample[]): number {
        if (data.length === 0) return 0;
        const mean = this.meanTarget(data);
        return data.reduce((sum, d) => sum + Math.pow(d.target - mean, 2), 0) / data.length;
    }

    private weightedMSE(left: TrainingSample[], right: TrainingSample[]): number {
        const total = left.length + right.length;
        return (left.length / total) * this.calculateMSE(left) +
            (right.length / total) * this.calculateMSE(right);
    }

    private calculateVariance(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        return values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    }

    private bootstrapSample(data: TrainingSample[]): { bootstrapSamples: TrainingSample[], oobIndices: number[] } {
        const n = data.length;
        const sampleSize = Math.ceil(n * this.BOOTSTRAP_RATIO);
        const usedIndices = new Set<number>();
        const bootstrapSamples: TrainingSample[] = [];

        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(Math.random() * n);
            bootstrapSamples.push(data[idx]);
            usedIndices.add(idx);
        }

        // OOB = índices que NO fueron seleccionados
        const oobIndices: number[] = [];
        for (let i = 0; i < n; i++) {
            if (!usedIndices.has(i)) {
                oobIndices.push(i);
            }
        }

        return { bootstrapSamples, oobIndices };
    }

    private randomFeatureSubset(totalFeatures: number, subsetSize: number): number[] {
        const indices = Array.from({ length: totalFeatures }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, subsetSize);
    }

    private calculateOOBScore(oobPredictions: Map<number, number[]>) {
        let ssRes = 0;
        let ssTot = 0;
        let count = 0;

        const meanTarget = this.trainingData.reduce((s, d) => s + d.target, 0) / this.trainingData.length;

        oobPredictions.forEach((predictions, idx) => {
            const avgPred = predictions.reduce((s, v) => s + v, 0) / predictions.length;
            const actual = this.trainingData[idx].target;
            ssRes += Math.pow(actual - avgPred, 2);
            ssTot += Math.pow(actual - meanTarget, 2);
            count++;
        });

        this.oobScore = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    }

    private calculateFeatureImportances() {
        // Permutation Feature Importance
        // Medir cuánto empeora el MSE al permutar cada feature
        const baseMSE = this.evaluateForestMSE(this.trainingData);
        const importances = new Array(7).fill(0);

        for (let f = 0; f < 7; f++) {
            // Crear copia con feature f permutada
            const permutedData = this.trainingData.map(d => ({
                features: [...d.features],
                target: d.target
            }));

            // Permutar feature f (Fisher-Yates en los valores de esa feature)
            const featureValues = permutedData.map(d => d.features[f]);
            for (let i = featureValues.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [featureValues[i], featureValues[j]] = [featureValues[j], featureValues[i]];
            }
            permutedData.forEach((d, idx) => d.features[f] = featureValues[idx]);

            const permutedMSE = this.evaluateForestMSE(permutedData);
            importances[f] = Math.max(0, permutedMSE - baseMSE);
        }

        // Normalizar a que sumen 1
        const totalImportance = importances.reduce((s: number, v: number) => s + v, 0);
        if (totalImportance > 0) {
            this.featureImportances = importances.map((v: number) => v / totalImportance);
        } else {
            this.featureImportances = new Array(7).fill(1 / 7);
        }
    }

    private evaluateForestMSE(data: TrainingSample[]): number {
        let totalMSE = 0;
        for (const sample of data) {
            const predictions = this.forest.map(tree => this.predictSingleTree(tree, sample.features));
            const avgPred = predictions.reduce((s, v) => s + v, 0) / predictions.length;
            totalMSE += Math.pow(sample.target - avgPred, 2);
        }
        return totalMSE / data.length;
    }

    private calculateTrainMSE() {
        this.trainMSE = this.evaluateForestMSE(this.trainingData);
    }

    private vectorToArray(features: RFFeatureVector): number[] {
        return [
            features.flujoPeatonal,
            features.flujoVehicular,
            features.numCompetidores,
            features.nivelSocioeconomico,
            features.indiceSeguridad,
            features.densidadPoblacional,
            features.rentaPromedio
        ];
    }

    private getDefaultPrediction(): RFPredictionResult {
        return {
            score: 3.0,
            confidence: 0,
            treeVotes: [],
            featureImportance: {},
            modelInfo: {
                numTrees: 0,
                maxDepth: 0,
                trainingSamples: 0,
                mse: 0,
                oobScore: 0
            }
        };
    }

    // ═══════════════════════════════════════════════
    //  API PÚBLICA PARA OBTENER INFO DEL MODELO
    // ═══════════════════════════════════════════════

    getModelInfo() {
        return {
            algorithm: 'Random Forest Regressor',
            formula: 'f̂(x) = (1/T) Σ h_t(x)',
            lossFn: 'MSE = (1/n) Σ (y_i − ŷ_i)²',
            numTrees: this.NUM_TREES,
            maxDepth: this.MAX_DEPTH,
            trainingSamples: this.trainingData.length,
            features: this.featureNames,
            oobScore: this.oobScore,
            trainMSE: this.trainMSE,
            featureImportances: Object.fromEntries(
                this.featureNames.map((name, i) => [name, this.featureImportances[i]])
            )
        };
    }

    isReady(): boolean {
        return this.isModelTrained;
    }
}
