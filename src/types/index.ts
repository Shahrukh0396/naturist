// Raw data structure from JSON
export interface RawPlace {
  _id: { $oid: string };
  sql_id: number;
  features: string[];
  rank: number;
  booking: string;
  images: string[];
  state: string;
  likes: any[];
  admin: boolean;
  deleted: boolean;
  rating: number;
  title: string;
  description: string;
  lat: string;
  lng: string;
  country: string;
  place_type: string;
  link: string;
  thumbnail: string;
  createdAt: { $date: string };
  updatedAt: { $date: string };
  __v: number;
  featured: boolean;
}

// Transformed place structure for the app
export interface Place {
  id: string;
  /** Used for Firebase Storage path (sync script uses sql_id); try this first when fetching images */
  sqlId?: number;
  name: string;
  description: string;
  image: string;
  images: string[]; // All images
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  category: 'beach' | 'camps' | 'hotel' | 'sauna' | 'other';
  rating: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  amenities: string[];
  isPopular: boolean;
  isNearby: boolean;
  distance?: number; // in km
  country: string;
  placeType: string;
  featured: boolean;
  source?: 'local' | 'google' | 'firebase'; // Data source
  googlePlaceId?: string; // Google Place ID if from Google Places API
  phone?: string; // Phone number
  website?: string; // Website URL
}

export interface FilterOptions {
  category: string[];
  priceRange: string[];
  rating: number;
  distance: number;
}

export type RootStackParamList = {
  Landing: undefined;
  MainTabs: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Explore: undefined;
  Map: { placeId?: string } | undefined;
  Contact: undefined;
};
