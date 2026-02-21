# TBA-NAGARESCUE

A mobile emergency alert application built with React Native (Expo) that connects citizens with their local Barangay for rapid emergency response.

## Overview

NAGARESCUE allows citizens to send emergency SOS alerts directly to their Barangay. The app supports multiple user roles — Citizens, Barangay Officials, and SARU (Search and Rescue Unit) — each with their own dedicated interface and dashboard.

## Features

- SOS emergency alerts with GPS location
- SMS notification to Barangay officials
- Role-based access: Citizen, Barangay, and SARU
- Real-time updates via Firebase
- Citizen registration and profile management
- Audio siren alert on incoming emergencies

## Tech Stack

- **React Native** with **Expo** (~SDK 54)
- **Firebase** (Firestore, Auth)
- **React Navigation** (Stack + Bottom Tabs)
- **Expo Location** for GPS
- **Expo Notifications** for push alerts
- **React Native Get SMS Android** for SMS handling

## Project Structure

```
Barangay_Level/
└── Mobile/
    ├── App.js
    ├── app.json
    ├── src/
    │   ├── firebaseConfig.js
    │   ├── context/
    │   │   └── UserContext.js
    │   ├── screens/
    │   │   ├── LandingScreen.js
    │   │   ├── CitizenLoginScreen.js
    │   │   ├── CitizenRegisterScreen.js
    │   │   ├── CitizenHomeScreen.js
    │   │   ├── CitizenProfileScreen.js
    │   │   ├── BarangayLoginScreen.js
    │   │   ├── BarangayDashboardScreen.js
    │   │   ├── SaruLoginScreen.js
    │   │   ├── SaruDashboardScreen.js
    │   │   └── SetupScreen.js
    │   └── utils/
    │       └── payload.js
    ├── components/
    └── constants/
```

## Getting Started

### Prerequisites

- Node.js v18+
- Android Studio (for Android emulator) or a physical Android device
- Expo CLI

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

> **Note:** `node_modules` is not included in the repository. Always run `npm install` before running the app.

## User Roles

| Role | Description |
|------|-------------|
| **Citizen** | Registers, logs in, and sends SOS alerts with location |
| **Barangay** | Receives and manages incoming emergency alerts |
| **SARU** | Search and Rescue Unit; responds to dispatched emergencies |

## License

This project is for academic/local government use.
