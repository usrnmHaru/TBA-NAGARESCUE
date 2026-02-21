import { equalTo, get, orderByChild, query, ref } from "firebase/database";
import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
// Must be identical to the one in CitizenRegisterScreen.js.
// At login, we hash the entered password and compare it against
// the stored hash — so we never compare or transmit plaintext.
//
// IMPORTANT: If you change the hash implementation here, you
// must also change it in CitizenRegisterScreen.js, or existing
// accounts will fail to log in (hashes won't match).
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
    // Same fallback as CitizenRegisterScreen — must stay in sync
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

export default function CitizenLoginScreen({ navigation }) {
  const { setUser } = useContext(UserContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both Username and Password.");
      return;
    }

    setLoading(true);

    try {
      // BUG #3 FIX: Hash the entered password before comparing.
      // Firebase stores the hashed version, so we must hash here
      // first — never compare raw password strings.
      const hashedPassword = await hashPassword(password);

      // 1. Search for the user by "username" in the 'households' node
      const householdsRef = ref(db, "households");
      const userQuery = query(
        householdsRef,
        orderByChild("username"),
        equalTo(username)
      );

      const snapshot = await get(userQuery);

      if (snapshot.exists()) {
        let userData = null;

        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          // BUG #3 FIX: Compare hashed password, not plaintext
          if (data.password === hashedPassword) {
            userData = data;
          }
        });

        if (userData) {
          setUser(userData);
        } else {
          Alert.alert("Login Failed", "Incorrect Password.");
        }
      } else {
        Alert.alert("Login Failed", "Username not found.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.innerContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to continue</Text>
        </View>

        {/* Inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register Link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate("CitizenRegister")}
        >
          <Text style={styles.registerText}>
            I don't have an account,{" "}
            <Text style={styles.registerBold}>Register</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  innerContainer: { flex: 1, padding: 25, justifyContent: "center" },

  header: { marginBottom: 40, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "bold", color: "#B71C1C" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 5 },

  form: { width: "100%" },
  label: { fontWeight: "bold", color: "#333", marginBottom: 5, marginTop: 15 },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
  },

  loginButton: {
    backgroundColor: "#B71C1C",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 30,
    elevation: 3,
  },
  loginButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },

  registerLink: { marginTop: 25, alignItems: "center" },
  registerText: { color: "#666", fontSize: 14 },
  registerBold: {
    color: "#B71C1C",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});