import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { BusinessAnalysisService } from '../services/business-analysis.service';
import { environment } from 'src/environments/environment';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import html2canvas from 'html2canvas';
@Component({
    selector: 'app-negocios',
    templateUrl: './negocios.page.html',
    styleUrls: ['./negocios.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, FormsModule]
})
export class NegociosPage implements OnInit {
    savedLocations: any[] = [];
    selectedLocation: any = null;

    constructor(
        private analysisService: BusinessAnalysisService,
        private alertController: AlertController,
        private sanitizer: DomSanitizer
    ) { }

    ngOnInit() {
        this.loadLocations();
    }

    loadLocations() {
        this.savedLocations = this.analysisService.getSavedLocations();

        const key = environment.apiKeys.googlePlaces;
        if (key && this.savedLocations.length > 0 && !this.selectedLocation) {
            setTimeout(() => {
                this.loadGoogleMapsScript(key);
            }, 300);
        }
    }

    loadGoogleMapsScript(apiKey: string) {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.StreetViewPanorama) {
            this.initStreetViews();
            return;
        }

        if (document.getElementById('google-maps-script')) {
            setTimeout(() => this.loadGoogleMapsScript(apiKey), 500);
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            this.initStreetViews();
        };
        document.head.appendChild(script);
    }

    initStreetViews() {
        this.savedLocations.forEach(loc => {
            if (loc.streetViewImage) return; // Si ya tiene la imagen generada, no la volvemos a renderizar

            const container = document.getElementById(`street-view-${loc.recommendation.id}`);
            // Check if container exists and hasn't been populated by Google Maps yet
            if (container && container.childNodes.length === 0) {
                const panorama = new (window as any).google.maps.StreetViewPanorama(container, {
                    position: { lat: loc.recommendation.coords.lat, lng: loc.recommendation.coords.lng },
                    pov: { heading: 0, pitch: 0 },
                    disableDefaultUI: true, // Hides compass, zoom, address
                    clickToGo: false,
                    panControl: false,
                    zoomControl: false,
                    linksControl: false,
                    scrollwheel: false,
                    disableDoubleClickZoom: true
                });

                // Automatización del script para captura de pantalla
                (window as any).google.maps.event.addListenerOnce(panorama, 'status_changed', () => {
                    setTimeout(async () => {
                        try {
                            const canvas = await html2canvas(container, { useCORS: true, allowTaint: false, logging: false });
                            loc.streetViewImage = canvas.toDataURL('image/jpeg', 0.9);
                            // Se guarda la referencia de la captura como imagen estática para no usar API en el futuro
                            this.analysisService.saveLocationsLocal(this.savedLocations); // Aseguramos que se persista en LocalStorage si existe ese método o simplemente actualizando la lista guardada en el servicio
                        } catch (error) {
                            console.error('Error automatizando la captura de streetview:', error);
                        }
                    }, 2500); // Dar suficiente tiempo para que los tiles se carguen completamente
                });
            }
        });
    }

    selectLocation(location: any) {
        this.selectedLocation = location;

        setTimeout(() => {
            this.initDetailStreetView(location.recommendation.coords.lat, location.recommendation.coords.lng);
        }, 300);
    }

    initDetailStreetView(lat: number, lng: number) {
        if (this.selectedLocation && this.selectedLocation.streetViewImage) {
            return; // Ya existe la imagen estática generada por el script
        }

        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.StreetViewPanorama) {
            const container = document.getElementById('details-street-view');
            if (container) {
                const panorama = new (window as any).google.maps.StreetViewPanorama(container, {
                    position: { lat: lat, lng: lng },
                    pov: { heading: 0, pitch: 0 },
                    disableDefaultUI: true, // Hides compass, zoom, address
                    clickToGo: false,
                    panControl: false,
                    zoomControl: false,
                    linksControl: false,
                    scrollwheel: false,
                    disableDoubleClickZoom: true
                });

                // Automatización complementaria para captura en la vista de detalle
                (window as any).google.maps.event.addListenerOnce(panorama, 'status_changed', () => {
                    setTimeout(async () => {
                        try {
                            const canvas = await html2canvas(container, { useCORS: true, allowTaint: false, logging: false });
                            this.selectedLocation.streetViewImage = canvas.toDataURL('image/jpeg', 0.9);
                            this.analysisService.saveLocationsLocal(this.savedLocations);
                        } catch (error) {
                            console.error('Error automatizando la captura de streetview en detalle:', error);
                        }
                    }, 2500);
                });
            }
        }
    }

    clearSelection() {
        this.selectedLocation = null;
        this.loadLocations(); // Re-trigger map initialization when going back to list
    }

    async confirmDelete() {
        if (!this.selectedLocation) return;

        const alert = await this.alertController.create({
            header: 'Eliminar Negocio',
            message: '¿Estás seguro de que deseas eliminar este negocio?',
            mode: 'ios',
            buttons: [
                {
                    text: 'Cancelar',
                    role: 'cancel'
                },
                {
                    text: 'Eliminar',
                    role: 'destructive',
                    handler: () => {
                        this.deleteLocation();
                    }
                }
            ]
        });

        await alert.present();
    }

    deleteLocation() {
        if (this.selectedLocation) {
            this.analysisService.deleteLocation(this.selectedLocation.recommendation.id);
            this.loadLocations();
            this.clearSelection();
        }
    }

    getCategoryIcon(category: string): string {
        const mapping: { [key: string]: string } = {
            'Alimentos y bebidas': 'restaurant',
            'Arte': 'color-palette',
            'Barberia': 'cut',
            'Belleza': 'rose',
            'Construccion': 'construct',
            'Contratistas': 'build',
            'Educacion': 'school',
            'Eventos y Entretenimeinto': 'ticket',
            'Fitness': 'barbell',
            'Hogar y Jardineria': 'leaf',
            'Legal y Financiero': 'briefcase',
            'Limpieza': 'water',
            'Mascotas': 'paw',
            'Negocios': 'business',
            'Restaurantes': 'restaurant',
            'Ropa': 'shirt',
            'Salud y Medicina': 'medkit',
            'Servicios Vehiculares': 'car',
            'Servivios Electronicos': 'hardware-chip',
            'Tienda Abarrotes': 'cart'
        };
        return mapping[category] || 'storefront';
    }

    getMapStaticUrl(lat: number, lng: number): string {
        const token = environment.apiKeys.mapbox;
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+ea4335(${lng},${lat})/${lng},${lat},15,0/600x300@2x?access_token=${token}`;
    }

    openMaps(lat: number, lng: number) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }
}
