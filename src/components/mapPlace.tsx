import * as React from "react"
import { Modal, View, ViewStyle, Dimensions, Image, TouchableOpacity, Text, Alert, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import Icon from 'react-native-vector-icons/MaterialIcons'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { showLocation } from 'react-native-map-link'
import { Place } from "../types"
import { Location } from "../services/locationService"
import { COLORS } from "../theme/colors"
import { getPlaceImagesFromStorage, isFirebaseStorageUrl } from "../services/firebaseStorageService"
import { capitalizeCountry } from "../utils/format"
import ImageCarousel from "./ImageCarousel"
import AdBanner from "./AdBanner"
import { useRewardedInterstitialAd } from "../hooks/useRewardedInterstitialAd"

const OFFLINE_UNLOCKED_KEY = 'offline_unlocked_place_ids'

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

const IMAGE_SECTION_HEIGHT = viewportHeight * 0.28
const MAX_MODAL_HEIGHT = viewportHeight * 0.75
const MIN_MODAL_HEIGHT = viewportHeight * 0.35

const filterSubBase: ViewStyle = {
    maxHeight: MAX_MODAL_HEIGHT,
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
    const [offlineUnlocked, setOfflineUnlocked] = React.useState(false);

    // Content-driven height: measure scroll content and directions bar
    const [scrollContentHeight, setScrollContentHeight] = React.useState(0);
    const [directionsBarHeight, setDirectionsBarHeight] = React.useState(32);

    const modalHeight = React.useMemo(() => {
        const contentHeight = IMAGE_SECTION_HEIGHT + directionsBarHeight + scrollContentHeight;
        return Math.max(MIN_MODAL_HEIGHT, Math.min(contentHeight, MAX_MODAL_HEIGHT));
    }, [scrollContentHeight, directionsBarHeight]);

    // Opt-in rewarded ad: grant offline unlock only when user completes the video
    const { show: showRewardedAd, isLoaded: isRewardedAdLoaded } = useRewardedInterstitialAd({
        onReward: async () => {
            if (!data) return;
            try {
                const raw = await AsyncStorage.getItem(OFFLINE_UNLOCKED_KEY);
                const ids: string[] = raw ? JSON.parse(raw) : [];
                if (!ids.includes(data.id)) {
                    ids.push(data.id);
                    await AsyncStorage.setItem(OFFLINE_UNLOCKED_KEY, JSON.stringify(ids));
                }
                setOfflineUnlocked(true);
                Alert.alert('Offline map unlocked', 'This place is now available for offline viewing.');
            } catch (e) {
                if (__DEV__) console.warn('[MapPlace] Failed to save offline unlock:', e);
            }
        },
    });

    // Hide "Loading ad..." after a short delay when ad never loads (e.g. Android) so we don't show a stuck disabled button
    const [rewardedAdUnavailable, setRewardedAdUnavailable] = React.useState(false);
    React.useEffect(() => {
        if (!modal || offlineUnlocked) return;
        const t = setTimeout(() => {
            setRewardedAdUnavailable(true);
        }, 4000);
        return () => clearTimeout(t);
    }, [modal, offlineUnlocked]);

    // Reset content-driven height and rewarded-ad state when modal closes so next open sizes correctly
    React.useEffect(() => {
        if (!modal) {
            setScrollContentHeight(0);
            setRewardedAdUnavailable(false);
        }
    }, [modal]);

    // Load offline-unlocked state and images when modal opens
    React.useEffect(() => {
        if (modal && data) {
            AsyncStorage.getItem(OFFLINE_UNLOCKED_KEY)
                .then((raw) => {
                    if (!raw) return;
                    const ids: string[] = JSON.parse(raw);
                    setOfflineUnlocked(ids.includes(data.id));
                })
                .catch(() => { });
        }
    }, [modal, data?.id]);

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
            // First, try to get images from Firebase Storage (sync uses sql_id first)
            const storageId = data.sqlId != null ? String(data.sqlId) : data.id;
            const alternateId = data.sqlId != null ? data.id : undefined;
            const firebaseImages = await getPlaceImagesFromStorage(storageId, 10, ...(alternateId ? [alternateId] : []));

            if (firebaseImages && firebaseImages.length > 0) {
                setImages(firebaseImages);
            } else {
                // Only use Firebase Storage URLs; ignore other domains
                const localImages: string[] = [];
                if (data.image && isFirebaseStorageUrl(data.image)) localImages.push(data.image);
                if (data.images?.length) {
                    data.images.forEach((img: string) => {
                        if (isFirebaseStorageUrl(img) && !localImages.includes(img)) localImages.push(img);
                    });
                }
                setImages(localImages.length > 0 ? localImages : ['']);
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
        <Modal visible={modal} transparent={true} animationType="slide" onRequestClose={setModal} style={{ zIndex: 3 }}>
            <TouchableOpacity
                style={filterMain}
                activeOpacity={1}
                onPress={setModal}
            >
                <TouchableOpacity
                    style={[filterSubBase, { height: modalHeight }]}
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
                        {loadingImages ? (
                            <View style={[styles.imageContainer, { height: IMAGE_SECTION_HEIGHT }]}>
                                <ActivityIndicator size="large" color={COLORS.primary.teal} />
                                <Text style={styles.loadingText}>Loading images...</Text>
                            </View>
                        ) : images.length > 0 ? (
                            <View style={{ width: '100%', height: IMAGE_SECTION_HEIGHT }}>
                                <ImageCarousel
                                    images={images}
                                    sliderBoxHeight={IMAGE_SECTION_HEIGHT}
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
                                style={{ height: IMAGE_SECTION_HEIGHT, width: '100%', borderRadius: 20 }}
                                resizeMode="cover"
                            />
                        )}
                    </View>
                    {/* Directions button always visible - open in Google/Apple Maps */}
                    <View
                        style={styles.directionsBar}
                        onLayout={(e) => setDirectionsBarHeight(e.nativeEvent.layout.height)}
                    >
                        <TouchableOpacity
                            style={styles.directionsButton}
                            onPress={handleGetDirections}
                            activeOpacity={0.8}
                        >
                            <Icon name="directions" size={20} color="white" />
                            <Text style={[styles.directionsButtonText, { marginLeft: 8 }]}>Open in Maps</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={styles.scrollContent}
                        contentContainerStyle={styles.scrollContentContainer}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
                    >
                        <View style={styles.placeInfo}>
                            <Text style={styles.placeName}>{data.name}</Text>
                            {data.location.address && (
                                <Text style={styles.placeAddress}>{capitalizeCountry(data.location.address)}</Text>
                            )}
                        </View>
                        <Text style={styles.placeDescription} numberOfLines={10}>
                            {data.description || 'No description available'}
                        </Text>
                        {/* Place detail banner: one medium rectangle after description; collapse when ads unavailable (e.g. Android) to avoid empty space */}
                        <View style={styles.bannerWrapCollapsible}>
                            <AdBanner variant="mediumRectangle" style={styles.placeDetailBanner} collapseWhenUnavailable />
                        </View>
                        {/* Opt-in rewarded: only grant offline unlock when user completes the ad. Hide section if ad never loads (e.g. Android) to avoid stuck "Loading ad..." button. */}
                        {!offlineUnlocked && (isRewardedAdLoaded || !rewardedAdUnavailable) && (
                            <TouchableOpacity
                                style={[styles.rewardedButton, !isRewardedAdLoaded && styles.rewardedButtonDisabled]}
                                onPress={() => showRewardedAd()}
                                disabled={!isRewardedAdLoaded}
                                activeOpacity={0.8}
                            >
                                <Icon name="offline-pin" size={20} color="white" />
                                <Text style={styles.rewardedButtonText}>
                                    {isRewardedAdLoaded
                                        ? 'Watch ad to unlock offline map'
                                        : 'Loading ad...'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {offlineUnlocked && (
                            <View style={styles.offlineBadge}>
                                <Icon name="offline-pin" size={18} color={COLORS.primary.teal} />
                                <Text style={styles.offlineBadgeText}>Available offline</Text>
                            </View>
                        )}
                    </ScrollView>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.closeButton}
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
    scrollContent: {
        flex: 1,
        backgroundColor: 'white',
    },
    scrollContentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    placeInfo: {
        marginTop: 12,
        marginBottom: 8,
    },
    placeName: {
        color: '#1a1a1a',
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 24,
    },
    placeAddress: {
        color: '#555',
        fontSize: 14,
        marginTop: 4,
    },
    placeDescription: {
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
        marginBottom: 8,
    },
    bannerWrap: {
        marginVertical: 20,
        minHeight: 250,
        alignItems: 'center',
    },
    /** No minHeight so when AdBanner collapses (collapseWhenUnavailable) the row doesn't leave empty space */
    bannerWrapCollapsible: {
        marginVertical: 20,
        alignItems: 'center',
    },
    placeDetailBanner: {
        marginVertical: 20,
    },
    rewardedButton: {
        backgroundColor: COLORS.primary.teal,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        marginBottom: 12,
    },
    rewardedButtonDisabled: {
        opacity: 0.6,
    },
    rewardedButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    offlineBadgeText: {
        color: COLORS.primary.teal,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    directionsBar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'white',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
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
    closeButton: {
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
