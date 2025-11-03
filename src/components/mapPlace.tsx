import * as React from "react"
import { Modal, TextStyle, View, ViewStyle, Platform, Dimensions, Image, TouchableOpacity, Text, Alert, StyleSheet } from "react-native"
import Icon from 'react-native-vector-icons/MaterialIcons'
import { useNavigation } from '@react-navigation/native'
import FastImage from "react-native-fast-image"
import { showLocation } from 'react-native-map-link'
import { Place } from "../types"
import { Location } from "../services/locationService"
import { COLORS } from "../theme/colors"

const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

const filterMain: ViewStyle = {
    width: viewportWidth,
    alignSelf: 'center',
    height: viewportHeight,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
}

const filterSub: ViewStyle = {
    height: viewportHeight * 0.4,
    backgroundColor: 'white',
    width: '88%',
    alignSelf: 'center',
    elevation: 10,
    borderRadius: 20,
    overflow: 'hidden',
}

export interface MapPlaceProps {
    /**
     * An optional style override useful for padding & margin.
     */
    style?: ViewStyle

    modal: boolean

    setModal: () => void

    data?: Place | null

    userLocation?: Location
}

/**
 * MapPlace component - Displays a modal with place details when a marker is pressed
 */
export const MapPlace = function MapPlace(props: MapPlaceProps) {
    const { style, modal, setModal, data, userLocation } = props;

    const navigation = useNavigation();

    const handlePlacePress = () => {
        if (data) {
            setModal();
            // Show alert with place details or navigate to detail screen
            Alert.alert(
                data.name,
                `${data.description}\n\n📍 ${data.location.address}\n⭐ ${data.rating}/5\n💰 ${data.priceRange}`,
                [
                    { text: 'Close', style: 'cancel' },
                    { 
                        text: 'View Details', 
                        onPress: () => {
                            // You can add navigation to a detail screen here if needed
                            console.log('View details for:', data.name);
                        } 
                    },
                ]
            );
        }
    }

    const handleGetDirections = () => {
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

    if (!data) return null;

    // Get the first image from images array or use the main image
    const placeImage = data.images && data.images.length > 0 
        ? data.images[0] 
        : data.image || null;

    return (
        <Modal visible={modal} transparent={true} animationType="slide" onRequestClose={setModal}>
            <TouchableOpacity 
                style={filterMain} 
                activeOpacity={1} 
                onPress={setModal}
            >
                <TouchableOpacity 
                    onPress={handlePlacePress} 
                    style={filterSub}
                    activeOpacity={0.9}
                >
                    <View style={{ flex: 1 }}>
                        {placeImage ? (
                            <FastImage
                                source={{ uri: placeImage }}
                                style={{ height: viewportHeight * 0.4, width: '100%', borderRadius: 20 }}
                                resizeMode={FastImage.resizeMode.cover}
                            />
                        ) : (
                            <Image
                                source={require('../assets/naturistLand.jpg')}
                                style={{ height: viewportHeight * 0.4, width: '100%', borderRadius: 20 }}
                                resizeMode="cover"
                            />
                        )}
                    </View>
                    <View style={styles.overlay}>
                        <View style={styles.placeInfo}>
                            <Text style={styles.placeName}>
                                {data.name}
                            </Text>
                            {data.location.address && (
                                <Text style={styles.placeAddress}>
                                    {data.location.address}
                                </Text>
                            )}
                            <View style={styles.placeDetails}>
                                <Text style={styles.placeRating}>
                                    ⭐ {data.rating}
                                </Text>
                                <Text style={[styles.placePrice, { marginLeft: 12 }]}>
                                    💰 {data.priceRange}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={styles.directionsButton}
                            onPress={handleGetDirections}
                            activeOpacity={0.8}
                        >
                            <Icon name="directions" size={20} color="white" />
                            <Text style={[styles.directionsButtonText, { marginLeft: 8 }]}>
                                Get Directions
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={{ 
                        backgroundColor: 'white', 
                        height: 50, 
                        width: 50, 
                        borderRadius: 25, 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        elevation: 10, 
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        marginTop: 16,
                    }} 
                    onPress={setModal}
                    activeOpacity={0.8}
                >
                    <Icon name="close" size={28} color={COLORS.primary.darkPurple} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: 'rgba(0,0,0,0.7)', 
        position: 'absolute', 
        bottom: 0, 
        width: '100%', 
        borderBottomLeftRadius: 20, 
        borderBottomRightRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    placeInfo: {
        marginBottom: 12,
    },
    placeName: {
        color: 'white', 
        fontSize: 20, 
        fontWeight: '600', 
        lineHeight: 24,
    },
    placeAddress: {
        color: 'rgba(255,255,255,0.9)', 
        fontSize: 14, 
        marginTop: 4,
    },
    placeDetails: {
        flexDirection: 'row',
        marginTop: 8,
    },
    placeRating: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
    },
    placePrice: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
    },
    directionsButton: {
        backgroundColor: COLORS.primary.teal,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    directionsButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
})
