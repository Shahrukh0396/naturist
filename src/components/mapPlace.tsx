import * as React from "react"
import { Modal, TextStyle, View, ViewStyle, Platform, Dimensions, Image, TouchableOpacity, Text, Alert, StyleSheet, ActivityIndicator } from "react-native"
import Icon from 'react-native-vector-icons/MaterialIcons'
import { useNavigation } from '@react-navigation/native'
import FastImage from "react-native-fast-image"
import { showLocation } from 'react-native-map-link'
import { Place } from "../types"
import { Location } from "../services/locationService"
import { COLORS } from "../theme/colors"
import { getPlaceImagesFromStorage } from "../services/firebaseStorageService"
import ImageCarousel from "./ImageCarousel"

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
    const [images, setImages] = React.useState<string[]>([]);
    const [loadingImages, setLoadingImages] = React.useState(true);

    // Load images from Firebase Storage when modal opens or data changes
    React.useEffect(() => {
        if (modal && data) {
            loadImages();
        }
    }, [modal, data?.id]);

    const loadImages = async () => {
        if (!data) return;
        
        setLoadingImages(true);
        
        try {
            // First, try to get images from Firebase Storage
            const placeId = data.id;
            const firebaseImages = await getPlaceImagesFromStorage(placeId, 10);
            
            if (firebaseImages && firebaseImages.length > 0) {
                // Use Firebase Storage images
                setImages(firebaseImages);
            } else {
                // Fallback to local images
                const localImages: string[] = [];
                
                // Add main image if available
                if (data.image && typeof data.image === 'string' && data.image.startsWith('http')) {
                    localImages.push(data.image);
                }
                
                // Add images from images array
                if (data.images && Array.isArray(data.images)) {
                    data.images.forEach((img) => {
                        if (typeof img === 'string' && img.startsWith('http') && !localImages.includes(img)) {
                            localImages.push(img);
                        }
                    });
                }
                
                // If no images found, use placeholder
                if (localImages.length === 0) {
                    localImages.push(''); // Empty string will trigger placeholder
                }
                
                setImages(localImages);
            }
        } catch (error) {
            console.error('Error loading images:', error);
            // Fallback to local images
            const localImages: string[] = [];
            if (data.image && typeof data.image === 'string' && data.image.startsWith('http')) {
                localImages.push(data.image);
            } else if (data.images && data.images.length > 0) {
                localImages.push(...data.images.filter((img): img is string => 
                    typeof img === 'string' && img.startsWith('http')
                ));
            }
            setImages(localImages.length > 0 ? localImages : ['']);
        } finally {
            setLoadingImages(false);
        }
    };

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
                    <View style={{ flex: 1, position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
                        {loadingImages ? (
                            <View style={[styles.imageContainer, { height: viewportHeight * 0.4 }]}>
                                <ActivityIndicator size="large" color={COLORS.primary.teal} />
                                <Text style={styles.loadingText}>Loading images...</Text>
                            </View>
                        ) : images.length > 0 ? (
                            <View style={{ width: '100%', height: viewportHeight * 0.4 }}>
                                <ImageCarousel
                                    images={images}
                                    sliderBoxHeight={viewportHeight * 0.4}
                                    parentWidth={viewportWidth * 0.88}
                                    dotColor={COLORS.primary.teal}
                                    inactiveDotColor="#90A4AE"
                                    paginationBoxVerticalPadding={20}
                                    autoplay={images.length > 1}
                                    circleLoop={images.length > 1}
                                    resizeMethod={'resize'}
                                    resizeMode={'cover'}
                                />
                            </View>
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
    imageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    loadingText: {
        color: COLORS.primary.teal,
        fontSize: 14,
        marginTop: 12,
        fontWeight: '500',
    },
    placeholderContainer: {
        height: viewportHeight * 0.4,
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    errorText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 8,
        fontWeight: '500',
    },
})
