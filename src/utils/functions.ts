import { Location } from "../services/locationService";
import { Place } from "../types";
import { showLocation } from "react-native-map-link";
import { Alert } from "react-native";

export const handleGetDirections = (data: Place | null, userLocation: Location | null) => {
    if (!data) return;

    const locationOptions: any = {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        title: data.name,
        googleForceLatLon: false,
        alwaysIncludeGoogle: true,
        dialogTitle: 'Open in Maps',
        dialogMessage: 'Choose an app to get directions',
        cancelText: 'Cancel',
        directionsMode: 'drive', // default to drive, but users can change in their app
    };

    // Add source location if user location is available
    if (userLocation) {
        locationOptions.sourceLatitude = userLocation.latitude;
        locationOptions.sourceLongitude = userLocation.longitude;
    }

    // Add Google Place ID if available
    if (data.googlePlaceId) {
        locationOptions.googlePlaceId = data.googlePlaceId;
    }

    showLocation(locationOptions).catch((error) => {
        console.error('Error opening map link:', error);
        Alert.alert(
            'Error',
            'Unable to open maps. Please try again.',
            [{ text: 'OK' }]
        );
    });
}
