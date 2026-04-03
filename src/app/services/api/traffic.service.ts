import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class TrafficService {

    constructor(private http: HttpClient) { }

    async getTrafficFlow(lat: number, lng: number): Promise<any> {
        const apiKey = environment.apiKeys.tomtom;
        if (!apiKey) {
            console.warn('TomTom Graph API Key missing');
            return { flow: 'Unknown', speed: 0 };
        }
        // https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=...&point=lat,lng
        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${apiKey}&point=${lat},${lng}`;
        try {
            return await this.http.get(url).toPromise();
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async getRoads(lat: number, lng: number): Promise<any> {
        // Google Maps Roads API
        // https://roads.googleapis.com/v1/nearestRoads?points=lat,lng&key=YOUR_API_KEY
        return null; // Implementation pending key
    }
}
