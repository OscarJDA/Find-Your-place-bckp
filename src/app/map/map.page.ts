import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { NavController, ModalController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BusinessAnalysisService, Recommendation } from '../services/business-analysis.service';
import { PlacesProviderService } from '../services/api/places-provider.service';
import { environment } from '../../environments/environment';
import * as mapboxgl from 'mapbox-gl';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-map',
    templateUrl: './map.page.html',
    styleUrls: ['./map.page.scss'],
    standalone: false
})
export class MapPage implements OnInit, OnDestroy, AfterViewInit {
    mapInstance: mapboxgl.Map | undefined;
    recommendations: Recommendation[] = [];
    userLocation: { lat: number, lng: number } | null = null;

    markersList: mapboxgl.Marker[] = [];
    competitorMarkersList: mapboxgl.Marker[] = [];
    userMarker: mapboxgl.Marker | null = null;

    // Search Inputs
    radius: number = 2; // Default 2km
    selectedCategory: string = '';
    categories: string[] = [];
    isAnalyzing: boolean = false;

    // Details Modal
    isModalOpen = false;
    selectedRecommendation: Recommendation | null = null;

    isPickerMode: boolean = false;
    isSheetExpanded: boolean = true; // Default expanded to show results
    selectedPlacePhotos: string[] = [];

    competitors: any[] = [];
    competitorsCoords: { lat: number, lng: number }[] = [];
    showCompetitors: boolean = false;

    hasGoogleKey: boolean = false;
    initialCenter = { lat: 19.003547, lng: -98.201514 };

    constructor(
        private navCtrl: NavController,
        private analysisService: BusinessAnalysisService,
        private route: ActivatedRoute,
        private placesService: PlacesProviderService,
        private toastCtrl: ToastController,
        private sanitizer: DomSanitizer
    ) { }

    ngOnInit() {
        this.categories = this.analysisService.getCategories();

        // 1. Get Params and Initialize Map Configuration
        this.route.queryParams.subscribe(params => {
            this.isPickerMode = params['mode'] === 'picker';
            if (params['radius']) this.radius = parseFloat(params['radius']);
            if (params['category']) this.selectedCategory = params['category'];

            if (params['lat'] && params['lng']) {
                this.initialCenter = {
                    lat: parseFloat(params['lat']),
                    lng: parseFloat(params['lng'])
                };
            }
        });
    }

    ngAfterViewInit() {
        this.initMap();
    }

    initMap() {
        Object.getOwnPropertyDescriptor(mapboxgl, "accessToken")?.set?.(environment.apiKeys.mapbox);

        this.mapInstance = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [this.initialCenter.lng, this.initialCenter.lat],
            zoom: 13,
            attributionControl: false
        });

        this.mapInstance.on('load', () => {
            // Fix Mapbox sizing issue in Ionic
            this.mapInstance?.resize();
            setTimeout(() => {
                this.mapInstance?.resize();
            }, 300);

            if (this.selectedCategory && !this.isPickerMode) {
                this.analyze();
            }

            if (this.isPickerMode) {
                this.setupPickerCircle();
                this.mapInstance?.on('move', () => {
                    this.updateCircleRadius();
                });
            }
        });
    }

    ionViewDidEnter() {
        if (this.mapInstance) {
            this.mapInstance.resize();
        }
    }

    setupPickerCircle() {
        if (!this.mapInstance) return;

        const center = this.mapInstance.getCenter();
        if (center && !this.mapInstance.getSource('picker-circle')) {
            const radiusInMeters = this.radius > 0 ? this.radius * 1000 : 1000;
            this.updatePickerCircleData(center, radiusInMeters);
        }
    }

    updatePickerCircleData(center: mapboxgl.LngLat, radius: number) {
        if (!this.mapInstance) return;

        const circleParams = this.createGeoJSONCircle([center.lng, center.lat], radius / 1000);

        if (this.mapInstance.getSource('picker-circle')) {
            (this.mapInstance.getSource('picker-circle') as mapboxgl.GeoJSONSource).setData(circleParams.data as any);
        } else {
            this.mapInstance.addSource('picker-circle', circleParams as any);
            this.mapInstance.addLayer({
                "id": "picker-circle-fill",
                "type": "fill",
                "source": "picker-circle",
                "paint": {
                    "fill-color": "#3880ff",
                    "fill-opacity": 0.2
                }
            });
            this.mapInstance.addLayer({
                "id": "picker-circle-line",
                "type": "line",
                "source": "picker-circle",
                "paint": {
                    "line-color": "#3880ff",
                    "line-width": 2
                }
            });
        }
    }

    createGeoJSONCircle(center: number[], radiusInKm: number, points: number = 64) {
        const coords = { latitude: center[1], longitude: center[0] };
        const km = radiusInKm;
        const ret = [];
        const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
        const distanceY = km / 110.574;

        let theta, x, y;
        for (let i = 0; i < points; i++) {
            theta = (i / points) * (2 * Math.PI);
            x = distanceX * Math.cos(theta);
            y = distanceY * Math.sin(theta);
            ret.push([coords.longitude + x, coords.latitude + y]);
        }
        ret.push(ret[0]);
        return {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [ret]
                    }
                }]
            }
        };
    }

    ngOnDestroy() {
        if (this.mapInstance) {
            this.mapInstance.remove();
        }
    }

    goBack() {
        this.navCtrl.back();
    }

    confirmSelection() {
        if (!this.mapInstance) return;
        const center = this.mapInstance.getCenter();
        if (center) {
            this.analysisService.emitLocationPicked({ lat: center.lat, lng: center.lng });
            this.navCtrl.back();
        }
    }

    progress = 0;

    async analyze() {
        if (!this.selectedCategory) {
            alert('Por favor selecciona una categoría de negocio.');
            return;
        }

        this.isAnalyzing = true;
        this.progress = 0;
        this.clearMarkers();
        this.showCompetitors = false;

        const center = this.mapInstance?.getCenter();
        if (!center) return;
        const coords = { lat: center.lat, lng: center.lng };

        const msgSubscription = this.analysisService.analysisProgress$.subscribe(p => {
            this.progress = p;
        });

        this.analysisService.analyzeArea(coords, this.radius, this.selectedCategory)
            .then((results) => {
                this.recommendations = results;
                this.addMarkers(results);
                this.competitors = this.analysisService.getLatestCompetitors();
                if (this.competitors.length > 0) {
                    this.showCompetitors = true;
                    this.extractCompetitorsCoords();
                }
                this.isAnalyzing = false;
                msgSubscription.unsubscribe();
            })
            .catch((err) => {
                console.error(err);
                this.isAnalyzing = false;
                msgSubscription.unsubscribe();
            });
    }

    clearMarkers() {
        this.markersList.forEach(m => m.remove());
        this.markersList = [];
        this.competitorMarkersList.forEach(m => m.remove());
        this.competitorMarkersList = [];
        this.recommendations = [];
        this.competitorsCoords = [];
    }

    getMarkerColor(score: number) {
        let color = '#ffc409'; // Yellow default
        if (score >= 4.5) color = '#2dd36f'; // Green
        else if (score < 3.5) color = '#eb445a'; // Red
        return color;
    }

    addMarkers(recommendations: Recommendation[]) {
        if (!this.mapInstance) return;

        const bounds = new mapboxgl.LngLatBounds();
        const center = this.mapInstance.getCenter();
        if (center) bounds.extend(center);

        recommendations.forEach(rec => {
            bounds.extend([rec.coords.lng, rec.coords.lat]);

            const marker = new mapboxgl.Marker({ color: this.getMarkerColor(rec.score) })
                .setLngLat([rec.coords.lng, rec.coords.lat])
                .addTo(this.mapInstance!);

            marker.getElement().addEventListener('click', () => {
                this.openDetails(rec);
            });
            this.markersList.push(marker);
        });

        this.mapInstance.fitBounds(bounds, {
            padding: { top: 50, bottom: 300, left: 50, right: 50 }
        });
    }

    openDetails(rec: Recommendation) {
        this.selectedRecommendation = rec;
        this.isModalOpen = true;
        this.selectedPlacePhotos = [];

        // Setup Street View with Google Maps JS API to disable UI
        const key = environment.apiKeys.googlePlaces;
        this.hasGoogleKey = !!key;

        if (key) {
            // Wait for modal transition to complete before initializing map
            setTimeout(() => {
                this.loadGoogleMapsScript(key, rec.coords.lat, rec.coords.lng);
            }, 300);
        }

        // Fetch photos
        this.placesService.getLocationPhotos(rec.coords.lat, rec.coords.lng, rec.title).then(urls => {
            if (this.isModalOpen && this.selectedRecommendation?.id === rec.id) {
                this.selectedPlacePhotos = urls;
            }
        });

        if (this.mapInstance) {
            this.mapInstance.flyTo({ center: [rec.coords.lng, rec.coords.lat], zoom: 16 });
        }
    }

    loadGoogleMapsScript(apiKey: string, lat: number, lng: number) {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.StreetViewPanorama) {
            this.initStreetView(lat, lng);
            return;
        }

        if (document.getElementById('google-maps-script')) {
            setTimeout(() => this.loadGoogleMapsScript(apiKey, lat, lng), 500);
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            this.initStreetView(lat, lng);
        };
        document.head.appendChild(script);
    }

    initStreetView(lat: number, lng: number) {
        // Si ya tenemos la imagen para esta recomendación, no hace falta reiniciar el script
        if (this.selectedRecommendation && this.selectedRecommendation.streetViewImage) {
            return;
        }

        const container = document.getElementById('street-view-panorama');
        if (container) {
            const panorama = new (window as any).google.maps.StreetViewPanorama(container, {
                position: { lat: lat, lng: lng },
                pov: { heading: 0, pitch: 0 },
                disableDefaultUI: true, // Disables compass, zoom controls, etc.
                clickToGo: false,
                panControl: false,
                zoomControl: false,
                linksControl: false,
                scrollwheel: false,
                disableDoubleClickZoom: true
            });

            // Automatización del script para captura de pantalla pre-guardada
            (window as any).google.maps.event.addListenerOnce(panorama, 'status_changed', () => {
                setTimeout(async () => {
                    try {
                        const canvas = await html2canvas(container, { useCORS: true, allowTaint: false, logging: false });
                        if (this.selectedRecommendation) {
                            this.selectedRecommendation.streetViewImage = canvas.toDataURL('image/jpeg', 0.9);
                        }
                    } catch (error) {
                        console.error('Error automatizando la captura de streetview:', error);
                    }
                }, 2500); // Dar suficiente tiempo para que los tiles se carguen
            });
        }
    }

    updateCircleRadius() {
        if (!this.mapInstance || !this.isPickerMode) return;
        const center = this.mapInstance.getCenter();
        if (center) {
            const displayRadius = this.radius > 0 ? this.radius * 1000 : 1000;
            this.updatePickerCircleData(center, displayRadius);
        }
    }

    closeModal() {
        this.isModalOpen = false;
        this.selectedRecommendation = null;
        this.selectedPlacePhotos = [];
    }

    getGoogleMapsKey(): string {
        return environment.apiKeys.googlePlaces;
    }

    getStaticMapUrl(): string {
        if (!this.selectedRecommendation) return '';
        const lat = this.selectedRecommendation.coords.lat;
        const lng = this.selectedRecommendation.coords.lng;
        // fallback static maps either to mapbox or google maps depending on the needs. I will use mapbox static API.
        const token = environment.apiKeys.mapbox;
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ff0000(${lng},${lat})/${lng},${lat},15,0/600x350?access_token=${token}`;
    }

    openMaps(lat: number, lng: number) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }

    async saveToMyBusinesses() {
        if (this.selectedRecommendation && this.selectedCategory) {

            // Script de automatización para generar la base64 (Fallback por si se presionó "Agregar" antes de que el timeout de 2.5s terminara)
            if (this.hasGoogleKey && !this.selectedRecommendation.streetViewImage) {
                const container = document.getElementById('street-view-panorama');
                if (container) {
                    try {
                        const canvas = await html2canvas(container, { useCORS: true, allowTaint: false, logging: false });
                        this.selectedRecommendation.streetViewImage = canvas.toDataURL('image/jpeg', 0.9);
                    } catch (error) {
                        console.error('Error automatizando la captura en MapPage fallback:', error);
                    }
                }
            }

            this.analysisService.saveLocation(this.selectedRecommendation, this.selectedCategory);

            const toast = await this.toastCtrl.create({
                message: 'Guardado en Mis Negocios',
                duration: 2000,
                position: 'top',
                icon: 'checkmark-circle',
                cssClass: 'ios-minimal-toast'
            });
            await toast.present();

            this.closeModal();
        } else {
            const toast = await this.toastCtrl.create({
                message: 'No se pudo guardar',
                duration: 2000,
                position: 'top',
                icon: 'alert-circle',
                cssClass: 'ios-minimal-toast error'
            });
            await toast.present();
        }
    }

    locateUser() {
        if (!this.mapInstance) return;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                    this.userLocation = coords;
                    this.mapInstance?.flyTo({ center: [coords.lng, coords.lat], zoom: 15 });

                    if (this.userMarker) {
                        this.userMarker.setLngLat([coords.lng, coords.lat]);
                    } else {
                        const el = document.createElement('div');
                        el.className = 'user-marker';
                        el.style.width = '20px';
                        el.style.height = '20px';
                        el.style.borderRadius = '50%';
                        el.style.backgroundColor = '#007aff';
                        el.style.border = '2px solid white';
                        el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

                        this.userMarker = new mapboxgl.Marker(el)
                            .setLngLat([coords.lng, coords.lat])
                            .addTo(this.mapInstance!);
                    }
                },
                (error) => {
                    console.error('Error getting location', error);
                    alert('No se pudo obtener tu ubicación.');
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert('Geolocalización no soportada por este navegador.');
        }
    }

    zoomIn() {
        if (this.mapInstance) {
            this.mapInstance.zoomIn();
        }
    }

    zoomOut() {
        if (this.mapInstance) {
            this.mapInstance.zoomOut();
        }
    }

    toggleSheet() {
        this.isSheetExpanded = !this.isSheetExpanded;
    }

    swipeStartY = 0;

    onTouchStart(e: TouchEvent) {
        this.swipeStartY = e.touches[0].clientY;
    }

    onTouchEnd(e: TouchEvent) {
        const deltaY = e.changedTouches[0].clientY - this.swipeStartY;
        if (deltaY > 50 && this.isSheetExpanded) {
            this.isSheetExpanded = false;
        }
        else if (deltaY < -50 && !this.isSheetExpanded) {
            this.isSheetExpanded = true;
        }
    }

    toggleCompetitors() {
        this.showCompetitors = !this.showCompetitors;
        if (this.showCompetitors) {
            this.extractCompetitorsCoords();
        } else {
            this.competitorMarkersList.forEach(m => m.remove());
            this.competitorMarkersList = [];
        }
    }

    extractCompetitorsCoords() {
        this.competitorsCoords = [];
        this.competitorMarkersList.forEach(m => m.remove());
        this.competitorMarkersList = [];

        this.competitors.forEach((comp, index) => {
            const lat = parseFloat(comp.lat ?? comp.Latitud);
            const lng = parseFloat(comp.lon ?? comp.lng ?? comp.Longitud);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                return;
            }

            this.competitorsCoords.push({ lat, lng });

            const el = document.createElement('div');
            el.innerHTML = '<svg style="width:24px;height:24px" viewBox="0 0 24 24"><path fill="#eb445a" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

            if (this.mapInstance) {
                const marker = new mapboxgl.Marker(el)
                    .setLngLat([lng, lat])
                    .addTo(this.mapInstance);
                this.competitorMarkersList.push(marker);
            }
        });
    }

    // ═══════════════════════════════════════════════
    //  RANDOM FOREST — Feature Importance Helper
    // ═══════════════════════════════════════════════
    getFeatureImportanceArray(): { label: string, value: number, color: string }[] {
        if (!this.selectedRecommendation?.rfPrediction?.featureImportance) return [];

        const labelMap: { [key: string]: string } = {
            'flujoPeatonal': 'x₁ Flujo Peatonal',
            'flujoVehicular': 'x₂ Flujo Vehicular',
            'numCompetidores': 'x₃ Competidores',
            'nivelSocioeconomico': 'x₄ Socioeconómico',
            'indiceSeguridad': 'x₅ Seguridad',
            'densidadPoblacional': 'x₆ Densidad Pobl.',
            'rentaPromedio': 'x₇ Renta Promedio'
        };

        const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

        const importance = this.selectedRecommendation.rfPrediction.featureImportance;
        return Object.entries(importance)
            .map(([key, value], idx) => ({
                label: labelMap[key] || key,
                value: value as number,
                color: colors[idx % colors.length]
            }))
            .sort((a, b) => b.value - a.value);
    }
}
