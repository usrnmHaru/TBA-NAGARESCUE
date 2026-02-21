import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* 1. BRANDING / HEADER */}
      <View style={styles.headerContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>🚑</Text>
        </View>
        <Text style={styles.appName}>Naga City Rescue</Text>
        <Text style={styles.tagline}>Emergency Response System</Text>
      </View>

      {/* 2. CITIZEN ACTIONS */}
      <View style={styles.actionContainer}>
        <Text style={styles.welcomeText}>Welcome, Citizen!</Text>
        <Text style={styles.instructionText}>
          Please choose an option to proceed:
        </Text>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate("CitizenLogin")} // Will link to the UI you send next
        >
          <Text style={styles.loginText}>LOGIN</Text>
        </TouchableOpacity>

        {/* Register Button */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate("CitizenRegister")} // Will link to the UI you send next
        >
          <Text style={styles.registerText}>CREATE ACCOUNT</Text>
        </TouchableOpacity>
      </View>

      {/* 3. OFFICIAL GATEWAY (Preserved) */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Official Personnel?</Text>
        <TouchableOpacity onPress={() => navigation.navigate("BarangayLogin")}>
          <Text style={styles.linkText}>Login as Barangay Official</Text>
        </TouchableOpacity>

        {/* Temporary: SARU Login */}
        <TouchableOpacity
          style={{ marginTop: 15 }}
          onPress={() => navigation.navigate("SaruLogin")}
        >
          <Text style={[styles.linkText, { color: "#1976D2" }]}>Login as SARU Responder</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
    paddingVertical: 40,
  },

  // Header Section
  headerContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFEBEE", // Light Red
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  logoIcon: {
    fontSize: 50,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#B71C1C", // Deep Red
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: "#757575",
    marginTop: 5,
  },

  // Action Section
  actionContainer: {
    width: "100%",
    paddingHorizontal: 30,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },

  // Buttons
  loginButton: {
    width: "100%",
    backgroundColor: "#B71C1C", // Main Red
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  registerButton: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#B71C1C",
  },
  registerText: {
    color: "#B71C1C",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },

  // Footer / Gateway
  footer: {
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    color: "#888",
    fontSize: 12,
  },
  linkText: {
    color: "#B71C1C",
    fontWeight: "bold",
    fontSize: 14,
    textDecorationLine: "underline",
    marginTop: 5,
  },
});
