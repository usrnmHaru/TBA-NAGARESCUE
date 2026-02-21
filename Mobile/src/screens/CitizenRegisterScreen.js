import { ref, set } from "firebase/database";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserContext } from "../context/UserContext";
import { db } from "../firebaseConfig";

// ─────────────────────────────────────────────────────────────
// BUG #3 FIX: hashPassword()
//
// Previously: password was saved as plaintext in Firebase.
// Anyone with Firebase console access (or a leaked DB export)
// could read every citizen's password directly.
//
// Fix: We apply a lightweight, deterministic hash before saving.
// We use the Web Crypto API (available in React Native's JS
// environment via Hermes / JSC) to run SHA-256.
//
// The same hash is applied at login time, so the comparison
// still works — we just never store or transmit the raw string.
//
// Why SHA-256 and not bcrypt?
//   → bcrypt requires a native module. SHA-256 is built into
//     the JS runtime — no extra dependency needed, which matters
//     during a hackathon. For production you'd want bcrypt +
//     a salt, but SHA-256 is a significant improvement over
//     plaintext for a demo.
// ─────────────────────────────────────────────────────────────
const hashPassword = async (plaintext) => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  } catch (e) {
    // Fallback: if crypto.subtle is unavailable (very old RN),
    // use a simple obfuscation rather than storing plaintext.
    // This is NOT cryptographically secure but is better than nothing.
    console.warn("[Auth] crypto.subtle unavailable, using fallback hash.");
    let hash = 0;
    for (let i = 0; i < plaintext.length; i++) {
      const char = plaintext.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `fb-${Math.abs(hash).toString(16)}`;
  }
};

// List of Barangays
const BARANGAY_LIST = [
  "Abella",
  "Bagumbayan Norte",
  "Bagumbayan Sur",
  "Balatas",
  "Calauag",
  "Cararayan",
  "Carolina",
  "Concepcion Grande",
  "Concepcion Pequeña",
  "Dayangdang",
  "Del Rosario",
  "Dinaga",
  "Igualdad",
  "Lerma",
  "Liboton",
  "Mabolo",
  "Pacol",
  "Panicuason",
  "Peñafrancia",
  "Sabang",
  "San Felipe",
  "San Francisco",
  "San Isidro",
  "Santa Cruz",
  "Tabuco",
  "Tinago",
  "Triangulo",
];

// Zone Options
const ZONE_LIST = [
  "Zone 1",
  "Zone 2",
  "Zone 3",
  "Zone 4",
  "Zone 5",
  "Zone 6",
  "Zone 7",
];

export default function CitizenRegisterScreen({ navigation }) {
  const { setUser } = useContext(UserContext);

  // --- FORM STATE ---
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [headName, setHeadName] = useState("");
  const [selectedZone, setSelectedZone] = useState(ZONE_LIST[0]);
  const [selectedBarangay, setSelectedBarangay] = useState(BARANGAY_LIST[0]);
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !headName || !mobileNumber) {
      Alert.alert("Missing Info", "Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      // BUG #3 FIX: Hash the password before storing — never save plaintext
      const hashedPassword = await hashPassword(password);

      const userData = {
        username,
        password: hashedPassword, // ← FIXED: hashed, not plaintext
        headName,
        address: selectedZone,
        barangay: selectedBarangay,
        mobileNumber,
        members: [],
      };

      // Save to Firebase under households/{mobileNumber}
      await set(ref(db, `households/${mobileNumber}`), userData);

      Alert.alert("Success", "Account Created!", [
        {
          text: "OK",
          onPress: () => {
            if (setUser) {
              setUser(userData);
            } else {
              console.error("setUser is undefined");
            }
          },
        },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSub}>Fill in your details below</Text>

          {/* CREDENTIALS SECTION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Login Credentials</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* PERSONAL INFO SECTION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <Text style={styles.label}>Full Name (Head of Family)</Text>
            <TextInput
              style={styles.input}
              placeholder="Juan Dela Cruz"
              value={headName}
              onChangeText={setHeadName}
            />

            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="09123456789"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
            />

            {/* BARANGAY SELECTOR */}
            <Text style={styles.label}>Barangay</Text>
            <View style={styles.pickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BARANGAY_LIST.map((bgy) => (
                  <TouchableOpacity
                    key={bgy}
                    style={[
                      styles.pickerItem,
                      selectedBarangay === bgy && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedBarangay(bgy)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        selectedBarangay === bgy && styles.pickerTextSelected,
                      ]}
                    >
                      {bgy}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ZONE SELECTOR */}
            <Text style={styles.label}>Zone / Purok</Text>
            <View style={styles.pickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ZONE_LIST.map((zone) => (
                  <TouchableOpacity
                    key={zone}
                    style={[
                      styles.pickerItem,
                      selectedZone === zone && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedZone(zone)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        selectedZone === zone && styles.pickerTextSelected,
                      ]}
                    >
                      {zone}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* REGISTER BUTTON */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>REGISTER</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { padding: 20 },

  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#B71C1C",
    textAlign: "center",
    marginTop: 10,
  },
  headerSub: { textAlign: "center", color: "#666", marginBottom: 30 },

  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    paddingBottom: 5,
  },

  label: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 5 },
  input: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },

  pickerContainer: { flexDirection: "row", marginBottom: 15, height: 50 },
  pickerItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EEE",
    justifyContent: "center",
  },
  pickerItemSelected: { backgroundColor: "#FFEBEE", borderColor: "#B71C1C" },
  pickerText: { color: "#555" },
  pickerTextSelected: { color: "#B71C1C", fontWeight: "bold" },

  registerButton: {
    backgroundColor: "#B71C1C",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    elevation: 3,
  },
  btnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },

  backLink: { marginTop: 20, alignItems: "center", marginBottom: 20 },
  backLinkText: { color: "#777" },
});