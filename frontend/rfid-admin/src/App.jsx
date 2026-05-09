import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Users from './components/Users';
import History from './components/History';
import Settings from './components/Settings';
import Layout from './components/Layout';

export const AuthContext = createContext();
export const SocketContext = createContext();

const backendUrl = `http://${window.location.hostname}:5000`;
const API_URL = `${backendUrl}/api`;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(backendUrl);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, API_URL }}>
      <SocketContext.Provider value={socket}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
            
            <Route path="/" element={token ? <Layout /> : <Navigate to="/login" />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="history" element={<History />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;