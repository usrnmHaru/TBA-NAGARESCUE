import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
// Firebase removed — fully offline SMS mode
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SmsListener from "react-native-android-sms-listener";
import SmsAndroid from "react-native-get-sms-android";

import { SafeAreaView } from "react-native-safe-area-context";
// Firebase config removed

// Configure Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function BarangayDashboardScreen({ route, navigation }) {
  const { barangay } = route.params;

  const [offlineAlerts, setOfflineAlerts] = useState([]);
  const [combinedAlerts, setCombinedAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const [activeTab, setActiveTab] = useState("INCOMING");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [newAlertIds, setNewAlertIds] = useState(new Set());
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  const [alertToDispatch, setAlertToDispatch] = useState(null);
  const [newRequestCount, setNewRequestCount] = useState(0);

  const SARU_TEAMS = [
    "Team Alpha (EMS)",
    "Team Beta (Fire)",
    "Team Gamma (Rescue)",
    "SARU Unit 1",
    "SARU Unit 2",
  ];

  const [saruContacts, setSaruContacts] = useState({
    "Team Alpha (EMS)": "09207826804",
    "Team Beta (Fire)": "09207826804",
    "Team Gamma (Rescue)": "09207826804",
    "SARU Unit 1": "09207826804",
    "SARU Unit 2": "09207826804",
  });

  const soundObject = useRef(new Audio.Sound()).current;

  // --- AUDIO ---
  useEffect(() => {
    async function loadSound() {
      try {
        await soundObject.loadAsync(require("../../assets/siren.mp3"));
      } catch (error) {
        /* Silent fail */
      }
    }
    loadSound();
    return () => {
      soundObject.unloadAsync();
    };
  }, []);

  const playSiren = async () => {
    try {
      const status = await soundObject.getStatusAsync();
      if (status.isLoaded) await soundObject.replayAsync();
    } catch (error) { }
  };

  // --- PERMISSIONS & POLLING ---
  useEffect(() => {
    const requestPerms = async () => {
      if (Platform.OS === "android") {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
        ];

        if (Platform.Version >= 33)
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        if (
          granted[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          fetchInboxHistory();
          const interval = setInterval(fetchInboxHistory, 5000);
          return () => clearInterval(interval);
        }
      } else {
        await Notifications.requestPermissionsAsync();
      }
    };
    requestPerms();
  }, []);

  // --- SMS POLLING (FETCH INBOX) ---
  const fetchInboxHistory = () => {
    if (Platform.OS !== "android") return;

    const filter = { box: "inbox", maxCount: 30 };
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => console.log("SMS Read Fail: " + fail),
      (count, smsList) => {
        const arr = JSON.parse(smsList);
        const foundAlerts = [];
        arr.forEach((msg) => {
          if (msg.body && msg.body.includes("SOS Alert")) {
            const parsed = parseSms(msg.body, msg.address, msg.date);
            if (parsed) foundAlerts.push(parsed);
          }
        });

        setOfflineAlerts((prev) => {
          const unique = [...prev];
          let hasNew = false;
          const addedIds = [];
          foundAlerts.forEach((newMsg) => {
            if (!unique.some((existing) => existing.id === newMsg.id)) {
              unique.push(newMsg);
              hasNew = true;
              addedIds.push(newMsg.id);
            }
          });

          if (hasNew) {
            setNewAlertIds((prevIds) => {
              const updated = new Set(prevIds);
              addedIds.forEach((id) => updated.add(id));
              return updated;
            });
            playSiren();
            Notifications.scheduleNotificationAsync({
              content: {
                title: "🚨 NEW OFFLINE ALERT",
                body: "Check Dashboard",
              },
              trigger: null,
            });
          }
          return unique;
        });
      }
    );
  };

  // --- LIVE SMS LISTENER ---
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = SmsListener.addListener((message) => {
      console.log(
        "Live SMS Received:",
        message.originatingAddress,
        message.body
      );

      if (message.body.includes("SARU CHECK-IN:")) {
        try {
          const content = message.body.replace("SARU CHECK-IN:", "").trim();
          const parts = content.split("|").map((p) => p.trim());
          let teamName = "";
          let teamNo = "";
          parts.forEach((p) => {
            if (p.startsWith("Team=")) teamName = p.replace("Team=", "");
            if (p.startsWith("No=")) teamNo = p.replace("No=", "");
          });

          if (teamName && teamNo) {
            console.log(
              `[Barangay] Dynamic SARU Check-in: ${teamName} at ${teamNo}`
            );
            setSaruContacts((prev) => ({ ...prev, [teamName]: teamNo }));
            Alert.alert(
              "SARU Registration",
              `${teamName} is now active at ${teamNo}`
            );
          }
        } catch (e) { }
      } else if (message.body.includes("SARU ACCEPT:")) {
        try {
          const content = message.body.replace("SARU ACCEPT:", "").trim();
          const parts = content.split("|").map((p) => p.trim());
          let missionId = "";
          let teamName = "";
          parts.forEach((p) => {
            if (p.startsWith("ID=")) missionId = p.replace("ID=", "");
            if (p.startsWith("Team=")) teamName = p.replace("Team=", "");
          });

          if (missionId) {
            setOfflineAlerts((prev) =>
              prev.map((a) =>
                a.id === missionId
                  ? { ...a, status: "DISPATCHED", assignedTeam: teamName }
                  : a
              )
            );
            Alert.alert(
              "Notification from SARU",
              `${teamName} has accepted Mission ${missionId}`
            );
          }
        } catch (e) { }
      } else if (message.body.includes("SARU DECLINE:")) {
        try {
          const content = message.body.replace("SARU DECLINE:", "").trim();
          const parts = content.split("|").map((p) => p.trim());
          let missionId = "";
          let teamName = "";
          parts.forEach((p) => {
            if (p.startsWith("ID=")) missionId = p.replace("ID=", "");
            if (p.startsWith("Team=")) teamName = p.replace("Team=", "");
          });

          if (missionId) {
            setOfflineAlerts((prev) =>
              prev.map((a) =>
                a.id === missionId
                  ? { ...a, status: "PENDING", assignedTeam: null }
                  : a
              )
            );
            Alert.alert(
              "Notification from SARU",
              `⚠️ ${teamName} declined Mission ${missionId}. Re-assignment needed.`
            );
          }
        } catch (e) { }
      } else if (message.body.includes("SARU STATUS:")) {
        try {
          const content = message.body.replace("SARU STATUS:", "").trim();
          const parts = content.split("|").map((p) => p.trim());
          let missionId = "";
          let teamName = "";
          let status = "";
          parts.forEach((p) => {
            if (p.startsWith("ID=")) missionId = p.replace("ID=", "");
            if (p.startsWith("Team=")) teamName = p.replace("Team=", "");
            if (p.startsWith("Status=")) status = p.replace("Status=", "");
          });

          if (missionId && status) {
            const normalizedStatus = status === "COMPLETED" ? "RESOLVED" : status;
            setOfflineAlerts((prev) =>
              prev.map((a) =>
                a.id === missionId
                  ? { ...a, status: normalizedStatus, assignedTeam: teamName }
                  : a
              )
            );
            console.log(`[Barangay] Offline Status Update from ${teamName}: ${status}`);

            // Notify barangay admin when SARU completes a mission (offline)
            if (status === "COMPLETED") {
              Alert.alert(
                "✅ Mission Completed",
                `${teamName} has completed their mission. They are now available for new assignments.`
              );
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "✅ Mission Completed",
                  body: `${teamName} is now available for new assignments.`,
                },
                trigger: null,
              });
            }
          }
        } catch (e) { }
      } else if (message.body.includes("SOS Alert")) {
        // Use message.timestamp so the ID matches what inbox polling will
        // generate for the same SMS — prevents duplicates across both paths.
        const parsed = parseSms(
          message.body,
          message.originatingAddress,
          message.timestamp || new Date().getTime()
        );
        if (parsed) {
          setOfflineAlerts((prev) => {
            if (prev.some((a) => a.id === parsed.id)) return prev;
            return [parsed, ...prev];
          });
          setNewAlertIds((prev) => new Set([...prev, parsed.id]));
          playSiren();
        }
      }
    });
    return () => sub.remove();
  }, []);

  // --- MERGE & FILTER (SMS-only: no online alerts) ---
  useEffect(() => {
    const sorted = [...offlineAlerts].sort((a, b) => b.createdAt - a.createdAt);
    setCombinedAlerts(sorted);
  }, [offlineAlerts]);

  useEffect(() => {
    let filtered = combinedAlerts.filter((item) => {
      const status = item.status || "PENDING";
      if (activeTab === "INCOMING") return status === "PENDING";
      if (activeTab === "ACTIVE_OPS")
        return (
          status === "DISPATCHED" ||
          status === "ASSIGNED" ||
          status === "ON-SITE" ||
          status === "EN-ROUTE"
        );
      if (activeTab === "HISTORY")
        return (
          status === "RESOLVED" ||
          status === "COMPLETED" ||
          status === "CANCELLED"
        );
      return true;
    });
    if (filterLevel !== "ALL") {
      filtered = filtered.filter((item) => item.level === filterLevel);
    }
    setFilteredAlerts(filtered);
  }, [filterLevel, combinedAlerts, activeTab]);

  // ─────────────────────────────────────────────────────────────
  // BUG #2 FIX: parseSms ID collision
  //
  // OLD: id: `sms-${dateSent}`
  //   → Two citizens sending SOS at the same millisecond share
  //     an ID, and one alert silently gets dropped by the
  //     deduplication check.
  //
  // NEW: id: `sms-${senderNumber.replace(/\D/g, "").slice(-7)}-${dateSent}`
  //   → Combines the last 7 digits of the sender's phone number
  //     with the timestamp. Since each phone has a unique number,
  //     collisions are now practically impossible even during a
  //     mass-casualty event where many people send SOS at once.
  //   → Also guarantees the same SMS polled across multiple
  //     fetchInboxHistory() cycles always produces the same ID,
  //     keeping deduplication working correctly.
  // ─────────────────────────────────────────────────────────────
  const parseSms = (body, senderNumber, dateSent) => {
    try {
      let content = body.replace(/SOS Alert:/gi, "").trim();
      const parts = content.split("|").map((p) => p.trim());

      // BUG #2 FIX: include last 7 digits of sender number in ID
      const senderSuffix = senderNumber
        ? senderNumber.replace(/\D/g, "").slice(-7)
        : "unknown";

      let extracted = {
        name: "Unknown Citizen",
        phone: senderNumber,
        location: "Unknown Location",
        level: "HIGH",
        urgencyReason: "LOCATION",
        timestamp: new Date(dateSent).toLocaleTimeString(),
        date: new Date(dateSent).toLocaleDateString(),
        id: `sms-${senderSuffix}-${dateSent}`, // ← FIXED
        status: "PENDING",
        source: "OFFLINE",
        createdAt: dateSent,
      };

      parts.forEach((p) => {
        if (p.startsWith("Name="))
          extracted.name = p.replace("Name=", "").trim();
        if (p.startsWith("Mobile="))
          extracted.phone = p.replace("Mobile=", "").trim();
        if (p.startsWith("Location="))
          extracted.location = p.replace("Location=", "").trim();
        if (p.startsWith("Lat="))
          extracted.latitude = parseFloat(p.replace("Lat=", "").trim());
        if (p.startsWith("Long=") || p.startsWith("Lng="))
          extracted.longitude = parseFloat(
            p.replace("Long=", "").replace("Lng=", "").trim()
          );
        if (p.startsWith("Lvl="))
          extracted.level = p.replace("Lvl=", "").split("(")[0];
      });

      return extracted;
    } catch (e) {
      return null;
    }
  };

  // --- SEND SMS HELPER ---
  const sendSmsSafe = (phoneNumber, message) => {
    if (Platform.OS !== "android") {
      console.log("[Barangay] SMS bypass: Not on Android.");
      return;
    }
    try {
      if (!phoneNumber || phoneNumber === "Unknown") {
        console.log("Invalid phone number:", phoneNumber);
        Alert.alert(
          "⚠️ No Phone Number",
          "Cannot send SMS: Citizen's phone number is not available."
        );
        return;
      }

      let cleanNumber = phoneNumber.replace(/\s/g, "").replace(/-/g, "");

      if (cleanNumber.startsWith("+63")) {
        cleanNumber = "0" + cleanNumber.substring(3);
      } else if (cleanNumber.startsWith("63") && cleanNumber.length === 12) {
        cleanNumber = "0" + cleanNumber.substring(2);
      }

      console.log("Sending SMS to:", cleanNumber);

      SmsAndroid.autoSend(
        cleanNumber,
        message,
        (fail) => {
          console.log("SMS Send Failed:", fail);
          Alert.alert(
            "⚠️ SMS Failed",
            `Could not send SMS to ${cleanNumber}.\n\nError: ${fail}\n\nPlease check SMS permissions and try again.`
          );
        },
        (success) => {
          console.log("SMS sent successfully to:", cleanNumber);
          Alert.alert(
            "✅ DISPATCHED",
            `Emergency notification sent to citizen via SMS.`
          );
        }
      );
    } catch (e) {
      console.log("SMS Send Error:", e);
      Alert.alert("❌ Error", `Failed to send SMS: ${e.message}`);
    }
  };

  // --- DISPATCH ACTION ---
  const handleDispatch = (alertItem) => {
    setAlertToDispatch(alertItem);
    setTeamModalVisible(true);
  };

  const confirmDispatch = async (teamName) => {
    const alertItem = alertToDispatch;
    if (!alertItem) return;

    console.log("Assigning alert:", alertItem.id, "to team:", teamName);

    const isBusy = combinedAlerts.some(
      (a) =>
        a.assignedTeam === teamName &&
        (a.status === "ASSIGNED" ||
          a.status === "DISPATCHED" ||
          a.status === "ON-SITE" ||
          a.status === "EN-ROUTE")
    );

    if (isBusy) {
      Alert.alert(
        "Team Busy",
        `${teamName} is currently on an active mission. Please select another team or wait for them to finish.`
      );
      return;
    }

    const missionData = {
      status: "ASSIGNED",
      assignedAt: Date.now(),
      assignedTeam: teamName,
    };

    // Update local state (SMS-only mode — no Firebase)
    setOfflineAlerts((prev) =>
      prev.map((a) =>
        a.id === alertItem.id ? { ...a, ...missionData } : a
      )
    );

    // Dispatch to SARU Team via SMS
    const teamPhone = saruContacts[teamName];
    if (teamPhone) {
      const citizenName = alertItem.name || "Unknown";
      const citizenLocation =
        alertItem.address || alertItem.location || "Unknown Location";
      const citizenPhone =
        alertItem.phone ||
        alertItem.mobileNumber ||
        alertItem.mobile ||
        "Unknown";
      const citizenLevel = alertItem.level || "HIGH";
      const saruMsg = `SARU DISPATCH: ID=${alertItem.id}|Name=${citizenName}|Loc=${citizenLocation}|Phone=${citizenPhone}|Lvl=${citizenLevel}`;
      console.log(
        `[Barangay] Dispatching mission to ${teamName} via SMS: ${teamPhone}`
      );
      sendSmsSafe(teamPhone, saruMsg);
    }

    const updatedNewIds = new Set(newAlertIds);
    updatedNewIds.delete(alertItem.id);
    setNewAlertIds(updatedNewIds);
    setTeamModalVisible(false);
    setAlertToDispatch(null);
    setSelectedAlert(null);
  };

  const handleResolve = (alertItem) => {
    const resolutionData = {
      status: "RESOLVED",
      resolvedAt: Date.now(),
    };
    // Update local state only (SMS-only mode)
    setOfflineAlerts((prev) =>
      prev.map((a) =>
        a.id === alertItem.id ? { ...a, ...resolutionData } : a
      )
    );
    setSelectedAlert(null);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: item.level === "HIGH" ? "#D32F2F" : "#FBC02D" },
      ]}
      onPress={() => {
        setSelectedAlert(item);
        // Mark as seen and stop siren when the triggering card is opened
        if (newAlertIds.has(item.id)) {
          setNewAlertIds((prev) => {
            const updated = new Set(prev);
            updated.delete(item.id);
            return updated;
          });
          soundObject.stopAsync().catch(() => {});
        }
      }}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.modeTag, { backgroundColor: "#FFF3E0" }]}>
            <Text style={{ fontSize: 10, fontWeight: "bold", color: "#E65100" }}>
              💬 SMS
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          {newAlertIds.has(item.id) ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )}
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 14,
              color: item.level === "HIGH" ? "#D32F2F" : "#FBC02D",
              marginTop: 4,
            }}
          >
            {item.level}
          </Text>
        </View>
      </View>
      <Text
        style={{ fontWeight: "bold", color: "#333", marginTop: 5 }}
        numberOfLines={1}
      >
        📍 {item.address || item.location}
      </Text>
      <Text style={styles.time}>
        {item.timestamp} - {item.date}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {newRequestCount > 0 && (
        <TouchableOpacity
          style={styles.banner}
          onPress={() => setNewRequestCount(0)}
        >
          <Text style={styles.bannerText}>
            🚨 {newRequestCount} NEW REQUESTS!
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{barangay} COMMAND CENTER</Text>
          <Text style={styles.headerSubtitle}>
            Naga City Emergency Response
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={fetchInboxHistory}
            style={{ padding: 10 }}
          >
            <Text style={{ color: "white", fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Landing")}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutBtnText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {["INCOMING", "ACTIVE_OPS", "HISTORY"].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
              {tab === "INCOMING" && newAlertIds.size > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{newAlertIds.size}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterContainer}>
        <Text
          style={{
            fontSize: 10,
            marginRight: 5,
            alignSelf: "center",
            fontWeight: "bold",
            color: "#555",
          }}
        >
          FILTER:
        </Text>
        {["ALL", "HIGH", "MEDIUM", "LOW"].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterBtn,
              filterLevel === level && styles.filterActive,
            ]}
            onPress={() => setFilterLevel(level)}
          >
            <Text
              style={[
                styles.filterText,
                filterLevel === level && { color: "white" },
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No Data</Text>}
      />

      {/* ALERT DETAIL MODAL */}
      <Modal visible={!!selectedAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor:
                    selectedAlert?.level === "HIGH" ? "#D32F2F" : "#F57C00",
                },
              ]}
            >
              <Text style={styles.modalTitle}>
                URGENCY: {selectedAlert?.level}
              </Text>
            </View>
            {selectedAlert && (
              <View style={{ padding: 20 }}>
                <Text style={styles.modalText}>
                  Name: {selectedAlert.name}
                </Text>
                <Text style={styles.modalText}>
                  Phone: {selectedAlert.phone}
                </Text>
                <Text style={styles.modalText}>
                  Loc: {selectedAlert.address || selectedAlert.location}
                </Text>
                <Text style={styles.modalText}>
                  Mode: {selectedAlert.source}
                </Text>
                <Text style={styles.modalText}>
                  Status: {selectedAlert.status || "PENDING"}
                </Text>

                <View style={{ marginTop: 20 }}>
                  {activeTab === "INCOMING" && (
                    <TouchableOpacity
                      style={styles.btn}
                      onPress={() => handleDispatch(selectedAlert)}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>
                        DISPATCH TEAM
                      </Text>
                    </TouchableOpacity>
                  )}
                  {activeTab === "ACTIVE_OPS" && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: "green" }]}
                      onPress={() => handleResolve(selectedAlert)}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>
                        MARK RESOLVED
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: "#999", marginTop: 10 },
                    ]}
                    onPress={() => setSelectedAlert(null)}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      CLOSE
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* TEAM SELECTION MODAL */}
      <Modal visible={teamModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: "#1976D2" }]}>
              <Text style={styles.modalTitle}>SELECT RESPONSE TEAM</Text>
            </View>
            <View style={{ padding: 20 }}>
              <FlatList
                data={SARU_TEAMS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const isTeamBusy = combinedAlerts.some(
                    (a) =>
                      a.assignedTeam === item &&
                      (a.status === "ASSIGNED" ||
                        a.status === "DISPATCHED" ||
                        a.status === "ON-SITE")
                  );
                  return (
                    <TouchableOpacity
                      style={[
                        styles.teamItem,
                        isTeamBusy && { opacity: 0.5 },
                      ]}
                      onPress={() => confirmDispatch(item)}
                    >
                      <View>
                        <Text style={styles.teamItemText}>{item}</Text>
                        {isTeamBusy && (
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#D32F2F",
                              fontWeight: "bold",
                            }}
                          >
                            ⚠️ CURRENTLY BUSY
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 18 }}>
                        {isTeamBusy ? "⏳" : "➡️"}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#999", marginTop: 15 }]}
                onPress={() => setTeamModalVisible(false)}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  CANCEL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F2" },
  banner: { backgroundColor: "#D32F2F", padding: 10, alignItems: "center" },
  bannerText: { color: "white", fontWeight: "bold" },
  header: {
    backgroundColor: "#B71C1C",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  headerSubtitle: { color: "#B0C4DE", fontSize: 10, marginTop: 2 },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoutBtnText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  tabs: { flexDirection: "row", backgroundColor: "white", elevation: 2 },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  tabActive: { borderColor: "#B71C1C" },
  tabText: { color: "#999", fontSize: 12, fontWeight: "bold" },
  tabTextActive: { color: "#B71C1C" },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
  },
  filterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    marginHorizontal: 4,
    backgroundColor: "white",
  },
  filterActive: { backgroundColor: "#333", borderColor: "#333" },
  filterText: { fontSize: 10, fontWeight: "bold", color: "#555" },
  card: {
    backgroundColor: "white",
    padding: 15,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  name: { fontWeight: "bold", fontSize: 16, marginBottom: 4 },
  newBadge: {
    backgroundColor: "red",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "center",
  },
  newBadgeText: { color: "white", fontSize: 10, fontWeight: "bold" },
  tabBadge: {
    backgroundColor: "#D32F2F",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "white", fontSize: 10, fontWeight: "bold" },
  modeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  time: { color: "#888", fontSize: 12, marginTop: 5 },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
  },
  modalHeader: { padding: 15, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "white" },
  modalText: { fontSize: 16, marginBottom: 10, color: "#333" },
  btn: {
    backgroundColor: "#D32F2F",
    padding: 15,
    alignItems: "center",
    borderRadius: 5,
  },
  teamItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  teamItemText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
});