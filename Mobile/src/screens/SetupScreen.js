import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SimCardsManager from "react-native-sim-cards-manager";
import { UserContext } from "../context/UserContext";

// ✅ COMPLETE LIST OF BARANGAYS (Naga City)
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

const VULNERABILITY_TYPES = [
  "None",
  "Senior",
  "PWD",
  "Child",
  "Pregnant",
  "Sick",
];

export default function SetupScreen({ navigation }) {
  const { saveUser } = useContext(UserContext);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [barangay, setBarangay] = useState("");
  const [addressDetails, setAddressDetails] = useState("");

  // 👨‍👩‍👧‍👦 HOUSEHOLD STATE
  const [familyMembers, setFamilyMembers] = useState([]);
  const [tempMemberName, setTempMemberName] = useState("");
  const [tempMemberAge, setTempMemberAge] = useState("");
  const [tempMemberVuln, setTempMemberVuln] = useState("None");

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // 📲 SIM STATE
  const [simCards, setSimCards] = useState([]);
  const [selectedSim, setSelectedSim] = useState(null);

  useEffect(() => {
    fetchSimCards();
  }, []);

  const fetchSimCards = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          const cards = await SimCardsManager.getSimCards({
            title: "Select SIM",
            message: "Choose SIM for SOS",
            buttonPositive: "Ok",
            buttonNegative: "Cancel",
          });
          if (cards && cards.length > 0) {
            setSimCards(cards);
            // Auto-select first SIM if available
            if (cards[0].phoneNumber) {
              setSelectedSim({ number: cards[0].phoneNumber, slot: 0 });
              setPhone(cards[0].phoneNumber);
            }
          }
        }
      } catch (error) {
        console.log("SIM Error", error);
      }
    }
  };

  const handleSimSelect = (sim, index) => {
    let num = sim.phoneNumber || "";
    setSelectedSim({ number: num, slot: index });
    if (num) setPhone(num);
    Alert.alert("SIM Selected", `Using SIM Slot ${index + 1}`);
  };

  // --- HOUSEHOLD LOGIC ---
  const addFamilyMember = () => {
    if (!tempMemberName || !tempMemberAge) {
      Alert.alert("Missing Info", "Please enter name and age.");
      return;
    }
    const newMember = {
      id: Date.now().toString(),
      name: tempMemberName,
      age: tempMemberAge,
      vulnerability: tempMemberVuln,
    };
    setFamilyMembers([...familyMembers, newMember]);
    setTempMemberName("");
    setTempMemberAge("");
    setTempMemberVuln("None");
    Keyboard.dismiss();
  };

  const removeMember = (id) => {
    setFamilyMembers(familyMembers.filter((m) => m.id !== id));
  };

  const handleSave = async () => {
    if (!name || !barangay || !phone || !addressDetails) {
      Alert.alert(
        "Missing Fields",
        "Please complete personal and address details.",
      );
      return;
    }

    setLoading(true);

    // Summarize conditions for quick view
    const vulnSummary = familyMembers
      .map((m) => m.vulnerability)
      .filter((v) => v !== "None")
      .join(", ");
    const conditions = vulnSummary || "None";

    const userData = {
      name,
      phone,
      barangay,
      addressDetails,
      familyMembers,
      conditions,
      selectedSimSlot: selectedSim ? selectedSim.slot : 0,
    };

    await saveUser(userData);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Resident Registration</Text>
        <Text style={styles.subHeader}>
          Pre-register your household for faster rescue.
        </Text>

        {/* 1. PERSONAL DETAILS */}
        <Text style={styles.sectionTitle}>1. Head of Household</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter Full Name (Head of Household)"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />

        {/* SIM CARD SELECTOR */}
        {simCards.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.label}>Select SIM for SOS:</Text>
            {simCards.map((sim, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.simButton,
                  selectedSim?.slot === index && styles.simButtonActive,
                ]}
                onPress={() => handleSimSelect(sim, index)}
              >
                <Text
                  style={[
                    styles.simText,
                    selectedSim?.slot === index && { color: "#FFF" },
                  ]}
                >
                  SIM {index + 1}{" "}
                  {sim.carrierName ? `(${sim.carrierName})` : ""} -{" "}
                  {sim.phoneNumber || "No Num"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Enter Mobile Number (e.g., 0912...)"
          placeholderTextColor="#999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setModalVisible(true)}
        >
          <Text style={barangay ? styles.inputText : styles.placeholder}>
            {barangay || "Select Barangay"}
          </Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          placeholder="Enter Complete Address (House #, Street, Zone, Landmark)"
          placeholderTextColor="#999"
          value={addressDetails}
          onChangeText={setAddressDetails}
          multiline
        />

        {/* 2. HOUSEHOLD MEMBERS */}
        <Text style={styles.sectionTitle}>2. Household Members</Text>
        <View style={styles.addMemberBox}>
          <TextInput
            style={styles.smallInput}
            placeholder="Enter Family Member Name"
            placeholderTextColor="#999"
            value={tempMemberName}
            onChangeText={setTempMemberName}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TextInput
              style={[styles.smallInput, { width: "30%" }]}
              placeholder="Age"
              placeholderTextColor="#999"
              value={tempMemberAge}
              onChangeText={setTempMemberAge}
              keyboardType="numeric"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.vulnScroll}
            >
              {VULNERABILITY_TYPES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.vulnBadge,
                    tempMemberVuln === v && styles.vulnBadgeActive,
                  ]}
                  onPress={() => setTempMemberVuln(v)}
                >
                  <Text
                    style={[
                      styles.vulnText,
                      tempMemberVuln === v && { color: "white" },
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.btnAdd} onPress={addFamilyMember}>
            <Text style={styles.btnText}>+ Add Member</Text>
          </TouchableOpacity>
        </View>

        {/* MEMBER LIST */}
        {familyMembers.length > 0 ? (
          familyMembers.map((m) => (
            <View key={m.id} style={styles.memberCard}>
              <View>
                <Text style={styles.memberName}>
                  {m.name} ({m.age} y/o)
                </Text>
                <Text style={styles.memberVuln}>
                  Condition: {m.vulnerability}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeMember(m.id)}>
                <Text style={styles.removeText}>✖</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No members added yet.</Text>
        )}

        {/* REGISTER BUTTON */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>REGISTER & START</Text>
          )}
        </TouchableOpacity>

        {/* LOGIN LINK (If user is an official or has account) */}
        <TouchableOpacity
          onPress={() => navigation.navigate("BarangayLogin")}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>
            Are you a Barangay Official? Login Here
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Barangay Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <FlatList
              data={BARANGAY_LIST}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setBarangay(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scroll: { padding: 20 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#B71C1C",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },

  input: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
    marginBottom: 10,
  },
  dropdown: {
    backgroundColor: "#F9F9F9",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  inputText: { fontSize: 16, color: "#333" },
  placeholder: { fontSize: 16, color: "#999" },

  // Member Styles
  addMemberBox: {
    backgroundColor: "#F0F0F0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  smallInput: {
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  vulnScroll: { flexDirection: "row", marginLeft: 10 },
  vulnBadge: {
    padding: 8,
    marginHorizontal: 3,
    borderRadius: 15,
    backgroundColor: "#DDD",
  },
  vulnBadgeActive: { backgroundColor: "#D32F2F" },
  vulnText: { fontSize: 10, fontWeight: "bold", color: "#333" },
  btnAdd: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  btnText: { color: "#FFF", fontWeight: "bold" },

  memberCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    marginBottom: 5,
    borderRadius: 5,
  },
  memberName: { fontWeight: "bold", fontSize: 16 },
  memberVuln: { fontSize: 12, color: "#D32F2F" },
  removeText: { color: "red", fontSize: 18, padding: 5 },
  emptyText: {
    textAlign: "center",
    color: "#AAA",
    fontStyle: "italic",
    marginBottom: 10,
  },

  // SIM Styles
  label: { fontSize: 12, fontWeight: "bold", marginBottom: 5 },
  simButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 5,
    marginBottom: 5,
  },
  simButtonActive: { backgroundColor: "#1976D2", borderColor: "#1976D2" },
  simText: { fontSize: 12, color: "#333" },

  saveButton: {
    backgroundColor: "#B71C1C",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },

  loginLink: { marginTop: 20, alignItems: "center", marginBottom: 40 },
  loginLinkText: { color: "#666", textDecorationLine: "underline" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  modalItemText: { fontSize: 16 },
  closeButton: { marginTop: 20, alignItems: "center", padding: 10 },
  closeButtonText: { color: "red", fontSize: 16 },
});
