import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class InegiService {

    // Token should be in environment.ts
    private token = environment.apiKeys.inegi;
    private baseUrl = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';

    constructor(private http: HttpClient) { }

    /**
     * Search for businesses in DENUE
     * @param lat Latitude
     * @param lng Longitude
     * @param radiusMeters Radius in meters (INEGI uses specific ranges usually, but we try standard)
     * @param keyword Keyword to search (e.g., "restaurante")
     */
    getDenueBusinesses(lat: number, lng: number, radiusMeters: number, keyword: string): Observable<any[]> {
        if (!this.token) {
            console.warn('INEGI API Key missing');
            return of([]);
        }

        // Example: Buscar/{condicion}/{lat},{lon}/{metros}/{token}
        // Condicion matches the business type
        const query = `${encodeURIComponent(keyword)}/${lat},${lng}/${radiusMeters}/${this.token}`;
        const url = `${this.baseUrl}/Buscar/${query}`;

        return this.http.get<any[]>(url).pipe(
            catchError(error => {
                console.error('Error fetching INEGI DENUE:', error);
                return of([]);
            })
        );
    }
}
