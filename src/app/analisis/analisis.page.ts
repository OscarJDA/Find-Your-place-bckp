import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, Platform, ToastController } from '@ionic/angular';
import { jsPDF } from 'jspdf';
import { BusinessAnalysisService } from '../services/business-analysis.service';
import { environment } from 'src/environments/environment';

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

@Component({
    selector: 'app-analisis',
    templateUrl: './analisis.page.html',
    styleUrls: ['./analisis.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, FormsModule]
})
export class AnalisisPage implements OnInit {

    savedLocations: any[] = [];
    selectedLocation: any = null;
    isComparingMode: boolean = false;
    selectedForCompare: any[] = [];
    comparingLocations: any[] = [];

    constructor(
        private analysisService: BusinessAnalysisService,
        private platform: Platform,
        private toastController: ToastController
    ) { }

    ngOnInit() {
        this.savedLocations = this.analysisService.getSavedLocations();
    }

    selectLocation(location: any) {
        this.selectedLocation = location;
    }

    clearSelection() {
        this.selectedLocation = null;
    }

    toggleCompareMode() {
        this.isComparingMode = !this.isComparingMode;
        this.selectedForCompare = [];
        this.comparingLocations = [];
    }

    async handleCardClick(location: any) {
        if (this.isComparingMode) {
            const index = this.selectedForCompare.findIndex(l => l === location);
            if (index > -1) {
                this.selectedForCompare.splice(index, 1);
            } else {
                if (this.selectedForCompare.length < 3) {
                    this.selectedForCompare.push(location);
                } else {
                    const toast = await this.toastController.create({
                        message: 'Puedes seleccionar un máximo de 3 ubicaciones.',
                        duration: 2000,
                        position: 'bottom',
                        color: 'warning'
                    });
                    toast.present();
                }
            }
        } else {
            this.selectLocation(location);
        }
    }

    isSelected(location: any): boolean {
        return this.selectedForCompare.includes(location);
    }

    startComparison() {
        if (this.selectedForCompare.length >= 2 && this.selectedForCompare.length <= 3) {
            this.comparingLocations = [...this.selectedForCompare];
        }
    }

    clearComparison() {
        this.comparingLocations = [];
    }

    getStaticMapUrl(): string {
        if (!this.selectedLocation || !this.selectedLocation.recommendation || !this.selectedLocation.recommendation.coords) return '';
        const lat = this.selectedLocation.recommendation.coords.lat;
        const lng = this.selectedLocation.recommendation.coords.lng;
        const token = environment.apiKeys.mapbox;
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+ea4335(${lng},${lat})/${lng},${lat},15,0/600x300?access_token=${token}`;
    }

    getCardMapUrl(lat: number, lng: number): string {
        const token = environment.apiKeys.mapbox;
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lng},${lat},13,0/160x160@2x?access_token=${token}`;
    }

    getBadgeClass(score: number): string {
        const percent = (score / 5) * 100;
        if (percent >= 80) return 'badge-success';
        if (percent >= 50) return 'badge-warning';
        return 'badge-danger';
    }

    getBadgeText(score: number): string {
        const percent = (score / 5) * 100;
        if (percent >= 80) return Math.round(percent) + '% VIABLE';
        if (percent >= 50) return 'EN REVISIÓN';
        return 'NO VIABLE';
    }

    getScoreColor(score: number): string {
        const percent = (score / 5) * 100;
        if (percent >= 80) return '#22c55e'; // Green
        if (percent >= 50) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    getScoreColorText(score: number): string {
        const percent = (score / 5) * 100;
        if (percent >= 80) return '#16a34a'; // Darker Green
        if (percent >= 50) return '#d97706'; // Darker Yellow
        return '#dc2626'; // Darker Red
    }

    getRecommended(): any {
        if (!this.comparingLocations || this.comparingLocations.length === 0) return null;
        let best = this.comparingLocations[0];
        for (let loc of this.comparingLocations) {
            if (loc.recommendation.score > best.recommendation.score) {
                best = loc;
            }
        }
        return best;
    }


    async getBase64ImageFromUrl(imageUrl: string): Promise<string> {
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('Error fetching image', e);
            return '';
        }
    }

    generateFODA(loc: any, category: string) {
        const foda = { f: [] as string[], o: [] as string[], d: [] as string[], a: [] as string[] };

        if (loc.details?.traffic >= 80) foda.f.push('Alto flujo peatonal/vehicular que asegura visibilidad.');
        else if (loc.details?.traffic >= 60) foda.f.push('Flujo peatonal adecuado para la operación del negocio.');
        if (loc.details?.security >= 80) foda.f.push('Zona con altos índices de seguridad.');
        if (loc.details?.accessibility >= 80) foda.f.push('Excelente accesibilidad y conectividad en la zona.');

        if (loc.saturationLevel === 'Oportunidad' || loc.saturationLevel === 'Muy pocos') foda.o.push(`Mercado desatendido o con baja penetración para ${category}.`);
        if (loc.details?.socioeconomic > 60) foda.o.push('Poder adquisitivo favorable en el entorno, posibilitando mayor margen.');

        if (loc.details?.accessibility < 50) foda.d.push('Accesibilidad limitada, lo que podría dificultar la llegada de clientes.');
        if (loc.details?.traffic < 50) foda.d.push('Flujo de personas por debajo del promedio, se requerirá más gasto en marketing.');

        if (loc.saturationLevel === 'Saturado') foda.a.push('Alta saturación de competidores directos en la zona, riesgo de guerra de precios.');
        if (loc.details?.security < 50) foda.a.push('Riesgos de seguridad considerables en el área que pueden afectar la operación.');
        if (loc.details?.competition >= 80) foda.a.push('Alta densidad competitiva cercana.');

        if (foda.f.length === 0) foda.f.push('Ubicación con viabilidad base aceptable.');
        if (foda.o.length === 0) foda.o.push('Posibilidad de consolidar oferta en el sector.');
        if (foda.d.length === 0) foda.d.push('No se detectaron debilidades críticas inmediatas.');
        if (foda.a.length === 0) foda.a.push('Márgenes de amenaza externa controlables.');

        return foda;
    }

    async exportToPDF() {
        if (!this.selectedLocation) return;

        try {
            const loc = this.selectedLocation.recommendation;
            const cat = this.selectedLocation.category || 'Negocio';
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            let y = margin;

            const addText = (txt: string, size: number, bold: boolean, align: 'left' | 'center' | 'right' | 'justify' = 'left', spacing = 5, color = [0, 0, 0]) => {
                doc.setFontSize(size);
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setTextColor(color[0], color[1], color[2]);
                const lines = doc.splitTextToSize(txt, pageWidth - margin * 2);
                lines.forEach((line: string) => {
                    if (y > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, align === 'center' ? pageWidth / 2 : (align === 'right' ? pageWidth - margin : margin), y, { align });
                    y += spacing;
                });
            };

            // Header Section
            addText(`Reporte de Viabilidad Analítica: ${cat.toUpperCase()}`, 18, true, 'center', 8, [0, 51, 102]);
            addText('Documento Formal Científico de Ubicación Geográfica', 12, false, 'center', 15, [100, 100, 100]);

            // Date and Address
            addText(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 10, false, 'right');
            addText(`ID de Referencia: ${loc.id?.substring(0, 8).toUpperCase() || 'N/A'}`, 10, false, 'right', 10);

            addText('UBICACIÓN EJE', 12, true, 'left', 6);
            addText(`${loc.address}`, 10, false, 'left', 12);

            // Fetch Map Image
            const mapUrl = this.getStaticMapUrl();
            if (mapUrl) {
                const img64 = await this.getBase64ImageFromUrl(mapUrl);
                if (img64 && y < pageHeight - 80) {
                    doc.addImage(img64, 'JPEG', margin, y, pageWidth - margin * 2, 80);
                    y += 85;
                }
            }

            if (y > pageHeight - 40) { doc.addPage(); y = margin; }

            // Results summary
            addText('I. ÍNDICE DE VIABILIDAD TÉCNICA Y COMPETITIVA', 14, true, 'left', 8, [0, 51, 102]);
            const scorePercent = ((loc.score || loc.totalScore || 0) / 5) * 100;

            addText(`Nivel de Viabilidad Global Calculada: ${scorePercent.toFixed(2)}% (${this.getBadgeText(loc.score || loc.totalScore)})`, 12, true, 'left', 6);
            addText(`Estado de Saturación del Mercado Sectorial: ${loc.saturationLevel}`, 11, false, 'left', 6);
            addText(`Competidores Registrados en Radio Efectivo: ${loc.competitorsCount}`, 11, false, 'left', 10);

            addText('Desglose de Factores Paramétricos (Sobre 100):', 11, true, 'left', 6);
            addText(`- Densidad de Flujo Peatonal/Vehicular: ${(loc.details?.traffic || 0).toFixed(1)}`, 10, false);
            addText(`- Capacidad Competitiva del Entorno: ${(100 - (loc.details?.competition || 0)).toFixed(1)} (Menor índice de competición es mejor)`, 10, false);
            addText(`- Índice de Capacidad Socioeconómica: ${(loc.details?.socioeconomic || 0).toFixed(1)}`, 10, false);
            addText(`- Evaluación de Accesibilidad Física: ${(loc.details?.accessibility || 0).toFixed(1)}`, 10, false);
            addText(`- Índice Integrado de Seguridad: ${(loc.details?.security || 0).toFixed(1)}`, 10, false, 'left', 12);

            if (y > pageHeight - 60) { doc.addPage(); y = margin; }

            // FODA
            addText('II. MATRIZ FODA AUTOMATIZADA', 14, true, 'left', 8, [0, 51, 102]);
            const foda = this.generateFODA(loc, cat);

            addText('FORTALEZAS INTERNAS/ESTRATÉGICAS', 11, true, 'left', 5, [34, 139, 34]);
            foda.f.forEach(f => addText('• ' + f, 10, false, 'left', 5));
            y += 3;
            addText('OPORTUNIDADES DE MERCADO EXTERNO', 11, true, 'left', 5, [218, 165, 32]);
            foda.o.forEach(o => addText('• ' + o, 10, false, 'left', 5));
            y += 3;
            addText('DEBILIDADES DEL ENTORNO GEOGRÁFICO', 11, true, 'left', 5, [255, 140, 0]);
            foda.d.forEach(d => addText('• ' + d, 10, false, 'left', 5));
            y += 3;
            addText('AMENAZAS COMPETITIVAS LATENTES', 11, true, 'left', 5, [220, 20, 60]);
            foda.a.forEach(a => addText('• ' + a, 10, false, 'left', 10));

            if (y > pageHeight - 40) { doc.addPage(); y = margin; }

            // Recommendation
            addText('III. DICTAMEN FINAL SUGERIDO', 14, true, 'left', 8, [0, 51, 102]);
            let recText = '';
            if (scorePercent >= 80) recText = `RESOLUCIÓN: La ubicación evaluada es ALTAMENTE RECOMENDAABLE para el establecimiento de un negocio del tipo "${cat}". Presenta atributos sobresalientes que estadísticamente pronostican una ventaja competitiva inicial y probabilidad de éxito sostenido.`;
            else if (scorePercent >= 50) recText = `RESOLUCIÓN: La ubicación presenta viabilidad CONDICIONADA para el giro "${cat}". Se recomienda estrictamente proceder bajo un análisis minucioso de las deficiencias y amenazas documentadas en este informe, ponderando métodos para contrarrestar dichos riesgos de forma proactiva.`;
            else recText = `RESOLUCIÓN: El punto geográfico resulta NO ESTADÍSTICAMENTE VIABLE para el giro "${cat}". Al someter las variables a análisis predictivo, las carencias del entorno estructural combinadas superan la viabilidad comercial. Se aconseja desestimar esta opción e iterar el análisis en nuevas zonas.`;

            addText(recText, 10, false, 'justify', 15);

            y = pageHeight - 15;
            addText('Este documento electrónico fue generado a través de algoritmos de inteligencia predictiva por Find Your Place. Su utilización es netamente orientativa.', 8, false, 'center', 5, [150, 150, 150]);

            // Save PDF
            const fileName = `Informe-${loc.title || 'Ubicacion'}.pdf`;

            if (this.platform.is('capacitor')) {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                Filesystem.writeFile({
                    path: fileName,
                    data: pdfBase64,
                    directory: Directory.Documents
                }).then(async (result) => {
                    try {
                        await Share.share({
                            title: 'Informe Científico de Viabilidad',
                            text: 'Se adjunta el análisis de viabilidad formal.',
                            url: result.uri,
                            dialogTitle: 'Exportar Informe'
                        });
                    } catch (e) { console.log('Cancelado por el usuario'); }
                }).catch(e => console.error(e));
            } else {
                doc.save(fileName);
            }
        } catch (error) {
            console.error('Error generando PDF formal', error);
        }
    }

    async exportMultiPDF() {
        if (!this.comparingLocations || this.comparingLocations.length === 0) return;

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            let y = margin;
            const cat = this.comparingLocations[0]?.category || 'Negocio';

            const addText = (txt: string, size: number, bold: boolean, align: 'left' | 'center' | 'right' | 'justify' = 'left', spacing = 5, color = [0, 0, 0]) => {
                doc.setFontSize(size);
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setTextColor(color[0], color[1], color[2]);
                const lines = doc.splitTextToSize(txt, pageWidth - margin * 2);
                lines.forEach((line: string) => {
                    if (y > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, align === 'center' ? pageWidth / 2 : (align === 'right' ? pageWidth - margin : margin), y, { align });
                    y += spacing;
                });
            };

            // Title
            addText(`Análisis Multivariable y Comparativo: ${cat.toUpperCase()}`, 18, true, 'center', 8, [0, 51, 102]);
            addText('Estudio Comparativo entre Ubicaciones Estratégicas', 12, false, 'center', 15, [100, 100, 100]);
            addText(`Fecha de Generación: ${new Date().toLocaleDateString()}`, 10, false, 'right');
            y += 5;

            // Winner
            const recommended = this.getRecommended();
            if (recommended) {
                addText('CONCLUSIÓN MATEMÁTICA Y UBICACIÓN GANADORA', 14, true, 'center', 8, [34, 139, 34]);
                addText(recommended.recommendation.address, 12, true, 'center', 15);
            }

            // Loop over locations
            for (let i = 0; i < this.comparingLocations.length; i++) {
                const locObj = this.comparingLocations[i];
                const loc = locObj.recommendation;

                if (y > pageHeight - 60) {
                    doc.addPage();
                    y = margin;
                }

                addText(`Opción Evaluada ${i + 1}`, 14, true, 'left', 6, [0, 51, 102]);
                addText(`Coordenadas / Dir: ${loc.address}`, 10, false, 'left', 5);

                const scorePercent = ((loc.score || loc.totalScore || 0) / 5) * 100;
                addText(`Índice de Viabilidad Total: ${scorePercent.toFixed(2)}% | Escala: ${this.getBadgeText(loc.score || loc.totalScore)}`, 11, true, 'left', 5);
                addText(`Densidad de Competencia: ${loc.competitorsCount} establecimientos detectados | Estado: ${loc.saturationLevel}`, 10, false, 'left', 5);

                const foda = this.generateFODA(loc, cat);
                addText(`Punto Fuerte Destacado: ${foda.f[0]}`, 10, false, 'left', 5, [34, 139, 34]);
                addText(`Riesgo Observado: ${foda.a[0] || foda.d[0] || 'Condiciones aparentemente estables'}`, 10, false, 'left', 12, [220, 20, 60]);
            }

            y = pageHeight - 15;
            addText('Reporte comparativo analítico autogenerado por Find Your Place.', 8, false, 'center', 5, [150, 150, 150]);

            const fileName = `Estudio-Comparativo-${new Date().getTime()}.pdf`;

            if (this.platform.is('capacitor')) {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                Filesystem.writeFile({
                    path: fileName,
                    data: pdfBase64,
                    directory: Directory.Documents
                }).then(async (result) => {
                    try {
                        await Share.share({
                            title: 'Estudio Comparativo',
                            text: 'Te comparto el estudio científico comparando ubicaciones.',
                            url: result.uri,
                            dialogTitle: 'Exportar Comparativa'
                        });
                    } catch (e) {
                        console.log('Cancelado por el usuario');
                    }
                }).catch(e => {
                    console.error('Error al guardar con Filesystem:', e);
                });
            } else {
                doc.save(fileName);
            }
        } catch (error) {
            console.error('Error generando PDF múltiple', error);
        }
    }

}
