import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import LoginScreen from '../src/screens/LoginScreen';

export default function Login() {
  const router = useRouter();
  const { jwt } = useAuth();

  // Ce useEffect est la clé : on ne navigue QUE si le jwt est bien dans le contexte global
  useEffect(() => {
    if (jwt) {
      router.replace('/');
    }
  }, [jwt, router]);

  // Plus de navigation manuelle forcée ici
  return <LoginScreen onLoggedIn={() => {}} />;
}