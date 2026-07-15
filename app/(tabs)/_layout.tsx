import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from 'react-native-paper';
import RequireAuth from '../../src/components/RequireAuth';

// Import des écrans Accueil
import EvenementsAccueil from './accueil/evenements';
import AccueilIndexScreen from './accueil/index';
import MenageAccueil from './accueil/menage';
import ReportsAccueil from './accueil/rapports';
import TerritoriesAccueil from './accueil/territoires';

// Import des écrans Attribution
import AttributionIndexScreen from './attribution/index';

// Import des écrans Programmes
import EvenementsProgrammes from './programmes/evenements';
import ProgrammesIndexScreen from './programmes/index';
import MenageProgrammes from './programmes/menage';
import MidweekProgrammes from './programmes/midweek';
import TplProgrammes from './programmes/tpl';
import WeekendProgrammes from './programmes/weekend';

// Import des écrans Assemblée
import AssembleeIndexScreen from './assemblee/index';
import AssembleeSettingsScreen from './assemblee/settings';
import WebAuthScannerRoute from './assemblee/web-auth-scanner';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AccueilStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="accueil_index" component={AccueilIndexScreen} options={{ title: 'Accueil' }} />
      <Stack.Screen name="territoires" component={TerritoriesAccueil} options={{ title: 'Mes territoires' }} />
      <Stack.Screen name="rapports" component={ReportsAccueil} options={{ title: 'Mes rapports' }} />
      <Stack.Screen name="menage" component={MenageAccueil} options={{ title: 'Ménage' }} />
      <Stack.Screen name="evenements" component={EvenementsAccueil} options={{ title: 'Événements' }} />
    </Stack.Navigator>
  );
}

function AttributionStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="attribution_index" component={AttributionIndexScreen} options={{ title: 'Attribution' }} />
    </Stack.Navigator>
  );
}

function ProgrammesStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="programmes_index" component={ProgrammesIndexScreen} options={{ title: 'Programmes' }} />
      <Stack.Screen name="tpl" component={TplProgrammes} options={{ title: 'Témoignage public' }} />
      <Stack.Screen name="midweek" component={MidweekProgrammes} options={{ title: 'Réunion de semaine' }} />
      <Stack.Screen name="weekend" component={WeekendProgrammes} options={{ title: 'Réunion du Weekend' }} />
      <Stack.Screen name="evenements_prog" component={EvenementsProgrammes} options={{ title: 'Événements' }} />
      <Stack.Screen name="menage_prog" component={MenageProgrammes} options={{ title: 'Ménage' }} />
    </Stack.Navigator>
  );
}

function AssembleeStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="assemblee_index" component={AssembleeIndexScreen} options={{ title: 'Assemblée' }} />
      <Stack.Screen name="territoires" component={TerritoriesAccueil} options={{ title: 'Mes territoires' }} />
      <Stack.Screen name="settings" component={AssembleeSettingsScreen} options={{ title: 'Paramètres' }} />
      <Stack.Screen name="web_auth_scanner" component={WebAuthScannerRoute} options={{ title: 'Scanner QR web' }} />
    </Stack.Navigator>
  );
}

function TabsNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          
          height:70,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'home';

          if (route.name === 'AccueilStack') iconName = 'home-outline';
          else if (route.name === 'AttributionStack') iconName = 'microphone-outline';
          else if (route.name === 'ProgrammesStack') iconName = 'book-open-variant';
          else if (route.name === 'AssembleeStack') iconName = 'city-variant';

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="AccueilStack" component={AccueilStack} options={{ title: 'Accueil' }} />
      <Tab.Screen name="AttributionStack" component={AttributionStack} options={{ title: 'Attribution' }} />
      <Tab.Screen name="ProgrammesStack" component={ProgrammesStack} options={{ title: 'Programmes' }} />
      <Tab.Screen name="AssembleeStack" component={AssembleeStack} options={{ title: 'Assemblée' }} />
    </Tab.Navigator>
  );
}

export default function TabsLayout() {
  return (
    <RequireAuth>
      <TabsNavigator />
    </RequireAuth>
  );
}
