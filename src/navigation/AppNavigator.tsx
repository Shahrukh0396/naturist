import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { RootStackParamList, RootTabParamList } from '../types';
import { COLORS } from '../theme/colors';

// Import screens
import LandingScreen from '../screens/LandingScreen';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MapScreen from '../screens/MapScreen';
import ContactScreen from '../screens/ContactScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const TabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: string;

            if (route.name === 'Home') {
              iconName = focused ? '🏠' : '🏡';
            } else if (route.name === 'Explore') {
              iconName = focused ? '🔍' : '🔎';
            } else if (route.name === 'Map') {
              iconName = focused ? '🗺️' : '🗺️';
            } else if (route.name === 'Contact') {
              iconName = focused ? '📞' : '📞';
            } else {
              iconName = '❓';
            }

            return <Text style={{ fontSize: size, color }}>{iconName}</Text>;
          },
          tabBarActiveTintColor: COLORS.primary.teal,
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderTopWidth: 1,
            borderTopColor: COLORS.primary.mint,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6),
            paddingTop: 6,
            height: 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6),
          },
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerStyle: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.primary.mint,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.primary.darkPurple,
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            headerShown: false, // We have custom header in HomeScreen
          }}
        />
        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{
            title: 'Explore',
            headerShown: false, // We have custom header in ExploreScreen
          }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Map',
            headerShown: false, // We have custom header in MapScreen
          }}
        />
        <Tab.Screen
          name="Contact"
          component={ContactScreen}
          options={{
            title: 'Contact',
            headerShown: false, // We have custom header in ContactScreen
          }}
        />
      </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Landing">
          {({ navigation }) => (
            <LandingScreen
              onGetStarted={() => navigation.replace('MainTabs')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
