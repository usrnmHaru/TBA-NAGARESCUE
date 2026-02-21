import { useState } from 'react';
import {
    Alert,
    FlatList, KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// MOCK SARU TEAMS
const SARU_TEAMS = [
    "Team Alpha (EMS)",
    "Team Beta (Fire)",
    "Team Gamma (Rescue)",
    "SARU Unit 1",
    "SARU Unit 2"
];

const BARANGAY_LIST = [
    "Abella", "Bagumbayan Norte", "Bagumbayan Sur", "Balatas",
    "Calauag", "Cararayan", "Carolina", "Concepcion Grande",
    "Concepcion Pequeña", "Dayangdang", "Del Rosario", "Dinaga",
    "Igualdad", "Lerma", "Liboton", "Mabolo", "Pacol",
    "Panicuason", "Peñafrancia", "Sabang", "San Felipe",
    "San Francisco", "San Isidro", "Santa Cruz", "Tabuco",
    "Tinago", "Triangulo"
];

export default function SaruLoginScreen({ navigation }) {
    const [team, setTeam] = useState('');
    const [barangay, setBarangay] = useState('');
    const [responderID, setResponderID] = useState('');
    const [teamMobile, setTeamMobile] = useState('');
    const [password, setPassword] = useState('');
    const [teamModalVisible, setTeamModalVisible] = useState(false);
    const [bgyModalVisible, setBgyModalVisible] = useState(false);

    const handleLogin = () => {
        if (!team || !barangay || !responderID || !teamMobile || !password) {
            Alert.alert("Access Denied", "Please fill in all fields to verify your identity.");
            return;
        }

        if (password === "admin") {
            // Success!
            navigation.navigate('SaruDashboard', {
                team: team,
                barangay: barangay,
                responderID: responderID,
                teamMobile: teamMobile
            });
        } else {
            Alert.alert("Login Failed", "Incorrect Password. (Try 'admin')");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >

                <View style={styles.header}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>🚑</Text>
                    </View>
                    <Text style={styles.title}>SARU RESPONDER</Text>
                    <Text style={styles.subtitle}>Search and Rescue Unit Deployment</Text>
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.label}>Operation Headquarters (Barangay)</Text>
                    <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() => setBgyModalVisible(true)}
                    >
                        <Text style={barangay ? styles.inputText : styles.placeholder}>
                            {barangay || "Select Barangay HQ..."}
                        </Text>
                        <Text style={styles.dropdownIcon}>▼</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Select Your Team</Text>
                    <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() => setTeamModalVisible(true)}
                    >
                        <Text style={team ? styles.inputText : styles.placeholder}>
                            {team || "Select Team..."}
                        </Text>
                        <Text style={styles.dropdownIcon}>▼</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Responder ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex. SARU-2024-05"
                        placeholderTextColor="#A0A0A0"
                        value={responderID}
                        onChangeText={setResponderID}
                    />

                    <Text style={styles.label}>Team Mobile Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex. 09123456789"
                        placeholderTextColor="#A0A0A0"
                        keyboardType="phone-pad"
                        value={teamMobile}
                        onChangeText={setTeamMobile}
                    />

                    <Text style={styles.label}>Access Key</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••"
                        placeholderTextColor="#A0A0A0"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                        <Text style={styles.loginButtonText}>ACTIVATE DEPLOYMENT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.backLink}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>

            <Modal visible={teamModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Active Team</Text>
                        <FlatList
                            data={SARU_TEAMS}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setTeam(item);
                                        setTeamModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setTeamModalVisible(false)}
                        >
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={bgyModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Headquarters</Text>
                        <FlatList
                            data={BARANGAY_LIST}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setBarangay(item);
                                        setBgyModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setBgyModalVisible(false)}
                        >
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0D47A1' }, // Deep Blue Background
    keyboardView: { flex: 1, justifyContent: 'center', padding: 25 },

    header: { alignItems: 'center', marginBottom: 40 },
    logoCircle: {
        width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)'
    },
    logoText: { fontSize: 40 },
    title: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
    subtitle: { fontSize: 14, color: '#BBDEFB', marginTop: 5 },

    formContainer: { backgroundColor: '#FFF', borderRadius: 15, padding: 25, elevation: 5 },

    label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 10, textTransform: 'uppercase' },

    input: {
        backgroundColor: '#F5F5F5', borderRadius: 8, padding: 15,
        fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#EEE'
    },

    dropdown: {
        backgroundColor: '#F5F5F5', borderRadius: 8, padding: 15,
        flexDirection: 'row', justifyContent: 'space-between',
        borderWidth: 1, borderColor: '#EEE'
    },
    inputText: { fontSize: 16, color: '#333', fontWeight: '600' },
    placeholder: { fontSize: 16, color: '#999' },
    dropdownIcon: { color: '#666' },

    loginButton: {
        backgroundColor: '#1976D2', borderRadius: 8, padding: 18,
        alignItems: 'center', marginTop: 30, elevation: 3
    },
    loginButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

    backLink: { marginTop: 20, alignItems: 'center' },
    backText: { color: '#666', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 15, padding: 20, maxHeight: '60%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EEE' },
    modalItemText: { fontSize: 16, color: '#333' },
    closeButton: { marginTop: 15, alignItems: 'center', padding: 10 },
    closeText: { color: '#1976D2', fontWeight: 'bold' }
});
