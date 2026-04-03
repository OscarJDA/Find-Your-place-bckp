import { Component, OnDestroy } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NavController, AlertController, ModalController } from '@ionic/angular';
import { BusinessAnalysisService } from '../services/business-analysis.service';
import { IntelligentSearchService } from '../services/intelligent-search.service';
import { FinancialSimulatorComponent } from './financial-simulator/financial-simulator.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {

  filteredCategories: any[] = [];
  businessSearchQuery: string = '';
  isSearchingCategory: boolean = false;
  isInvalidKeyword: boolean = false;
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  categories = [
    { name: 'Alimentos y bebidas', image: 'assets/Iconos/Alimentos y bebidas.png' },
    { name: 'Arte', image: 'assets/Iconos/Arte.png' },
    { name: 'Barberia', image: 'assets/Iconos/Barberia.png' },
    { name: 'Belleza', image: 'assets/Iconos/Belleza.png' },
    { name: 'Construccion', image: 'assets/Iconos/Construccion.png' },
    { name: 'Contratistas', image: 'assets/Iconos/Contratistas.png' },
    { name: 'Cortes de Cabello', image: 'assets/Iconos/Cortes de Cabello.png' },
    { name: 'Costureria', image: 'assets/Iconos/Costureria.png' },
    { name: 'Cuidado', image: 'assets/Iconos/Cuidado.png' },
    { name: 'Educacion', image: 'assets/Iconos/Educacion.png' },
    { name: 'Eventos y Entretenimeinto', image: 'assets/Iconos/Eventos y Entretenimeinto.png' },
    { name: 'Fitness', image: 'assets/Iconos/Fitness.png' },
    { name: 'Hogar y Jardineria', image: 'assets/Iconos/Hogar y Jardineria.png' },
    { name: 'Infantes', image: 'assets/Iconos/Infantes.png' },
    { name: 'Ingenieria', image: 'assets/Iconos/Ingenieria.png' },
    { name: 'Legal y Financiero', image: 'assets/Iconos/Legal y Financiero.png' },
    { name: 'Limpieza', image: 'assets/Iconos/Limpieza.png' },
    { name: 'Mascotas', image: 'assets/Iconos/Mascotas.png' },
    { name: 'Negocios', image: 'assets/Iconos/Negocios.png' },
    { name: 'Reciclaje', image: 'assets/Iconos/Reciclaje.png' },
    { name: 'Regalos', image: 'assets/Iconos/Regalos.png' },
    { name: 'Restaurantes', image: 'assets/Iconos/Restaurantes.png' },
    { name: 'Ropa', image: 'assets/Iconos/Ropa.png' },
    { name: 'Salud y Medicina', image: 'assets/Iconos/Salud y Medicina.png' },
    { name: 'Servicios IT', image: 'assets/Iconos/Servicios IT.png' },
    { name: 'Servicios Vehiculares', image: 'assets/Iconos/Servicios Vehiculares.png' },
    { name: 'Servivios Electronicos', image: 'assets/Iconos/Servivios Electronicos.png' },
    { name: 'Tatuajes y Piercings', image: 'assets/Iconos/Tatuajes y Piercings.png' },
    { name: 'Tienda Abarrotes', image: 'assets/Iconos/Tienda Abarrotes.png' },
    { name: 'Viajes y Transportistas', image: 'assets/Iconos/Viajes y Transportistas.png' }
  ];


  radius: number = 0;
  selectedCategory: string = '';
  searchQuery: string = '';
  suggestions: any[] = [];
  selectedCoords: { lat: number, lng: number } | null = null;
  isLocating: boolean = false;
  private locationSub: Subscription | undefined;

  constructor(
    private navCtrl: NavController,
    private analysisService: BusinessAnalysisService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private aiSearchService: IntelligentSearchService
  ) {
    this.filteredCategories = this.categories;

    // Configura la búsqueda inteligente
    this.searchSub = this.searchSubject.pipe(
      debounceTime(800),
      distinctUntilChanged()
    ).subscribe(async (query) => {
      if (!query) {
        this.filteredCategories = this.categories;
        this.selectedCategory = '';
        this.isSearchingCategory = false;
        this.isInvalidKeyword = false;
        return;
      }

      this.isSearchingCategory = true;
      const categoryNames = this.categories.map(c => c.name);
      const bestMatch = await this.aiSearchService.categorize(query, categoryNames);

      if (bestMatch === 'INVALIDO') {
        this.filteredCategories = [];
        this.selectedCategory = '';
        this.isInvalidKeyword = true;
      } else {
        this.isInvalidKeyword = false;
        if (bestMatch) {
          this.filteredCategories = this.categories.filter(c => c.name === bestMatch);
        } else {
          this.filteredCategories = [];
        }
        // Permitir que el texto libre sea la categoría seleccionada
        this.selectedCategory = query;
      }

      this.isSearchingCategory = false;
    });
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  ionViewDidEnter() {
    this.locationSub = this.analysisService.locationPicked$.subscribe(async (coords) => {
      if (coords) {
        this.selectedCoords = coords;
        this.isLocating = true;
        const address = await this.analysisService.reverseGeocode(coords.lat, coords.lng);
        this.searchQuery = address;
        this.isLocating = false;
        this.analysisService.clearLocationPicked();
      }
    });
  }

  ionViewDidLeave() {
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
  }

  pickLocationOnMap() {
    if (this.radius <= 0) return;

    const queryParams: any = {
      mode: 'picker',
      radius: this.radius // Pass current radius
    };
    if (this.selectedCoords) {
      queryParams.lat = this.selectedCoords.lat;
      queryParams.lng = this.selectedCoords.lng;
    }
    this.navCtrl.navigateForward('/map', { queryParams });
  }

  selectCategory(categoryName: string) {
    this.selectedCategory = categoryName;
    this.businessSearchQuery = categoryName;
  }

  onBusinessSearchChange(event: any) {
    const query = event.target.value;
    this.businessSearchQuery = query;
    this.selectedCategory = query.trim(); // Actualizar inmediatamente para texto libre
    this.searchSubject.next(query.trim().toLowerCase());
  }

  async onSearchChange(event: any) {
    const query = event.target.value;
    this.searchQuery = query;

    if (query && query.length > 2) {
      this.suggestions = await this.analysisService.searchPlaces(query);
    } else {
      this.suggestions = [];
    }
  }

  selectSuggestion(place: any) {
    this.searchQuery = place.place_name;
    this.selectedCoords = {
      lng: place.center[0],
      lat: place.center[1]
    };
    this.suggestions = [];
  }

  async getCurrentLocation() {
    const alert = await this.alertCtrl.create({
      header: 'Usar ubicación actual',
      message: '¿Quieres utilizar tu ubicación actual para buscar oportunidades de negocio cercanas?',
      cssClass: 'custom-location-alert',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
        }, {
          text: 'Sí',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.fetchLocation();
          }
        }
      ]
    });

    await alert.present();
  }

  fetchLocation() {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada en este navegador.');
      return;
    }

    this.isLocating = true;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        this.selectedCoords = { lat: latitude, lng: longitude };

        // Populate input with address
        const address = await this.analysisService.reverseGeocode(latitude, longitude);
        this.searchQuery = address;
        this.isLocating = false;
      },
      (error) => {
        console.error('Error getting location', error);
        alert('No se pudo obtener la ubicación.');
        this.isLocating = false;
      }
    );
  }

  get isFormValid(): boolean {
    return this.searchQuery?.trim().length > 0 && this.radius > 0 && !!this.selectedCategory && !this.isInvalidKeyword && !this.isSearchingCategory;
  }

  get dynamicButtonText(): string {
    if (this.isSearchingCategory) {
      return 'Validando negocio...';
    }
    if (this.isInvalidKeyword) {
      return 'Palabra clave inválida';
    }
    if (!this.searchQuery?.trim() || this.searchQuery.length <= 0) {
      return 'Ingresa tu ubicación';
    }
    if (this.radius <= 0) {
      return 'Ajusta el radio de búsqueda';
    }
    if (!this.selectedCategory) {
      return 'Ingresa o selecciona un negocio';
    }
    return `Buscar ${this.selectedCategory}`;
  }

  async navigateToMap() {
    if (!this.isFormValid) {
      let message = 'Completa los campos para continuar';
      if (this.isInvalidKeyword) {
        message = 'La palabra clave ingresada no es válida o no representa un negocio verdadero.';
      } else if (!this.searchQuery) {
        message = 'Ingresa una ubicación';
      } else if (this.radius === 0) {
        message = 'Ajusta el radio de búsqueda';
      } else if (!this.selectedCategory) {
        message = 'Ingresa o selecciona un negocio';
      }

      const alert = await this.alertCtrl.create({
        header: 'Información Incompleta',
        message: message,
        cssClass: 'custom-location-alert',
        buttons: [
          {
            text: 'OK',
            cssClass: 'alert-button-confirm',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
      return;
    }

    const queryParams: any = {
      radius: this.radius,
      category: this.selectedCategory
    };

    if (this.selectedCoords) {
      queryParams.lat = this.selectedCoords.lat;
      queryParams.lng = this.selectedCoords.lng;
    }

    this.navCtrl.navigateForward('/map', { queryParams });
  }

  pinFormatter(value: number) {
    return `${value.toFixed(1)} km`;
  }

  currentView: string = 'home';

  setSelectedTab(tab: string) {
    this.currentView = tab;
  }
}
