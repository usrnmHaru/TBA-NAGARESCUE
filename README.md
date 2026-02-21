# NAGARESCUE — Naga City Emergency Response System

A mobile emergency response application for **Naga City, Philippines** built with React Native (Expo). It connects citizens directly to their Barangay Command Center via SMS-based SOS alerts — no internet required for emergencies.

---

## How It Works

The entire emergency flow runs over **SMS**, making it resilient even without mobile data:

1. **Citizen** presses the SOS button → app sends an SMS to the Barangay hotline number
2. **Barangay Command Center** receives the SMS on their device → siren plays + alert appears on dashboard → dispatches a SARU team via SMS
3. **SARU Responder** receives the dispatch SMS → accepts or declines → sends status updates back to HQ via SMS
4. **Barangay** replies to the citizen (e.g. `DISPATCHED`, `ON THE WAY`, `RESOLVED`) → citizen's UI updates automatically

Firebase is only used for citizen account registration, login, and profile management. The alert pipeline is fully offline.

---

## Features

### Citizen
- Register an account (stored in Firebase Realtime Database with SHA-256 hashed passwords)
- Log in and persist session via AsyncStorage
- One-tap SOS button — sends formatted SMS to the correct Barangay hotline
- Urgency level auto-calculated from barangay flood risk zone and household conditions (PWD, Senior, etc.)
- Live status tracking via incoming SMS replies (`WAITING` → `ON THE WAY` → `RESOLVED`)
- Household profile management: add/edit family members with name, age, gender, condition, and relationship

### Barangay Command Center
- Receive SOS alerts via SMS listener (no internet needed)
- Audio siren + push notification on new incoming alert
- Dashboard tabs: **INCOMING**, **DISPATCHED**, **HISTORY**
- Filter alerts by urgency level (HIGH / MEDIUM / LOW)
- Dispatch SARU teams by sending a structured `SARU DISPATCH:` SMS
- View alert details: citizen name, location, barangay, zone, urgency

### SARU Responder
- Log in with team, barangay HQ, responder ID, and mobile number
- Auto-sends a check-in SMS to Barangay HQ on login (dynamic contact registration)
- Receive dispatch missions via SMS listener
- Accept or decline missions with SMS status reply back to HQ
- Dashboard tabs: **REQUESTS**, **ACTIVE**, **HISTORY**

---

## Covered Barangays

All 27 Barangays of Naga City are supported:

Abella, Bagumbayan Norte, Bagumbayan Sur, Balatas, Calauag, Cararayan, Carolina, Concepcion Grande, Concepcion Pequeña, Dayangdang, Del Rosario, Dinaga, Igualdad, Lerma, Liboton, Mabolo, Pacol, Panicuason, Peñafrancia, Sabang, San Felipe, San Francisco, San Isidro, Santa Cruz, Tabuco, Tinago, Triangulo

---

## Tech Stack

| Category | Library |
|---|---|
| Framework | React Native + Expo (~SDK 54) |
| Navigation | React Navigation (Native Stack) |
| Database | Firebase Realtime Database |
| Session | AsyncStorage |
| SMS Send | react-native-get-sms-android |
| SMS Listen | react-native-android-sms-listener |
| Location | expo-location |
| Audio | expo-av |
| Notifications | expo-notifications |

---

## Project Structure

```
Barangay_Level/
└── Mobile/
    ├── App.js                  # Root navigator + UserProvider
    ├── app.json                # Expo config (permissions, plugins)
    ├── src/
    │   ├── firebaseConfig.js   # Firebase Realtime DB init
    │   ├── context/
    │   │   └── UserContext.js  # Global auth state + AsyncStorage persistence
    │   ├── screens/
    │   │   ├── LandingScreen.js          # Entry point — role selection
    │   │   ├── CitizenLoginScreen.js     # Firebase login (SHA-256 hashed)
    │   │   ├── CitizenRegisterScreen.js  # Firebase registration
    │   │   ├── CitizenHomeScreen.js      # SOS button + urgency + SMS flow
    │   │   ├── CitizenProfileScreen.js   # Household profile + member management
    │   │   ├── BarangayLoginScreen.js    # Barangay official login (mock: "admin")
    │   │   ├── BarangayDashboardScreen.js# Command center — alerts + dispatch
    │   │   ├── SaruLoginScreen.js        # SARU responder login (mock: "admin")
    │   │   └── SaruDashboardScreen.js    # SARU missions + SMS accept/decline
    │   └── utils/
    ├── components/             # Shared UI components
    └── constants/
        └── theme.ts            # App theme/colors
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Android Studio with an emulator, or a physical Android device with USB debugging enabled
- Java Development Kit (JDK) 17+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/usrnmHaru/TBA-NAGARESCUE.git
   cd TBA-NAGARESCUE/Mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run on Android:
   ```bash
   npx expo run:android
   ```

> `node_modules` is not included in the repo. You **must** run `npm install` before running the app, otherwise you will get a `Failed to resolve plugin for module "expo-router"` error.

---

## Authentication

| Role | Auth Method | Credentials |
|---|---|---|
| Citizen | Firebase Realtime DB + SHA-256 hashed password | Register via app |
| Barangay Official | Mock (prototype) | Password: `admin` |
| SARU Responder | Mock (prototype) | Password: `admin` |

---

## Urgency Calculation

Urgency is automatically assigned when a citizen sends SOS based on two factors:

| Factor | Effect |
|---|---|
| Barangay flood risk zone (`HIGH`/`MEDIUM`/`LOW`) | Sets base urgency level |
| 2+ PWD household members in a LOW-risk zone | Bumps urgency to `MEDIUM` |

High-risk barangays include: **Sabang**, **Dinaga**, **Igualdad**.

---

## License

This project is developed for academic and local government emergency response purposes.

