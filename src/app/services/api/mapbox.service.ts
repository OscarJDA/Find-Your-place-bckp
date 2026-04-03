import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MapboxService {

    private accessToken = environment.apiKeys.mapbox;

    constructor(private http: HttpClient) { }

    getIsochrone(lat: number, lng: number, minutes: number = 10, profile: 'walking' | 'driving' | 'cycling' = 'walking'): Observable<any> {
        if (!this.accessToken) return of(null);

        // Mapbox Isochrone API
        // https://docs.mapbox.com/api/navigation/isochrone/
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${this.accessToken}`;

        return this.http.get(url).pipe(
            catchError(error => {
                console.error('Error fetching Mapbox Isochrone:', error);
                return of(null);
            })
        );
    }
}
