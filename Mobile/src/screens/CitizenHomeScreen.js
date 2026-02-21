import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useContext, useEffect, useRef, useState } from "react";
// Firebase removed — fully offline SMS mode
import {
  ActivityIndicator,
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SmsListener from "react-native-android-sms-listener";
import SmsAndroid from "react-native-get-sms-android";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserContext } from "../context/UserContext";

// 🚨 ADMIN SIM CARD NUMBERS
const BARANGAY_HOTLINES = {
  Abella: "09634600191",
  "Bagumbayan Norte": "09634120112", //daryl
  "Bagumbayan Sur": "09512412208", //gab
  Balatas: "09207826804", //bryann
  Calauag: "09126773857",
  Cararayan: "09126773857",
  Carolina: "09126773857",
  "Concepcion Grande": "09126773857",
  "Concepcion Pequeña": "09126773857",
  Dayangdang: "09126773857",
  "Del Rosario": "09126773857",
  Dinaga: "09126773857",
  Igualdad: "09813888974", //rachelle
  Lerma: "09126773857",
  Liboton: "09126773857",
  Mabolo: "09126773857",
  Pacol: "09126773857",
  Panicuason: "09126773857",
  Peñafrancia: "09126773857",
  Sabang: "09126773857",
  "San Felipe": "09126773857",
  "San Francisco": "09126773857",
  "San Isidro": "09126773857",
  "Santa Cruz": "09126773857",
  Tabuco: "09126773857",
  Tinago: "09126773857",
  Triangulo: "09126773857",
  DEFAULT: "09126773857",
};

// 🌊 RISK MAPPING
const RISK_MAPPING = {
  Sabang: { default: "HIGH", zones: {} },
  Dinaga: { default: "HIGH", zones: {} },
  Igualdad: { default: "HIGH", zones: {} },
  Tabuco: { default: "LOW", zones: {} },
  DEFAULT: { default: "MEDIUM", zones: {} },
};

const BARANGAY_LIST = Object.keys(BARANGAY_HOTLINES);
const ZONE_LIST = [
  "Zone 1",
  "Zone 2",
  "Zone 3",
  "Zone 4",
  "Zone 5",
  "Zone 6",
  "Zone 7",
];

export default function CitizenHomeScreen({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const [loading, setLoading] = useState(false);

  // State for calculated Urgency and the Reason for it
  const [urgency, setUrgency] = useState("MEDIUM");
  const [urgencyReason, setUrgencyReason] = useState("LOCATION");

  // SOS State
  const [tapCount, setTapCount] = useState(0);
  const resetTapTimer = useRef(null);
  const [targetNumber, setTargetNumber] = useState(BARANGAY_HOTLINES.DEFAULT);

  // helpStatus can be: IDLE, WAITING, RETRY, ON_THE_WAY, RESOLVED
  const [helpStatus, setHelpStatus] = useState("IDLE");
  const [timeLeft, setTimeLeft] = useState(0);

  // --- UI STATE ---
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);
  const [tempBarangay, setTempBarangay] = useState("");
  const [tempZone, setTempZone] = useState("");

  // --- 1. INITIALIZATION & RISK CALCULATION ---
  useEffect(() => {
    if (user && user.barangay) {
      const bgyRisk = RISK_MAPPING[user.barangay] || RISK_MAPPING["DEFAULT"];
      const userZone = user.address || "";
      let calculatedLevel = bgyRisk.default;

      if (bgyRisk.zones && bgyRisk.zones[userZone]) {
        calculatedLevel = bgyRisk.zones[userZone];
      }

      const members = user.members || [];
      const pwdCount = members.filter((m) => m.condition === "PWD").length;

      if (calculatedLevel === "LOW" && pwdCount >= 2) {
        setUrgency("MEDIUM");
        setUrgencyReason("CONDITIONS");
      } else {
        setUrgency(calculatedLevel);
        setUrgencyReason("LOCATION");
      }

      const cleanName = user.barangay.trim();
      setTargetNumber(
        BARANGAY_HOTLINES[cleanName] || BARANGAY_HOTLINES.DEFAULT,
      );
      setTempBarangay(user.barangay);
      setTempZone(user.address);
    }
  }, [user]);

  // --- 2. PERMISSIONS & SMS LISTENER ---
  useEffect(() => {
    const getPerms = async () => {
      if (Platform.OS === "android") {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);
      }
      await Location.requestForegroundPermissionsAsync();
    };
    getPerms();

    // 👂 LISTEN FOR SMS REPLY FROM BARANGAY (Android only)
    // Barangay admin should reply with keywords like:
    //   → "DISPATCHED", "NAGA RESCUE", "ON THE WAY", "COMING" → turns UI green
    //   → "RESOLVED" → marks operation complete
    //   → "CANCELLED" → resets to IDLE
    let subscription = null;
    if (Platform.OS === "android") {
      subscription = SmsListener.addListener((message) => {
        const body = message.body.toUpperCase();

        const isDispatched =
          body.includes("HELP IS COMING") ||
          body.includes("HELP IS ON THE WAY") ||
          body.includes("NAGA RESCUE") ||
          body.includes("DISPATCHED") ||
          body.includes("ON THE WAY") ||
          body.includes("ON MY WAY") ||
          body.includes("COMING");

        const isResolved = body.includes("RESOLVED");
        const isCancelled = body.includes("CANCELLED") || body.includes("CANCELED");

        if (isDispatched) {
          setHelpStatus("ON_THE_WAY");
          Alert.alert(
            "📢 HELP IS COMING!",
            "A Naga Rescue SARU Unit has accepted your mission and is on the way! Stay calm and stay where you are.",
          );
        } else if (isResolved) {
          setHelpStatus("RESOLVED");
          Alert.alert("✅ STATUS UPDATE", "Operation Resolved.", [
            {
              text: "OK (Reset)",
              onPress: () => {
                setHelpStatus("IDLE");
                setTapCount(0);
                setTimeLeft(0);
              },
            },
          ]);
        } else if (isCancelled) {
          setHelpStatus("IDLE");
          setTapCount(0);
          setTimeLeft(0);
          Alert.alert("ℹ️ UPDATE", "Your SOS request was cancelled by the barangay.");
        }
      });
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  // [Firebase listener removed — status updates arrive via SMS listener]

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval = null;
    if (helpStatus === "WAITING") {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(interval);
            return 0; // Stay in WAITING/SENT state, don't auto-retry
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [helpStatus]);

  // --- HELPERS ---
  const getButtonColor = () => {
    if (helpStatus === "ON_THE_WAY") return "#4CAF50"; // Green for dispatched
    if (helpStatus === "WAITING") return "#FF9800"; // Orange while waiting
    if (helpStatus === "RESOLVED") return "#2196F3"; // Blue for resolved
    if (tapCount > 0) return "#EF5350";
    if (urgency === "HIGH") return "#D32F2F";
    if (urgency === "MEDIUM") return "#F57C00";
    return "#FBC02D";
  };

  const getButtonText = () => {
    if (helpStatus === "ON_THE_WAY") return "RESCUE\nINBOUND";
    if (helpStatus === "WAITING") return "REQUEST\nSENT";
    if (helpStatus === "RESOLVED") return "RESOLVED";
    if (tapCount > 0) return "TAP AGAIN";
    return "REQUEST\nFLOOD\nRESCUE";
  };

  const getHouseholdSummary = () => {
    const members = user.members || [];
    const total = members.length + 1;
    let seniors = members.filter((m) => m.condition === "Senior").length;
    let kids = members.filter(
      (m) => m.condition === "Child" || parseInt(m.age) < 18,
    ).length;
    let pwds = members.filter((m) => m.condition === "PWD").length;
    return `Fam=${total}${seniors ? `,${seniors}S` : ""}${kids ? `,${kids}K` : ""}${pwds ? `,${pwds}P` : ""}`;
  };

  // --- SOS LOGIC (SMS only — no internet required) ---
  const handleSOS = async () => {
    if (!user || !user.barangay) {
      Alert.alert("Error", "Profile incomplete.");
      return;
    }
    setLoading(true);
    try {
      let coords = { latitude: 0, longitude: 0 };
      try {
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
          timeout: 5000,
        });
        coords = loc.coords;
      } catch (e) {
        console.log("GPS Fail — using 0,0");
      }

      const msg = `SOS Alert: Name=${user.headName} | Mobile=${user.mobileNumber} | Location=${user.address} | Lat=${coords.latitude.toFixed(6)} | Long=${coords.longitude.toFixed(6)} | Lvl=${urgency}(${urgencyReason}) | ${getHouseholdSummary()} | Type=Flood Rescue`;

      if (Platform.OS === "ios") {
        setLoading(false);
        Alert.alert(
          "SOS Alert",
          "Your device will open the SMS app with your emergency message ready. Just tap Send.",
          [
            {
              text: "Open SMS",
              onPress: () => {
                Linking.openURL(`sms:${targetNumber}&body=${encodeURIComponent(msg)}`);
                setHelpStatus("WAITING");
                setTimeLeft(30);
              },
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      // Android — direct background SMS
      if (!SmsAndroid || typeof SmsAndroid.autoSend !== "function") {
        setLoading(false);
        Alert.alert("SOS Failed", "SMS module unavailable. Please call your barangay directly.");
        return;
      }

      const permResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        {
          title: "SMS Permission Required",
          message: "NagaRescue needs permission to send an emergency SMS on your behalf.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        }
      );

      if (permResult !== PermissionsAndroid.RESULTS.GRANTED) {
        setLoading(false);
        Alert.alert("Permission Denied", "SMS permission is required. Please enable it in app settings.");
        return;
      }

      // Failsafe: release loading after 15s if callbacks never fire
      const smsTimeout = setTimeout(() => {
        setLoading((cur) => {
          if (cur) {
            Alert.alert("SOS Status Unknown", "SMS may have been sent. Wait for a response or try again.");
            return false;
          }
          return cur;
        });
      }, 15000);

      SmsAndroid.autoSend(
        targetNumber,
        msg,
        (fail) => {
          clearTimeout(smsTimeout);
          setLoading(false);
          Alert.alert("SOS Failed", `Could not send SMS.\n\nError: ${fail}\n\nCall ${targetNumber} directly.`);
        },
        () => {
          clearTimeout(smsTimeout);
          setHelpStatus("WAITING");
          setTimeLeft(30);
          setLoading(false);
          Alert.alert("✅ SOS SENT", `SMS sent to barangay hotline. Wait for a reply from ${targetNumber}.`);
        },
      );
    } catch (e) {
      console.log("SOS error:", e);
      setLoading(false);
      Alert.alert("Error", "Failed to send SOS.");
    }
  };

  const handleTripleTap = () => {
    if (loading || helpStatus === "ON_THE_WAY" || helpStatus === "RESOLVED")
      return;

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (resetTapTimer.current) clearTimeout(resetTapTimer.current);

    if (newCount === 3) {
      setTapCount(0);
      handleSOS();
    } else {
      resetTapTimer.current = setTimeout(() => setTapCount(0), 1000);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: () => setUser(null), style: "destructive" },
    ]);
  };

  // --- LOCATION UPDATE ---
  const handleOpenLocationModal = () => {
    setSidebarVisible(false);
    setTempBarangay(user.barangay);
    setTempZone(user.address);
    setLocationModalVisible(true);
  };

  // Location update — local context only (no internet required)
  const saveNewLocation = () => {
    if (!tempBarangay || !tempZone) {
      Alert.alert("Missing Info", "Please select both Barangay and Zone.");
      return;
    }
    const updatedUser = { ...user, barangay: tempBarangay, address: tempZone };
    setUser(updatedUser);
    setLocationModalVisible(false);
    Alert.alert("Success", "Location updated.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => setSidebarVisible(true)}>
            <View style={styles.profileCircle}>
              <Text style={styles.profileInitials}>
                {(user?.headName || user?.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.welcome}>
              Hello, {user?.headName || user?.username}
            </Text>
            <Text style={styles.barangayRes}>{user?.barangay}</Text>
          </View>
        </View>
      </View>

      <View style={styles.centerStage}>
        <View style={styles.riskBadgeContainer}>
          <Text style={styles.riskLabel}>RISK LEVEL</Text>
          <View
            style={[styles.riskBadge, { backgroundColor: getButtonColor() }]}
          >
            <Text style={styles.riskText}>
              {urgency}{" "}
              {urgencyReason === "CONDITIONS" ? "(VULNERABLE)" : "AREA"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.ring,
            {
              backgroundColor: helpStatus === "WAITING" ? "#FFF3E0" :
                helpStatus === "ON_THE_WAY" ? "#E8F5E9" : "#FFEBEE",
              borderColor: getButtonColor(),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.sosButton, { backgroundColor: getButtonColor() }]}
            onPress={helpStatus === "ON_THE_WAY" ? null : handleTripleTap}
            activeOpacity={0.7}
            disabled={loading || helpStatus === "RESOLVED"}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#FFF" />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={[styles.sosText, { fontSize: tapCount > 0 ? 30 : 22 }]}
                >
                  {getButtonText()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>
          {helpStatus === "WAITING"
            ? "Request Sent! Waiting for dispatch..."
            : helpStatus === "ON_THE_WAY"
              ? "Rescue Team is ON THE WAY!"
              : helpStatus === "RESOLVED"
                ? "Operation Complete"
                : "Quickly tap 3 times to send an SOS alert!"}
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>🏠 Registered Home:</Text>
          <Text style={styles.infoValue}>
            {user?.address}, {user?.barangay}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.infoLabel}>📞 Emergency Hotline:</Text>
          <Text style={styles.infoValue}>{targetNumber}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>STATUS</Text>
          <Text
            style={[
              styles.statValue,
              { color: helpStatus === "ON_THE_WAY" ? "green" : "#333" },
            ]}
          >
            {helpStatus === "IDLE" ? "Ready" : helpStatus.replace(/_/g, " ")}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>MODE</Text>
          <Text style={styles.statValue}>Flood Rescue</Text>
        </View>
      </View>

      <Modal
        visible={isSidebarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sidebarContainer}>
            <Text style={styles.sidebarHeader}>Actions</Text>
            <View style={styles.navGroup}>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => {
                  setSidebarVisible(false);
                  navigation.navigate("CitizenProfile");
                }}
              >
                <Text style={styles.navText}>Profile & Household</Text>
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navItem}
                onPress={handleOpenLocationModal}
              >
                <Text style={styles.navText}>Update Location</Text>
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setSidebarVisible(false)}
          />
        </View>
      </Modal>

      <Modal
        visible={isLocationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.locationModal}>
            <Text style={styles.modalTitle}>Update Location</Text>
            <Text style={styles.label}>Select Barangay:</Text>
            <View style={{ height: 50, marginBottom: 15 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BARANGAY_LIST.map((bgy) => (
                  <TouchableOpacity
                    key={bgy}
                    style={[
                      styles.pickerItem,
                      tempBarangay === bgy && styles.pickerItemSelected,
                    ]}
                    onPress={() => setTempBarangay(bgy)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        tempBarangay === bgy && styles.pickerTextSelected,
                      ]}
                    >
                      {bgy}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.label}>Select Zone:</Text>
            <View style={{ height: 50, marginBottom: 20 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ZONE_LIST.map((zone) => (
                  <TouchableOpacity
                    key={zone}
                    style={[
                      styles.pickerItem,
                      tempZone === zone && styles.pickerItemSelected,
                    ]}
                    onPress={() => setTempZone(zone)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        tempZone === zone && styles.pickerTextSelected,
                      ]}
                    >
                      {zone}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSave}
                onPress={saveNewLocation}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnSaveText}>Save Location</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  topBar: {
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  profileCircle: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "#B71C1C",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  profileInitials: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  welcome: { fontSize: 16, fontWeight: "bold", color: "#333" },
  barangayRes: { fontSize: 12, color: "#666" },

  centerStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  riskBadgeContainer: { alignItems: "center", marginBottom: 20 },
  riskLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#999",
    marginBottom: 5,
  },
  riskBadge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15 },
  riskText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },

  ring: {
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  sosText: {
    fontWeight: "900",
    color: "#FFF",
    textAlign: "center",
    lineHeight: 28,
  },
  instruction: {
    color: "#555",
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },

  infoBox: {
    backgroundColor: "#E3F2FD",
    padding: 15,
    borderRadius: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  infoLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: "#0D47A1",
    fontWeight: "bold",
    marginBottom: 5,
  },
  divider: { height: 1, backgroundColor: "#BBDEFB", marginVertical: 8 },

  footer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#EEE",
    padding: 20,
    backgroundColor: "#FAFAFA",
  },
  statBox: { flex: 1 },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    marginBottom: 4,
  },
  statValue: { fontSize: 14, fontWeight: "600", color: "#333" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
  },
  sidebarContainer: {
    width: "70%",
    backgroundColor: "#FFF",
    height: "100%",
    paddingVertical: 50,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.3,
    elevation: 10,
  },
  sidebarHeader: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#B71C1C",
    marginBottom: 30,
  },
  navGroup: { marginBottom: 20 },
  navItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#F5F5F5",
  },
  navText: { fontSize: 16, color: "#333", fontWeight: "500" },
  navArrow: { fontSize: 20, color: "#999" },
  sidebarFooter: { marginTop: "auto" },
  logoutBtn: { paddingVertical: 15 },
  logoutText: { color: "#D32F2F", fontWeight: "bold", fontSize: 16 },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  locationModal: {
    backgroundColor: "#FFF",
    borderRadius: 15,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#B71C1C",
    textAlign: "center",
  },
  label: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 10 },
  pickerItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EEE",
    justifyContent: "center",
  },
  pickerItemSelected: { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" },
  pickerText: { color: "#555", fontSize: 14 },
  pickerTextSelected: { color: "#B71C1C", fontWeight: "bold" },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  btnCancel: {
    flex: 1,
    padding: 12,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: "#EEE",
    alignItems: "center",
  },
  btnCancelText: { color: "#555", fontWeight: "bold" },
  btnSave: {
    flex: 1,
    padding: 12,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: "#B71C1C",
    alignItems: "center",
  },
  btnSaveText: { color: "#FFF", fontWeight: "bold" },
});
