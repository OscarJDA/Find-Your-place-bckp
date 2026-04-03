import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class PlacesProviderService {

    constructor(private http: HttpClient) { }

    // Use a proxy or direct call if CORS allows (usually Google Places blocks direct browser calls, needs proxy or backend)
    // For this environment, we assume we might need a proxy. However, usually Ionic/native http works. 
    // We will use standard HttpClient. If CORS fails, user needs a Proxy.
    // Assuming a proxy is available usually, or this is for native run.
    private baseUrl = 'https://maps.googleapis.com/maps/api/place';

    /**
     * Search nearby places using Google Places API via CapacitorHttp to bypass CORS
     */
    async getGooglePlaces(query: string, lat: number, lng: number, type: string = '', radius: number = 1000): Promise<any[]> {
        const key = environment.apiKeys.googlePlaces;
        if (!key) return [];

        let url = `${this.baseUrl}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${key}`;

        if (query && query.trim() !== '') {
            url += `&keyword=${encodeURIComponent(query)}`;
        }

        if (type) {
            url += `&type=${type}`;
        }

        const isWeb = Capacitor.getPlatform() === 'web';
        const finalUrl = isWeb ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` : url;

        try {
            // Use CapacitorHttp to bypass CORS on device and potentially in browser if configured
            const response = await CapacitorHttp.get({ url: finalUrl });

            if (response.status === 200 && response.data) {
                return response.data.results || [];
            }
            return [];
        } catch (error) {
            console.error('Google Places Error (CapacitorHttp):', error);
            return [];
        }
    }

    /**
     * Get Place Details (for Opening Hours)
     */
    async getPlaceDetails(placeId: string): Promise<any> {
        const key = environment.apiKeys.googlePlaces;
        if (!key) return null;

        const url = `${this.baseUrl}/details/json?place_id=${placeId}&fields=photos,opening_hours,formatted_phone_number,rating,user_ratings_total&key=${key}`;

        const isWeb = Capacitor.getPlatform() === 'web';
        const finalUrl = isWeb ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` : url;

        try {
            const response = await CapacitorHttp.get({ url: finalUrl });
            if (response.status === 200 && response.data) {
                return response.data.result;
            }
            return null;
        } catch (error) {
            console.error('Google Places Details Error:', error);
            return null;
        }
    }

    async getFoursquareInsights(lat: number, lng: number): Promise<any> {
        const key = environment.apiKeys.foursquare;
        if (!key) return null;
        // Foursquare API for foot traffic
        return { footTraffic: 'Medium', popularity: 5 };
    }

    async getYelpReviews(term: string, lat: number, lng: number): Promise<any> {
        const key = environment.apiKeys.yelp;
        if (!key) return null;
        // Yelp Fusion API
        return { rating: 4.5, reviewCount: 100 };
    }

    /**
     * Get a photo URL for a specific location using Google Places
     */
    async getLocationPhotos(lat: number, lng: number, name: string = ''): Promise<string[]> {
        const key = environment.apiKeys.googlePlaces;
        if (!key) return [];

        let places = [];

        // 1. Try searching with name if available and valid (not a coordinate)
        const isCoordinateName = /^-?\d+(\.\d+)?$/.test(name) || name.includes('Ubicación') || name.includes('Opción');

        if (name && !isCoordinateName) {
            places = await this.getGooglePlaces(name, lat, lng, '', 50);
        }

        // 2. If no results or invalid name, search by proximity (generic nearby search)
        if (!places || places.length === 0) {
            // Increase radius to 200m as requested to ensure finding a place with photos
            places = await this.getGooglePlaces('', lat, lng, '', 200);
        }

        if (places && places.length > 0) {
            // Find first place that HAS photos
            const placeWithPhoto = places.find(p => p.photos && p.photos.length > 0);

            if (placeWithPhoto) {
                // Determine if we need to proxy the photo request due to CORS on the web
                const isWeb = Capacitor.getPlatform() === 'web';

                return placeWithPhoto.photos.slice(0, 5).map((photo: any) => {
                    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${key}`;

                    // We shouldn't use api.allorigins.win/raw for images as it's meant for JSON/text.
                    // But if we must avoid CORS in the browser for an img src, we can try corsproxy.io or let <img> handle it without crossOrigin attribute
                    return photoUrl;
                });
            }
        }
        return [];
    }

    /**
     * Get a photo URL for a specific location using Google Places
     * Kept for backward compatibility or single-photo usage
     */
    async getPhotoForLocation(lat: number, lng: number): Promise<string | null> {
        const photos = await this.getLocationPhotos(lat, lng);
        return photos.length > 0 ? photos[0] : null;
    }
}

