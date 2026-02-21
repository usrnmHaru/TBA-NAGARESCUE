import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { UserContext, UserProvider } from "./src/context/UserContext";

// --- IMPORT SCREENS ---
import CitizenHomeScreen from "./src/screens/CitizenHomeScreen";
import CitizenLoginScreen from "./src/screens/CitizenLoginScreen";
import CitizenProfileScreen from "./src/screens/CitizenProfileScreen";
import CitizenRegisterScreen from "./src/screens/CitizenRegisterScreen";
import LandingScreen from "./src/screens/LandingScreen";

// --- BARANGAY SCREENS ---
import BarangayDashboardScreen from "./src/screens/BarangayDashboardScreen";
import BarangayLoginScreen from "./src/screens/BarangayLoginScreen";

// --- SARU SCREENS ---
import SaruDashboardScreen from "./src/screens/SaruDashboardScreen";
import SaruLoginScreen from "./src/screens/SaruLoginScreen";

const Stack = createNativeStackNavigator();

function AppNav() {
  const { user } = useContext(UserContext);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={CitizenHomeScreen} />
            <Stack.Screen
              name="CitizenProfile"
              component={CitizenProfileScreen}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="CitizenLogin" component={CitizenLoginScreen} />
            <Stack.Screen
              name="CitizenRegister"
              component={CitizenRegisterScreen}
            />
            <Stack.Screen
              name="BarangayLogin"
              component={BarangayLoginScreen}
            />
            <Stack.Screen
              name="BarangayDashboard"
              component={BarangayDashboardScreen}
            />
            <Stack.Screen name="SaruLogin" component={SaruLoginScreen} />
            <Stack.Screen
              name="SaruDashboard"
              component={SaruDashboardScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppNav />
    </UserProvider>
  );
}
