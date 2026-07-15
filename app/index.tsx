import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { jwt, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (jwt) {
        // Rediriger vers les tabs si authentifié
        router.replace('/(tabs)/accueil');
      } else {
        // Rediriger vers login si non authentifié
        router.replace('/login');
      }
    }
  }, [jwt, isLoading, router]);

  return null;
}
