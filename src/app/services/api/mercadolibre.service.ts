import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class MercadoLibreService {

    private baseUrl = 'https://api.mercadolibre.com/sites/MLM/search';

    constructor(private http: HttpClient) { }

    /**
     * Estimate commercial rent prices in a zone
     * @param query e.g. "Renta local comercial Ciudad de Mexico Centro"
     */
    async getCommercialRentals(query: string): Promise<any[]> {
        const url = `${this.baseUrl}?q=${encodeURIComponent(query)}&category=MLM1472&limit=10`; // MLM1472 is roughly Real Estate/Commercial, need to verify or just use text
        // Actually simpler to search "Renta local comercial [Place]"

        try {
            const response: any = await firstValueFrom(this.http.get(url));
            return response.results || [];
        } catch (error) {
            console.error('MercadoLibre Error:', error);
            return [];
        }
    }

    calculateAveragePrice(items: any[]): number {
        if (!items.length) return 0;
        const prices = items.map(i => i.price).filter(p => p > 0);
        if (!prices.length) return 0;
        return prices.reduce((a, b) => a + b, 0) / prices.length;
    }
}
