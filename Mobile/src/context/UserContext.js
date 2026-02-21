import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useEffect, useState } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // We rename the internal state setter to 'setUserState' to avoid confusion
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on startup
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("@user_profile");
      if (storedUser) {
        setUserState(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to load user", e);
    } finally {
      setLoading(false);
    }
  };

  // This function handles both State and AsyncStorage
  const saveUser = async (userData) => {
    try {
      if (userData) {
        // Login: Save to storage
        await AsyncStorage.setItem("@user_profile", JSON.stringify(userData));
        setUserState(userData);
      } else {
        // Logout: Clear storage
        await AsyncStorage.removeItem("@user_profile");
        setUserState(null);
      }
    } catch (e) {
      console.error("Failed to save user", e);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        // We expose 'saveUser' as 'setUser' so your Login/Register screens work perfectly
        setUser: saveUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
