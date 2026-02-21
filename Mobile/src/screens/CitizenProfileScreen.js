import { ref, update } from "firebase/database";
import { useContext, useEffect, useState } from "react";
import {
    Alert,
    Button,
    KeyboardAvoidingView, // <--- Added Button Component
    Modal,
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

const CONDITIONS = ["None", "PWD", "Senior", "Pregnant", "Sick", "Child"];
const RELATIONSHIPS = [
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Relative",
  "Other",
];

export default function CitizenProfileScreen({ navigation }) {
  const { user, setUser } = useContext(UserContext);

  // --- STATE FOR HEAD EDITING ---
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headEditData, setHeadEditData] = useState({
    headName: "",
    address: "",
  });

  // --- STATE FOR MEMBER EDITING/ADDING ---
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [memberData, setMemberData] = useState({
    name: "",
    age: "",
    gender: "Male",
    condition: "None",
    relationship: "Child",
  });

  useEffect(() => {
    if (user) {
      setHeadEditData({
        headName: user.headName || user.username || "",
        address: user.address || "",
      });
    }
  }, [user]);

  // ==============================
  // HEAD LOGIC
  // ==============================
  const handleSaveHead = async () => {
    if (!headEditData.headName || !headEditData.address) {
      Alert.alert("Error", "Name and Address cannot be empty.");
      return;
    }
    try {
      const updates = {
        headName: headEditData.headName,
        username: headEditData.headName,
        address: headEditData.address,
      };
      await update(ref(db, `households/${user.mobileNumber}`), updates);
      setUser({ ...user, ...updates });
      setShowHeadModal(false);
      Alert.alert("Success", "Profile updated!");
    } catch (error) {
      Alert.alert("Error", "Could not update profile.");
    }
  };

  // ==============================
  // MEMBER LOGIC
  // ==============================
  const openAddMember = () => {
    setMemberData({
      name: "",
      age: "",
      gender: "Male",
      condition: "None",
      relationship: "Child",
    });
    setEditingIndex(null);
    setShowMemberModal(true);
  };

  const openEditMember = (member, index) => {
    setMemberData({ ...member });
    setEditingIndex(index);
    setShowMemberModal(true);
  };

  const handleSaveMember = async () => {
    if (!memberData.name || !memberData.age) {
      Alert.alert("Missing Info", "Please enter Name and Age.");
      return;
    }
    let updatedMembers = user.members ? [...user.members] : [];
    if (editingIndex !== null) {
      updatedMembers[editingIndex] = memberData;
    } else {
      updatedMembers.push(memberData);
    }
    try {
      await update(ref(db, `households/${user.mobileNumber}`), {
        members: updatedMembers,
      });
      setUser({ ...user, members: updatedMembers });
      setShowMemberModal(false);
      Alert.alert(
        "Success",
        editingIndex !== null ? "Member updated." : "Member added.",
      );
    } catch (error) {
      Alert.alert("Error", "Could not save member.");
    }
  };

  const handleDeleteMember = async () => {
    if (editingIndex === null) return;
    Alert.alert(
      "Delete Member",
      "Are you sure you want to remove this person?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedMembers = user.members.filter(
              (_, i) => i !== editingIndex,
            );
            try {
              await update(ref(db, `households/${user.mobileNumber}`), {
                members: updatedMembers,
              });
              setUser({ ...user, members: updatedMembers });
              setShowMemberModal(false);
            } catch (error) {
              Alert.alert("Error", "Could not delete member.");
            }
          },
        },
      ],
    );
  };

  // ==============================
  // UI RENDER
  // ==============================
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Household</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HEAD CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Head of Family</Text>
            <TouchableOpacity onPress={() => setShowHeadModal(true)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{user?.headName || user?.username}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{user?.mobileNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Barangay:</Text>
            <Text style={styles.value}>{user?.barangay}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Address/Zone:</Text>
            <Text style={styles.value}>{user?.address}</Text>
          </View>
        </View>

        {/* MEMBERS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>
              Family Members ({user?.members?.length || 0})
            </Text>
            <TouchableOpacity onPress={openAddMember} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hintText}>Tap a member to edit details</Text>

          {!user.members || user.members.length === 0 ? (
            <Text style={styles.emptyText}>No members added yet.</Text>
          ) : (
            user.members.map((m, index) => (
              <TouchableOpacity
                key={index}
                style={styles.memberRow}
                onPress={() => openEditMember(m, index)}
              >
                <View>
                  <Text style={styles.memName}>
                    {m.name} ({m.age})
                  </Text>
                  <Text style={styles.memDetail}>
                    {m.relationship} • {m.gender}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {m.condition !== "None" && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{m.condition}</Text>
                    </View>
                  )}
                  <Text style={styles.editHint}>Edit ›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ============================== */}
      {/* MODAL 1: EDIT HEAD             */}
      {/* ============================== */}
      <Modal visible={showHeadModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.inputLabel}>Head of Family Name</Text>
            <TextInput
              style={styles.input}
              value={headEditData.headName}
              onChangeText={(t) =>
                setHeadEditData({ ...headEditData, headName: t })
              }
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Address / Zone</Text>
            <TextInput
              style={styles.input}
              value={headEditData.address}
              onChangeText={(t) =>
                setHeadEditData({ ...headEditData, address: t })
              }
              placeholder="e.g. Zone 1, Near Chapel"
              placeholderTextColor="#999"
            />

            {/* NEW STANDARD BUTTONS */}
            <View style={styles.modalButtonsColumn}>
              <View style={styles.btnSpacer}>
                <Button
                  title="Save Changes"
                  color="#B71C1C"
                  onPress={handleSaveHead}
                />
              </View>
              <View style={styles.btnSpacer}>
                <Button
                  title="Cancel"
                  color="#757575"
                  onPress={() => setShowHeadModal(false)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================== */}
      {/* MODAL 2: EDIT MEMBER           */}
      {/* ============================== */}
      <Modal visible={showMemberModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingIndex !== null ? "Edit Member" : "Add New Member"}
            </Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={memberData.name}
              onChangeText={(t) => setMemberData({ ...memberData, name: t })}
              placeholder="e.g. Maria Dela Cruz"
              placeholderTextColor="#999"
            />

            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <View style={{ flex: 0.45 }}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={memberData.age}
                  onChangeText={(t) => setMemberData({ ...memberData, age: t })}
                  placeholder="e.g. 25"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={{ flex: 0.45 }}>
                <Text style={styles.inputLabel}>Gender</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() =>
                    setMemberData({
                      ...memberData,
                      gender: memberData.gender === "Male" ? "Female" : "Male",
                    })
                  }
                >
                  <Text style={{ color: "#333" }}>{memberData.gender}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>Relationship</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {RELATIONSHIPS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() =>
                    setMemberData({ ...memberData, relationship: r })
                  }
                  style={[
                    styles.chip,
                    memberData.relationship === r && styles.chipSel,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      memberData.relationship === r && styles.chipTextSel,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Condition</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 15 }}
            >
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setMemberData({ ...memberData, condition: c })}
                  style={[
                    styles.chip,
                    memberData.condition === c && styles.chipSel,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      memberData.condition === c && styles.chipTextSel,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* NEW STANDARD BUTTONS */}
            <View style={styles.modalButtonsColumn}>
              <View style={styles.btnSpacer}>
                <Button
                  title={editingIndex !== null ? "Update Member" : "Add Member"}
                  color="#B71C1C"
                  onPress={handleSaveMember}
                />
              </View>

              {editingIndex !== null && (
                <View style={styles.btnSpacer}>
                  <Button
                    title="Delete Member"
                    color="#D32F2F"
                    onPress={handleDeleteMember}
                  />
                </View>
              )}

              <View style={styles.btnSpacer}>
                <Button
                  title="Cancel"
                  color="#757575"
                  onPress={() => setShowMemberModal(false)}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    padding: 20,
    backgroundColor: "#B71C1C",
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { marginRight: 15 },
  backText: { color: "#FFF", fontSize: 16 },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },

  scrollContent: { padding: 20 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  editText: { color: "#1976D2", fontWeight: "bold", fontSize: 14 },

  row: { flexDirection: "row", marginBottom: 5 },
  label: { fontWeight: "bold", color: "#666", width: 90 },
  value: { color: "#333", flex: 1 },

  addBtn: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  addBtnText: { color: "#1976D2", fontWeight: "bold", fontSize: 12 },
  emptyText: { fontStyle: "italic", color: "#999", marginTop: 5 },
  hintText: {
    fontSize: 10,
    color: "#999",
    marginBottom: 5,
    fontStyle: "italic",
  },

  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    alignItems: "center",
  },
  memName: { fontWeight: "bold", color: "#444", fontSize: 16 },
  memDetail: { fontSize: 13, color: "#888" },
  editHint: { fontSize: 11, color: "#CCC", marginTop: 2 },
  tag: {
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 2,
  },
  tagText: { color: "#D32F2F", fontSize: 11, fontWeight: "bold" },

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { backgroundColor: "#FFF", borderRadius: 10, padding: 20 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#B71C1C",
    marginBottom: 15,
    textAlign: "center",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 5,
    marginTop: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 5,
    padding: 10,
    backgroundColor: "#FAFAFA",
    marginBottom: 5,
    color: "#333",
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  chipSel: { backgroundColor: "#FFCDD2", borderColor: "#B71C1C" },
  chipText: { fontSize: 12, color: "#555" },
  chipTextSel: { color: "#B71C1C", fontWeight: "bold" },

  modalButtonsColumn: { marginTop: 20 },
  btnSpacer: { marginBottom: 10, width: "100%" }, // Added wrapper for Buttons to have spacing
});
