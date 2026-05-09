# RFID & Fingerprint Access Control System 🚪🔐

![System Interface](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue)

A modern, comprehensive access control system that combines ESP32 hardware (RFID and Fingerprint) with a real-time web administration dashboard.

## 🌟 Overview

This project provides an end-to-end access control solution. It features an ESP32-based hardware client that scans RFID cards and fingerprints, and communicates over Wi-Fi to a Flask backend. The backend manages users, logs, and time-based scheduling rules. A React frontend provides administrators with a beautiful, real-time interface to monitor access, manage users, and configure the system.

## ✨ Key Features

### Hardware (ESP32)
*   **Dual Authentication:** Supports both MFRC522 RFID cards and Adafruit Fingerprint sensors.
*   **Real-Time Validation:** Sends scanned IDs to the backend over Wi-Fi and awaits authorization.
*   **Visual & Audio Feedback:** Features a 16x2 I2C LCD screen (with French language support), status LEDs (Blue for success, Red for failure), and a buzzer for sound alerts.
*   **Dynamic Enrollment:** Supports over-the-air enrollment modes to easily add new cards and fingerprints without hardcoding.
*   **Physical Control:** Drives a servo motor to physically lock/unlock a door upon successful authentication.

### Backend (Flask & SQLite)
*   **RESTful API:** Manages users, logs, and system configurations.
*   **Real-time Communication:** Uses `Flask-SocketIO` to instantly push scanned IDs, logs, and mode changes to the frontend.
*   **Time-Based Access:** Allows configuring specific hours for entry and exit. Access is denied if scanned outside of these hours.
*   **JWT Security:** Secures admin endpoints using JSON Web Tokens.
*   **Local Database:** Uses SQLite to store users, historical logs, and system configuration.
*   **CSV Export:** Allows exporting historical access logs.

### Frontend (React & Vite)
*   **Modern UI/UX:** Built with React, TailwindCSS, and Framer Motion for a sleek, responsive design.
*   **Real-Time Dashboard:** Displays live entry/exit logs and daily statistics using `socket.io-client`.
*   **Analytics:** Visualizes access trends using Recharts.
*   **User Management:** Interface to add, view, and delete authorized users.
*   **Settings Panel:** Easy configuration of allowed entry/exit time blocks.

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Microcontroller** | ESP32 |
| **Sensors** | MFRC522 (RFID), Adafruit Fingerprint |
| **Backend** | Python, Flask, Flask-SocketIO, SQLite, PyJWT |
| **Frontend** | React 18, Vite, TailwindCSS, Recharts, Framer Motion |

## 📂 Project Structure

```text
├── app.py                      # Main Flask Backend application
├── rfid_system.db              # SQLite Database (generated automatically)
├── bab_project/                # ESP32 C++ Code
│   └── bab_project.ino         # Main Arduino sketch for ESP32
└── frontend/
    └── rfid-admin/             # React Frontend application
        ├── src/                # React components and assets
        ├── package.json        # Node.js dependencies
        └── tailwind.config.js  # Tailwind CSS configuration
```

## 🚀 Installation & Setup

### 1. Backend Setup (Python)

1. Ensure Python 3.8+ is installed.
2. Create and activate a virtual environment:
   ```bash
   python -m venv env
   # On Windows
   env\Scripts\activate
   # On Mac/Linux
   source env/bin/activate
   ```
3. Install dependencies:
   *(Note: ensure you have a `requirements.txt` or install manually)*
   ```bash
   pip install Flask Flask-Cors Flask-SocketIO PyJWT
   ```
4. Run the server (runs on port 5000 by default):
   ```bash
   python app.py
   ```

### 2. Frontend Setup (React/Node)

1. Ensure Node.js is installed.
2. Navigate to the frontend directory:
   ```bash
   cd frontend/rfid-admin
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Hardware Setup (ESP32)

1. Open `bab_project/bab_project.ino` in the Arduino IDE.
2. Update the Wi-Fi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Update the IP address of the machine running the Flask server:
   ```cpp
   String IP_FLASK = "192.168.X.X"; // Your computer's local IP
   ```
4. Flash the code to your ESP32.

## 🔒 Default Credentials

- **Admin Username:** `admin`
- **Admin Password:** `admin123`
*(It is highly recommended to change these in production.)*

## 🤝 Contributing
Contributions are welcome. Please open an issue or submit a pull request if you want to improve the system.

## 📝 License
This project is open-source and available under the MIT License.
