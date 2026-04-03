import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class OpenStreetMapService {

    private nominatimUrl = 'https://nominatim.openstreetmap.org';
    private overpassUrl = 'https://overpass-api.de/api/interpreter';

    constructor(private http: HttpClient) { }

    /**
     * Consulta OPTIMIZADA de infraestructura.
     * Solo extraemos centroides de ways para reducir el tamaño de la respuesta JSON.
     */
    async getInfrastructure(lat: number, lng: number, radius: number): Promise<any[]> {
        // Reducimos el payload pidiendo 'center' en lugar de geometría completa
        const query = `
            [out:json][timeout:45];
            (
                node(around:${radius},${lat},${lng})["amenity"~"^(school|university|hospital|clinic|bank)$"];
                way(around:${radius},${lat},${lng})["amenity"~"^(school|university|hospital|clinic|bank)$"];
                
                node(around:${radius},${lat},${lng})["shop"~"^(mall|supermarket)$"];
                way(around:${radius},${lat},${lng})["shop"~"^(mall|supermarket)$"];
                
                node(around:${radius},${lat},${lng})["highway"="bus_stop"];
                node(around:${radius},${lat},${lng})["public_transport"="platform"];
                
                way(around:${radius},${lat},${lng})["highway"~"^(primary|secondary|tertiary${radius > 4000 ? '' : '|residential'})$"];
                
                way(around:${radius},${lat},${lng})["landuse"~"^(residential|commercial|retail)$"];
                ${radius > 4000 ? '' : 'way(around:' + radius + ',' + lat + ',' + lng + ')["building"="office"];'}
            );
            out center; 
        `;
        // 'out center' convierte edificios (ways) en un solo punto lat/lon. Vital para performance.

        const body = `data=${encodeURIComponent(query)}`;
        try {
            const response: any = await firstValueFrom(
                this.http.post(this.overpassUrl, body, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })
            );
            return this.normalizeElements(response.elements);
        } catch (e) {
            console.error('Overpass Infrastructure Error:', e);
            return [];
        }
    }

    async getNearbyPlaces(lat: number, lng: number, radius: number, value: string, key: string = 'amenity'): Promise<any[]> {
        const query = `
            [out:json][timeout:25];
            (
                node(around:${radius},${lat},${lng})["${key}"="${value}"];
                way(around:${radius},${lat},${lng})["${key}"="${value}"];
            );
            out center;
        `;
        const body = `data=${encodeURIComponent(query)}`;
        try {
            const response: any = await firstValueFrom(
                this.http.post(this.overpassUrl, body, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })
            );
            return this.normalizeElements(response.elements);
        } catch (error) {
            return [];
        }
    }

    async searchByKeyword(lat: number, lng: number, radius: number, keyword: string): Promise<any[]> {
        // Search by name ~ keyword (case insensitive) or specific common tags containing the keyword
        const query = `
            [out:json][timeout:25];
            (
                node(around:${radius},${lat},${lng})["name"~"${keyword}", i];
                way(around:${radius},${lat},${lng})["name"~"${keyword}", i];
                node(around:${radius},${lat},${lng})["amenity"~"${keyword}", i];
                way(around:${radius},${lat},${lng})["amenity"~"${keyword}", i];
                node(around:${radius},${lat},${lng})["shop"~"${keyword}", i];
                way(around:${radius},${lat},${lng})["shop"~"${keyword}", i];
            );
            out center;
        `;
        const body = `data=${encodeURIComponent(query)}`;
        try {
            const response: any = await firstValueFrom(
                this.http.post(this.overpassUrl, body, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })
            );
            return this.normalizeElements(response.elements);
        } catch (error) {
            console.error('Overpass keyword search error:', error);
            return [];
        }
    }

    // Geocoding ligero para la lista final
    async reverseNominatimSimple(lat: number, lon: number): Promise<string> {
        const url = `${this.nominatimUrl}/reverse?format=json&lat=${lat}&lon=${lon}`;
        try {
            const res: any = await firstValueFrom(this.http.get(url));
            return res.display_name || 'Dirección desconocida';
        } catch {
            return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
    }

    private normalizeElements(elements: any[]): any[] {
        if (!elements) return [];
        return elements.map(e => {
            // Si es un 'way' o 'relation' con 'out center', viene con 'center' prop
            if (e.center) return { ...e, lat: e.center.lat, lon: e.center.lon };
            return e;
        }).filter(e => e.lat && e.lon);
    }
}
