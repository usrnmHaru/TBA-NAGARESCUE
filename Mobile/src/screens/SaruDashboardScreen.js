// Firebase removed — fully offline SMS mode
import { Audio } from "expo-av";
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

// ─────────────────────────────────────────────────────────────
// BARANGAY HQ CONTACTS — used for offline SMS replies to HQ.
// FIX: Moved to module level so every useEffect and handler
//      can safely reference it without hoisting issues.
// ─────────────────────────────────────────────────────────────
const BARANGAY_CONTACTS = {
    "Abella": "09813888974",
    "Bagumbayan Norte": "09813888974",
    "Bagumbayan Sur": "09813888974",
    "Balatas": "09813888974",
    "Igualdad": "09813888974",
    "Triangulo": "09813888974",
    // Add the rest as real SIM numbers are assigned to each barangay
};

export default function SaruDashboardScreen({ route, navigation }) {
    const { team, barangay, responderID, teamMobile } = route.params;
    console.log(`[SARU] Logged in: Team="${team}", Mobile="${teamMobile}", Barangay="${barangay}", ID="${responderID}"`);

    const [offlineMissions, setOfflineMissions] = useState([]); // Missions received via SMS dispatch
    const [declinedMissions, setDeclinedMissions] = useState([]); // Locally tracked declined missions
    const [filteredMissions, setFilteredMissions] = useState([]);
    const [selectedMission, setSelectedMission] = useState(null);
    const [activeTab, setActiveTab] = useState("REQUESTS"); // REQUESTS | ACTIVE | HISTORY

    const soundObject = useRef(new Audio.Sound()).current;

    // ─── AUDIO ───────────────────────────────────────────────
    useEffect(() => {
        async function loadSound() {
            try {
                await soundObject.loadAsync(require("../../assets/siren.mp3"));
            } catch (e) { /* silent fail */ }
        }
        loadSound();
        return () => { soundObject.unloadAsync(); };
    }, []);

    const playSiren = async () => {
        try {
            const status = await soundObject.getStatusAsync();
            if (status.isLoaded) await soundObject.replayAsync();
        } catch (e) { }
    };

    const stopSiren = async () => {
        try {
            const status = await soundObject.getStatusAsync();
            if (status.isLoaded && status.isPlaying) await soundObject.stopAsync();
        } catch (e) { }
    };

    // ─── PERMISSIONS ────────────────────────────────────────────
    useEffect(() => {
        const getPerms = async () => {
            if (Platform.OS === "android") {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.SEND_SMS,
                    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
                    PermissionsAndroid.PERMISSIONS.READ_SMS,
                ]);
            }
        };
        getPerms();
    }, []);

    // ─── iOS WARNING ─────────────────────────────────────────────
    useEffect(() => {
        if (Platform.OS === "ios") {
            Alert.alert(
                "⚠️ Limited iOS Support",
                "This app runs in SMS-only mode. iOS does not support background SMS sending or receiving. You will need an Android device to send/receive mission updates.",
                [{ text: "I Understand", style: "default" }]
            );
        }
    }, []);

    // Firebase listener removed (SMS-only mode)

    // ─── DYNAMIC CONTACT REGISTRATION (SMS check-in only) ─────────────
    // Sends check-in SMS to HQ so barangay has the SARU number offline.
    useEffect(() => {
        if (Platform.OS === "android" && teamMobile && team) {
            const hqNumber = BARANGAY_CONTACTS[barangay.trim()];
            if (hqNumber) {
                const checkInMsg = `SARU CHECK-IN: Team=${team}|No=${teamMobile}`;
                console.log(`[SARU] Sending check-in SMS to HQ (${barangay}): ${hqNumber}`);
                sendSmsSafe(hqNumber, checkInMsg);
            } else {
                console.warn(`[SARU] No HQ number found for barangay: ${barangay}. Check-in SMS skipped.`);
            }
        }
    }, [team, teamMobile, barangay]);

    // ─── SMS LISTENER — Incoming offline dispatch from Barangay ──
    useEffect(() => {
        if (Platform.OS !== "android") return;

        const sub = SmsListener.addListener((message) => {
            if (message.body.includes("SARU DISPATCH:")) {
                const parsed = parseSaruDispatch(message.body, message.originatingAddress);
                if (parsed) {
                    console.log("[SARU] Received offline mission via SMS:", parsed.id);
                    setOfflineMissions((prev) => {
                        if (prev.some((m) => m.id === parsed.id)) return prev;
                        return [parsed, ...prev];
                    });
                    playSiren();
                    Alert.alert("🚨 NEW MISSION", `Mission received from Barangay CC for ${parsed.name}`);
                }
            }
        });
        return () => sub.remove();
    }, []);

    // ─── FILTER MISSIONS (SMS-only) ──────────────────────────────
    useEffect(() => {
        let filtered = [];
        if (activeTab === "REQUESTS") {
            filtered = offlineMissions.filter((m) => m.status === "ASSIGNED");
        } else if (activeTab === "ACTIVE") {
            filtered = offlineMissions.filter(
                (m) => m.status === "DISPATCHED" || m.status === "ON-SITE"
            );
        } else if (activeTab === "HISTORY") {
            const resolved = offlineMissions.filter(
                (m) => m.status === "RESOLVED" || m.status === "CANCELLED"
            );
            filtered = [...resolved, ...declinedMissions];
            filtered.sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0));
        }
        setFilteredMissions(filtered);
    }, [offlineMissions, declinedMissions, activeTab]);

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    // Parse a "SARU DISPATCH:" SMS into a mission object
    const parseSaruDispatch = (body, sender) => {
        try {
            const content = body.replace("SARU DISPATCH:", "").trim();
            const parts = content.split("|").map((p) => p.trim());
            const data = {
                source: "OFFLINE",
                assignedAt: Date.now(),
                status: "ASSIGNED",
                assignedTeam: team,
                hqNumber: sender, // Store actual sender so replies go to the right number
            };

            parts.forEach((p) => {
                if (p.startsWith("ID=")) data.id = p.replace("ID=", "");
                if (p.startsWith("Name=")) data.name = p.replace("Name=", "");
                if (p.startsWith("Loc=")) data.location = p.replace("Loc=", "");
                if (p.startsWith("Phone=")) data.phone = p.replace("Phone=", "");
                if (p.startsWith("Lvl=")) data.level = p.replace("Lvl=", "");
            });

            return data.id ? data : null;
        } catch (e) {
            console.error("[SARU] parseSaruDispatch error:", e);
            return null;
        }
    };

    // Safe SMS sender — handles PH number formatting
    const sendSmsSafe = (phoneNumber, message) => {
        if (Platform.OS !== "android") {
            console.log("[SARU] SMS bypass: Not on Android.");
            return;
        }
        if (!phoneNumber || phoneNumber === "Unknown") {
            console.warn("[SARU] sendSmsSafe: invalid number, skipping.");
            return;
        }

        let cleanNumber = phoneNumber.replace(/\s/g, "").replace(/-/g, "");
        if (cleanNumber.startsWith("+63")) {
            cleanNumber = "0" + cleanNumber.substring(3);
        } else if (cleanNumber.startsWith("63") && cleanNumber.length === 12) {
            cleanNumber = "0" + cleanNumber.substring(2);
        }

        console.log(`[SARU] Sending SMS to: ${cleanNumber}`);
        SmsAndroid.autoSend(
            cleanNumber,
            message,
            (fail) => console.log("[SARU] SMS Fail:", fail),
            (success) => console.log("[SARU] SMS Success to:", cleanNumber)
        );
    };

    // ─────────────────────────────────────────────────────────────
    // BUG FIX: updateOfflineMission
    //
    // Previously, offline mission updates used direct object
    // mutation (Object.assign / mission.status = ...) which does
    // NOT trigger React re-renders reliably.
    //
    // This helper replaces the mutated mission in offlineMissions
    // state using an immutable map(), ensuring the UI always
    // reflects the correct status immediately.
    // ─────────────────────────────────────────────────────────────
    const updateOfflineMission = (missionId, updates) => {
        setOfflineMissions((prev) =>
            prev.map((m) =>
                m.id === missionId ? { ...m, ...updates } : m
            )
        );
    };

    // ─── ACCEPT MISSION ──────────────────────────────────────────
    const handleAccept = (mission) => {
        const now = Date.now();
        const updates = {
            status: "DISPATCHED",
            dispatchedAt: now,
            currentSaruStatus: "Accepted - Dispatching",
        };

        // Update local state (SMS-only mode)
        updateOfflineMission(mission.id, updates);
        setSelectedMission((prev) =>
            prev?.id === mission.id ? { ...prev, ...updates } : prev
        );

        // 1. Notify citizen via SMS
        const citizenPhone = mission.phone || mission.mobileNumber || mission.mobile;
        if (citizenPhone) {
            const msg = `HELP IS COMING: ${team} has accepted your mission. Help is on the way! Stay calm and stay where you are.`;
            sendSmsSafe(citizenPhone, msg);
        }

        // 2. Notify Barangay HQ via SMS (offline feedback loop)
        //    hqNumber comes from parseSaruDispatch (actual sender address)
        //    or falls back to the static BARANGAY_CONTACTS map.
        const hqNumber = mission.hqNumber || BARANGAY_CONTACTS[barangay.trim()];
        if (hqNumber) {
            const acceptMsg = `SARU ACCEPT: ID=${mission.id}|Team=${team}`;
            console.log(`[SARU] Notifying Barangay HQ of acceptance: ${hqNumber}`);
            sendSmsSafe(hqNumber, acceptMsg);
        } else {
            console.warn("[SARU] No HQ number to send ACCEPT reply to.");
        }

        Alert.alert("✅ Mission Accepted", "Citizen has been notified that help is on the way!");
        setActiveTab("ACTIVE");
        setSelectedMission(null);
    };

    // ─── DECLINE MISSION ─────────────────────────────────────────
    const handleDecline = (mission) => {
        const declinedItem = {
            ...mission,
            status: "DECLINED",
            currentSaruStatus: "Declined by Team",
            declinedAt: Date.now(),
        };

        // Remove from missions and add to declined history
        setDeclinedMissions((prev) => [declinedItem, ...prev]);
        setOfflineMissions((prev) => prev.filter((m) => m.id !== mission.id));

        // Notify Barangay HQ via SMS so they can reassign
        const hqNumber = mission.hqNumber || BARANGAY_CONTACTS[barangay.trim()];
        if (hqNumber) {
            const declineMsg = `SARU DECLINE: ID=${mission.id}|Team=${team}`;
            console.log(`[SARU] Notifying Barangay HQ of decline: ${hqNumber}`);
            sendSmsSafe(hqNumber, declineMsg);
        } else {
            console.warn("[SARU] No HQ number to send DECLINE reply to.");
        }

        Alert.alert("❌ Mission Declined", "The mission has been returned to the Barangay for re-assignment.");
        setSelectedMission(null);
    };

    // ─── UPDATE MISSION STATUS ───────────────────────────────────
    const updateStatus = (mission, newStatus) => {
        const now = Date.now();
        const updates = {};

        if (newStatus === "EN-ROUTE") {
            updates.status = "DISPATCHED"; // EN-ROUTE maps to DISPATCHED tab
            updates.enRouteAt = now;
            updates.currentSaruStatus = "En Route";
        } else if (newStatus === "ON-SITE") {
            updates.status = "ON-SITE";
            updates.arrivedAt = now;
            updates.currentSaruStatus = "On-Site";
        } else if (newStatus === "COMPLETED") {
            updates.status = "RESOLVED";
            updates.completedAt = now;
            updates.resolvedAt = now;
            updates.currentSaruStatus = "Completed";
        }

        // Update local state (SMS-only mode)
        updateOfflineMission(mission.id, updates);
        setSelectedMission((prev) =>
            prev?.id === mission.id ? { ...prev, ...updates } : prev
        );

        // Notify Barangay HQ via SMS for all status changes
        const hqNumber = mission.hqNumber || BARANGAY_CONTACTS[barangay.trim()];
        if (hqNumber) {
            // Send the original newStatus string (EN-ROUTE, ON-SITE, COMPLETED)
            // so the barangay parser can react appropriately
            const statusMsg = `SARU STATUS: ID=${mission.id}|Team=${team}|Status=${newStatus}`;
            console.log(`[SARU] Notifying Barangay HQ of status (${newStatus}): ${hqNumber}`);
            sendSmsSafe(hqNumber, statusMsg);
        } else {
            console.warn("[SARU] No HQ number to send STATUS reply to.");
        }

        Alert.alert("📡 Status Updated", `HQ notified: ${newStatus}`);

        if (newStatus === "COMPLETED") {
            Alert.alert("🎉 Mission Complete", "Great job! You are now available for new missions.");
            setSelectedMission(null);
            setActiveTab("REQUESTS");
        }
    };

    // ─── RENDER MISSION CARD ─────────────────────────────────────
    const renderMission = ({ item }) => (
        <TouchableOpacity
            style={styles.missionCard}
            onPress={() => {
                setSelectedMission(item);
                stopSiren();
            }}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.citizenName}>{item.name}</Text>
                <Text style={[
                    styles.statusTag,
                    {
                        backgroundColor:
                            item.status === "RESOLVED" ? "#4CAF50" :
                                item.status === "DECLINED" ? "#D32F2F" :
                                    item.status === "CANCELLED" ? "#757575" : "#FF9800",
                    },
                ]}>
                    {item.currentSaruStatus || item.status}
                </Text>
            </View>
            <Text style={styles.locationText}>📍 {item.address || item.location}</Text>
            <Text style={styles.sourceTag}>💬 SMS</Text>
            <Text style={styles.timeText}>
                🕒 {item.status === "ASSIGNED" ? "Assigned" : "Updated"}:{" "}
                {new Date(item.assignedAt || item.dispatchedAt || Date.now()).toLocaleTimeString()}
            </Text>
        </TouchableOpacity>
    );

    // ─── RENDER ──────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>

            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.teamName}>{team}</Text>
                    <Text style={styles.responderInfo}>
                        ID: {responderID} | {barangay} HQ
                    </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.syncContainer}>
                        <View style={[styles.syncDot, { backgroundColor: "#FF9800" }]} />
                        <Text style={styles.syncText}>SMS MODE</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Landing")}
                        style={styles.logoutBtn}
                    >
                        <Text style={{ color: "white", fontWeight: "bold" }}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabContainer}>
                {["REQUESTS", "ACTIVE", "HISTORY"].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabItem, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab}
                        </Text>
                        {tab === "REQUESTS" &&
                            filteredMissions.length > 0 &&
                            activeTab !== "REQUESTS" && (
                                <View style={styles.badge} />
                            )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* MISSION LIST */}
            <View style={{ flex: 1, padding: 20 }}>
                <Text style={styles.sectionTitle}>
                    {activeTab} MISSIONS ({filteredMissions.length})
                </Text>
                <FlatList
                    data={filteredMissions}
                    keyExtractor={(item) => item.id + (item.declinedAt || "")}
                    renderItem={renderMission}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            No {activeTab.toLowerCase()} missions found.
                        </Text>
                    }
                />
            </View>

            {/* MISSION CONTROL MODAL */}
            <Modal visible={!!selectedMission} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>MISSION CONTROL</Text>
                        </View>

                        {selectedMission && (
                            <View style={{ padding: 20 }}>
                                <Text style={styles.modalLabel}>Citizen:</Text>
                                <Text style={styles.modalValue}>{selectedMission.name}</Text>

                                <Text style={styles.modalLabel}>Location:</Text>
                                <Text style={styles.modalValue}>
                                    {selectedMission.address || selectedMission.location}
                                </Text>

                                <Text style={styles.modalLabel}>Phone:</Text>
                                <Text style={styles.modalValue}>
                                    {selectedMission.phone || selectedMission.mobileNumber || "Unknown"}
                                </Text>

                                <Text style={styles.modalLabel}>Mode:</Text>
                                <Text style={styles.modalValue}>
                                    {selectedMission.source === "ONLINE" ? "🌐 Online" : "💬 SMS / Offline"}
                                </Text>

                                <Text style={styles.modalLabel}>Mission Status:</Text>
                                <Text style={styles.missionStatusValue}>
                                    {selectedMission.currentSaruStatus || selectedMission.status}
                                </Text>

                                {/* ── ACCEPT / DECLINE (when ASSIGNED) ── */}
                                {selectedMission.status === "ASSIGNED" ? (
                                    <View style={styles.workflowContainer}>
                                        <Text style={styles.assignmentNote}>
                                            New mission assigned to your team. Do you accept?
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.workflowBtn, { backgroundColor: "#2E7D32" }]}
                                            onPress={() => handleAccept(selectedMission)}
                                        >
                                            <Text style={styles.workflowBtnText}>✅ ACCEPT MISSION</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.workflowBtn, { backgroundColor: "#D32F2F" }]}
                                            onPress={() => handleDecline(selectedMission)}
                                        >
                                            <Text style={styles.workflowBtnText}>❌ DECLINE MISSION</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    /* ── STATUS UPDATES (when DISPATCHED / ON-SITE) ── */
                                    <View style={styles.workflowContainer}>
                                        <TouchableOpacity
                                            style={[styles.workflowBtn, { backgroundColor: "#1976D2" }]}
                                            onPress={() => updateStatus(selectedMission, "EN-ROUTE")}
                                        >
                                            <Text style={styles.workflowBtnText}>🚗 EN ROUTE</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.workflowBtn, { backgroundColor: "#FB8C00" }]}
                                            onPress={() => updateStatus(selectedMission, "ON-SITE")}
                                        >
                                            <Text style={styles.workflowBtnText}>📍 ON-SITE / ARRIVED</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.workflowBtn, { backgroundColor: "#2E7D32" }]}
                                            onPress={() => updateStatus(selectedMission, "COMPLETED")}
                                        >
                                            <Text style={styles.workflowBtnText}>✅ MISSION COMPLETED</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.closeBtn}
                                    onPress={() => setSelectedMission(null)}
                                >
                                    <Text style={styles.closeBtnText}>BACK TO LIST</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F7FA" },

    header: {
        backgroundColor: "#0D47A1",
        padding: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    teamName: { color: "white", fontSize: 20, fontWeight: "bold" },
    responderInfo: { color: "#BBDEFB", fontSize: 12 },
    logoutBtn: {
        backgroundColor: "rgba(255,255,255,0.2)",
        padding: 8,
        borderRadius: 5,
        marginLeft: 10,
    },

    syncContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    syncDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#4CAF50",
        marginRight: 5,
    },
    syncText: { color: "white", fontSize: 9, fontWeight: "bold" },

    tabContainer: {
        flexDirection: "row",
        backgroundColor: "white",
        elevation: 2,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 15,
        alignItems: "center",
        borderBottomWidth: 3,
        borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: "#0D47A1" },
    tabText: { fontSize: 13, fontWeight: "bold", color: "#90A4AE" },
    tabTextActive: { color: "#0D47A1" },
    badge: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#D32F2F",
        position: "absolute",
        top: 12,
        right: 25,
    },

    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#546E7A",
        marginBottom: 15,
        textTransform: "uppercase",
    },

    missionCard: {
        backgroundColor: "white",
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        elevation: 3,
        borderLeftWidth: 5,
        borderLeftColor: "#1976D2",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    citizenName: { fontSize: 18, fontWeight: "bold", color: "#263238" },
    statusTag: {
        color: "white",
        fontSize: 10,
        fontWeight: "bold",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    sourceTag: {
        fontSize: 11,
        color: "#78909C",
        marginBottom: 2,
    },
    locationText: { color: "#455A64", marginBottom: 4 },
    timeText: { color: "#78909C", fontSize: 12 },
    emptyText: { textAlign: "center", marginTop: 40, color: "#999" },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: 20,
    },
    modalContent: {
        backgroundColor: "white",
        borderRadius: 15,
        overflow: "hidden",
    },
    modalHeader: {
        backgroundColor: "#0D47A1",
        padding: 15,
        alignItems: "center",
    },
    modalTitle: { color: "white", fontWeight: "bold", fontSize: 18 },
    modalLabel: { fontSize: 12, color: "#78909C", marginTop: 10 },
    modalValue: { fontSize: 16, fontWeight: "bold", color: "#263238" },
    missionStatusValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E88E5",
        marginVertical: 5,
    },

    workflowContainer: { marginTop: 25 },
    workflowBtn: {
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 12,
    },
    workflowBtnText: { color: "white", fontWeight: "bold", letterSpacing: 1 },
    assignmentNote: {
        textAlign: "center",
        color: "#546E7A",
        marginBottom: 20,
        fontStyle: "italic",
    },
    closeBtn: { marginTop: 10, padding: 15, alignItems: "center" },
    closeBtnText: { color: "#546E7A", fontWeight: "bold" },
});